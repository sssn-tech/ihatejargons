import { readChats, contextFor, snapshot, translatedFragment, historyTasks } from "./content.js";
import { matchAppearance } from "./appearance.js";
import { chatSidebar, sidebarStyle, threadRow, chatKey } from "./sidebar.js";
import { levelSignature } from "./levels.js";
import { defaults } from "./preferences.js";
import { mountSettings } from "./settings.js";

import { jargonUI, jargonStyle } from "./jargon-ui.js";

const css = jargonStyle + sidebarStyle + `
[data-cxt-hidden] { display:none !important }
[data-cxt-view] { color:inherit; font:inherit; line-height:inherit; margin-block:.4em; overflow-wrap:anywhere }
[data-cxt-view] .cxt-text {overflow-wrap:anywhere}
[data-cxt-view] .cxt-mark {display:block; font:600 11px/1.5 system-ui; color:#166b59; letter-spacing:.015em}
@media(prefers-color-scheme:dark){[data-cxt-view] .cxt-mark{color:#7ad9bb}}
[data-cxt-view] .cxt-text > :first-child {margin-top:0}
[data-cxt-view] .cxt-text > :last-child {margin-bottom:0}
[data-cxt-view] .cxt-text :is(ul,ol){padding-inline-start:1.5em}
[data-cxt-view] .cxt-text ul{list-style:disc}
[data-cxt-view] .cxt-text ol{list-style:decimal}
[data-cxt-view] .cxt-text p{margin-block:.45em}
[data-cxt-view] .cxt-mark:first-child {margin-bottom:3px}
[data-cxt-view] .cxt-mark:last-child {margin-top:3px}
[data-cxt-view] .ihj-controls{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-block:3px 6px;font:12px/1.4 system-ui}
.ihj-modes{display:inline-flex;flex-wrap:wrap;gap:2px;padding:2px;border:1px solid color-mix(in srgb,currentColor 19%,transparent);border-radius:8px}
[data-cxt-view] .ihj-modes button{font:inherit;color:inherit;background:transparent;cursor:pointer;border:0;border-radius:5px;padding:3px 9px;white-space:nowrap}
[data-cxt-view] .ihj-modes button:hover{background:color-mix(in srgb,currentColor 8%,transparent)}
[data-cxt-view] .ihj-modes button[aria-pressed=true]{font-weight:650;background:color-mix(in srgb,currentColor 16%,transparent)}
.ihj-controls button:focus-visible{outline:2px solid currentColor;outline-offset:1px}
.ihj-status{font-size:12px;color:inherit;opacity:.82}
.ihj-status[data-working]::before{content:"";display:inline-block;width:6px;height:6px;background:currentColor;border-radius:50%;vertical-align:middle;margin-right:5px;animation:ihj-pulse 1.4s ease-in-out infinite alternate}
@keyframes ihj-pulse{to{opacity:.3}}
@media(prefers-reduced-motion:reduce){.ihj-status[data-working]::before{animation:none}}
.ihj-controls .ihj-retry{cursor:pointer;text-decoration:underline;font:inherit}
[data-cxt-view] [hidden]{display:none!important}
[data-cxt-view][hidden] {display:none !important}
.cxt-settings {display:grid;gap:14px;padding:20px;max-width:38em}
.ihj-rail-settings{display:grid;place-items:center;align-self:center;flex:none;width:32px;height:32px;border-radius:8px;background:transparent;color:inherit;font:600 16px/1 system-ui;cursor:pointer;-webkit-app-region:no-drag}
.ihj-rail-settings:hover,.ihj-rail-settings:focus-visible{background:color-mix(in srgb,currentColor 12%,transparent)}
.ihj-dialog{position:fixed;inset:0 auto 0 min(var(--ihj-rail-edge,0px),15vw);margin:0;box-sizing:border-box;width:min(450px,calc(100vw - min(var(--ihj-rail-edge,0px),15vw)));max-width:none;height:100dvh;max-height:none;overflow:auto;overscroll-behavior:contain;border:0;border-inline-end:1px solid color-mix(in srgb,currentColor 18%,transparent);box-shadow:4px 0 22px #0002;background:Canvas;color:CanvasText;color-scheme:light dark;padding:0 0 18px}
.ihj-dialog .cxt-settings{max-width:none;min-width:0}
.ihj-dialog :is(fieldset,select,input,textarea){min-width:0;max-width:100%;box-sizing:border-box}
details.nmj-library{display:block;padding:0 20px 20px}
.nmj-library>summary{cursor:pointer;font-weight:600;padding:10px 0;border-block-start:1px solid color-mix(in srgb,currentColor 18%,transparent)}
.nmj-library>summary small{font-weight:400;opacity:.7;margin-inline-start:8px}
.nmj-library .ihj-library-body{display:grid;gap:8px}
.ihj-dialog::backdrop{background:#0006}
.ihj-dialog-close{float:right;margin:16px;cursor:pointer;padding:4px 8px;border-radius:5px}
.ihj-controls .ihj-regen{font:inherit;color:inherit;opacity:.75;cursor:pointer}
.cxt-settings [hidden]{display:none!important}
.ihj-warm-levels{display:flex;gap:10px;flex-wrap:wrap}
.cxt-settings .ihj-warm-levels label{display:flex;align-items:center;gap:4px}
.cxt-settings fieldset{display:grid;gap:10px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:8px;padding:12px}
.cxt-settings legend{font-weight:600;padding:0 4px}
.cxt-settings textarea{width:100%;font:inherit;border:1px solid GrayText;border-radius:5px;padding:6px;resize:vertical}
.cxt-settings label {display:grid;gap:4px}
.cxt-settings :is(input,select,button){border:1px solid currentColor;border-radius:5px;padding:5px 8px}
`;
const settleMs = {summary:350, report:1200};
function sameProtected(a,b) {
  return a===b || (a?.nodeType===Node.TEXT_NODE && b?.nodeType===Node.TEXT_NODE && a.data===b.data);
}
const generated = '[data-cxt-view],[data-ihj-sidebar],.ihj-dialog';

