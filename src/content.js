import MarkdownIt from "./vendor/markdown-it.cjs";

const parser = new MarkdownIt({ html:false, linkify:false }).disable(["image","link","autolink"]);
const transcript = '[data-thread-find-target="conversation"]';
const assistant = '[data-markdown-text-style="assistant-message"]';
const reasoning = '.content-oxuumP';
const user = '[data-user-message-bubble]:not([data-user-message-bubble="false"]),[data-message-author-role="user"]';
const owned = '[data-cxt-view]';
const ignore = '[contenteditable="true"],[data-markdown-copy="exclude"],script,style,textarea,[aria-hidden="true"]';
const protectedSelector = 'pre,code,kbd,a,button,img,svg,canvas,video,iframe,[role="button"],[data-markdown-copy="inline-code"]';
const block = 'p,h1,h2,h3,h4,h5,h6,li,blockquote';
const tokens = /⟦T(\d+)⟧/g;

// One ordered pass per mounted transcript. Different turns and nested chats never share a job.
export function readChats() {
  const jobs = [];
  for (const chat of document.querySelectorAll(transcript)) {
    if (!chat.checkVisibility({visibilityProperty:true}) || chat.closest('[hidden],[inert]')) continue;
    const history = [];
    let group = chat, questionNode = null, lastReport, previousTurn;
    for (const root of chat.querySelectorAll([user, reasoning, assistant].join(","))) {
      if (root.closest(transcript) !== chat || root.closest(owned) || root.closest('[hidden],[inert]') ||
          root.parentElement.closest([user,reasoning,assistant].join(","))) continue;
      if (!root.hasAttribute("data-cxt-hidden") && !root.checkVisibility({visibilityProperty:true})) continue;
      const turn = root.closest("[data-turn-key]");
      if (turn && turn!==previousTurn) {
        questionNode=null;
        lastReport=null;
      }
      previousTurn=turn;
      if (root.matches(user)) {
        group = turn || root;
        questionNode = root;
        history.push({ role:"user", node:root });
        lastReport = null;
        continue;
      }
      const isSummary = root.matches(reasoning);
      const sections = isSummary ? Array.from(root.querySelectorAll(block)).filter(el=>!el.closest(owned) && !el.querySelector(block)) : [root];
      if (!sections.length) sections.push(root);
      for (const el of sections) {
        const currentGroup = turn || group;
        const message = el.closest("[data-history-message-id]") || currentGroup;
        if (!isSummary && lastReport && lastReport.group === currentGroup && lastReport.message === message) {
          lastReport.sources.push(el);
        } else {
          const job = {chat,scope:location.href+"|"+(turn?.dataset.turnKey || ""),group:currentGroup,message,sources:[el],kind:isSummary?"summary":"report",
            questionNode, history, before:history.length};
          jobs.push(job);
          lastReport = isSummary ? null : job;
        }
        history.push({role:"assistant",node:el});
      }
    }
  }
  return jobs;
}

function backgroundText(el) {
  const clone = el.cloneNode(true);
  for (const node of clone.querySelectorAll([owned,ignore,'[hidden]','pre','button','svg','iframe'].join(','))) node.remove();
  for (const node of clone.querySelectorAll("p,li,div,h1,h2,h3,br")) node.append("\n");
  return clip(clone.textContent.trim(), 6000);
}
function clip(s, max) {
  if (s.length <= max) return s;
  const half = Math.floor((max-5)/2);
  return s.slice(0,half)+" […] "+s.slice(-half);
}
export function contextFor(job) {
  const history=[];
  let remaining=8000;
  for (let i=job.before-1;i>=0 && remaining>50 && history.length<12;i--) {
    const entry=job.history[i];
    if (entry.node === job.questionNode) continue;
    const text=clip(backgroundText(entry.node), Math.min(remaining,2500));
    if (!text) continue;
    history.unshift({role:entry.role,text});
    remaining-=text.length;
  }
  return {question:job.questionNode ? backgroundText(job.questionNode) : "",history};
}

