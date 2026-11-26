import test from "node:test";
import assert from "node:assert/strict";
import { requestPool } from "../src/request-pool.js";
import { registerGlossary } from "../src/glossary.js";
import { defaults, settingsOf } from "../src/preferences.js";

test("legacy settings acquire independent limits; queued foreground work goes first", async()=>{
  assert.equal(settingsOf({}).textConcurrency,4);
  assert.equal(settingsOf({}).termConcurrency,2);
  assert.throws(()=>settingsOf({termConcurrency:0}));
  let limit=1;
  const pool=requestPool(()=>limit);
  const started=[], gates=[];
  const run=(id,background=false)=>pool.run(()=>new Promise(resolve=>{started.push(id);gates.push(resolve);}),background);
  const jobs=[run(1),run(2,true),run(3),run(4)];
  await new Promise(setImmediate);
  assert.deepEqual(started,[1]);
  limit=2;pool.drain();
  await new Promise(setImmediate);
  assert.deepEqual(started,[1,3]);
  gates.shift()();await new Promise(setImmediate);
  assert.deepEqual(started,[1,3,4]);
  gates.shift()();await new Promise(setImmediate);
  assert.deepEqual(started,[1,3,4,2]);
  for(const release of gates) release();
  await Promise.all(jobs);
});

test("each annotation is anchored to its own occurrence and current context",async()=>{
  const handlers={},seen=[];
  const rpc={handle:(name,fn)=>handlers[name]=fn};
  const pool=requestPool(()=>2);
  registerGlossary(rpc,()=>defaults,async (_config,messages)=>{
    seen.push(messages);
    const {passage,question}=JSON.parse(messages[1].content);
    if(!passage) return "追问结果";
    return JSON.stringify([
      {term:"窗口",quote:"观察窗口",explanation:question+"：观察时段"},
      {term:"窗口",quote:"应用窗口",explanation:question+"：屏幕上的界面"},
      {term:"窗口",quote:"另一个窗口",explanation:"幻觉"}]);
  },defaults,pool);
  const input={passage:"观察窗口结束。打开应用窗口。",original:"原文",question:"甲"};
  const first=await handlers["glossary-detect"](input);
  const second=await handlers["glossary-detect"]({...input,question:"乙"});
  assert.deepEqual(first.map(x=>x.start),[2,11]);
  assert.deepEqual(second.map(x=>x.explanation),["乙：观察时段","乙：屏幕上的界面"]);
  assert.equal(seen.length,2);
  await handlers["glossary-ask"]({...second[1],context:"乙的原文",question:"哪个界面？",history:[]});
  assert.equal(JSON.parse(seen.at(-1)[1].content).context,"乙的原文");
  assert.equal(handlers.glossary,undefined);
});
