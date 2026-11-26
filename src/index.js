import { readChats, contextFor, snapshot, translatedFragment, historyTasks } from "./content.js";
import { matchAppearance } from "./appearance.js";
import { chatSidebar, sidebarStyle, threadRow, chatKey } from "./sidebar.js";
import { levelSignature } from "./levels.js";
import { defaults } from "./preferences.js";
import { settingsStyle } from "./settings-style.js";
import { mountSettings } from "./settings.js";
import { localSettingsPage } from "./settings-page.js";
import { logo } from "./logo.js";

import { jargonUI, jargonStyle } from "./jargon-ui.js";

const css = jargonStyle + sidebarStyle + settingsStyle + `
[data-cxt-hidden] { display:none !important }
[data-cxt-view] { color:inherit; font:inherit; line-height:inherit; margin-block:.4em; overflow-wrap:anywhere }
[data-cxt-view] .cxt-text {overflow-wrap:anywhere}
[data-cxt-view] .cxt-text > :first-child {margin-top:0}
[data-cxt-view] .cxt-text > :last-child {margin-bottom:0}
[data-cxt-view] .cxt-text :is(ul,ol){padding-inline-start:1.5em}
[data-cxt-view] .cxt-text ul{list-style:disc}
[data-cxt-view] .cxt-text ol{list-style:decimal}
[data-cxt-view] .cxt-text p{margin-block:.45em}
[data-cxt-view] .ihj-controls{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-block:3px 6px;font:12px/1.4 system-ui}
.ihj-modes{display:inline-flex;flex-wrap:wrap;gap:2px;padding:2px;border:1px solid color-mix(in srgb,currentColor 19%,transparent);border-radius:8px}
[data-cxt-view] .ihj-modes button{font:inherit;color:inherit;background:transparent;cursor:pointer;border:0;border-radius:5px;padding:3px 9px;white-space:nowrap}
[data-cxt-view] .ihj-modes button:hover{background:color-mix(in srgb,currentColor 8%,transparent)}
[data-cxt-view] .ihj-modes button[aria-pressed=true]{background:color-mix(in srgb,currentColor 16%,transparent)}
.ihj-controls button:focus-visible{outline:2px solid currentColor;outline-offset:1px}
.ihj-actions{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;color:color-mix(in srgb,currentColor 68%,transparent)}
.ihj-status{font:inherit;min-inline-size:4em}
.ihj-actions button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;padding:2px 0 2px 8px;border-inline-start:1px solid color-mix(in srgb,currentColor 28%,transparent)}
.ihj-actions button:hover:enabled{text-decoration:underline}
.ihj-actions button:disabled{opacity:.52;cursor:default}
[data-cxt-view] [hidden]{display:none!important}
[data-cxt-view][hidden] {display:none !important}
.ihj-rail-settings{display:grid;place-items:center;align-self:center;flex:none;width:32px;height:32px;border-radius:8px;background:transparent;color:inherit;border:0;padding:0;cursor:pointer;-webkit-app-region:no-drag}
.ihj-rail-settings[aria-current="page"],.ihj-rail-settings:hover,.ihj-rail-settings:focus-visible{background:color-mix(in srgb,currentColor 12%,transparent)}
main:has(>.ihj-settings-page)>:not(.ihj-settings-page){display:none!important}
.ihj-settings-page{flex:1 1 auto;min-height:0;height:100%;width:100%;overflow:auto;padding:24px clamp(12px,4vw,64px) 0;box-sizing:border-box}
`;
const settleMs = {summary:350, report:1200};
function sameProtected(a,b) {
  return a===b || (a?.nodeType===Node.TEXT_NODE && b?.nodeType===Node.TEXT_NODE && a.data===b.data);
}
const generated = '[data-cxt-view],[data-ihj-sidebar],.cxt-settings';

