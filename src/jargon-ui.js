const layer = "nmj-terms";
const exclude = "pre,script,style,a,button,textarea,input,select,[contenteditable=true],[role=button],[aria-hidden=true],[data-markdown-copy=exclude]:not([data-cxt-view]),[hidden],[data-cxt-hidden]";
export const jargonStyle = `
::highlight(nmj-terms){text-decoration:underline dashed;text-decoration-color:color-mix(in srgb,currentColor 50%,transparent)}
.nmj-popup {position:fixed;z-index:2147483646;box-sizing:border-box;width:min(340px,calc(100vw - 16px));max-height:min(440px,70vh);overflow:auto;overscroll-behavior:contain;background:Canvas;color:CanvasText;color-scheme:light dark;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:10px;padding:14px;box-shadow:0 6px 24px #0003;font:13px/1.55 system-ui;overflow-wrap:anywhere}
.nmj-popup header,.nmj-popup footer {display:flex;align-items:center;justify-content:space-between;gap:8px}
.nmj-popup p {white-space:pre-wrap;margin:8px 0}
.nmj-popup textarea {display:block;width:100%;box-sizing:border-box;margin:10px 0;resize:vertical;font:inherit;border:1px solid GrayText;border-radius:5px;padding:6px;background:Field;color:FieldText}
.nmj-popup button {font:inherit;cursor:pointer;color:inherit;text-decoration:underline}
`;

