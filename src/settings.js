import { cloudModels, recommendedModel } from "./models.js";
export function mountSettings(container, node) {
  const form = document.createElement("form");
  form.className = "cxt-settings";
  const heading = document.createElement("h2");
  heading.textContent = "ihatejargons";
  form.append(heading);
  function field(title, control) {
    const label = document.createElement("label");
    label.append(title, control);
    form.append(label);
    return label;
  }
  const provider = document.createElement("select");
  provider.add(new Option("硅基流动", "siliconflow"));
  provider.add(new Option("本机 Ollama", "ollama"));
  field("翻译服务", provider);
  const cloud = document.createElement("input");
  const choices = document.createElement("datalist");
  choices.id = "cxt-cloud-models";
  for (const id of cloudModels) choices.append(new Option(id,id));
  cloud.setAttribute("list",choices.id);
  form.append(choices);
  const cloudField = field("硅基流动模型 ID", cloud);
  const model = document.createElement("input");
  model.placeholder = "填写已下载的 Ollama 模型名";
  const local = field("本地模型", model);
  const button = document.createElement("button");
  button.type = "submit"; button.textContent = "保存"; button.disabled = true;
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  form.append(button, status);
  container.append(form);
  function toggle() {
    cloud.required = provider.value === "siliconflow";
    cloudField.style.display = cloud.required ? "grid" : "none";
    local.style.display = provider.value === "ollama" ? "grid" : "none";
    model.required = provider.value === "ollama";
  }
  toggle();
  provider.onchange = toggle;
  node.invoke("settings", {}).then(s => {
    provider.value = s.provider;
    model.value = s.localModel;
    cloud.value = s.cloudModel;
    toggle(); button.disabled = false;
  }).catch(e => { status.textContent = e.message; });
  form.onsubmit = async event => {
    event.preventDefault();
    button.disabled = true;
    try {
      await node.invoke("save-settings", {provider:provider.value, localModel:model.value, cloudModel:cloud.value.trim() || recommendedModel});
      status.textContent = "已保存";
    } catch (e) { status.textContent = e.message; }
    finally { button.disabled = false; }
  };
  const library = document.createElement("section");
  library.className = "cxt-settings nmj-library";
  library.innerHTML = '<h3>本机全局术语库</h3><p>各聊天共用。三种阅读方式都支持点击虚线词条查看解释。移出的词以后会跳过自动收录。</p><input type="search" aria-label="查找术语" placeholder="查找术语"><p role="status"></p><div class="terms"></div>';
  container.append(library);
  const search = library.querySelector("input");
  const feedback = library.querySelector('[role=status]');
  const list = library.querySelector(".terms");
  let items = [], revision = -1;
  function render() {
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
    if (data.version <= revision) return;
    revision = data.version;
    items = data.entries.slice().sort((a,b)=>a.term.localeCompare(b.term,"zh-CN"));
    render();
  }
  const off = node.on("glossary-changed",update);
  node.invoke("glossary",{}).then(update).catch(e=>{feedback.textContent=e.message;});
  search.oninput = render;
  return () => {off(); library.remove(); form.remove();};
}
