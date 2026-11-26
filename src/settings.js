import { cloudModels } from "./models.js";
import { defaults, settingsOf } from "./preferences.js";
import { builtInLevels } from "./levels.js";
import { logo } from "./logo.js";

const keyPage = "https://cloud.siliconflow.cn/account/ak";
const keySources = {
  plugin: "已保存在本插件中",
  env: "读取自环境变量 SILICONFLOW_API_KEY",
  file: "读取自 ~/.config/minicode/siliconflow.env",
  none: "还没有设置密钥"
};
const numbers = ["cacheMB", "recentBlocks", "textConcurrency", "termConcurrency"];

const template = `
<header class="ihj-head">
  <span class="ihj-mark">${logo(26)}</span>
  <div><h2>ihatejargons</h2><p>把 Codex 的回复讲成人话</p></div>
</header>

<section class="ihj-card">
  <div class="ihj-card-head"><h3>翻译服务</h3><p>译文和术语注释由这里选的模型生成。</p></div>
  <div class="ihj-seg" role="radiogroup" aria-label="翻译服务">
    <label><input type="radio" name="provider" value="siliconflow"><span>硅基流动</span></label>
    <label><input type="radio" name="provider" value="ollama"><span>本机 Ollama</span></label>
  </div>
  <div class="ihj-stack" data-provider="siliconflow">
    <label class="ihj-field"><span>模型</span>
      <input name="cloudModel" maxlength="160" spellcheck="false" autocomplete="off">
      <small>可以从列表里选，也可以填硅基流动上的其他模型名。</small></label>
    <div class="ihj-field"><span>API 密钥</span>
      <p class="ihj-key"><i aria-hidden="true"></i><output class="ihj-key-status">正在读取…</output></p>
      <div class="ihj-inline">
        <input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="粘贴新的密钥" aria-label="新的 API 密钥">
        <button type="button" data-action="key-save">保存密钥</button>
        <button type="button" data-action="key-remove" hidden>移除</button>
      </div>
      <small>密钥只保存在本机插件目录，页面上不会再显示。<a href="${keyPage}" target="_blank" rel="noreferrer">去硅基流动获取密钥</a></small>
    </div>
  </div>
  <div class="ihj-stack" data-provider="ollama">
    <label class="ihj-field"><span>模型名</span>
      <input name="localModel" maxlength="200" spellcheck="false" autocomplete="off" placeholder="例如 qwen3:8b">
      <small>先在本机用 Ollama 下载好模型。插件连接 127.0.0.1:11434，正文不会离开这台电脑。</small></label>
  </div>
  <div class="ihj-inline">
    <button type="button" data-action="check">测试连接</button>
    <output class="ihj-check" aria-live="polite"></output>
  </div>
</section>

<section class="ihj-card">
  <div class="ihj-card-head"><h3>阅读档位</h3><p>每条回复上方的切换按钮。「原文注释」固定在最前；其余档位可以改名、改提示词、调整顺序。</p></div>
  <div class="ihj-levels">
    <div class="ihj-level-side">
      <ul class="ihj-level-list" role="listbox" aria-label="阅读档位"></ul>
      <button type="button" class="ihj-add" data-action="add">＋ 添加档位</button>
    </div>
    <div class="ihj-level-editor">
      <div class="ihj-grid">
        <label class="ihj-field"><span>按钮名称</span><input name="levelName" maxlength="32"></label>
        <label class="ihj-field"><span>排版</span><select name="layout">
          <option value="source">保留原文的表格和结构</option>
          <option value="free">可以重新组织段落和列表</option></select></label>
      </div>
      <label class="ihj-switch"><input type="checkbox" name="isDefault"><span>打开回复时默认显示这一档</span></label>
      <label class="ihj-switch"><input type="checkbox" name="isWarm"><span>后台预翻译这一档</span></label>
      <label class="ihj-field"><span>提示词</span><textarea name="prompt" rows="7" maxlength="12000"></textarea></label>
      <label class="ihj-field"><span>输出格式</span><textarea name="format" rows="2" maxlength="4000" placeholder="例如：先给结论，再用列表说明原因"></textarea></label>
      <div class="ihj-inline">
        <button type="button" data-action="up">↑ 上移</button>
        <button type="button" data-action="down">↓ 下移</button>
        <button type="button" data-action="reset">恢复内置提示词</button>
        <span class="ihj-spacer"></span>
        <button type="button" class="ihj-danger" data-action="remove">删除这一档</button>
      </div>
    </div>
  </div>
</section>

<section class="ihj-card">
  <div class="ihj-card-head"><h3>预翻译与缓存</h3><p>提前把最近的回复翻译好，打开聊天就能直接读。译文只缓存在本机。</p></div>
  <label class="ihj-switch"><input type="checkbox" name="warmOn"><span>自动预翻译最近的聊天</span></label>
  <div class="ihj-stack ihj-indent" data-when="warm">
    <div class="ihj-grid">
      <label class="ihj-field"><span>最近几个聊天</span><input name="recentChats" type="number" min="1" max="30"></label>
      <label class="ihj-field"><span>每个聊天最近几条回复</span><input name="recentBlocks" type="number" min="1" max="30"></label>
    </div>
    <label class="ihj-switch"><input type="checkbox" name="includeHistory"><span>也包括还没打开过的本机聊天</span></label>
    <small>预翻译会把这些回复和必要的上下文发给所选模型。使用硅基流动会产生调用费用。</small>
  </div>
  <p class="ihj-note" data-when="no-cache">缓存上限为 0 时不保存译文，自动预翻译也会停用。</p>
  <div class="ihj-storage">
    <div class="ihj-storage-row"><span class="ihj-meter">正在读取缓存…</span><span class="ihj-busy"></span></div>
    <progress max="1" value="0" aria-label="译文缓存占用"></progress>
    <div class="ihj-inline">
      <label class="ihj-field ihj-narrow"><span>缓存上限（MiB）</span><input name="cacheMB" type="number" min="0" max="2048"></label>
      <span class="ihj-spacer"></span>
      <button type="button" data-action="warm">立即预翻译</button>
      <button type="button" class="ihj-danger" data-action="clear">清空译文缓存</button>
    </div>
  </div>
</section>

<details class="ihj-card ihj-advanced">
  <summary><h3>高级</h3></summary>
  <div class="ihj-stack">
    <div class="ihj-grid">
      <label class="ihj-field"><span>正文同时翻译几条</span><input name="textConcurrency" type="number" min="1" max="16"></label>
      <label class="ihj-field"><span>术语注释同时请求几次</span><input name="termConcurrency" type="number" min="1" max="16"></label>
    </div>
    <small>数值越大越快，也越容易触发服务商限流。正在阅读的回复总是排在预翻译前面。</small>
    <p class="ihj-build"></p>
  </div>
</details>

<footer class="ihj-savebar">
  <output class="ihj-status" role="status"></output>
  <button type="button" data-action="revert" hidden>撤销修改</button>
  <button type="submit" class="ihj-primary">保存</button>
</footer>`;