export function activate({ node, ui, onCleanup }) {
  if (!node) throw Error("ihatejargons 需要启用本地 Node 后端。");
  let config, stopped = false, translating = 0, timer = 0;
  const records = new Map();
  let submitted = new WeakMap();
  const chatKeys = new WeakMap();
  function levelFor(mode) { return config.levels.find(p=>p.id===mode); }
  const mountPage=container=>mountSettings(container,node);
  const registration=ui?.settingsSections?.register({id:"codex-translator",mount:mountPage});
  const localPage=registration?.open ? null : localSettingsPage(mountPage);
  const railButtons=new Map();
  function syncRailButtons() {
    localPage?.sync();
    const active=localPage ? localPage.selected() :
      [...document.querySelectorAll("[data-codex-tweaks-settings-section-host]")].some(
        host=>host.getAttribute("data-codex-tweaks-settings-section-host")===registration.slug && host.getClientRects().length
      );
    for (const [rail,button] of railButtons) {
      if (!rail.isConnected) {button.remove();railButtons.delete(rail);}
    }
    for (const rail of document.querySelectorAll("nav[data-app-navigation-rail]")) {
      const group=rail.querySelector(".vertical-scroll-fade-mask") || rail;
      let button=railButtons.get(rail);
      if (!button) {
        button=document.createElement("button");
        button.type="button";
        button.className="ihj-rail-settings";
        button.dataset.ihjSidebar="";
        button.innerHTML=logo(18);
        button.title="ihatejargons 设置";
        button.setAttribute("aria-label",button.title);
        button.onclick=e=>{
          e.stopPropagation();
          (localPage || registration).open();
        };
        railButtons.set(rail,button);
      }
      if (active) button.setAttribute("aria-current","page");
      else button.removeAttribute("aria-current");
      if (button.parentElement!==group) group.append(button);
    }
  }
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const events = new AbortController();
  const listen = (target, type, fn, options = {}) =>
    target.addEventListener(type, fn, { ...options, signal: events.signal });

  let historyGeneration=0, historyTimer, historyBusy=false, historyPaused=false;
  const histories=new Map();
  const normalize=s=>s.replace(/\s+/gu," ").trim();
  function chatId(chat) {
    const local=chat.closest("[data-thread-id],[data-conversation-id]");
    const route=/\/(?:thread|chat|local)\/([^/?#]+)/.exec(location.href)?.[1];
    if(!chatKeys.has(chat)) chatKeys.set(chat,crypto.randomUUID());
    return chatKey(local?.dataset.threadId || local?.dataset.conversationId || route ||
      document.querySelector("[data-above-composer-conversation-id]")?.getAttribute("data-above-composer-conversation-id") ||
      document.querySelector(threadRow+'[data-app-action-sidebar-thread-active="true"]')?.getAttribute("data-app-action-sidebar-thread-id") || chatKeys.get(chat));
  }
  const sidebar=chatSidebar(node,listen,async(chat,action)=>{
    if(action==="delete"){await node.invoke("chat-delete",{chat});return;}
    let jobs;
    try {
      const items=await node.invoke("chat-history",{chat});
      jobs=historyTasks(items,config.recentBlocks);
      if(jobs.length) histories.set(chat,{stamp:null,jobs});
    } catch(e) {
      if(![...records.values()].some(r=>r.owner===chat)) throw e;
    }
    const tasks=jobs?.length ? jobs.map(j=>j.task) : [...records.values()].filter(r=>r.owner===chat && !r.streaming).slice(-config.recentBlocks).map(r=>r.task);
    await node.invoke("chat-queue",{chat,tasks,action});
  });
  function effectiveTask(rec) {
    // Virtual scrolling can unmount earlier turns. Reuse the background context only
    // when this exact completed message/turn and its translatable content match.
    const turn=rec.group?.dataset.turnKey;
    const id=rec.message?.dataset.historyMessageId;
    const indexed=histories.get(rec.owner);
    if (indexed && config.includeHistory && (turn || id)) {
      const {jobs}=indexed;
      const hit=jobs.find(j=>((id && j.id===id) || (turn && j.turn===turn)) && j.task.kind===rec.task.kind &&
          normalize(j.task.target)===normalize(rec.task.target) && JSON.stringify(j.task.terms)===JSON.stringify(rec.task.terms) &&
          (!rec.task.question || normalize(j.task.question)===normalize(rec.task.question)));
      if (hit) return hit.task;
    }
    return rec.task;
  }
  async function loadHistory() {
    if (stopped || historyBusy || historyPaused || !config?.includeHistory || !config.cacheMB || !config.recentChats || !config.warmModes.length) return;
    historyBusy=true;
    const generation=historyGeneration;
    try {
      const known=Object.fromEntries([...histories].map(([id,data])=>[id,data.stamp]));
      const rows=await node.invoke("history-recent",{known});
      if (generation!==historyGeneration || stopped) return;
      const remaining=new Set(rows.map(row=>row.id));
      const removed=[...histories.keys()].filter(id=>!remaining.has(id));
      for (const id of removed) histories.delete(id);
      if (removed.length) await node.invoke("recent-forget",{chats:removed});
      for (const row of rows) {
        if (generation!==historyGeneration || stopped) return;
        if (!row.items) continue;
        const jobs=historyTasks(row.items,config.recentBlocks);
        await node.invoke("recent-chat",{chat:row.id,tasks:jobs.map(j=>j.task),historical:true});
        if (generation!==historyGeneration || stopped) return;
        histories.set(row.id,{stamp:row.stamp,jobs});
      }
      schedule();
    } catch(e) {
      if (!stopped) void node.invoke("history-error",{message:e.message}).catch(()=>{});
    } finally {
      historyBusy=false;
      if (generation!==historyGeneration && !historyPaused && !stopped) void loadHistory();
    }
  }
  function restartHistory() {
    historyGeneration++; clearInterval(historyTimer); histories.clear(); historyPaused=false;
    void loadHistory(); historyTimer=setInterval(loadHistory,60000);
  }
  const jargon = jargonUI(node, records, listen, schedule);
  function drop(rec) {
    for (const source of rec.sources) source.removeAttribute("data-cxt-hidden");
    rec.view?.remove();
    records.delete(rec.source);
  }
  function schedule(delay = 100) {
    if (stopped || timer) return;
    timer = setTimeout(() => { timer = 0; scan(); }, delay);
  }
  function onscreen(el) {
    if (!el.isConnected || !el.checkVisibility({visibilityProperty:true, opacityProperty:true})) return false;
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0 || box.bottom <= 0 || box.top >= innerHeight ||
        box.right <= 0 || box.left >= innerWidth) return false;
    // Also respect scrolling and collapsed containers within the transcript.
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowY)) continue;
      const r = p.getBoundingClientRect();
      if (r.height === 0 || box.top >= r.bottom || box.bottom <= r.top) return false;
    }
    return true;
  }
  function mount(rec) {
    const source = rec.source;
    const view = document.createElement(["LI","TD","TH"].includes(source.tagName) ? source.tagName : "div");
    if (source.matches("td,th")) { view.colSpan = source.colSpan; view.rowSpan = source.rowSpan; }
    view.dataset.cxtView = "";
    view.setAttribute("data-markdown-copy","exclude");
    view.innerHTML = '<div class="ihj-controls"><div class="ihj-modes" role="group" aria-label="阅读方式"></div><div class="ihj-actions"><span class="ihj-status" role="status" aria-live="polite"></span><button type="button" class="ihj-retry" hidden>重试注释</button><button type="button" class="ihj-regen">重新生成</button></div></div><div class="cxt-text" hidden></div>';
    rec.view = view;
    rec.body = view.querySelector(".cxt-text");
    rec.status = view.querySelector(".ihj-status");
    rec.retry = view.querySelector(".ihj-retry");
    rec.regen=view.querySelector(".ihj-regen");
    rec.regen.onclick=()=>{
      if (rec.mode==="original") selectMode(rec,rec.lastMode);
      regenerate(rec);
    };
    rec.buttons = [];
    for (const {id:mode,name:label} of [{id:"original",name:"原文注释"},...config.levels]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.title = mode==="original" ? "阅读带虚线注释的原文" : label;
      button.dataset.mode = mode;
      button.onclick = () => selectMode(rec,mode);
      view.querySelector(".ihj-modes").append(button);
      rec.buttons.push(button);
    }
    rec.retry.onclick = () => {
      for (const job of rec.annotations.get(rec.mode)?.jobs || []) {
        if (job.state==="failed") job.state="waiting";
      }
      rec.priority = true;
      paint(rec); schedule();
    };
    source.before(view);
  }
  function selectMode(rec,mode) {
    rec.mode = mode;
    if (mode!=="original") rec.lastMode = mode;
    rec.priority = true;
    jargon.close();
    paint(rec); jargon.refresh(); schedule();
  }
  function regenerate(rec) {
    if (rec.mode==="original" || rec.pending===rec.mode) return;
    delete rec.outputs[rec.mode]; delete rec.errors[rec.mode];
    rec.annotations.delete(rec.mode);
    rec.rendered=null; rec.force=rec.mode; rec.priority=true;
    rec.lookups.set(rec.mode,true);
    paint(rec); schedule();
  }
  function lookup(rec) {
    const task=rec.task, mode=rec.mode==="original" ? rec.lastMode : rec.mode;
    if (rec.lookups.has(mode) || rec.outputs[mode]) return;
    const token={}; rec.lookups.set(mode,token);
    void node.invoke("cache-lookup",{chat:rec.owner,task:{...effectiveTask(rec),mode}}).then(output=>{
      if (records.get(rec.source)!==rec || rec.task!==task || rec.lookups.get(mode)!==token) return;
      if (typeof output==="string" && output) rec.outputs[mode]=output;
    }).catch(()=>{}).finally(()=>{
      if (rec.lookups.get(mode)===token) rec.lookups.set(mode,true);
      schedule(0);
    });
  }
  function paint(rec) {
    const {mode} = rec;
    const output = rec.outputs[mode];
    if (output && rec.rendered!==mode) {
      // Native table widths must be measured while the source participates in layout.
      for (const el of rec.sources) el.removeAttribute("data-cxt-hidden");
      try {
        const fragment = translatedFragment(output,rec.nodes);
        rec.body.replaceChildren(fragment);
        matchAppearance(rec.sources,rec.body,levelFor(mode).layout);
        rec.rendered = mode;
      } catch (e) {
        delete rec.outputs[mode];

        rec.errors[mode] = e.message;
        rec.rendered = null;
      }
    }
    const translated = mode!=="original" && Boolean(rec.outputs[mode]);
    for (const el of rec.sources) el.toggleAttribute("data-cxt-hidden",translated);
    rec.body.hidden = !translated;
    for (const button of rec.buttons) {
      const pressed = String(button.dataset.mode===mode);
      if (button.getAttribute("aria-pressed")!==pressed) button.setAttribute("aria-pressed",pressed);
    }
    const target = mode==="original" ? rec.lastMode : mode;
    const working = rec.pending===target;
    const error = rec.errors[target];
    const state = working ? "正在翻译" : error ? "翻译失败" : rec.outputs[target] ? "已经翻译" : "尚未翻译";
    if (rec.status.textContent!==state) rec.status.textContent=state;
    rec.status.title = levelFor(target).name + " · " + (error || state);
    const failed=rec.annotations.get(mode)?.jobs.find(job=>job.state==="failed");
    rec.retry.hidden=!failed;
    if (failed) rec.retry.title=failed.error;
    rec.regen.disabled = working || rec.streaming;
    rec.regen.title = rec.streaming ? "等待原文写完" : "重新生成「" + levelFor(target).name + "」";
  }
  async function send(rec) {
    const task = rec.task, mode = rec.mode;
    const force=rec.force===mode; if (force) rec.force=null;
    translating++; rec.pending = mode; rec.priority = false;
    paint(rec);
    const current = () => !stopped && records.get(rec.source)===rec && rec.task===task && rec.source.isConnected;
    try {
      const output = await node.invoke("translate",{chat:rec.owner,task:{...effectiveTask(rec),mode},provider:config.provider,
        cloudModel:config.cloudModel,localModel:config.localModel,force,levelStamp:levelSignature(levelFor(mode))});
      if (current() && snapshot(rec.sources).text===task.target) {
        rec.outputs[mode] = output;
      }
    } catch (e) {
      if (current()) rec.errors[mode] = e.message || "翻译失败";
    } finally {
      translating--;
      if (current()) { rec.pending = null; paint(rec); jargon.refresh(); }
      schedule();
    }
  }
  function scan() {
    if (!config || stopped) return;
    syncRailButtons();
    sidebar.scan();
    const jobs = readChats();
    const current = new Set(jobs.map(job=>job.sources[0]));
    for (const rec of records.values()) {
      if (!current.has(rec.source) || rec.view.nextElementSibling!==rec.source) drop(rec);
    }
    const recentByChat=new Map();
    if (config.cacheMB && config.recentChats && config.warmModes.length) {
      for (const job of jobs) {
        if (!recentByChat.has(job.chat)) recentByChat.set(job.chat,[]);
        recentByChat.get(job.chat).push(job);
      }
      for (const [chat,list] of recentByChat) recentByChat.set(chat,list.slice(-config.recentBlocks));
    }
    const warmJobs=new Set([...recentByChat.values()].flat());
    let waiting = false;
    const next=[], annotate=[];
    for (const job of jobs) {
      const source = job.sources[0];
      let rec = records.get(source);
      const owner=chatId(job.chat);
      if (rec && (rec.owner!==owner || rec.chat!==job.chat || rec.scope!==job.scope || rec.group!==job.group ||
          rec.sources.length!==job.sources.length || rec.sources.some((el,i)=>el!==job.sources[i]))) {
        drop(rec); rec=null;
      }
      const visible=(rec && onscreen(rec.view)) || job.sources.some(onscreen);
      if (!visible && !warmJobs.has(job)) continue;
      const snap = snapshot(job.sources);
      if (!/\p{L}/u.test(snap.text.replace(/⟦T\d+⟧/g,""))) { if (rec) drop(rec); continue; }
      const nativeText = job.sources.map(el=>el.textContent).join("\n");
      const question = job.questionNode?.textContent || "";
      const same = rec && rec.task.target===snap.text && rec.original===nativeText &&
        rec.questionNode===job.questionNode && rec.originalQuestion===question &&
        rec.nodes.length===snap.protectedNodes.length && rec.nodes.every((el,i)=>sameProtected(el,snap.protectedNodes[i]));
      if (!same) {
        if (!rec) {
          rec = {source,owner,mode:config.defaultMode,lastMode:config.defaultMode};
          records.set(source,rec);
          mount(rec);
        }
        const task = {kind:job.kind,...contextFor(job),target:snap.text,terms:snap.terms};
        Object.assign(rec,job,{task,original:nativeText,originalQuestion:question,
          nodes:snap.protectedNodes,ready:Date.now()+settleMs[job.kind],outputs:{},errors:{},rendered:null,
          pending:null,annotations:new Map(),lookups:new Map(),force:null});
      }
      rec.streaming = job.kind==="report" && job.sources.some(el=>el.closest('[aria-busy="true"],[data-streaming="true"]') ||
          el.querySelector('[data-markdown-animated="true"]'));
      if (visible && !rec.streaming) lookup(rec);
      paint(rec);
      if (rec.streaming) continue;
      if (Date.now()<rec.ready) { waiting=true; continue; }
      if (!visible) continue;
      if (!rec.pending && rec.lookups.get(rec.mode)===true && rec.mode!=="original" &&
          !rec.outputs[rec.mode] && !rec.errors[rec.mode]) next.push(rec);
      if (rec.mode==="original" || !rec.body.hidden) annotate.push(rec);
    }
    next.sort((a,b)=>Number(Boolean(b.priority))-Number(Boolean(a.priority)));
    for (const rec of next.slice(0,Math.max(0,config.textConcurrency-translating))) void send(rec);
    for (const rec of annotate) jargon.queue(rec,config.termConcurrency);
    for (const [chat,list] of recentByChat) {
      const tasks=list.map(job=>records.get(job.sources[0])).filter(rec=>rec && !rec.streaming && Date.now()>=rec.ready).map(rec=>rec.task);
      const previous=submitted.get(chat);
      if (!tasks.length || (previous?.length===tasks.length && tasks.every((t,i)=>t===previous[i]))) continue;
      submitted.set(chat,tasks);
      const id=chatId(chat);
      if (!histories.get(id)?.jobs.length) void node.invoke("recent-chat",{chat:id,tasks}).catch(()=>{});
    }
    jargon.refresh();
    if (waiting) schedule(150);
  }
  function apply(next) {
    if (stopped) return;
    next={...defaults,...next};
    if (config && [ "provider","cloudModel","localModel","levels","defaultMode" ].some(k=>JSON.stringify(config[k])!==JSON.stringify(next[k]))) {
      for (const rec of records.values()) drop(rec);
    }
    config = next; submitted=new WeakMap(); restartHistory();
    schedule();
  }
  const changes = new MutationObserver(mutations => {
    if (mutations.some(m => !m.target.parentElement?.closest(generated) &&
        !(m.target instanceof Element && m.target.closest(generated)))) schedule();
  });
  changes.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,
    attributeFilter:["hidden","aria-expanded","data-state","data-markdown-text-style","inert","aria-busy","data-streaming","data-markdown-animated","data-app-action-sidebar-thread-id","data-app-action-sidebar-thread-active","data-app-action-sidebar-thread-selected"]});
  listen(window, "scroll", () => schedule(), {capture:true, passive:true});
  listen(window, "resize", () => schedule());
  function resetOutputs(rec) {
    rec.task={...rec.task};rec.annotations=new Map();rec.outputs={};rec.errors={};rec.lookups=new Map();
    rec.rendered=null;rec.pending=null;rec.mode="original";rec.force=null;paint(rec);
  }
  const deleted=node.on("chat-cache-deleted",({chat})=>{
    for(const rec of records.values()) if(rec.owner===chat) resetOutputs(rec);
    jargon.refresh();schedule();
  });
  const renewed=node.on("chat-regenerated",({chat,task,output})=>{
    for(const rec of records.values()) {
      if(rec.owner!==chat || !levelFor(task.mode))continue;
      const active=effectiveTask(rec);
      if(active.target!==task.target || active.question!==task.question ||
          JSON.stringify(active.history)!==JSON.stringify(task.history) || JSON.stringify(active.terms)!==JSON.stringify(task.terms))continue;
      rec.outputs[task.mode]=output;delete rec.errors[task.mode];rec.rendered=null;paint(rec);
    }
    jargon.refresh();
  });
  const cleared = node.on("cache-cleared",()=>{
    historyGeneration++; historyPaused=true; histories.clear();
    for (const rec of records.values()) resetOutputs(rec);
    // Do not immediately repopulate the entries the user just removed.
    for (const [chat,list] of Map.groupBy(readChats(),j=>j.chat)) {
      submitted.set(chat,list.slice(-config.recentBlocks).map(j=>records.get(j.sources[0])?.task).filter(Boolean));
    }
    jargon.refresh(); schedule();
  });
  const resumeWarm = node.on("prewarm-resume",()=>{submitted=new WeakMap();restartHistory();schedule();});
  const unsubscribe = node.on("settings-changed", apply);
  void node.invoke("settings", {}).then(value => { if (!config) apply(value); });
  onCleanup(() => {
    stopped = true; historyGeneration++; clearInterval(historyTimer); clearTimeout(timer); jargon.dispose(); changes.disconnect(); events.abort();
    for (const button of railButtons.values()) button.remove();
    railButtons.clear();localPage?.dispose();
    sidebar.dispose();deleted();renewed();cleared(); resumeWarm(); unsubscribe(); registration?.unregister(); style.remove();
    for (const rec of records.values()) drop(rec);

  });
}
