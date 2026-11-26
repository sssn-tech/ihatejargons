import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const envFile = join(homedir(), ".config/minicode/siliconflow.env");
import { translationMessages, jargonLeftIn, plainIssues, plainBudget } from "./prompt.js";
import { recommendedModel } from "./models.js";
import { registerGlossary } from "./glossary.js";
export const defaults = { provider: "siliconflow", localModel: "", cloudModel: recommendedModel };

function settingsOf(input) {
  const { provider, localModel, cloudModel = recommendedModel } = input ?? {};
  if (typeof cloudModel !== "string" || !/^[\w./-]{1,160}$/.test(cloudModel) || !["siliconflow", "ollama"].includes(provider) || typeof localModel !== "string" ||
      localModel.length > 200 || (provider === "ollama" && !localModel.trim())) {
    throw Error("请选择翻译服务，填写所需模型。");
  }
  return { provider, localModel: localModel.trim(), cloudModel };
}

async function siliconKey() {
  let env;
  try { env = await readFile(envFile, "utf8"); }
  catch { throw Error("无法读取 ~/.config/minicode/siliconflow.env。"); }
  const m = env.match(/^\s*(?:export\s+)?SILICONFLOW_API_KEY\s*=\s*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s#]+))\s*(?:#.*)?$/m);
  const key = m && (m[1] || m[2] || m[3]);
  if (!key) throw Error("密钥文件缺少 SILICONFLOW_API_KEY。");
  return key;
}

// The model can repeat a field in its explanation. Keep the native inline element
// once and render later mentions as its visible label. Links and code blocks stay opaque.
function restoreInlineLabels(output, terms = []) {
  for (const {token,label} of terms) {
    if (!/^⟦T\d+⟧$/.test(token) || typeof label!=="string" || !label) continue;
    if (output.includes(token)) {
      let seen = false;
      output = output.replaceAll(token, () => {
        if (seen) return label;
        seen = true;
        return token;
      });
    } else if (/^[A-Za-z]+(?:_[A-Za-z]+)+$/.test(label)) {
      const field = new RegExp("(?<![\\w])"+label+"(?![\\w])","g");
      if ([...output.matchAll(field)].length===1) output = output.replace(field,token);
    }
  }
  return output;
}

export async function translate(task, config, signal) {
  const { kind, target, question, history, mode = "light" } = task;
  if (!["light","deep"].includes(mode)) throw Error("翻译模式无效。");
  if (!["report","summary"].includes(kind) || typeof target !== "string" || !target.trim()) throw Error("缺少翻译目标。");
  if (target.length > 96000) throw Error("整篇汇报超过 96000 字符，已保留原文。");
  if (typeof question !== "string" || question.length > 6000 || !Array.isArray(history) ||
      history.length > 12 || history.some(x => !["user","assistant"].includes(x?.role) || typeof x.text !== "string") ||
      history.reduce((n,x)=>n+x.text.length,0)>8000) throw Error("背景格式不正确。");
  const messages = translationMessages(task);
  const deadline = AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])]);
  const request = async history => restoreInlineLabels(await modelRequest(config,history,deadline),task.terms);
  const draft = await request(messages);
  const markers = value => (value.match(/⟦T\d+⟧/g) || []).sort().join(" ");
  const required = markers(target);
  const valid = output => markers(output)===required;
  const issues = output => mode==="deep" ? plainIssues(output,kind,target) : jargonLeftIn(output);
  const remaining = issues(draft);
  const fixMarkers = !valid(draft);
  const edit = mode==="deep" ? remaining.length>0 : kind==="report" && remaining.length>=2;
  if (!fixMarkers && !edit) return draft;

  // One revision at most. Only a structurally usable result may reach the cache.
  const instruction = fixMarkers
    ? "上一稿没有保留排版标记。请对照 target 找回每个标记对应的原句，把原样标记放回译文相应位置。已有文字解释可以保留，移除重复标签。修订后必须恰好含有以下标记各一次："+(required || "（无标记）")
    : (mode==="deep" ? "像同事发消息一样，先说决定，用一两句说清原因，最后说下一步。删掉重复事实、表格和术语，只保留必要标记，处理以下问题：" : "再编辑一遍整篇译文，把这些词换成普通人能理解的具体动作和结果：")+remaining.join("、");
  try {
    const revision = mode==="deep" ? [
      {role:"system",content:"为一个第一次听说此事的人写短消息。改写已有草稿，只留决定、一个具体原因、恢复条件。每段最多两句，每件事只说一次。保留关键数字及其含义（例如通过数、总数和失败条件）。段间换行。删掉汇报标签、表格、比喻、解释性括号。不要复述输入里的专业说法。根据语境换词，例如旧版消费者→处理消息的旧程序，投递→发送，回放→再发一次，验收矩阵→各种情况的测试，金丝雀观察窗口→先让少量用户试用，门禁→必须满足的条件，解除阻断→什么时候能继续。能直接说清楚动作就省掉术语名称。不要编造后果。排版标记会还原成原字，原样保留且各用一次，不重复写对应的字段或数值。只输出正文。"},
      {role:"user",content:JSON.stringify({draft, ...(fixMarkers ? {source:target} : {}),
        requiredMarkers:required,labels:task.terms,replaceOrCut:remaining,
        maxCharacters:plainBudget(kind,target)})}
    ] : [...messages,{role:"assistant",content:draft},{role:"user",content:
      instruction+"。保留所有事实和原文排版，只输出完整修订稿。"}];
    const revised = await request(revision);
    const tableLines = value => value.split("\n").filter(line=>line.trim().startsWith("|")).length;
    const layoutOK = mode==="deep" ? tableLines(revised)===0 : tableLines(target)===tableLines(revised);
    if (valid(revised) && layoutOK &&
        (fixMarkers || issues(revised).length<remaining.length)) return revised;
  } catch (error) {
    if (signal?.aborted || fixMarkers) throw error;
  }
  if (fixMarkers) throw Error("模型遗漏了原文排版标记，请重试。");
  return draft;
}

