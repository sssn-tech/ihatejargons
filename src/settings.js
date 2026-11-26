import { cloudModels, recommendedModel } from "./models.js";
import { defaults } from "./preferences.js";

export function mountSettings(container, node) {
  const form=document.createElement("form");
  form.className="cxt-settings";
  form.innerHTML=`
    <h2>ihatejargons</h2>
    <fieldset><legend>翻译服务</legend>
      <label>服务<select name="provider"><option value="siliconflow">硅基流动</option><option value="ollama">本机 Ollama</option></select></label>
      <label>硅基流动模型<input name="cloudModel" maxlength="160"></label>
      <label>本地模型<input name="localModel" maxlength="200" placeholder="已下载的 Ollama 模型名"></label>
    </fieldset>
    <fieldset><legend>本地缓存与预译</legend>
      <label>缓存上限（MiB，0 关闭）<input name="cacheMB" type="number" min="0" max="2048" required></label>
      <output class="ihj-meter" aria-live="off"></output>
      <div><button type="button" data-action="clear">清空译文缓存</button> <button type="button" data-action="warm">立即预译</button></div>
      <label>最近聊天数（0 关闭预译）<input name="recentChats" type="number" min="0" max="30" required></label>
      <label>每个聊天最近的回复块数<input name="recentBlocks" type="number" min="1" max="30" required></label>
      <label><span><input name="includeHistory" type="checkbox"> 包含尚未打开的本机历史聊天</span></label>
      <small>后台按选中的等级，把已完成的可见回复和必要前文交给所选模型。云服务按调用计费。</small>
      <div>后台预译等级</div><div class="ihj-warm-levels"></div>
    </fieldset>
    <fieldset><legend>阅读等级</legend>
      <label>默认显示<select name="defaultMode"></select></label>
      <label>编辑等级<select name="editor"></select></label>
      <div><button type="button" data-action="add">添加等级</button> <button type="button" data-action="up">上移</button> <button type="button" data-action="down">下移</button> <button type="button" data-action="remove">移除</button></div>
      <label>按钮名称<input name="levelName" maxlength="32" required></label>
      <label>写作提示词<textarea name="prompt" rows="5" maxlength="12000" required></textarea></label>
      <label>输出格式<textarea name="format" rows="3" maxlength="4000" placeholder="例如：先给结论，再用列表逐项解释原因"></textarea></label>
      <label>Markdown 布局<select name="layout"><option value="source">保留原表格行列</option><option value="free">自由组织段落、列表或表格</option></select></label>
    </fieldset>
    <button type="submit">保存设置</button><p role="status"></p>`;
  const fields=form.elements, status=form.querySelector('[role=status]');
  const action=id=>form.querySelector('[data-action="'+id+'"]');
  const meter=form.querySelector(".ihj-meter");
  const choices=document.createElement("datalist");
  choices.id="ihj-models-"+crypto.randomUUID();
  choices.append(...cloudModels.map(id=>new Option(id,id))); form.append(choices);
  fields.cloudModel.setAttribute("list",choices.id);
  let draft, disposed=false;
  function selected(){return draft.levels.find(l=>l.id===fields.editor.value);}
  function refreshLevels(id) {
    for (const select of [fields.defaultMode,fields.editor]) select.replaceChildren(...draft.levels.map(l=>new Option(l.name,l.id)));
    fields.defaultMode.value=draft.defaultMode; fields.editor.value=id;
    const level=selected();
    fields.levelName.value=level.name;fields.prompt.value=level.prompt;
    fields.format.value=level.format;fields.layout.value=level.layout;
    const i=draft.levels.indexOf(level);
    action("up").disabled=i===0;action("down").disabled=i===draft.levels.length-1;
    action("remove").disabled=draft.levels.length===1; action("add").disabled=draft.levels.length>=16;
    const checks=form.querySelector(".ihj-warm-levels");
    checks.replaceChildren(...draft.levels.map(l=>{
      const label=document.createElement("label"), box=document.createElement("input");
      box.type="checkbox";box.checked=draft.warmModes.includes(l.id);
      box.onchange=()=>{draft.warmModes=draft.warmModes.filter(mode=>mode!==l.id);if(box.checked) draft.warmModes.push(l.id);};
      label.append(box,l.name);return label;
    }));
  }
  function toggleProvider(){
    const local=fields.provider.value==="ollama";
    fields.localModel.required=local;fields.localModel.parentElement.hidden=!local;
    fields.cloudModel.required=!local;fields.cloudModel.parentElement.hidden=local;
  }
  fields.provider.onchange=toggleProvider;
  fields.defaultMode.onchange=()=>{draft.defaultMode=fields.defaultMode.value;};
  fields.editor.onchange=()=>refreshLevels(fields.editor.value);
  fields.levelName.oninput=()=>{
    const level=selected();level.name=fields.levelName.value;
    for (const select of [fields.defaultMode,fields.editor]) select.options[draft.levels.indexOf(level)].text=level.name;
    form.querySelectorAll(".ihj-warm-levels label")[draft.levels.indexOf(level)].lastChild.textContent=level.name;
  };
  fields.prompt.oninput=()=>{selected().prompt=fields.prompt.value;};
  fields.format.oninput=()=>{selected().format=fields.format.value;};
  fields.layout.onchange=()=>{selected().layout=fields.layout.value;};
  action("add").onclick=()=>{
    const l={id:"level-"+crypto.randomUUID(),name:"新等级",prompt:"用通俗中文解释原文，先交代背景，再逐步说明原因和影响。",format:"先给结论，再用要点解释。",layout:"free"};
    draft.levels.splice(draft.levels.indexOf(selected())+1,0,l);refreshLevels(l.id);fields.levelName.select();
  };
  for(const [name,delta] of [["up",-1],["down",1]]) action(name).onclick=()=>{
    const level=selected(),i=draft.levels.indexOf(level);
    draft.levels.splice(i,1);draft.levels.splice(i+delta,0,level);refreshLevels(level.id);
  };
  action("remove").onclick=()=>{
    const id=selected().id;
    draft.levels=draft.levels.filter(l=>l.id!==id);draft.warmModes=draft.warmModes.filter(key=>key!==id);
    if(draft.defaultMode===id) draft.defaultMode=draft.levels[0].id;
    refreshLevels(draft.defaultMode);
  };
  async function updateMeter() {
    try {
      const s=await node.invoke("cache-stats",{});
      if(disposed) return;
      meter.textContent=s.entries+" 条译文 · "+(s.bytes/1048576).toFixed(2)+" / "+s.limitMB+" MiB · v"+s.version+" · "+s.hash.slice(0,12)
        +(s.warming?" · 正在预译":"")+(s.message?" · "+s.message:"");
    } catch(e){if(!disposed) meter.textContent=e.message;}
  }
  for (const [name,method,note] of [["clear","cache-clear","已清空译文缓存"],["warm","prewarm","已按保存的设置安排预译"]]) {
    action(name).onclick=async()=>{
      action(name).disabled=true;
      try {await node.invoke(method,{}); status.textContent=note; await updateMeter();}
      catch(e){status.textContent=e.message;}
      finally{action(name).disabled=false;}
    };
  }
  for(const fs of form.querySelectorAll("fieldset")) fs.disabled=true;
  const save=form.querySelector('[type=submit]');save.disabled=true;
  container.append(form);
  node.invoke("settings",{}).then(s=>{
    if(disposed)return;
    draft=structuredClone({...defaults,...s});
    for(const k of ["provider","localModel","cloudModel","cacheMB","recentChats","recentBlocks"])fields[k].value=draft[k];
    fields.includeHistory.checked=draft.includeHistory;toggleProvider();refreshLevels(draft.defaultMode);
    for(const fs of form.querySelectorAll("fieldset")) fs.disabled=false;
    save.disabled=false;
  }).catch(e=>{status.textContent=e.message;});
  form.onsubmit=async e=>{
    e.preventDefault();save.disabled=true;
    try{
      Object.assign(draft,{provider:fields.provider.value,localModel:fields.localModel.value,cloudModel:fields.cloudModel.value.trim() || recommendedModel,
        includeHistory:fields.includeHistory.checked});
      for(const k of ["cacheMB","recentChats","recentBlocks"])draft[k]=fields[k].valueAsNumber;
      await node.invoke("save-settings",draft);status.textContent="已保存";await updateMeter();
    }catch(error){status.textContent=error.message;}finally{save.disabled=false;}
  };
  void updateMeter();
  const meterTimer=setInterval(updateMeter,4000);
  const library = document.createElement("details");
  library.className = "cxt-settings nmj-library";
  library.innerHTML = '<summary>本机全局术语库<small></small></summary><div class="ihj-library-body"><p>各聊天共用。所有阅读等级都支持点击虚线词条查看解释。移出的词以后会跳过自动收录。</p><input type="search" aria-label="查找术语" placeholder="查找术语"><p role="status"></p><div class="terms"></div></div>';
  container.append(library);
  const count = library.querySelector("summary small");
  const search = library.querySelector("input");
  const feedback = library.querySelector('[role=status]');
  const list = library.querySelector(".terms");
  let items = [], revision = -1;
  function render() {
    if (!library.open) {list.replaceChildren();return;}
    const filter = search.value.trim().toLowerCase();
    const visible = items.filter(e=>e.term.toLowerCase().includes(filter));
    feedback.textContent = filter ? "找到 " + visible.length + " 个词条" : "已收录 " + items.length + " 个词条";
    list.replaceChildren(...visible.map(entry => {
      const details = document.createElement("details"), title = document.createElement("summary");
      title.textContent = entry.term;
      const text = document.createElement("p"); text.textContent = entry.explanation;
      const remove = document.createElement("button");
      remove.type = "button"; remove.textContent = "移出词库";
      remove.onclick = async () => {
        remove.disabled = true;
        try { update(await node.invoke("glossary-remove",{term:entry.term})); }
        catch (e) { feedback.textContent = e.message; remove.disabled = false; }
      };
      details.append(title,text,remove);
      return details;
    }));
  }
  function update(data) {
    if (disposed || data.version <= revision) return;
    revision = data.version;
    items = data.entries.slice().sort((a,b)=>a.term.localeCompare(b.term,"zh-CN"));
    count.textContent=items.length+" 个词条";
    render();
  }
  library.ontoggle=render;
  const off = node.on("glossary-changed",update);
  node.invoke("glossary",{}).then(update).catch(e=>{feedback.textContent=e.message;});
  search.oninput = render;
  return () => {disposed=true; clearInterval(meterTimer); off(); library.remove(); form.remove();};
}