// Index native text with Ranges so React keeps ownership of the original Markdown and controls.
export function jargonUI(node, records, listen, schedule) {
  let opening = 0, detecting = 0, panel, activeTerm, anchor, retired = false;
  const hits = new Map(), threads = new WeakMap();
  function close() {
    clearTimeout(opening);
    const thread = threads.get(activeTerm);
    if (thread) thread.draw = null;
    panel?.remove();
    panel = null;
    activeTerm = anchor = null;
  }
  // Offsets refer to this exact displayed passage, including paragraph boundaries.
  function passageFor(rec) {
    const roots=rec.mode==="original" ? rec.sources : [rec.body];
    const leaves=[];
    let text="", previousBlock;
    for (const root of roots) {
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const leaf=walker.currentNode;
        if (!leaf.data || leaf.parentElement.closest(exclude)) {previousBlock=null;continue;}
        const block=leaf.parentElement.closest("p,li,td,th,blockquote,h1,h2,h3,h4,h5,h6") || root;
        if (text && block!==previousBlock) text+="\n";
        const start=text.length;
        text+=leaf.data;
        leaves.push({leaf,root,start,end:text.length});
        previousBlock=block;
      }
    }
    return {text,leaves};
  }
  function jobsFor(text) {
    const jobs=[];
    for (let start=0;start<text.length;) {
      let end=Math.min(text.length,start+6400);
      if (end<text.length) {
        const boundary=Math.max(text.lastIndexOf("\n",end-1),text.lastIndexOf("。",end-1));
        if (boundary>start+3200) end=boundary+1;
      }
      const passage=text.slice(start,end);
      if (passage.trim()) jobs.push({start,passage,state:"waiting",entries:[]});
      start=end;
    }
    return jobs;
  }
  function queue(rec,limit) {
    if (rec.mode!=="original" && rec.body.hidden) return;
    const version=rec.mode==="original" ? rec.task : rec.outputs[rec.mode];
    let annotation=rec.annotations.get(rec.mode);
    if (!annotation || annotation.version!==version) {
      if (detecting>=limit) return;
      const {text}=passageFor(rec);
      const labels=new Map(rec.task.terms.map(item=>[item.token,item.label]));
      const original=rec.task.target.replace(/⟦T\d+⟧/g,token=>labels.get(token) || " ");
      annotation={version,text,original,jobs:jobsFor(text)};
      rec.annotations.set(rec.mode,annotation);
    }
    const mode=rec.mode;
    for (const job of annotation.jobs) {
      if (detecting>=limit) break;
      if (job.state!=="waiting") continue;
      detecting++;
      job.state="running";
      // Include the original reply alongside a rewrite. For long replies retain
      // the opening and nearby source text within the context budget.
      const original=annotation.original;
      const offset=Math.floor(job.start/Math.max(1,annotation.text.length)*original.length);
      const from=Math.max(1600,Math.min(original.length-6300,offset-2500));
      const context=original.length<=8000 ? original : original.slice(0,1600)+"\n…\n"+original.slice(from,from+6300);
      const current=()=>!retired && records.get(rec.source)===rec && rec.annotations.get(mode)===annotation;
      void node.invoke("glossary-detect",{question:rec.task.question,original:context,passage:job.passage}).then(entries=>{
        if (!current()) return;
        job.entries=entries.map(entry=>({...entry,start:entry.start+job.start,context}));
        job.state="done";
      }).catch(error=>{
        if (current()) {job.state="failed";job.error=error.message || "术语识别失败";}
      }).finally(()=>{detecting--;schedule();});
    }
  }
  function refresh() {
    if (retired) return;
    const highlight=new Highlight();
    hits.clear();
    for (const rec of records.values()) {
      if (rec.mode!=="original" && rec.body.hidden) continue;
      const annotation=rec.annotations?.get(rec.mode);
      if (!annotation || (rec.mode!=="original" && annotation.version!==rec.outputs[rec.mode])) continue;
      const entries=annotation.jobs.flatMap(j=>j.entries);
      if (!entries.length) continue;
      const {text,leaves}=passageFor(rec);
      if (annotation.text!==text) {rec.annotations.delete(rec.mode);schedule();continue;}
      for (const entry of entries) {
        const end=entry.start+entry.term.length;
        if (text.slice(entry.start,end)!==entry.term) continue;
        const first=leaves.find(l=>l.end>entry.start && l.start<=entry.start);
        const last=leaves.find(l=>l.end>=end && l.start<end);
        if (!first || first.root!==last?.root) continue;
        const range=new Range();
        range.setStart(first.leaf,entry.start-first.start);
        range.setEnd(last.leaf,end-last.start);
        highlight.add(range);
        if (!hits.has(first.root)) hits.set(first.root,[]);
        hits.get(first.root).push({range,entry});
      }
    }
    CSS.highlights.set(layer,highlight);
    if (anchor && (!anchor.startContainer.isConnected || !anchor.getClientRects().length ||
        ![...hits.values()].some(items=>items.some(hit=>hit.entry===activeTerm)))) close();
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
    const entry = hit.entry;
    if (!entry) return;
    close();
    const dialog = document.createElement("aside");
    dialog.className = "nmj-popup";
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-label",entry.term+"的解释");
    dialog.innerHTML = '<header><strong></strong><button type="button" aria-label="关闭解释">关闭</button></header><p class="definition"></p><div class="messages"></div><form><textarea rows="2" maxlength="2000" aria-label="追问 DeepSeek" placeholder="关于这个词，还想知道什么？"></textarea><footer><button type="submit">向 DeepSeek 追问</button></footer></form><p role="status"></p>';
    dialog.querySelector("strong").textContent = entry.term;
    dialog.querySelector(".definition").textContent = entry.explanation;
    dialog.querySelector("header button").onclick = close;
    const messages = dialog.querySelector(".messages"), status = dialog.querySelector('[role=status]');
    const question = dialog.querySelector("textarea"), submit = dialog.querySelector('[type=submit]');
    let thread = threads.get(entry);
    if (!thread) {
      thread = {history:[], pending:false};
      threads.set(entry,thread);
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
        const answer = await node.invoke("glossary-ask",{term:entry.term,explanation:entry.explanation,quote:entry.quote,context:entry.context,history,question:value});
        thread.history.push({role:"user",content:value},{role:"assistant",content:answer});
        question.value = "";
      } catch (error) { thread.error = error.message; }
      finally { thread.pending = false; thread.draw?.(); place(); }
    };
    document.body.append(dialog);
    panel = dialog; activeTerm = entry; anchor = hit.range;
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
      const hit = matches.find(({range}) => caret && range.isPointInRange(caret.startContainer,caret.startOffset) &&
        Array.from(range.getClientRects()).some(r=>e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom));
      if (hit) { close(); opening = setTimeout(()=>{ if (hit.range.startContainer.isConnected && hit.range.getClientRects().length) open(hit); },300); return; }
    }
    close();
  }, {capture:true});
  listen(window,"resize",place);
  listen(window,"scroll",e=>{if (!panel?.contains(e.target instanceof Node ? e.target : null)) place();}, {capture:true,passive:true});
  listen(document,"keydown",e=>{if (e.key==="Escape" && panel) {e.stopPropagation();close();}}, {capture:true});
  return {queue, refresh, close, dispose() {
    retired = true; close(); hits.clear(); CSS.highlights.delete(layer);
  }};
}
