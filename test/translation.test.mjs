import assert from "node:assert/strict";
import test from "node:test";
import { translate } from "../src/backend.js";

const task = {
  mode:"deep", kind:"report", question:"能继续发布吗？", history:[],
  target:"| 结果 | 原因 |\n| --- | --- |\n| 金丝雀晋级暂停 | 旧消息缺少 ⟦T0⟧ |",
  terms:[{token:"⟦T0⟧",label:"event_id"}]
};
const config = {provider:"ollama",localModel:"fixture"};

function reply(t, responses) {
  const requests = [];
  t.mock.method(globalThis,"fetch", async (url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({choices:[{message:{content:responses.shift()}}]});
  });
  return requests;
}

test("a draft that keeps every placeholder is returned after one model call", async t => {
  const draft = "扩大发布先停下了。旧消息缺少编号 ⟦T0⟧，需要先查清原因。";
  const requests = reply(t, [draft]);
  assert.equal(await translate(task, config), draft);
  assert.equal(requests.length, 1);
});

test("a dropped placeholder gets one repair call, and a second miss is an error", async t => {
  const fixed = "扩大发布先停下了。旧消息缺少编号 ⟦T0⟧。";
  const requests = reply(t, ["扩大发布先停下了。旧消息缺少编号 event_id 和 ⟦T1⟧。", fixed]);
  assert.equal(await translate(task, config), fixed);
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages.at(-1).content, /⟦T0⟧/);

  reply(t, ["没有占位符", "还是没有"]);
  await assert.rejects(translate(task, config), /排版标记/);
});

test("a field named twice is accepted as is", async t => {
  const draft = "旧消息缺少 ⟦T0⟧。补上 ⟦T0⟧ 之前先暂停扩大。";
  const requests = reply(t, [draft]);
  assert.equal(await translate({...task, terms:[]}, config), draft);
  assert.equal(requests.length, 1);
});

test("the prompt carries the level's own wording and only the placeholders in this target", async t => {
  const requests = reply(t, ["好的 ⟦T0⟧"]);
  await translate({...task, mode:"light"}, config);
  const system = requests[0].messages[0].content;
  assert.match(system, /简明改写/);
  assert.match(system, /必须原样保留的占位符：⟦T0⟧/);
  assert.doesNotMatch(system, /讲给外行/);
});
