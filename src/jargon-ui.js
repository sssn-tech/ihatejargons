const layer = "nmj-terms";
const exclude = "pre,a,button,textarea,input,select,[contenteditable=true],[role=button],[aria-hidden=true],[data-markdown-copy=exclude]:not([data-cxt-view]),[hidden],[data-cxt-hidden]";
export const jargonStyle = `
::highlight(nmj-terms){text-decoration:underline dashed;text-decoration-color:color-mix(in srgb,currentColor 50%,transparent)}
.nmj-popup {position:fixed;z-index:2147483646;box-sizing:border-box;width:min(340px,calc(100vw - 16px));max-height:min(440px,70vh);overflow:auto;overscroll-behavior:contain;background:Canvas;color:CanvasText;color-scheme:light dark;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:10px;padding:14px;box-shadow:0 6px 24px #0003;font:13px/1.55 system-ui;overflow-wrap:anywhere}
.nmj-popup header,.nmj-popup footer {display:flex;align-items:center;justify-content:space-between;gap:8px}
.nmj-popup p {white-space:pre-wrap;margin:8px 0}
.nmj-popup textarea {display:block;width:100%;box-sizing:border-box;margin:10px 0;resize:vertical;font:inherit;border:1px solid GrayText;border-radius:5px;padding:6px;background:Field;color:FieldText}
.nmj-popup button,.nmj-library button {font:inherit;cursor:pointer;color:inherit;text-decoration:underline}
.nmj-library details {margin-block:5px}
`;

