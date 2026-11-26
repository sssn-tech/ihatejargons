import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const envFile = join(homedir(), ".config/minicode/siliconflow.env");
import { translationMessages, jargonLeftIn, plainIssues, plainBudget } from "./prompt.js";
import { registerGlossary } from "./glossary.js";
import { openPlans } from "./chat-plans.js";
import { readRecent } from "./recent-history.js";
import { defaults, settingsOf } from "./preferences.js";
import { builtInLevels, levelSignature } from "./levels.js";
import { buildIdentity, digest, openCache } from "./translation-cache.js";
export { defaults };

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
  const level = (config.levels || builtInLevels).find(item=>item.id===mode);
  if (!level) throw Error("翻译模式无效。");
  const builtin = builtInLevels.find(item=>item.id===mode);
  const standard = builtin && ["format","prompt","layout"].every(k=>builtin[k]===level[k]);
  if (!["report","summary"].includes(kind) || typeof target !== "string" || !target.trim()) throw Error("缺少翻译目标。");
  if (target.length > 96000) throw Error("整篇汇报超过 96000 字符，已保留原文。");
  if (typeof question !== "string" || question.length > 6000 || !Array.isArray(history) ||
      history.length > 12 || history.some(x => !["user","assistant"].includes(x?.role) || typeof x.text !== "string") ||
      history.reduce((n,x)=>n+x.text.length,0)>8000) throw Error("背景格式不正确。");
  const messages = translationMessages(task,level);
  const deadline = AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])]);
  const request = async history => restoreInlineLabels(await modelRequest(config,history,deadline),task.terms);
  const draft = await request(messages);
  const markers = value => (value.match(/⟦T\d+⟧/g) || []).sort().join(" ");
  const required = markers(target);
  const valid = output => markers(output)===required;
  const issues = output => mode==="deep" ? plainIssues(output,kind,target) : jargonLeftIn(output);
  const remaining = issues(draft);
  const fixMarkers = !valid(draft);
  const edit = standard && (mode==="deep" ? remaining.length>0 : kind==="report" && remaining.length>=2);
  if (!fixMarkers && !edit) return draft;

  // One revision at most. Only a structurally usable result may reach the cache.
  const instruction = fixMarkers
    ? "上一稿没有保留排版标记。请对照 target 找回每个标记对应的原句，把原样标记放回译文相应位置。已有文字解释可以保留，移除重复标签。修订后必须恰好含有以下标记各一次："+(required || "（无标记）")
    : (mode==="deep" ? "像同事发消息一样，先说决定，用一两句说清原因，最后说下一步。删掉重复事实、表格和术语，只保留必要标记，处理以下问题：" : "再编辑一遍整篇译文，把这些词换成普通人能理解的具体动作和结果：")+remaining.join("、");
  try {
    const revision = standard && mode==="deep" ? [
      {role:"system",content:"为一个第一次听说此事的人写短消息。改写已有草稿，只留决定、一个具体原因、恢复条件。每段最多两句，每件事只说一次。保留关键数字及其含义（例如通过数、总数和失败条件）。段间换行。删掉汇报标签、表格、比喻、解释性括号。不要复述输入里的专业说法。根据语境换词，例如旧版消费者→处理消息的旧程序，投递→发送，回放→再发一次，验收矩阵→各种情况的测试，金丝雀观察窗口→先让少量用户试用，门禁→必须满足的条件，解除阻断→什么时候能继续。能直接说清楚动作就省掉术语名称。不要编造后果。排版标记会还原成原字，原样保留且各用一次，不重复写对应的字段或数值。只输出正文。"},
      {role:"user",content:JSON.stringify({draft, ...(fixMarkers ? {source:target} : {}),
        requiredMarkers:required,labels:task.terms,replaceOrCut:remaining,
        maxCharacters:plainBudget(kind,target)})}
    ] : [...messages,{role:"assistant",content:draft},{role:"user",content:
      instruction+"。遵循本等级的提示词和格式，只输出完整修订稿。"}];
    const revised = await request(revision);
    const tableLines = value => value.split("\n").filter(line=>line.trim().startsWith("|")).length;
    const layoutOK = level.layout==="free" || tableLines(target)===tableLines(revised);
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

export async function activate({ rpc, packageDirectory, dataDirectory, signal }) {
  const path = join(dataDirectory, "settings.json");
  let settings = { ...defaults };
  try { settings = settingsOf(JSON.parse(await readFile(path, "utf8"))); }
  catch (error) { if (error.code !== "ENOENT") throw Error("无法读取 ihatejargons 设置。"); }
  const build = await buildIdentity(packageDirectory);
  const cache = await openCache(dataDirectory,build,settings.cacheMB);
  const plans=await openPlans(dataDirectory,build);
  const recent=new Map(), manual=new Map(), attempted=new Set(), errors=new Map(), active=new Map();
  let warmingChat=null;
  const owner=id=>digest(String(id));
  const notify=()=>rpc.emit("chat-state-change",{});
  function settingsKey() {
    return digest(JSON.stringify([settings.provider,settings.cloudModel,settings.localModel,settings.levels.filter(p=>settings.warmModes.includes(p.id) || (!settings.warmModes.length && p.id===settings.defaultMode)).map(levelSignature),settings.recentBlocks]));
  }
  let warmMessage="", warmTimer, warming = false, foreground = 0, closed = false;
  function identify(task, config=settings, chat="") {
    const level = config.levels.find(p=>p.id===task.mode);
    if (!level) throw Error("翻译等级已更改。");
    return owner(chat)+"-"+digest(JSON.stringify([config.provider,config.provider==="ollama"?config.localModel:config.cloudModel,
      level.id,level.prompt,level.format,level.layout,task.kind,task.target,task.question,task.history.map(v=>[v.role,v.text]),(task.terms || []).map(v=>[v.token,v.label])]));
  }
  function scheduleWarm() {
    if (closed || warmTimer || warming || foreground || !settings.cacheMB) return;
    warmTimer=setTimeout(()=>{warmTimer=null;void warmOne();},450);
  }
  async function warmOne() {
    if (closed || foreground || warming || !settings.cacheMB) return;
    const queues=[...manual.entries(),...Array.from(recent.entries()).reverse()];
    for (const [chat,jobs] of queues) {
      for (const job of jobs) {
        if (attempted.has(job.key) || (!job.force && cache.has(job.key))) continue;
        attempted.add(job.key); warming=true; warmingChat=chat; notify();
        try {
          const result=await cache.run(job.key,()=>translate(job.task,job.config,signal),job.force);
          if(job.force && manual.get(chat)===jobs && cache.has(job.key)) rpc.emit("chat-regenerated",{chat,task:job.task,output:result});
        }
        catch(e) { errors.set(chat,e.message);warmMessage=e.message; }
        finally { warming=false;warmingChat=null;notify();scheduleWarm(); }
        return;
      }
      if(manual.get(chat)===jobs) manual.delete(chat);
    }
  }
  function trimRecent() {
    while(recent.size>settings.recentChats) recent.delete(recent.keys().next().value);
    const keep=new Set([...manual.values(),...recent.values()].flat().map(j=>j.key));
    for(const key of attempted) if(!keep.has(key)) attempted.delete(key);
  }
  async function enqueue({chat,tasks,historical=false,action=null}) {
    if (typeof chat!=="string" || !chat || !Array.isArray(tasks) || tasks.length>30) throw Error("预译任务格式不正确。");
    const ownerId=owner(chat);
    if (!action && (plans.get(ownerId)?.suppressed || (historical && !settings.includeHistory) || !settings.recentChats || !settings.warmModes.length)) return false;
    if (!settings.cacheMB) {if(action) throw Error("请先在设置中启用本地缓存。");return false;}
    if(!tasks.length) {if(action) throw Error("此聊天尚无已完成的可译回复。");return false;}
    const modes=settings.warmModes.length?settings.warmModes:[settings.defaultMode];
    const jobs=tasks.slice(-settings.recentBlocks).reverse().flatMap(source=>modes.map(mode=>{
      const task={...source,mode};return {task,config:settings,key:identify(task,settings,chat),force:action==="regenerate"};
    }));
    if (!action && manual.has(chat)) return false;
    if (action) {
      for (const j of jobs) attempted.delete(j.key);
      errors.delete(chat);manual.set(chat,jobs);
    } else {recent.delete(chat);recent.set(chat,jobs);}
    trimRecent();
    await plans.set(ownerId,{keys:[...new Set(jobs.map(j=>j.key))],settings:settingsKey()});
    notify();scheduleWarm();return true;
  }
  rpc.handle("recent-chat",input=>enqueue(input));
  rpc.handle("chat-queue",input=>enqueue({...input,action:input.action==="regenerate"?"regenerate":"warm"}));
  rpc.handle("chat-history",async({chat})=>{
    const rows=await readRecent(1,{},undefined,chat);
    if(!rows.length) throw Error("此聊天的记录尚未同步到本机。可以打开聊天后再试。");
    return rows[0].items;
  });
  rpc.handle("chat-states",({chats})=>{
    const counts=cache.counts(), result={};
    const stamp=settingsKey();
    for(const chat of chats) {
      const id=owner(chat), plan=plans.get(id);
      const keys=plan?.settings===stamp ? plan.keys || [] : [];
      const done=keys.filter(k=>cache.has(k)).length, entries=counts.get(id)||0;
      const queued=(manual.get(chat)||recent.get(chat)||[]).some(j=>!attempted.has(j.key) && (j.force || !cache.has(j.key)));
      const state=warmingChat===chat || active.has(chat) ? "running" : queued ? "queued" :
        keys.length && done===keys.length ? "done" : errors.has(chat) ? "error" : entries ? "partial" : "untouched";
      result[chat]={state,done,total:keys.length,entries,error:errors.get(chat)||""};
    }
    return result;
  });
  rpc.handle("chat-delete",async({chat})=>{
    recent.delete(chat);manual.delete(chat);errors.delete(chat);trimRecent();
    const saved=plans.set(owner(chat),{suppressed:true});
    await cache.removeChat(owner(chat)); await saved;
    rpc.emit("chat-cache-deleted",{chat});notify();return true;
  });
  rpc.handle("history-recent",({known})=>settings.includeHistory && settings.cacheMB && settings.warmModes.length
    ? readRecent(settings.recentChats,known) : []);
  rpc.handle("recent-forget",({chats})=>{for(const id of chats) recent.delete(id);trimRecent();return true;});
  rpc.handle("prewarm",()=>{warmMessage="";attempted.clear();rpc.emit("prewarm-resume",{});scheduleWarm();return true;});
  rpc.handle("history-error",({message})=>{warmMessage=String(message).slice(0,300);return true;});
  rpc.handle("cache-stats",()=>({...cache.stats(),recent:recent.size,warming,message:warmMessage}));
  rpc.handle("cache-clear",async ()=>{
    clearTimeout(warmTimer); warmTimer=null; warmMessage=""; recent.clear(); manual.clear(); errors.clear(); attempted.clear();
    const stats=await cache.clear();
    await plans.clear();rpc.emit("cache-cleared",{});notify(); return stats;
  });
  rpc.handle("cache-lookup",({task,chat})=>cache.get(identify(task,settings,chat)));
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
      await cache.resize(next.cacheMB);
      settings = next;
      recent.clear();manual.clear();attempted.clear();errors.clear();notify();
      trimRecent(); scheduleWarm();
      rpc.emit("settings-changed", settings);
      return settings;
    });
    writes = save.catch(() => {});
    return save;
  });
  rpc.handle("translate", async ({ task, provider, localModel, cloudModel, chat="", force=false, levelStamp }) => {
    if (provider !== settings.provider || localModel !== settings.localModel || cloudModel !== settings.cloudModel) throw Error("翻译设置已更改。");
    const config=settings, key=identify(task,config,chat);
    const level=config.levels.find(p=>p.id===task.mode);
    if (levelStamp && levelSignature(level)!==levelStamp) throw Error("翻译等级已更改。");
    foreground++;active.set(chat,(active.get(chat)||0)+1);notify();
    try {
      const output=await cache.run(key,()=>translate(task,config,signal),force===true);
      if(force && cache.has(key)) rpc.emit("chat-regenerated",{chat,task,output});
      return output;
    }
    finally { foreground--; const n=active.get(chat)-1;if(n) active.set(chat,n);else active.delete(chat);notify();scheduleWarm(); }
  });
  return () => { closed=true; clearTimeout(warmTimer); recent.clear(); attempted.clear(); };
}
