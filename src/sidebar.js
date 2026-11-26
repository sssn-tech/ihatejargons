export const threadRow="[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-id]";
export function chatKey(raw) {
  if (!raw) return "";
  try {
    raw=decodeURIComponent(raw);
    if (raw.startsWith("thread-client-id-v1:"))
      raw=decodeURIComponent(raw.slice("thread-client-id-v1:".length));
  } catch { return raw; }
  const local=/^local:([^:]+)$/.exec(raw);
  return local ? local[1] : raw;
}
const idAttr="data-app-action-sidebar-thread-id";
const states={
  untouched:["○","未触达"],queued:["◷","等待预译"],running:["◐","正在翻译"],
  done:["✓","近期回复已缓存"],partial:["◒","部分已缓存"],error:["!","预译失败"]
};
export const sidebarStyle=`
[data-ihj-row]{position:relative;padding-inline-start:24px!important}
.ihj-indicator{position:absolute;inset-inline-start:2px;top:50%;transform:translateY(-50%);width:20px;height:22px;display:grid;place-items:center;border:0;background:transparent;color:inherit;opacity:.58;font:14px/1 system-ui;border-radius:4px;cursor:pointer}
.ihj-indicator[data-state=running],.ihj-indicator[data-state=queued]{color:var(--color-text-accent,#538aca);opacity:1}
.ihj-indicator[data-state=done]{color:var(--color-text-success,#449b75);opacity:1}
.ihj-indicator[data-state=error]{color:var(--color-text-danger,#c86c45);opacity:1}
.ihj-indicator:hover,.ihj-indicator:focus-visible{background:color-mix(in srgb,currentColor 14%,transparent);opacity:1}
.ihj-chat-menu{position:fixed;z-index:2147483645;box-sizing:border-box;width:min(260px,94vw);padding:10px;display:grid;gap:5px;border-radius:9px;border:1px solid GrayText;box-shadow:0 4px 20px #0003;color-scheme:light dark;background:Canvas;color:CanvasText;font:13px/1.5 system-ui}
.ihj-chat-menu strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ihj-chat-menu button{text-align:start;padding:4px 7px;font:inherit;color:inherit;cursor:pointer;border-radius:4px}
.ihj-chat-menu button:hover{background:color-mix(in srgb,currentColor 12%,transparent)}
`;

export function chatSidebar(node,listen,operate) {
  const badges=new Map();
  let values={}, lastIds="", timer, menu, button, menuChat, request=0, stopped=false;
  function close(focus=false) {
    if(focus && button?.isConnected) button.focus();
    button?.setAttribute("aria-expanded","false");menu?.remove();menu=button=menuChat=null;
  }
  function place() {
    if(!menu) return;
    if(!button?.isConnected) return close();
    const r=button.getBoundingClientRect(), b=menu.getBoundingClientRect();
    menu.style.left=Math.max(4,Math.min(r.left,innerWidth-b.width-4))+"px";
    menu.style.top=Math.max(4,Math.min(r.bottom+2,innerHeight-b.height-4))+"px";
  }
  function showStatus() {
    if(!menu)return;
    const data=values[menuChat] || {state:"untouched",entries:0,total:0};
    menu.querySelector("output").textContent=states[data.state][1]+(data.total?" · "+data.done+"/"+data.total:"")+" · 本聊天缓存 "+data.entries+" 条"+(data.error?" · "+data.error:"");
  }
  function open(row,b) {
    if(button===b) return close(true);
    close();button=b;menuChat=chatKey(row.getAttribute(idAttr));
    const chat=menuChat;
    menu=document.createElement("section");menu.className="ihj-chat-menu";menu.dataset.ihjSidebar="";
    menu.setAttribute("role","dialog");menu.setAttribute("aria-label","聊天翻译操作");
    menu.innerHTML='<strong></strong><output></output>';
    menu.querySelector("strong").textContent=row.getAttribute("data-app-action-sidebar-thread-title") || "聊天翻译";
    const panel=menu;
    for(const [action,label] of [["warm","预译最近回复"],["regenerate","重新翻译最近回复"],["delete","删除本聊天全部译文缓存"]]) {
      const ctl=document.createElement("button");ctl.type="button";ctl.textContent=label;
      ctl.onclick=async()=>{
        for (const el of panel.querySelectorAll("button")) el.disabled=true;
        try {await operate(chat,action); if(menu===panel) close(true); refresh();}
        catch(e){panel.querySelector("output").textContent=e.message;for (const el of panel.querySelectorAll("button")) el.disabled=false;}
      };
      menu.append(ctl);
    }
    document.body.append(menu);b.setAttribute("aria-expanded","true");showStatus();place();menu.querySelector("button").focus();
  }
  function paint() {
    for(const [row,b] of badges){
      const id=chatKey(row.getAttribute(idAttr)), state=values[id]?.state || "untouched";
      const label=states[state][1]+" · 聊天翻译操作";
      if(b.dataset.state!==state) {b.dataset.state=state;b.textContent=states[state][0];b.title=label;b.setAttribute("aria-label",label);}
    }
    showStatus();
  }
  function refresh() {
    if(stopped || timer)return;
    timer=setTimeout(async()=>{
      timer=null;const seq=++request;
      const chats=[...new Set([...badges.keys()].map(r=>chatKey(r.getAttribute(idAttr))))];
      if(!chats.length)return;
      try{const data=await node.invoke("chat-states",{chats});if(seq===request && !stopped){values=data;paint();}}
      catch { /* The next host notification retries after a reconnect. */ }
    },60);
  }
  function scan() {
    for(const [row,b] of badges) {
      if(row.isConnected && b.parentElement===row && b.dataset.owner===chatKey(row.getAttribute(idAttr))) continue;
      if(button===b) close();b.remove();row.removeAttribute("data-ihj-row");badges.delete(row);
    }
    for(const row of document.querySelectorAll(threadRow)) {
      if(badges.has(row))continue;
      const b=document.createElement("button");b.type="button";b.className="ihj-indicator";
      b.dataset.ihjSidebar="";b.dataset.owner=chatKey(row.getAttribute(idAttr));
      b.setAttribute("aria-haspopup","dialog");b.setAttribute("aria-expanded","false");b.draggable=false;
      for(const event of ["pointerdown","mousedown","dblclick","keydown","dragstart"]) b.addEventListener(event,e=>e.stopPropagation());
      b.onclick=e=>{e.preventDefault();e.stopPropagation();open(row,b);};
      row.setAttribute("data-ihj-row","");row.prepend(b);badges.set(row,b);
    }
    const ids=JSON.stringify([...badges.keys()].map(r=>chatKey(r.getAttribute(idAttr))));
    if(lastIds!==ids){lastIds=ids;refresh();}
    paint();
  }
  listen(document,"pointerdown",e=>{if(menu && !menu.contains(e.target) && !button.contains(e.target)) close();},{capture:true});
  listen(document,"keydown",e=>{if(menu && e.key==="Escape"){e.stopPropagation();close(true);}},{capture:true});
  listen(window,"resize",place);listen(window,"scroll",place,{capture:true,passive:true});
  const off=node.on("chat-state-change",refresh);
  return {scan,dispose(){stopped=true;off();clearTimeout(timer);close();for(const [row,b] of badges){b.remove();row.removeAttribute("data-ihj-row");}badges.clear();}};
}