export function snapshot(sources) {
  const protectedNodes = [];
  const terms = [];
  function protect(node) {
    const index = protectedNodes.push(node) - 1;
    const token = "⟦T" + index + "⟧";
    if (node.nodeType === Node.ELEMENT_NODE && node.matches('code,[data-markdown-copy="inline-code"]')) {
      const label = node.textContent.trim();
      // Give the translator a field name, status or range, never a code block or link target.
      if (terms.length < 100 && label.length <= 48 &&
          /^(?:[A-Za-z]{1,20}(?:_[A-Za-z]{1,20})+|[\d.]+%?(?:\s*[→–-]\s*[\d.]+%?)?)$/.test(label)) {
        terms.push({token, label});
      }
    }
    return token;
  }
  function inside(el) {
    return Array.from(el.childNodes, collect).join("");
  }
  function tableText(table) {
    const rows = Array.from(table.rows);
    return "\n\n" + rows.map((row, i) => {
      const cells = Array.from(row.cells, cell => inside(cell).trim().replace(/\s*\n\s*/g," ").replaceAll("|","\\|"));
      const line = "| " + cells.join(" | ") + " |";
      if (i !== 0) return line;
      return line + "\n| " + cells.map(()=>"---").join(" | ") + " |";
    }).join("\n") + "\n\n";
  }
  function collect(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.data.replace(tokens, literal => protect(document.createTextNode(literal)));
    }
    if (!(node instanceof Element) || node.matches(owned) || node.matches(ignore) || node.hidden) return "";
    if (node.matches('code,[data-markdown-copy="inline-code"]') && !node.closest("pre")) {
      const words = node.textContent.trim();
      // Backticks are also used for human-language labels in Codex reports.
      if (/\p{Script=Han}/u.test(words) && /^[\p{Script=Han}A-Za-z0-9 ×→，、（）%.-]{2,96}$/u.test(words)) {
        return "`" + words + "`";
      }
    }
    if (node.matches(protectedSelector)) return protect(node);
    if (node.tagName === "TABLE") return tableText(node);
    if (node.matches("ol,ul")) {
      const lines = Array.from(node.children).filter(el=>el.tagName==="LI").map((item,i)=>{
        const prefix = node.tagName==="OL" ? (node.start+i)+". " : "- ";
        return prefix + inside(item).trim().replace(/\n/g,"\n"+" ".repeat(prefix.length));
      });
      return "\n\n"+lines.join("\n")+"\n\n";
    }
    const inner = inside(node);
    if (/^H[1-6]$/.test(node.tagName)) return "\n\n"+"#".repeat(Number(node.tagName[1]))+" "+inner.trim()+"\n\n";
    switch (node.tagName) {
      case "STRONG": case "B": return "**"+inner+"**";
      case "EM": case "I": return "*"+inner+"*";
      case "DEL": case "S": return "~~"+inner+"~~";
      case "BLOCKQUOTE": return "\n\n"+inner.trim().replace(/^/gm,"> ")+"\n\n";
      case "HR": return "\n\n---\n\n";
      case "BR": return "  \n";
      case "P": case "DIV": return "\n\n"+inner+"\n\n";
      default: return inner;
    }
  }
  const text = sources.map(el=>el.matches("li,td,th") ? inside(el) : collect(el))
    .join("\n\n").replace(/\n{3,}/g,"\n\n").trim();
  return {text,protectedNodes,terms};
}
export function translatedFragment(text,nodes) {
  const seen=new Set();
  // Only original UI elements can produce links/media. Model output goes through Markdown with HTML disabled.
  const template=document.createElement("template");
  // CommonMark needs a boundary after closing emphasis that ends with CJK punctuation.
  const markdown = text.replace(/([：，。；！？）】])(\*\*|__)(?=\p{Script=Han})/gu,"$1$2 ");
  template.innerHTML=parser.render(markdown);
  const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT);
  const leaves=[];
  while(walker.nextNode()) leaves.push(walker.currentNode);
  for(const leaf of leaves) {
    let start=0;
    const pieces=[];
    for(const m of leaf.data.matchAll(tokens)) {
      const index=Number(m[1]), original=nodes[index];
      if(!original || seen.has(index)) throw Error("译文中的占位符不匹配。");
      seen.add(index);
      if (original.nodeType===Node.TEXT_NODE) {
        pieces.push(leaf.data.slice(start,m.index),original.data);
        start=m.index+m[0].length;
        continue;
      }
      const copy=original.cloneNode(true);
      copy.removeAttribute("id");
      for (const e of copy.querySelectorAll("[id]")) e.removeAttribute("id");
      if(original.matches('a,button,[role="button"]')) copy.onclick=e=>{e.preventDefault();original.click();};
      pieces.push(leaf.data.slice(start,m.index),copy);
      start=m.index+m[0].length;
    }
    if(pieces.length) leaf.replaceWith(...pieces,leaf.data.slice(start));
  }
  if(seen.size!==nodes.length) throw Error("译文遗漏了代码或链接标记。");
  return template.content;
}

const historyMarkdown = new MarkdownIt({html:false,linkify:false});
// Use the same token, Markdown and context serialization as live replies. A detached
// document keeps generated links and images inert while reconstructing display text.
export function historyTasks(items, depth) {
  const doc=document.implementation.createHTMLDocument("");
  const history=[], jobs=[];
  let questionNode, turn;
  for (const item of items) {
    if (turn!==item.turn) {turn=item.turn; questionNode=null;}
    const root=doc.createElement("div");
    root.innerHTML=historyMarkdown.render(item.text);
    if (item.role==="user") {
      questionNode=root;
      history.push({role:"user",node:root});
      continue;
    }
    if (questionNode) {
      const sections=item.kind==="summary" ? [...root.querySelectorAll(block)].filter(el=>!el.querySelector(block)) : [];
      for (const el of sections.length?sections:[root]) {
        const snap=snapshot([el]);
        if (!/\p{L}/u.test(snap.text.replace(/⟦T\d+⟧/g,""))) continue;
        jobs.push({task:{kind:item.kind,...contextFor({history,questionNode,before:history.length}),target:snap.text,terms:snap.terms},turn:item.turn,id:item.id});
        history.push({role:"assistant",node:el});
      }
    } else history.push({role:"assistant",node:root});
  }
  return jobs.slice(-depth);
}
