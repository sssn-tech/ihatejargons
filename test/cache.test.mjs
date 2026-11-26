import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { activate } from "../src/backend.js";
import { digest,openCache } from "../src/translation-cache.js";
import { visibleItems } from "../src/recent-history.js";

async function temporary(t) {
  const path=await mkdtemp(join(tmpdir(),"ihj-test-"));
  t.after(()=>rm(path,{recursive:true,force:true}));
  return path;
}
test("bounded persistent cache, LRU, build invalidation and in-flight clear",async t=>{
  const dir=await temporary(t), build={version:"0.1.0",hash:digest("a")};
  let c=await openCache(dir,build,1);
  const owner=digest("chat-a"), key=s=>owner+"-"+digest(s);
  const big="a".repeat(410000);
  for(const s of ["a","b"]) await c.run(key(s),async()=>big);
  await c.get(key("a"));await c.run(key("c"),async()=>big);
  assert.equal(c.has(key("b")),false);
  c=await openCache(dir,build,1);
  assert.equal((await c.get(key("a"))).length,big.length);
  let resolve;const pending=c.run(key("d"),()=>new Promise(r=>{resolve=r;}),true);
  await c.clear();resolve("late");await pending;assert.equal(c.stats().bytes,0);
  await c.run(key("a"),async()=>"old");
  c=await openCache(dir,{...build,hash:digest("b")},1);
  assert.equal(c.stats().entries,0);
});

test("chat-level warm, restart hit, prompt change, regeneration and scoped removal",async t=>{
  const dir=await temporary(t), packageDirectory=fileURLToPath(new URL("../",import.meta.url));
  await writeFile(join(dir,"settings.json"),JSON.stringify({provider:"ollama",localModel:"fixture",cloudModel:"test"}));
  let calls=0;const prompts=[];
  t.mock.method(globalThis,"fetch",async (_url,req)=>{
    calls++;prompts.push(JSON.parse(req.body).messages[0].content);
    return Response.json({choices:[{message:{content:"回答 "+calls}}]});
  });
  async function boot(){
    const rpc={};
    const dispose=await activate({packageDirectory,dataDirectory:dir,rpc:{handle:(k,fn)=>rpc[k]=fn,emit(){}}});
    t.after(dispose);return {rpc,dispose};
  }
  let {rpc,dispose}=await boot();
  const config=rpc.settings(), task={kind:"report",target:"订单已核对",question:"进展如何",terms:[],history:[]};
  await rpc["recent-chat"]({chat:"a",tasks:[task],historical:true});
  assert.equal(rpc["chat-states"]({chats:["a","b"]}).a.state,"queued");
  for(let i=0;i<40 && !rpc["cache-stats"]().entries;i++)await new Promise(r=>setTimeout(r,30));
  assert.equal(rpc["chat-states"]({chats:["a"]}).a.state,"done");
  dispose();({rpc,dispose}=await boot());
  const input={...config,chat:"a",task:{...task,mode:"light"}};
  assert.equal(await rpc["cache-lookup"](input),"回答 1");
  assert.equal(await rpc.translate(input),"回答 1");assert.equal(calls,1);
  await rpc.translate({...input,chat:"b"});
  await rpc.translate({...input,force:true});
  assert.equal(await rpc["cache-lookup"](input),"回答 3");
  const level={id:"level-details",name:"展开讲",prompt:"给出每一步的背景",format:"先结论后列清单",layout:"free"};
  await rpc["save-settings"]({...config,levels:[...config.levels,level],warmModes:[],includeHistory:false});
  const custom={...input,task:{...task,mode:level.id}};
  await rpc.translate(custom);
  assert.ok(prompts.at(-1).includes(level.format)&&prompts.at(-1).includes(level.prompt));
  await rpc["save-settings"]({...rpc.settings(),levels:[...config.levels,{...level,prompt:"更短一些"}]});
  assert.equal(await rpc["cache-lookup"](custom),null);
  await rpc["chat-delete"]({chat:"a"});
  assert.equal(await rpc["cache-lookup"](input),null);
  assert.equal(await rpc["cache-lookup"]({...input,chat:"b"}),"回答 2");
  assert.equal(rpc["chat-states"]({chats:["a"]}).a.state,"untouched");
  await rpc["cache-clear"]();assert.equal(rpc["cache-stats"]().bytes,0);
});

test("history uses completed user-visible items and summary_text only",()=>{
  const event=payload=>JSON.stringify({type:"event_msg",payload});
  const item=(type,fields)=>event({type:"item_completed",turn_id:"turn",item:{type,id:type,...fields}});
  const lines=[event({type:"task_started"}),item("UserMessage",{content:[{type:"text",text:"问题"}]}),
    item("Reasoning",{summary_text:["摘要"],raw_content:["NEVER"]}),
    item("McpToolCall",{result:"NEVER"}),item("AgentMessage",{content:[{type:"Text",text:"结果"}],phase:"final_answer"}),
    event({type:"task_complete"}),item("AgentMessage",{content:[{type:"Text",text:"NEVER"}]}),event({type:"turn_aborted"})];
  assert.deepEqual(visibleItems(lines).map(x=>x.text),["问题","摘要","结果"]);
});

test("unopened legacy chats use visible completed events from the recent local index",async t=>{
  const {DatabaseSync}=await import("node:sqlite");
  const {mkdir}=await import("node:fs/promises");
  const {readRecent}=await import("../src/recent-history.js");
  const dir=await temporary(t), sessions=join(dir,"sessions");
  await mkdir(sessions);
  const path=join(sessions,"rollout.jsonl");
  const payloads=[
    {type:"task_started",turn_id:"one"},
    {type:"user_message",message:"问题"},
    {type:"agent_message",message:"汇报"},
    {type:"task_complete",last_agent_message:"汇报"},
    {type:"task_started",turn_id:"two"},
    {type:"user_message",message:"未完成"}
  ];
  await writeFile(path,payloads.map(payload=>JSON.stringify({type:"event_msg",payload})).join("\n"));
  const db=new DatabaseSync(join(dir,"state_1.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT, rollout_path TEXT, source TEXT, updated_at INTEGER, archived INTEGER)");
  const add=db.prepare("INSERT INTO threads VALUES (?,?,?,?,?)");
  add.run("visible",path,"cli",10,0);add.run("archived",path,"cli",20,1);
  add.run("agent",path,"subagent",30,0);db.close();
  const [chat]=await readRecent(1,{},dir);
  assert.equal(chat.id,"visible");
  assert.deepEqual(chat.items.map(x=>x.text),["问题","汇报"]);
  assert.equal((await readRecent(1,{visible:chat.stamp},dir))[0].items,undefined);
  assert.deepEqual(await readRecent(1,{},dir,"archived"),[]);
});
