// Markdown is rendered beside the host element, so ancestor-specific typography and table CSS
// must also be applied there. Measure before the source is hidden.
const type = ["font-family","font-size","font-weight","font-style","line-height","letter-spacing","color","text-align"];
const spacing = ["margin-block-start","margin-block-end","padding-block-start","padding-block-end","padding-inline-start","padding-inline-end"];
const rules = ["border-top","border-right","border-bottom","border-left"];
const tags = "p,h1,h2,h3,h4,h5,h6,strong,em,del,blockquote,ol,ul,li,hr,table,thead,tbody,tr,th,td,pre,code,kbd,a";

function useStyle(from, to, properties) {
  const style = getComputedStyle(from);
  for (const key of properties) to.style.setProperty(key, style.getPropertyValue(key));
}

export function matchAppearance(sources, body, mode = "light") {
  const first = sources[0];
  useStyle(first, body, type);
  const originals = sources.flatMap(source => [
    ...(source.matches(tags) ? [source] : []), ...source.querySelectorAll(tags)
  ]);
  const samples = new Map();
  for (const el of originals) {
    if (!samples.has(el.localName)) samples.set(el.localName,el);
  }
  // A host may style the source paragraphs rather than the root itself.
  const paragraph = samples.get("p");
  if (paragraph) useStyle(paragraph, body, type);
  for (const el of body.querySelectorAll(tags)) {
    const sample = samples.get(el.localName);
    if (!sample) continue;
    useStyle(sample, el, type);
    if (el.matches("p,h1,h2,h3,h4,h5,h6,ol,ul,li,blockquote,pre,hr")) useStyle(sample, el, spacing);
    if (el.matches("ul,ol,li")) useStyle(sample,el,["list-style-type","list-style-position"]);
    if (el.matches("blockquote,hr,thead,tbody")) useStyle(sample,el,rules);
    if (el.matches("code,kbd,pre,a")) {
      const original = originals.find(node=>node.localName===el.localName && node.textContent===el.textContent) || sample;
      useStyle(original,el,[...type,...spacing,...rules,"background-color","border-radius","text-decoration"]);
    }
  }
  const tables = originals.filter(el=>el.localName==="table");
  const translated = Array.from(body.querySelectorAll("table")).filter(el=>!el.closest("pre"));
  if (mode==="deep" && !translated.length) return;
  if (tables.length !== translated.length) throw Error("译文表格数量与原文不符");
  translated.forEach((table,i)=>matchTable(tables[i],table));
}

function matchTable(source, table) {
  const rows = Array.from(source.rows);
  const output = Array.from(table.rows);
  if (rows.length!==output.length || rows.some((row,i)=>row.cells.length!==output[i].cells.length)) {
    throw Error("译文表格行列与原文不符");
  }
  useStyle(source,table,[...rules,"border-collapse","border-spacing",...spacing]);
  const firstRow = rows[0];
  if (firstRow && Array.from(firstRow.cells).every(cell=>cell.colSpan===1)) {
    const widths = Array.from(firstRow.cells,cell=>cell.getBoundingClientRect().width);
    const width = widths.reduce((a,b)=>a+b,0);
    const containerWidth=source.parentElement?.getBoundingClientRect().width;
    if (width>0 && containerWidth>0) {
      const cols=document.createElement("colgroup");
      for (const value of widths) {
        const col=document.createElement("col");
        col.style.width=(100*value/width)+"%";
        cols.append(col);
      }
      table.prepend(cols);
      table.style.tableLayout="fixed";
      table.style.width="min(100%, "+(100*source.getBoundingClientRect().width/containerWidth)+"%)";
    }
  }
  rows.forEach((row,i)=>{
    useStyle(row,output[i],rules);
    Array.from(row.cells).forEach((cell,j)=>{
      const to=output[i].cells[j];
      useStyle(cell,to,[...type,...spacing,...rules,"vertical-align","background-color"]);
    });
  });
}
