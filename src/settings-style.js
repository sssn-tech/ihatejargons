// Follows the host's text colour and light/dark scheme; only the accent is our own.
export const settingsStyle = `
.cxt-settings {
  --ihj-line: color-mix(in srgb,currentColor 13%,transparent);
  --ihj-soft: color-mix(in srgb,currentColor 4%,transparent);
  --ihj-muted: color-mix(in srgb,currentColor 62%,transparent);
  --ihj-accent:#176a58; --ihj-on-accent:#fff; --ihj-danger:#b3261e; --ihj-field:#fff; --ihj-raised:#fff;
}
.cxt-settings[data-theme=dark]{--ihj-accent:#81d4bc;--ihj-on-accent:#0f2a23;--ihj-danger:#ff8a80;
  --ihj-field:color-mix(in srgb,currentColor 6%,transparent);--ihj-raised:color-mix(in srgb,currentColor 16%,transparent)}
.cxt-settings {
  box-sizing:border-box; width:100%; max-width:780px; margin-inline:auto;
  padding:8px clamp(12px,3%,28px) 0; display:grid; gap:18px;
  font:14px/1.55 system-ui,-apple-system,"PingFang SC",sans-serif; color:inherit;
}
.cxt-settings [hidden]{display:none!important}
.cxt-settings :is(h2,h3,p){margin:0}
.cxt-settings small,.cxt-settings .ihj-card-head p,.cxt-settings .ihj-head p{font-size:12.5px;color:var(--ihj-muted)}
.cxt-settings a{color:var(--ihj-accent);margin-inline-start:6px}

.cxt-settings .ihj-head{display:flex;align-items:center;gap:14px;padding:6px 2px 4px}
.cxt-settings .ihj-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--ihj-accent);color:var(--ihj-on-accent);flex:none}
.cxt-settings h2{font:650 21px/1.25 inherit;letter-spacing:-.01em}

.cxt-settings .ihj-card{display:grid;gap:16px;min-width:0;padding:18px clamp(14px,3%,22px);border:1px solid var(--ihj-line);border-radius:14px;background:var(--ihj-soft)}
.cxt-settings .ihj-card-head{display:grid;gap:2px}
.cxt-settings h3{font:620 15px/1.35 inherit}
.cxt-settings .ihj-stack{display:grid;gap:14px;min-width:0}
.cxt-settings .ihj-indent{padding-inline-start:26px}
.cxt-settings .ihj-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px}
.cxt-settings .ihj-field{display:grid;align-content:start;gap:6px;min-width:0}
.cxt-settings .ihj-field>span{font-weight:560;font-size:13px}
.cxt-settings .ihj-inline{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.cxt-settings .ihj-inline>input{flex:1 1 220px;width:auto}
.cxt-settings .ihj-spacer{flex:1}
.cxt-settings .ihj-narrow{width:150px}

.cxt-settings :is(input:not([type=checkbox],[type=radio]),select,textarea){
  box-sizing:border-box;display:block;width:100%;min-width:0;min-height:34px;padding:6px 10px;
  border:1px solid var(--ihj-line);border-radius:8px;background:var(--ihj-field);
  color:inherit;font:inherit;
}
.cxt-settings textarea{line-height:1.6;resize:vertical;font-size:13px}
.cxt-settings :is(input,select,textarea):hover:enabled{border-color:color-mix(in srgb,currentColor 26%,transparent)}
.cxt-settings :is(button,input,select,textarea,summary,a):focus-visible{outline:2px solid var(--ihj-accent);outline-offset:2px}
.cxt-settings :is(input,select,textarea):disabled{opacity:.55}

.cxt-settings button{font:inherit;font-size:13px;color:inherit;cursor:pointer;background:transparent;
  border:1px solid var(--ihj-line);border-radius:8px;padding:6px 12px;min-height:32px}
.cxt-settings button:hover:enabled{background:color-mix(in srgb,currentColor 8%,transparent)}
.cxt-settings button:disabled{opacity:.4;cursor:default}
.cxt-settings .ihj-danger{color:var(--ihj-danger)}
.cxt-settings .ihj-primary{background:var(--ihj-accent);color:var(--ihj-on-accent);border-color:transparent;font-weight:620;padding-inline:20px}
.cxt-settings .ihj-primary:hover:enabled{background:var(--ihj-accent);filter:brightness(.93)}

.cxt-settings .ihj-seg{display:inline-flex;justify-self:start;padding:3px;gap:2px;border-radius:10px;background:color-mix(in srgb,currentColor 7%,transparent)}
.cxt-settings .ihj-seg label{position:relative;cursor:pointer}
.cxt-settings .ihj-seg input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.cxt-settings .ihj-seg span{display:block;padding:5px 16px;border-radius:7px;font-size:13px}
.cxt-settings .ihj-seg input:checked+span{background:var(--ihj-raised);font-weight:600;box-shadow:0 1px 2px #0000001f}
.cxt-settings .ihj-seg input:focus-visible+span{outline:2px solid var(--ihj-accent)}

.cxt-settings .ihj-switch{display:flex;align-items:center;gap:10px;cursor:pointer;justify-self:start}
.cxt-settings .ihj-switch input{appearance:none;flex:none;width:32px;height:19px;margin:0;border-radius:99px;background:color-mix(in srgb,currentColor 22%,transparent);position:relative;cursor:pointer;transition:background .15s}
.cxt-settings .ihj-switch input::after{content:"";position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0003;transition:left .15s}
.cxt-settings .ihj-switch input:checked{background:var(--ihj-accent)}
.cxt-settings .ihj-switch input:checked::after{left:15px}
.cxt-settings .ihj-switch input:disabled,.cxt-settings .ihj-switch:has(input:disabled){cursor:default;opacity:.55}

.cxt-settings .ihj-key{display:flex;align-items:center;gap:8px;font-size:13px}
.cxt-settings .ihj-key i{width:8px;height:8px;border-radius:50%;background:var(--ihj-muted);flex:none}
.cxt-settings .ihj-key[data-state=ok] i{background:var(--ihj-accent)}
.cxt-settings .ihj-key[data-state=missing] i{background:var(--ihj-danger)}
.cxt-settings .ihj-check{font-size:13px;color:var(--ihj-muted);overflow-wrap:anywhere}
.cxt-settings .ihj-check[data-tone=ok]{color:var(--ihj-accent)}
.cxt-settings .ihj-check[data-tone=error]{color:var(--ihj-danger)}

.cxt-settings .ihj-levels{display:grid;grid-template-columns:minmax(150px,200px) 1fr;gap:16px;align-items:start}
@media (max-width:640px){.cxt-settings .ihj-levels{grid-template-columns:1fr}}
.cxt-settings .ihj-level-side{display:grid;gap:8px}
.cxt-settings .ihj-level-list{list-style:none;margin:0;padding:4px;display:grid;gap:2px;border:1px solid var(--ihj-line);border-radius:10px;background:var(--ihj-field)}
.cxt-settings .ihj-level-list :is(button,.ihj-fixed){display:grid;gap:1px;width:100%;text-align:start;border:0;border-radius:7px;padding:7px 10px;min-height:0}
.cxt-settings .ihj-level-list .ihj-fixed{opacity:.6}
.cxt-settings .ihj-level-list span{font-weight:560;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cxt-settings .ihj-level-list small{font-size:11.5px;min-height:1em}
.cxt-settings .ihj-level-list button[aria-selected=true]{background:color-mix(in srgb,var(--ihj-accent) 14%,transparent)}
.cxt-settings .ihj-level-list button[aria-selected=true] span{color:var(--ihj-accent)}
.cxt-settings .ihj-add{justify-self:start;border-style:dashed}
.cxt-settings .ihj-level-editor{display:grid;gap:14px;min-width:0}

.cxt-settings .ihj-note{font-size:13px;color:var(--ihj-muted)}
.cxt-settings .ihj-storage{display:grid;gap:10px;padding-top:14px;border-top:1px solid var(--ihj-line)}
.cxt-settings .ihj-storage-row{display:flex;justify-content:space-between;gap:12px;font-size:13px}
.cxt-settings .ihj-busy{color:var(--ihj-muted)}
.cxt-settings .ihj-busy[data-tone=error]{color:var(--ihj-danger)}
.cxt-settings progress{appearance:none;width:100%;height:6px;border:0;border-radius:99px;overflow:hidden;background:color-mix(in srgb,currentColor 10%,transparent)}
.cxt-settings progress::-webkit-progress-bar{background:transparent}
.cxt-settings progress::-webkit-progress-value{background:var(--ihj-accent);border-radius:99px}
.cxt-settings .ihj-storage .ihj-inline{align-items:end}

.cxt-settings .ihj-advanced{gap:0}
.cxt-settings .ihj-advanced summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px}
.cxt-settings .ihj-advanced summary::-webkit-details-marker{display:none}
.cxt-settings .ihj-advanced summary::before{content:"›";font-size:18px;line-height:1;transition:transform .15s;color:var(--ihj-muted)}
.cxt-settings .ihj-advanced[open] summary::before{transform:rotate(90deg)}
.cxt-settings .ihj-advanced[open] summary{margin-bottom:16px}
.cxt-settings .ihj-build{font:12px/1.4 ui-monospace,SFMono-Regular,monospace;color:var(--ihj-muted)}

.cxt-settings .ihj-savebar{position:sticky;bottom:0;z-index:1;display:flex;align-items:center;justify-content:flex-end;gap:10px;
  margin-inline:calc(-1 * clamp(12px,3%,28px));padding:12px clamp(12px,3%,28px);
  background:var(--ihj-bg,transparent);border-top:1px solid var(--ihj-line)}
.cxt-settings .ihj-status{margin-inline-end:auto;font-size:13px;color:var(--ihj-muted)}
.cxt-settings .ihj-status[data-tone=pending]{color:var(--ihj-accent)}
@media (prefers-reduced-motion:reduce){.cxt-settings *{transition:none!important}}
`;