async function modelRequest(config,messages,signal) {
  const local = config.provider === "ollama";
  const url = local ? "http://127.0.0.1:11434/v1/chat/completions" :
    "https://api.siliconflow.cn/v1/chat/completions";
  const headers = { "Content-Type": "application/json" };
  if (!local) headers.Authorization = "Bearer " + await siliconKey();
  const model = local ? config.localModel : config.cloudModel;

  let response;
  try {
    response = await fetch(url, {
      method: "POST", headers, redirect: "error",
      signal,
      body: JSON.stringify({
        model, stream: false,
        messages,
        ...(!local && /Qwen3|DeepSeek-V4/.test(model) ? {enable_thinking:false} : {})
      })
    });
  } catch { throw Error("翻译服务连接失败或超时。"); }
  if (!response.ok) throw Error("翻译服务返回 HTTP " + response.status + "，请检查模型、密钥或配额。");
  const body = await response.json();
  const choice = body.choices?.[0];
  if (!choice || choice.finish_reason === "length") throw Error("翻译服务没有返回完整结果。");
  const result = choice.message?.content;
  if (typeof result !== "string" || !result.trim()) throw Error("模型返回了空译文。");
  return result.trim();
}

export async function activate({ rpc, dataDirectory, signal }) {
  const path = join(dataDirectory, "settings.json");
  let settings = { ...defaults };
  try { settings = settingsOf(JSON.parse(await readFile(path, "utf8"))); }
  catch (error) { if (error.code !== "ENOENT") throw Error("无法读取 ihatejargons 设置。"); }
  let writes = Promise.resolve();
  await registerGlossary({rpc,dataDirectory}, () => settings, (config,messages) =>
    modelRequest(config,messages,AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])])), defaults);
  rpc.handle("settings", () => settings);
  rpc.handle("save-settings", input => {
    const next = settingsOf(input);
    const save = writes.then(async () => {
      await mkdir(dataDirectory, { recursive: true });
      const temp = path + "." + randomUUID();
      await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
      await rename(temp, path);
      settings = next;
      rpc.emit("settings-changed", settings);
      return settings;
    });
    writes = save.catch(() => {});
    return save;
  });
  rpc.handle("translate", ({ task, provider, localModel, cloudModel }) => {
    if (provider !== settings.provider || localModel !== settings.localModel || cloudModel !== settings.cloudModel) throw Error("翻译设置已更改。");
    return translate(task, settings, signal);
  });
}
