import assert from "node:assert/strict";
import test from "node:test";
import { translate } from "../src/backend.js";

test("a jargon-heavy table can be edited into short prose with its inline field intact", async t => {
  const task = {
    mode:"deep", kind:"report", question:"能继续发布吗？", history:[],
    target:"| 结果 | 原因 |\n| --- | --- |\n| 金丝雀晋级暂停 | 旧消息缺少 ⟦T0⟧ |",
    terms:[{token:"⟦T0⟧",label:"event_id"}]
  };
  const expected = "先暂停扩大试用。旧消息缺少编号 ⟦T0⟧，需要先查清原因。";
  const responses = [task.target, expected];
  t.mock.method(globalThis,"fetch", async () => Response.json({
    choices:[{message:{content:responses.shift()}}]
  }));
  assert.equal(await translate(task,{provider:"ollama",localModel:"fixture"}),expected);
  assert.equal(responses.length,0);
});