export function mountSettings(container, node) {
  const form = document.createElement("form");
  form.className = "cxt-settings";
  form.noValidate = true;
  form.innerHTML = template;
  const f = form.elements;
  const $ = selector => form.querySelector(selector);
  const act = id => form.querySelector(`[data-action="${id}"]`);
  const status = $(".ihj-status"), list = $(".ihj-level-list"), save = $("[type=submit]");

  const models = document.createElement("datalist");
  models.id = "ihj-models-" + crypto.randomUUID();
  models.append(...cloudModels.map(id => new Option(id, id)));
  form.append(models);
  f.cloudModel.setAttribute("list", models.id);

  let saved, draft, selectedId, lastRecent = 3, saving = false, disposed = false, message = "";
  const dirty = () => Boolean(saved) && JSON.stringify(draft) !== JSON.stringify(saved);
  const level = () => draft.levels.find(item => item.id === selectedId);
  const builtin = item => builtInLevels.find(original => original.id === item.id);
  const edited = item => {
    const original = builtin(item);
    return Boolean(original) && ["prompt", "format", "layout"].some(key => original[key] !== item[key]);
  };

  function say(text) { message = text; renderDirty(); }

  function load(settings) {
    saved = structuredClone({ ...defaults, ...settings });
    draft = structuredClone(saved);
    if (!draft.levels.some(item => item.id === selectedId)) selectedId = draft.defaultMode;
    if (draft.recentChats) lastRecent = draft.recentChats;
    f.provider.value = draft.provider;
    f.cloudModel.value = draft.cloudModel;
    f.localModel.value = draft.localModel;
    for (const key of numbers) f[key].value = draft[key];
    f.recentChats.value = draft.recentChats || lastRecent;
    f.warmOn.checked = draft.recentChats > 0;
    f.includeHistory.checked = draft.includeHistory;
    renderProvider(); renderLevels(); renderWarm(); renderDirty();
  }

  function renderProvider() {
    for (const group of form.querySelectorAll("[data-provider]")) group.hidden = group.dataset.provider !== draft.provider;
    $(".ihj-check").textContent = "";
  }

  function renderList() {
    const fixed = document.createElement("li");
    fixed.className = "ihj-fixed";
    fixed.innerHTML = "<span>原文注释</span><small>固定 · 原文加术语注释</small>";
    const rows = draft.levels.map(item => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(item.id === selectedId));
      const name = document.createElement("span");
      name.textContent = item.name.trim() || "未命名";
      const tags = document.createElement("small");
      tags.textContent = [item.id === draft.defaultMode && "默认", draft.warmModes.includes(item.id) && "预翻译",
        edited(item) && "已修改", !builtin(item) && "自建"].filter(Boolean).join(" · ");
      button.append(name, tags);
      button.onclick = () => { selectedId = item.id; renderLevels(); };
      li.append(button);
      return li;
    });
    list.replaceChildren(fixed, ...rows);
  }

  function renderEditor() {
    const item = level(), index = draft.levels.indexOf(item);
    f.levelName.value = item.name;
    f.layout.value = item.layout;
    f.prompt.value = item.prompt;
    f.format.value = item.format;
    f.isDefault.checked = item.id === draft.defaultMode;
    f.isDefault.disabled = f.isDefault.checked;
    f.isWarm.checked = draft.warmModes.includes(item.id);
    f.isWarm.disabled = !draft.recentChats || !draft.cacheMB;
    act("up").disabled = index === 0;
    act("down").disabled = index === draft.levels.length - 1;
    act("remove").disabled = draft.levels.length === 1;
    act("add").disabled = draft.levels.length >= 16;
    act("reset").hidden = !edited(item);
  }

  function renderLevels() { renderList(); renderEditor(); }

  function renderWarm() {
    const cache = draft.cacheMB > 0;
    f.warmOn.disabled = !cache;
    for (const part of form.querySelectorAll('[data-when="warm"]')) part.hidden = !(cache && draft.recentChats > 0);
    $('[data-when="no-cache"]').hidden = cache;
    act("warm").disabled = !cache || !saved?.cacheMB;
    f.isWarm.disabled = !draft.recentChats || !cache;
  }

  function renderDirty() {
    const changed = dirty();
    save.disabled = !changed || saving;
    act("revert").hidden = !changed || saving;
    status.textContent = message || (changed ? "有未保存的修改" : "");
    status.dataset.tone = message ? "note" : changed ? "pending" : "";
  }

  form.addEventListener("input", event => {
    const target = event.target;
    if (!draft || !target.name || target.name === "apiKey") return;
    message = "";
    const item = level();
    switch (target.name) {
      case "provider": draft.provider = target.value; renderProvider(); break;
      case "cloudModel": case "localModel": draft[target.name] = target.value.trim(); $(".ihj-check").textContent = ""; break;
      case "recentChats":
        draft.recentChats = target.valueAsNumber;
        if (target.valueAsNumber > 0) lastRecent = target.valueAsNumber;
        break;
      case "warmOn":
        draft.recentChats = target.checked ? lastRecent : 0;
        f.recentChats.value = lastRecent;
        renderWarm(); renderLevels();
        break;
      case "includeHistory": draft.includeHistory = target.checked; break;
      case "levelName": item.name = target.value; renderList(); break;
      case "prompt": case "format": case "layout":
        item[target.name] = target.value;
        renderList();
        act("reset").hidden = !edited(item);
        break;
      case "isDefault": if (target.checked) draft.defaultMode = item.id; renderLevels(); break;
      case "isWarm":
        draft.warmModes = draft.warmModes.filter(id => id !== item.id);
        if (target.checked) draft.warmModes.push(item.id);
        renderList();
        break;
      default:
        if (numbers.includes(target.name)) draft[target.name] = target.valueAsNumber;
        if (target.name === "cacheMB") { renderWarm(); renderEditor(); }
    }
    renderDirty();
  });

  act("add").onclick = () => {
    const item = { id: "level-" + crypto.randomUUID(), name: "新档位",
      prompt: "用通俗的中文解释原文：先交代背景，再说明原因和影响。只依据原文，不要补充原文没有的事实。",
      format: "先给结论，再用要点解释。", layout: "free" };
    draft.levels.splice(draft.levels.indexOf(level()) + 1, 0, item);
    selectedId = item.id;
    message = "";
    renderLevels(); renderDirty();
    f.levelName.select();
  };
  for (const [name, step] of [["up", -1], ["down", 1]]) act(name).onclick = () => {
    const item = level(), index = draft.levels.indexOf(item);
    draft.levels.splice(index, 1);
    draft.levels.splice(index + step, 0, item);
    message = "";
    renderLevels(); renderDirty();
  };
  act("remove").onclick = () => {
    const item = level(), index = draft.levels.indexOf(item);
    draft.levels.splice(index, 1);
    draft.warmModes = draft.warmModes.filter(id => id !== item.id);
    if (draft.defaultMode === item.id) draft.defaultMode = draft.levels[0].id;
    selectedId = draft.levels[Math.min(index, draft.levels.length - 1)].id;
    renderLevels();
    say("已删除「" + item.name + "」，保存后生效");
  };
  act("reset").onclick = () => {
    const item = level(), original = builtin(item);
    Object.assign(item, { prompt: original.prompt, format: original.format, layout: original.layout });
    message = "";
    renderLevels(); renderDirty();
  };
  act("revert").onclick = () => { message = ""; load(saved); };

  // API key: saved on its own, right away, and never read back into the page.
  const keyStatus = $(".ihj-key-status");
  async function refreshKey() {
    try {
      const state = await node.invoke("key-status", {});
      if (disposed) return;
      keyStatus.textContent = keySources[state.source] + (state.hint ? " · " + state.hint : "");
      $(".ihj-key").dataset.state = state.source === "none" ? "missing" : "ok";
      act("key-remove").hidden = state.source !== "plugin";
    } catch (error) { if (!disposed) keyStatus.textContent = error.message; }
  }
  async function storeKey(key) {
    act("key-save").disabled = act("key-remove").disabled = true;
    try {
      await node.invoke("key-save", { key });
      f.apiKey.value = "";
      say(key ? "密钥已保存" : "已移除插件里保存的密钥");
      await refreshKey();
    } catch (error) { say(error.message); }
    finally { act("key-save").disabled = act("key-remove").disabled = false; }
  }
  act("key-save").onclick = () => {
    const key = f.apiKey.value.trim();
    if (!key) { f.apiKey.focus(); return; }
    void storeKey(key);
  };
  act("key-remove").onclick = () => void storeKey("");
  f.apiKey.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    act("key-save").click();
  });

  act("check").onclick = async () => {
    const result = $(".ihj-check");
    act("check").disabled = true;
    result.dataset.tone = "";
    result.textContent = "正在连接…";
    try {
      const { ms, model } = await node.invoke("check-service",
        { provider: draft.provider, cloudModel: draft.cloudModel, localModel: draft.localModel });
      if (disposed) return;
      result.dataset.tone = "ok";
      result.textContent = "连接正常 · " + model + " · " + (ms / 1000).toFixed(1) + " 秒";
    } catch (error) {
      if (disposed) return;
      result.dataset.tone = "error";
      result.textContent = error.message;
    } finally { act("check").disabled = false; }
  };

  // Cache usage refreshes while the page is open.
  const meter = $(".ihj-meter"), busy = $(".ihj-busy"), capacity = $("progress"), build = $(".ihj-build");
  async function updateMeter() {
    try {
      const stats = await node.invoke("cache-stats", {});
      if (disposed) return;
      capacity.value = stats.limitMB > 0 ? Math.min(1, stats.bytes / (stats.limitMB * 1048576)) : 0;
      meter.textContent = stats.limitMB > 0
        ? `${stats.entries} 条译文 · ${(stats.bytes / 1048576).toFixed(2)} / ${stats.limitMB} MiB`
        : "未启用缓存";
      busy.textContent = stats.message || (stats.warming ? "正在预翻译…" : "");
      busy.dataset.tone = stats.message ? "error" : "";
      build.textContent = `版本 ${stats.version} · 构建 ${stats.hash.slice(0, 12)}`;
    } catch (error) { if (!disposed) meter.textContent = error.message; }
  }
  act("warm").onclick = async () => {
    act("warm").disabled = true;
    try { await node.invoke("prewarm", {}); say("已按保存的设置开始预翻译"); await updateMeter(); }
    catch (error) { say(error.message); }
    finally { renderWarm(); }
  };
  // Clearing cannot be undone, so it takes a second click within a few seconds.
  let confirmClear = 0;
  act("clear").onclick = async () => {
    const button = act("clear");
    if (!confirmClear) {
      button.textContent = "再点一次确认清空";
      confirmClear = setTimeout(() => { confirmClear = 0; button.textContent = "清空译文缓存"; }, 4000);
      return;
    }
    clearTimeout(confirmClear); confirmClear = 0;
    button.textContent = "清空译文缓存";
    button.disabled = true;
    try { await node.invoke("cache-clear", {}); say("已清空译文缓存"); await updateMeter(); }
    catch (error) { say(error.message); }
    finally { button.disabled = false; }
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (!dirty() || saving) return;
    try { settingsOf(draft); }
    catch (error) { say(error.message); return; }
    saving = true; message = "正在保存…"; renderDirty();
    try {
      const next = await node.invoke("save-settings", draft);
      if (disposed) return;
      saving = false; message = "";
      load(next);
      say("已保存");
      await updateMeter();
    } catch (error) {
      saving = false;
      say(error.message);
    }
  };

  // The host switches themes with its own classes, so read the colours it actually uses:
  // light or dark from the text colour, and the first opaque background for the save bar.
  function syncTheme() {
    const channels = value => value.match(/[\d.]+/g)?.map(Number) || [];
    let background = "";
    for (let el = container; el && !background; el = el.parentElement) {
      const color = getComputedStyle(el).backgroundColor, c = channels(color);
      if (c.length === 3 || (c.length === 4 && c[3] > 0.6)) background = color;
    }
    const [r = 0, g = 0, b = 0] = channels(getComputedStyle(form).color);
    const dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
    form.dataset.theme = dark ? "dark" : "light";
    form.style.setProperty("--ihj-bg", background || (dark ? "#1e1e20" : "#ffffff"));
  }

  for (const control of form.querySelectorAll("input,select,textarea,button")) control.disabled = true;
  container.append(form);
  syncTheme();
  node.invoke("settings", {}).then(settings => {
    if (disposed) return;
    for (const control of form.querySelectorAll("input,select,textarea,button")) control.disabled = false;
    load(settings);
  }).catch(error => say(error.message));
  // Another window saved: follow it unless this page has its own unsaved edits.
  const unsubscribe = node.on?.("settings-changed", settings => { if (!disposed && !dirty() && !saving) load(settings); });
  void refreshKey();
  void updateMeter();
  const timer = setInterval(() => { syncTheme(); void updateMeter(); }, 4000);
  return () => {
    disposed = true;
    clearInterval(timer);
    clearTimeout(confirmClear);
    unsubscribe?.();
    form.remove();
  };
}
