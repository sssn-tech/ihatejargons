import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Metadata contains hashes of expected cached translations, never the chat text.
export async function openPlans(dir,build) {
  const file=join(dir,"translation-plans.json");
  let state=new Map(), writes=Promise.resolve();
  try {
    const saved=JSON.parse(await readFile(file,"utf8"));
    if (saved.build===build.hash) state=new Map(saved.plans);
  } catch(e) { if(e.code!=="ENOENT" && !(e instanceof SyntaxError)) throw e; }
  function save() {
    const json=JSON.stringify({build:build.hash,plans:[...state]});
    const op=writes.then(async()=>{
      const tmp=file+"."+randomUUID();
      await writeFile(tmp,json,{mode:0o600}); await rename(tmp,file);
    });
    writes=op.catch(()=>{});return op;
  }
  return {get:owner=>state.get(owner),clear(){state.clear();return save();},
    set(owner,plan){
      if (JSON.stringify(state.get(owner))===JSON.stringify(plan)) return;
      state.delete(owner);state.set(owner,plan);
      if(state.size>2048) state.delete(state.keys().next().value);
      return save();
    }};
}