export function activate({ node, ui, onCleanup }) {
  if (!node) throw Error("ihatejargons 需要启用本地 Node 后端。");
  let config, stopped = false, busy = false, timer = 0, detecting = false;
  const records = new Map();
  let submitted = new WeakMap(), settingsDialog, disposeDialog;
  const chatKeys = new WeakMap();
  function levelFor(mode) { return config.levels.find(p=>p.id===mode); }
  function nameOf(mode) { return levelFor(mode)?.name || "原文注释"; }
  const railButtons=new Map();
  function syncRailButtons() {
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
        button.textContent="译";
        button.title="ihatejargons 设置";
        button.setAttribute("aria-label",button.title);
        button.setAttribute("aria-haspopup","dialog");
        button.onclick=e=>{e.stopPropagation();showSettings(rail);};
        railButtons.set(rail,button);
      }
      if (button.parentElement!==group) group.append(button);
    }
  }
  function showSettings(rail) {
    if (settingsDialog) return;
    const dialog=document.createElement("dialog");
    dialog.className="ihj-dialog";
    dialog.style.setProperty("--ihj-rail-edge",Math.max(0,rail.getBoundingClientRect().right)+"px");
    dialog.setAttribute("aria-label","ihatejargons 设置");
    const close=document.createElement("button");
    close.type="button"; close.textContent="关闭"; close.className="ihj-dialog-close";
    close.onclick=()=>dialog.close();
    const page=document.createElement("div"); dialog.append(close,page);
    document.body.append(dialog);
    const dispose=mountSettings(page,node);
    settingsDialog=dialog;
    disposeDialog=()=>{
      if (settingsDialog!==dialog) return;
      dispose(); dialog.remove(); settingsDialog=null; disposeDialog=null;
    };
    dialog.addEventListener("close",disposeDialog,{once:true});
    dialog.addEventListener("click",e=>{
      if (e.target===dialog && e.clientX>=dialog.getBoundingClientRect().right) dialog.close();
    });
    dialog.showModal();
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
  const jargon = jargonUI(node, records, listen);
  async function detect(rec) {
    detecting = true;
    const task = rec.task;
    rec.detectStarted = true;
    const labels = new Map(rec.task.terms.map(item=>[item.token,item.label]));
    const source = rec.task.target.replace(/⟦T\d+⟧/g,token=>labels.get(token) || " ");
    try { jargon.apply(await node.invoke("glossary-detect",{source})); }
    catch (error) { if (rec.task===task) rec.detectError = error.message || "术语识别失败"; }
    finally { detecting = false; schedule(); }
  }
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
  function mark(text) {
    const el = document.createElement("span");
    el.className = "cxt-mark";
    el.textContent = text;
    return el;
  }
  function mount(rec) {
    const source = rec.source;
    const view = document.createElement(["LI","TD","TH"].includes(source.tagName) ? source.tagName : "div");
    if (source.matches("td,th")) { view.colSpan = source.colSpan; view.rowSpan = source.rowSpan; }
    view.dataset.cxtView = "";
    view.setAttribute("data-markdown-copy","exclude");
    view.innerHTML = '<div class="ihj-controls"><div class="ihj-modes" role="group" aria-label="阅读方式"></div><span class="ihj-status" role="status" aria-live="polite"></span><button type="button" class="ihj-retry" hidden>重试</button><button type="button" class="ihj-regen">重新生成</button></div><div class="cxt-text" hidden></div>';
    rec.view = view;
    rec.body = view.querySelector(".cxt-text");
    rec.status = view.querySelector(".ihj-status");
    rec.retry = view.querySelector(".ihj-retry");
    rec.regen=view.querySelector(".ihj-regen");
    rec.regen.onclick=()=>regenerate(rec);
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
      if (rec.mode==="original") { rec.detectStarted = false; rec.detectError = ""; }
      else { regenerate(rec); return; }
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
    rec.rendered=null; rec.force=rec.mode; rec.priority=true;
    rec.lookups.set(rec.mode,true);
    paint(rec); schedule();
  }
  function lookup(rec) {
    const task=rec.task, mode=rec.mode;
    if (mode==="original" || rec.lookups.has(mode) || rec.outputs[mode]) return;
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
    const error = mode==="original" ? rec.detectError : rec.errors[mode];
    let message = "", working = false;
    if (error) message = "ihatejargons · " + error;
    else if (rec.pending) {
      working = true;
      const background = mode===rec.pending ? "" : "后台";
      message = "ihatejargons · " + background + "正在生成「" + nameOf(rec.pending) + "」…";
      if (!translated && mode!=="original" && mode!==rec.pending) message += "「"+nameOf(mode)+"」已排队";
    } else if (mode!=="original" && !translated) {
      message = "ihatejargons · " + (rec.streaming ? "等待原文写完…" : "等待生成「"+nameOf(mode)+"」…");
    }
    rec.status.toggleAttribute("data-working",working);
    if (rec.status.textContent!==message) rec.status.textContent = message;
    rec.retry.hidden = !error;
    rec.regen.hidden = !translated; rec.regen.disabled = rec.pending===mode;
  }
  function groupMarks(jobs) {
    const groups = new Map();
    for (const job of jobs) {
      const rec = records.get(job.sources[0]);
      if (!rec?.view) continue;
      if (rec.body.hidden || !rec.view.checkVisibility()) {
        for (const label of rec.view.querySelectorAll("[data-cxt-mark]")) label.remove();
        continue;
      }
      if (!groups.has(job.group)) groups.set(job.group, []);
      groups.get(job.group).push(rec);
    }
    for (const members of groups.values()) {
      members.forEach((rec, i) => {
        for (const [position, needed] of [["start",i===0],["end",i===members.length-1]]) {
          const current = rec.view.querySelector('[data-cxt-mark="'+position+'"]');
          if (!needed) { current?.remove(); continue; }
          if (current) continue;
          const label = mark("由 ihatejargons 翻译 · " + (position==="start"?"开始":"结束"));
          label.dataset.cxtMark = position;
          if (position==="start") rec.view.prepend(label); else rec.view.append(label);
        }
      });
    }
  }
  async function send(rec) {
    const task = rec.task, mode = rec.mode;
    const force=rec.force===mode; if (force) rec.force=null;
    busy = true; rec.pending = mode; rec.priority = false;
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
      busy = false;
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
    let waiting = false, next;
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
          pending:null,detectStarted:false,detectError:"",lookups:new Map(),force:null});
      }
      rec.streaming = job.kind==="report" && job.sources.some(el=>el.closest('[aria-busy="true"],[data-streaming="true"]') ||
          el.querySelector('[data-markdown-animated="true"]'));
      if (visible && !rec.streaming) lookup(rec);
      paint(rec);
      if (rec.streaming) continue;
      if (Date.now()<rec.ready) { waiting=true; continue; }
      if (!visible) continue;
      if (!detecting && !rec.detectStarted) void detect(rec);
      if (!busy && rec.lookups.get(rec.mode)===true && rec.mode!=="original" && !rec.outputs[rec.mode] && !rec.errors[rec.mode] &&
          (!next || (rec.priority && !next.priority))) next=rec;
    }
    if (next) void send(next);
    for (const [chat,list] of recentByChat) {
      const tasks=list.map(job=>records.get(job.sources[0])).filter(rec=>rec && !rec.streaming && Date.now()>=rec.ready).map(rec=>rec.task);
      const previous=submitted.get(chat);
      if (!tasks.length || (previous?.length===tasks.length && tasks.every((t,i)=>t===previous[i]))) continue;
      submitted.set(chat,tasks);
      const id=chatId(chat);
      if (!histories.get(id)?.jobs.length) void node.invoke("recent-chat",{chat:id,tasks}).catch(()=>{});
    }
    groupMarks(jobs);
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
  listen(document, "click", e => {
    if (e.button!==0 || e.detail!==3 || e.target.closest("a,button,input,select,textarea,[contenteditable=true],[role=button],.nmj-popup")) return;
    for (const rec of records.values()) {
      if (!rec.view) continue;
      const inside = rec.body.hidden ? rec.sources.some(el=>el.contains(e.target)) : rec.body.contains(e.target);
      if (!inside) continue;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      selectMode(rec,rec.mode==="original" ? rec.lastMode : "original");
      break;
    }
  }, {capture:true});
  function resetOutputs(rec) {
    rec.task={...rec.task};rec.outputs={};rec.errors={};rec.lookups=new Map();
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
  const registration = ui?.settingsSections?.register({
    id:"codex-translator", mount:container => mountSettings(container, node)
  });
  void node.invoke("settings", {}).then(value => { if (!config) apply(value); });
  onCleanup(() => {
    stopped = true; historyGeneration++; clearInterval(historyTimer); clearTimeout(timer); jargon.dispose(); changes.disconnect(); events.abort();
    for (const button of railButtons.values()) button.remove();
    railButtons.clear();
    sidebar.dispose();deleted();renewed();cleared(); resumeWarm(); disposeDialog?.(); unsubscribe(); registration?.unregister(); style.remove();
    for (const rec of records.values()) drop(rec);

  });
}
