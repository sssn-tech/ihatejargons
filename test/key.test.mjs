import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { activate } from "../src/backend.js";

async function boot(t) {
  const dataDirectory = await mkdtemp(join(tmpdir(), "ihj-key-"));
  t.after(() => rm(dataDirectory, { recursive: true, force: true }));
  const rpc = {};
  const dispose = await activate({ packageDirectory: fileURLToPath(new URL("../", import.meta.url)), dataDirectory,
    rpc: { handle: (name, fn) => rpc[name] = fn, emit() {} } });
  t.after(dispose);
  return { rpc, dataDirectory };
}

test("a key saved from the settings page wins, is stored privately and only its last four characters come back", async t => {
  const previous = process.env.SILICONFLOW_API_KEY;
  process.env.SILICONFLOW_API_KEY = "sk-from-environment-0000";
  t.after(() => { if (previous === undefined) delete process.env.SILICONFLOW_API_KEY; else process.env.SILICONFLOW_API_KEY = previous; });
  const { rpc, dataDirectory } = await boot(t);

  assert.deepEqual(await rpc["key-status"](), { source: "env", hint: "…0000" });
  assert.deepEqual(await rpc["key-save"]({ key: "  sk-saved-in-plugin-abcd  " }), { source: "plugin", hint: "…abcd" });
  const file = join(dataDirectory, "siliconflow-key");
  assert.equal(await readFile(file, "utf8"), "sk-saved-in-plugin-abcd");
  assert.equal((await stat(file)).mode & 0o777, 0o600);

  let sent;
  t.mock.method(globalThis, "fetch", async (_url, request) => {
    sent = request.headers.Authorization;
    return Response.json({ choices: [{ message: { content: "好" } }] });
  });
  const check = await rpc["check-service"]({ provider: "siliconflow", cloudModel: "deepseek-ai/DeepSeek-V4.1-Flash", localModel: "" });
  assert.equal(sent, "Bearer sk-saved-in-plugin-abcd");
  assert.equal(check.model, "deepseek-ai/DeepSeek-V4.1-Flash");

  assert.deepEqual(await rpc["key-save"]({ key: "" }), { source: "env", hint: "…0000" }, "removing falls back to the environment");
  await assert.rejects(rpc["key-save"]({ key: "has spaces in it" }), /不含空格/);
});

test("checking an Ollama model needs no key and reports a bad model name before any request", async t => {
  const { rpc } = await boot(t);
  t.mock.method(globalThis, "fetch", async url => {
    assert.match(String(url), /127\.0\.0\.1:11434/);
    return Response.json({ choices: [{ message: { content: "好" } }] });
  });
  assert.equal((await rpc["check-service"]({ provider: "ollama", cloudModel: "deepseek-ai/DeepSeek-V4.1-Flash", localModel: "qwen3:8b" })).model, "qwen3:8b");
  await assert.rejects(rpc["check-service"]({ provider: "ollama", cloudModel: "deepseek-ai/DeepSeek-V4.1-Flash", localModel: "" }), /模型名/);
});
