import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const digest = value => createHash("sha256").update(value).digest("hex");

export async function buildIdentity(directory) {
  const manifest = await readFile(join(directory,"package.json"));
  const hash = createHash("sha256").update(manifest);
  async function include(relative) {
    const entries = await readdir(join(directory,relative),{withFileTypes:true});
    for (const entry of entries.sort((a,b)=>a.name.localeCompare(b.name,"en"))) {
      const name = join(relative,entry.name);
      if (entry.isDirectory()) await include(name);
      else if (entry.isFile()) hash.update(name+"\0").update(await readFile(join(directory,name)));
    }
  }
  await include("src");
  return {version:JSON.parse(manifest).version, hash:hash.digest("hex")};
}

// All filesystem mutations run in one queue. The generation prevents an old request
// from refilling the cache after a clear; the model call itself never holds the queue.
export async function openCache(directory, build, limitMB) {
  const dir = join(directory,"translations");
  await mkdir(dir,{recursive:true,mode:0o700});
  const prefix = build.version+"-"+build.hash+"-";
  const files = new Map(), pending = new Map();
  let bytes = 0, generation = 0, queue = Promise.resolve();
  const path = key => join(dir,prefix+key+".txt");
  const stats = () => ({...build,entries:files.size,bytes,limitMB});
  function serial(fn) {
    const op = queue.then(fn);
    queue = op.catch(()=>{});
    return op;
  }
  async function remove(key) {
    if (!files.has(key)) return;
    try { await unlink(path(key)); } catch (e) { if (e.code!=="ENOENT") throw e; }
    bytes -= files.get(key);
    files.delete(key);
  }
  async function prune() {
    while (bytes>limitMB*1048576 && files.size) await remove(files.keys().next().value);
  }
  const current = [];
  for (const file of await readdir(dir)) {
    if (!file.startsWith(prefix) || !/^[a-f0-9]{64}-[a-f0-9]{64}\.txt$/.test(file.slice(prefix.length))) {
      if (file.endsWith(".txt") || file.endsWith(".tmp")) await unlink(join(dir,file));
      continue;
    }
    const info = await stat(join(dir,file));
    current.push({key:file.slice(prefix.length,-4),size:info.size,t:info.mtimeMs});
  }
  for (const row of current.sort((a,b)=>a.t-b.t)) { files.set(row.key,row.size); bytes+=row.size; }
  await prune();

  function get(key) {
    return serial(async () => {
      if (!files.has(key)) return null;
      try {
        const output = await readFile(path(key),"utf8");
        const now = new Date();
        await utimes(path(key),now,now);
        const size=files.get(key);
        files.delete(key); files.set(key,size);
        return output;
      } catch (e) {
        if (e.code!=="ENOENT") throw e;
        await remove(key);
        return null;
      }
    });
  }
  function run(key,generate,force=false) {
    if (pending.has(key) && !force) return pending.get(key);
    const epoch = generation;
    const job = (async () => {
      if (!force) {
        const hit = await get(key);
        if (hit!==null) return hit;
      }
      const output = await generate();
      await serial(async () => {
        if (generation!==epoch || pending.get(key)!==job) return;
        const size = Buffer.byteLength(output);
        if (!limitMB || size>limitMB*1048576) { await remove(key); return; }
        const temp=join(dir,randomUUID()+".tmp");
        await writeFile(temp,output,{mode:0o600});
        await rename(temp,path(key));
        bytes+=size-(files.get(key)||0);
        files.delete(key); files.set(key,size);
        await prune();
      });
      return output;
    })();
    pending.set(key,job);
    const finish=()=>{ if (pending.get(key)===job) pending.delete(key); };
    job.then(finish,finish);
    return job;
  }
  return {get,run,stats,has:key=>files.has(key),
    counts() {
      const totals=new Map();
      for (const key of files.keys()) {
        const owner=key.slice(0,64);
        totals.set(owner,(totals.get(owner)||0)+1);
      }
      return totals;
    },
    removeChat(owner) {
      const prefix=owner+"-";
      for(const key of pending.keys()) if(key.startsWith(prefix)) pending.delete(key);
      return serial(async()=>{for(const key of files.keys()) if(key.startsWith(prefix)) await remove(key);});
    },
    resize(size) { return serial(async()=>{limitMB=size; await prune();}); },
    clear() {
      generation++; pending.clear();
      return serial(async()=>{for (const key of files.keys()) await remove(key); return stats();});
    }
  };
}