// Index native text with Ranges so React keeps ownership of the original Markdown and controls.
export function jargonUI(node, records, listen) {
  let opening = 0, entries = [], version = -1, pattern, panel, activeTerm, anchor, retired = false;
  const hits = new Map(), threads = new Map();
  function close() {
    clearTimeout(opening);
    const thread = threads.get(activeTerm);
    if (thread) thread.draw = null;
    panel?.remove();
    panel = null;
    activeTerm = anchor = null;
  }
  function rebuild(source) {
    if (!pattern || !source.isConnected) return [];
    const matches = [];
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const leaf = walker.currentNode;
      if (leaf.parentElement.closest(exclude)) continue;
      for (const match of leaf.data.matchAll(pattern)) {
        const start = match.index, end = start + match[0].length;
        const word = /[\w]/;
        if ((word.test(match[0][0]) && word.test(leaf.data[start-1] || "")) ||
            (word.test(match[0].at(-1)) && word.test(leaf.data[end] || ""))) continue;
        const range = new Range();
        range.setStart(leaf,start); range.setEnd(leaf,end);
        matches.push({range,term:match[0]});
      }
    }
    return matches;
  }
  function refresh() {
    if (retired) return;
    const highlight = new Highlight();
    hits.clear();
    for (const rec of records.values()) {
      const roots = rec.body.hidden ? rec.sources : [rec.body];
      for (const root of roots) {
        const matches = rebuild(root);
        for (const hit of matches) highlight.add(hit.range);
        if (matches.length) hits.set(root, matches);
      }
    }
    CSS.highlights.set(layer,highlight);
    if (anchor && (!anchor.startContainer.isConnected ||
        !anchor.getClientRects().length || !entries.some(e=>e.term===activeTerm))) close();
  }
  function apply(state) {
    if (retired || !state || state.version <= version) return;
    version = state.version;
    entries = state.entries;
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const words = entries.map(e=>e.term).sort((a,b)=>b.length-a.length);
    pattern = words.length ? new RegExp(words.map(escape).join("|"),"giu") : null;
    refresh();
  }
  function place() {
    if (!panel || !anchor) return;
    const r = anchor.getBoundingClientRect(), p = panel.getBoundingClientRect();
    if ((!r.width && !r.height) || r.bottom < 0 || r.top > innerHeight) return close();
    panel.style.left = Math.max(8,Math.min(r.left,innerWidth-p.width-8))+"px";
    const y = r.bottom + p.height + 10 < innerHeight ? r.bottom+5 : r.top-p.height-5;
    panel.style.top = Math.max(8,Math.min(y,innerHeight-p.height-8))+"px";
  }
  function open(hit) {
    const entry = entries.find(e=>e.term.toLowerCase()===hit.term.toLowerCase());
    if (!entry) return;
    close();
    const dialog = document.createElement("aside");
    dialog.className = "nmj-popup";
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-label",entry.term+"的解释");
    dialog.innerHTML = '<header><strong></strong><button type="button" aria-label="关闭解释">关闭</button></header><p class="definition"></p><div class="messages"></div><form><textarea rows="2" maxlength="2000" aria-label="追问 DeepSeek" placeholder="关于这个词，还想知道什么？"></textarea><footer><button type="button" class="remove">移出词库</button><button type="submit">向 DeepSeek 追问</button></footer></form><p role="status"></p>';
    dialog.querySelector("strong").textContent = entry.term;
    dialog.querySelector(".definition").textContent = entry.explanation;
    dialog.querySelector("header button").onclick = close;
    const messages = dialog.querySelector(".messages"), status = dialog.querySelector('[role=status]');
    const question = dialog.querySelector("textarea"), submit = dialog.querySelector('[type=submit]');
    let thread = threads.get(entry.term);
    if (!thread) {
      thread = {history:[], pending:false};
      threads.set(entry.term,thread);
    }
    function renderHistory() {
      messages.replaceChildren(...thread.history.map(m=>{
        const p = document.createElement("p");
        p.textContent = (m.role==="user" ? "你 · " : "DeepSeek · ")+m.content;
        return p;
      }));
      submit.disabled = thread.pending;
      status.textContent = thread.pending ? "DeepSeek 正在回答…" : (thread.error || "");
    }
    thread.draw = renderHistory;
    renderHistory();
    dialog.querySelector("form").onsubmit = async e => {
      e.preventDefault();
      const value = question.value.trim();
      if (!value || thread.pending) return;
      thread.pending = true;
      thread.error = "";
      thread.draw();
      try {
        const history = thread.history.slice(-12).map(m=>({...m,content:m.content.slice(0,8000)}));
        const answer = await node.invoke("glossary-ask",{term:entry.term,history,question:value});
        thread.history.push({role:"user",content:value},{role:"assistant",content:answer});
        question.value = "";
      } catch (error) { thread.error = error.message; }
      finally { thread.pending = false; thread.draw?.(); place(); }
    };
    dialog.querySelector(".remove").onclick = async e => {
      const button = e.currentTarget;
      button.disabled = true;
      try {
        apply(await node.invoke("glossary-remove",{term:entry.term}));
        threads.delete(entry.term);
        if (panel===dialog) close();
      } catch (error) {status.textContent = error.message; button.disabled = false;}
    };
    document.body.append(dialog);
    panel = dialog; activeTerm = entry.term; anchor = hit.range;
    place();
    dialog.querySelector("header button").focus({preventScroll:true});
  }
  listen(document, "mousedown", () => clearTimeout(opening), {capture:true});
  listen(document, "click", e => {
    if (e.target.closest(".nmj-popup")) return;
    if (e.detail!==1 || e.button!==0 || e.target.closest(exclude)) { close(); return; }
    const caret = document.caretRangeFromPoint(e.clientX,e.clientY);
    for (const [root,matches] of hits) {
      if (!root.contains(e.target)) continue;
      const hit = matches.find(({range}) => range.startContainer===caret?.startContainer &&
        Array.from(range.getClientRects()).some(r=>e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom));
      if (hit) { close(); opening = setTimeout(()=>{ if (hit.range.startContainer.isConnected && hit.range.getClientRects().length) open(hit); },300); return; }
    }
    close();
  }, {capture:true});
  listen(window,"resize",place);
  listen(window,"scroll",e=>{if (!panel?.contains(e.target instanceof Node ? e.target : null)) place();}, {capture:true,passive:true});
  listen(document,"keydown",e=>{if (e.key==="Escape" && panel) {e.stopPropagation();close();}}, {capture:true});
  const off = node.on("glossary-changed",apply);
  void node.invoke("glossary",{}).then(apply).catch(()=>{});
  return {apply, refresh, close, dispose() {
    retired = true; close(); off(); threads.clear(); hits.clear(); CSS.highlights.delete(layer);
  }};
}
