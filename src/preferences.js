import { builtInLevels } from "./levels.js";
import { recommendedModel } from "./models.js";

export const defaults = {provider:"siliconflow",localModel:"",cloudModel:recommendedModel,
  cacheMB:32,includeHistory:true,recentChats:3,recentBlocks:4,warmModes:["light"],defaultMode:"light",levels:builtInLevels};

export function settingsOf(input) {
  const s={...defaults,...input};
  if (!["siliconflow","ollama"].includes(s.provider) || typeof s.localModel!=="string" ||
      s.localModel.length>200 || (s.provider==="ollama" && !s.localModel.trim()) ||
      typeof s.cloudModel!=="string" || !/^[\w./-]{1,160}$/.test(s.cloudModel)) throw Error("请选择服务并填写有效的模型名。");
  for (const [value,min,max] of [[s.cacheMB,0,2048],[s.recentChats,0,30],[s.recentBlocks,1,30]]) {
    if (!Number.isInteger(value) || value<min || value>max) throw Error("缓存或预译范围超出设置页标注的范围。");
  }
  if (!Array.isArray(s.levels) || !s.levels.length || s.levels.length>16) throw Error("请保留 1 到 16 个翻译等级。");
  if (typeof s.includeHistory!=="boolean") throw Error("请选择预译范围。");
  const ids=new Set();
  const levels=s.levels.map(({id,name,prompt,format,layout})=>{
    if (typeof id!=="string" || !/^(light|deep|level-[a-z0-9-]{1,64})$/.test(id) || ids.has(id) ||
        typeof name!=="string" || !name.trim() || name.length>32 || typeof prompt!=="string" ||
        !prompt.trim() || prompt.length>12000 || typeof format!=="string" || format.length>4000 ||
        !["source","free"].includes(layout)) throw Error("请检查等级名称、提示词和格式。");
    ids.add(id); return {id,name:name.trim(),prompt:prompt.trim(),format:format.trim(),layout};
  });
  if (!ids.has(s.defaultMode) || !Array.isArray(s.warmModes) || s.warmModes.some(id=>!ids.has(id))) throw Error("请选择有效的默认和预译等级。");
  return {provider:s.provider,cloudModel:s.cloudModel,localModel:s.localModel.trim(),cacheMB:s.cacheMB,
    includeHistory:s.includeHistory,recentChats:s.recentChats,recentBlocks:s.recentBlocks,defaultMode:s.defaultMode,warmModes:[...new Set(s.warmModes)],levels};
}
