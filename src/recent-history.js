import { open, readdir, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { homedir } from "node:os";

// Only completed, user-visible event items are eligible. Tool calls, tool output,
// system/developer instructions, raw reasoning, attachments and aborted turns are ignored.
export function visibleItems(lines) {
  let turn=[], legacy=[], complete=[], turnId;
  function reset(id) {
    turn=[]; legacy=[]; turnId=id;
  }
  function addLegacy(role,kind,text) {
    if (typeof text==="string" && text.trim() && text.length<=96000)
      legacy.push({role,kind,text,turn:turnId});
  }
  for (const line of lines) {
    if (!line.includes('"event_msg"')) continue;
    let event;
    try { event=JSON.parse(line); } catch { continue; }
    if (event.type!=="event_msg") continue;
    const p=event.payload;
    if (!p) continue;
    if (p.type==="task_started" || p.type==="turn_aborted") {reset(p.turn_id);continue;}
    if (p.type==="task_complete") {
      if (!legacy.some(row=>row.kind==="report" && row.role==="assistant"))
        addLegacy("assistant","report",p.last_agent_message);
      const rows=turn.some(row=>row.role==="assistant") ? turn : legacy;
      if (rows.some(row=>row.role==="user")) complete=complete.concat(rows).slice(-64);
      reset();continue;
    }
    if (p.type==="user_message") addLegacy("user","report",p.message);
    if (p.type==="agent_message") addLegacy("assistant",p.phase==="commentary"?"summary":"report",p.message);
    if (p.type!=="item_completed") continue;
    const item=p.item;
    let parts, role, kind;
    if (item?.type==="UserMessage" || item?.type==="AgentMessage") {
      role=item.type==="UserMessage"?"user":"assistant";
      kind=item.phase==="commentary"?"summary":"report";
      parts=[(item.content || []).filter(v=>["text","Text"].includes(v.type) && typeof v.text==="string").map(v=>v.text).join("\n")];
    } else if (item?.type==="Reasoning") {
      parts=(item.summary_text || []).filter(v=>typeof v==="string");
      role="assistant";kind="summary";
    } else continue;
    for (const text of parts) {
      if (!text.trim() || text.length>96000) continue;
      turn.push({role,kind,text,id:item.id,turn:p.turn_id});
    }
  }
  // Supply preceding context without sending an unbounded transcript over IPC.
  let size=0;
  for (let i=complete.length-1;i>=0;i--) {
    size+=complete[i].text.length;
    if (size>200000) return complete.slice(i+1);
  }
  return complete;
}

export async function readRecent(limit, known={}, home=process.env.CODEX_HOME || join(homedir(),".codex"), id=null) {
  if (!limit) return [];
  const names=(await readdir(home)).filter(n=>/^state_\d+\.sqlite$/.test(n)).sort((a,b)=>Number(b.match(/\d+/)[0])-Number(a.match(/\d+/)[0]));
  if (!names.length) throw Error("未找到本机 Codex 聊天索引。");
  const { DatabaseSync }=await import("node:sqlite");
  const db=new DatabaseSync(join(home,names[0]),{readOnly:true});
  let rows;
  try {
    if (id) rows=db.prepare("SELECT id, rollout_path FROM threads WHERE id=? AND archived=0").all(id);
    else rows=db.prepare("SELECT id, rollout_path FROM threads WHERE archived=0 AND source IN ('vscode','cli','exec','appServer') ORDER BY updated_at DESC, id DESC LIMIT ?").all(limit);
  } finally { db.close(); }
  const root=await realpath(join(home,"sessions"));
  const result=[];
  for (const row of rows.reverse()) {
    try {
      const path=await realpath(row.rollout_path);
      if (!path.startsWith(root+sep) || !path.endsWith(".jsonl")) continue;
      const info=await stat(path), stamp=info.size+"-"+info.mtimeMs;
      const record={id:row.id,stamp};
      if (known[row.id]!==stamp) {
        const file=await open(path,"r");
        try {
          const length=Math.min(info.size,8*1024*1024), buffer=Buffer.alloc(length);
          const {bytesRead}=await file.read(buffer,0,length,info.size-length);
          const lines=buffer.toString("utf8",0,bytesRead).split("\n");
          if (info.size>length) lines.shift();
          record.items=visibleItems(lines);
        } finally {await file.close();}
      }
      result.push(record);
    } catch(e) { if (e.code!=="ENOENT") throw e; }
  }
  return result;
}
