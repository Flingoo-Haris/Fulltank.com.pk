// node build.js -> dist/
// Pages: / (prices + dropdown calculator only), /cars/ /bikes/ (brand hubs),
// /cars/<brand>.html /bikes/<brand>.html (precalculated tables), one page per
// vehicle for SEO, /add.html (manual add, its own page), /price-history.html.
const fs = require('fs'), path = require('path');
const SITE = (process.env.SITE || 'https://fulltank.pk').replace(/\/$/, '');
const pr = JSON.parse(fs.readFileSync('prices.json'));
const V = JSON.parse(fs.readFileSync('vehicles.json'));

const slug = s => s.toLowerCase().replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rs = n => 'Rs ' + Math.round(n).toLocaleString('en-PK');
const priceFor = f => f == 'd' ? pr.diesel : pr.petrol; // hOctane offered as a choice, not a separate vehicle attribute
const cost = c => c[3] * priceFor(c[4]);
const brand = n => (/^(Road Prince|Super Power|Super Star)/.exec(n) || [n.split(' ')[0]])[0];
const K = { car: { dir: 'cars', label: 'Cars', one: 'car' }, bike: { dir: 'bikes', label: 'Bikes', one: 'bike' } };
const COLL = { car: [['Petrol', 'petrol'], ['Diesel', 'diesel'], ['Hybrid', 'hybrid'], ['PHEV', 'phev']], bike: [['70cc', '70cc'], ['100-125cc', '100-125cc'], ['150cc+', '150cc-plus'], ['Scooter', 'scooter']] };
const collName = (k, t) => t == 'Scooter' ? 'Scooters' : `${t} ${K[k].label}`;
const of = k => V.filter(c => c[5] == k);
const brandsOf = k => [...new Set(of(k).map(c => brand(c[0])))].sort();
const byName = L => L.slice().sort((a, b) => a[0].localeCompare(b[0]));

fs.rmSync('dist', { recursive: true, force: true });
const w = (f, t) => { const p = path.join('dist', f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const crumb = a => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: a.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x[0], item: SITE + x[1] })) });

/* ---------- shared CSS ---------- */
// Palette grounded in the subject itself: a fuel pump's LED price display
// (ink panel + tabular digits) and Pakistan's real pump signage colours —
// petrol green, premium-octane amber, diesel blue — used as information,
// not decoration. One bold moment (the hero readout); everything else quiet.
const CSS = `
:root{--bg:#eef1ec;--card:#fff;--tx:#14181c;--mut:#5c655f;--pri:#0e8a6b;--pri2:#14b88f;--bd:#dbe1da;--acc:#e2932c;--diesel:#2f5fd6;--ink:#12161a;--ink2:#1c2229}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1210;--card:#161c19;--tx:#e9ede9;--mut:#9aa39c;--pri:#2fd9a6;--pri2:#5ee9c3;--bd:#283530;--acc:#f0ab4d;--diesel:#6d8dff;--ink:#070a08;--ink2:#0f1613}}
:root[data-theme="dark"]{--bg:#0d1210;--card:#161c19;--tx:#e9ede9;--mut:#9aa39c;--pri:#2fd9a6;--pri2:#5ee9c3;--bd:#283530;--acc:#f0ab4d;--diesel:#6d8dff;--ink:#070a08;--ink2:#0f1613}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:880px;margin:0 auto;padding:16px}
.ic{width:1em;height:1em;vertical-align:-.15em;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
nav.top{background:var(--ink);border-bottom:3px solid var(--pri)}
nav.top .w{display:flex;gap:16px;flex-wrap:wrap;align-items:center;padding:10px 16px}
nav.top a{color:#dfe8e4;text-decoration:none;font-size:.92rem;font-weight:600}
nav.top a:hover{color:#fff}
nav.top a.brand{color:#fff;font-size:1.08rem;font-weight:800;margin-right:auto;letter-spacing:-.01em}
.crumb{color:var(--mut);font-size:.85rem;margin:14px 0 4px}
.crumb a{color:var(--mut)}
h1{font-size:clamp(1.3rem,4.5vw,2rem);line-height:1.2;margin:6px 0 10px;letter-spacing:-.01em}
h2{font-size:1.15rem;margin:28px 0 8px;letter-spacing:-.005em}
.big{font-size:1.7rem;font-weight:700;color:var(--acc);font-variant-numeric:tabular-nums}
.digits{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;letter-spacing:.02em}
/* ---- hero: pump display, the one bold element on the page ---- */
.hero{background:var(--ink);color:#eef1ec;margin:0 0 22px}
.hero .w{padding:22px 16px 26px}
.hero h1{color:#fff;margin:0 0 4px}
.hero .lede{color:#aab6ad;margin:0 0 16px;font-size:.95rem}
.pump{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.pd{background:var(--ink2);border-radius:12px;padding:12px 14px;border-top:3px solid var(--c,var(--pri))}
.pd .ic{color:var(--c,var(--pri));font-size:1.1rem}
.pd small{display:block;color:#9fada5;font-size:.78rem;margin-top:4px}
.pd b{display:block;font-size:1.5rem;color:#fff;margin-top:2px}
.pump-meta{color:#8d9a92;font-size:.8rem;margin-top:12px}
/* ---- fuel-cost calculator, styled as a receipt ---- */
.receipt{background:var(--card);border:1px solid var(--bd);border-top:none;border-radius:0 0 14px 14px;padding:18px;margin:18px 0;position:relative}
.receipt::before{content:"";display:block;height:10px;margin:0 -1px 8px;background:repeating-linear-gradient(115deg,var(--card) 0 6px,transparent 6px 10px),var(--bd);background-size:100% 10px,auto;border-radius:14px 14px 0 0}
.calc{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:18px;margin:18px 0}
select,input,button{font:inherit;color:var(--tx);background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;width:100%}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.row>*{flex:1 1 160px}
button.p{background:var(--pri);color:#fff;border-color:var(--pri);cursor:pointer;flex:0 0 auto;width:auto;padding:10px 20px;font-weight:600}
button.p:hover{background:var(--pri2);border-color:var(--pri2)}
.result{margin-top:12px;padding:12px 14px;border-radius:10px;background:var(--ink);color:#fff;display:none}
.result .big{color:var(--acc)}
a{color:var(--pri)}
table{border-collapse:collapse;width:100%;margin:10px 0}
td,th{border:1px solid var(--bd);padding:7px 10px;text-align:left}
th{background:var(--bg)}
/* ---- brand/type tiles (Cars / Bikes) ---- */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}
.tile{display:flex;align-items:center;gap:10px;padding:16px;border-radius:14px;color:#fff;text-decoration:none;font-weight:700;font-size:1.05rem}
.tile .ic{font-size:1.6rem}
.tile.car{background:linear-gradient(135deg,var(--pri),#0a5c48)}
.tile.bike{background:linear-gradient(135deg,var(--diesel),#1c3a9c)}
.tile:hover{filter:brightness(1.08)}
/* ---- guide / blog cards ---- */
.guides{display:grid;gap:10px;margin:10px 0}
.gcard{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--bd)}
.gcard:last-child{border-bottom:none}
.gcard .dot{flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:#fff}
.gcard a{color:var(--tx);font-weight:700;text-decoration:none}
.gcard a:hover{color:var(--pri)}
.gcard p{margin:2px 0 0;color:var(--mut);font-size:.88rem}
.hubgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:10px 0}
.hubgrid a{display:block;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px;text-decoration:none;color:var(--tx);font-weight:600;text-align:center}
.hubgrid a:hover{border-color:var(--pri)}
.hubband{border-radius:14px;padding:18px;margin:0 0 16px;color:#fff}
.hubband.car{background:linear-gradient(120deg,var(--pri),#0a5c48)}
.hubband.bike{background:linear-gradient(120deg,var(--diesel),#1c3a9c)}
.hubband h1{color:#fff;margin:4px 0 2px}
.hubband p{color:rgba(255,255,255,.85);margin:0}
.tag{display:inline-block;font-size:.7rem;border:1px solid var(--bd);border-radius:6px;padding:0 6px;margin-right:4px;color:var(--mut)}
.ad{margin:16px 0;min-height:90px;border:1px dashed var(--bd);border-radius:10px;display:grid;place-items:center;color:var(--mut);font-size:.8rem}
footer{color:var(--mut);font-size:.8rem;padding:24px 16px;border-top:1px solid var(--bd);margin-top:20px}
.list{display:grid;gap:8px;margin-top:10px}
.car{background:var(--card);border:1px solid var(--bd);border-left:3px solid var(--pri);border-radius:10px;padding:10px 14px;display:grid;grid-template-columns:1fr auto;gap:2px 12px}
.car h3{margin:0;font-size:1rem;grid-column:1}
.car .s{color:var(--mut);font-size:.85rem;grid-column:1}
.car .c{grid-row:1/3;grid-column:2;text-align:right;font-weight:700;font-size:1.1rem;color:var(--acc);align-self:center;font-variant-numeric:tabular-nums}
.bh{font-size:1.05rem;margin:18px 0 2px;color:var(--pri)}
.add-list{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;margin:8px 0}
`;
// Original line-icon sprite (no stock imagery — fast, copyright-free, on-brand)
const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-pump" viewBox="0 0 24 24"><path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M3 21h12"/><path d="M14 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/><rect x="6" y="6" width="6" height="5" rx=".6"/></symbol>
<symbol id="i-drop" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></symbol>
<symbol id="i-car" viewBox="0 0 24 24"><path d="M3 16V12l2.2-5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.9 1.4L21 12v4"/><path d="M3 16h18v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-11v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2Z"/><circle cx="7.5" cy="16" r="1.6"/><circle cx="16.5" cy="16" r="1.6"/><path d="M3 12h18"/></symbol>
<symbol id="i-bike" viewBox="0 0 24 24"><circle cx="5.5" cy="17" r="3.2"/><circle cx="18.5" cy="17" r="3.2"/><path d="M5.5 17 10 8h5l3.5 9"/><path d="M8 17h8"/><path d="M10 8H8"/></symbol>
<symbol id="i-calc" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2m3 0h2M8 15h2m3 0h2"/></symbol>
<symbol id="i-leaf" viewBox="0 0 24 24"><path d="M4 20c0-9 5-15 16-15 0 11-6 16-15 16-1 0-1 0-1-1Z"/><path d="M5 19 16 8"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></symbol>
</defs></svg>`;

/* ---------- Peto (shared, embedded on every page) ---------- */
const PETO_CSS = `
#peto-fab{position:fixed;right:18px;bottom:18px;width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,var(--pri),var(--pri2));color:#fff;border:none;font-size:1.5rem;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer;z-index:999;display:flex;align-items:center;justify-content:center;padding:0}
#peto-badge{position:fixed;right:16px;bottom:70px;background:var(--acc);color:#1a1200;font-size:.7rem;font-weight:700;border-radius:99px;padding:2px 8px;z-index:1000;box-shadow:0 2px 6px rgba(0,0,0,.2);border:none;cursor:pointer}
#peto-panel{position:fixed;right:18px;bottom:86px;width:min(360px,92vw);max-height:min(560px,75vh);background:var(--card);border:1px solid var(--bd);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;z-index:1000}
#peto-panel.open{display:flex}
#peto-head{background:linear-gradient(135deg,var(--pri),#134e4a);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}
#peto-head .av{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
#peto-head .ti{flex:1}
#peto-head b{display:block;font-size:.95rem}
#peto-head small{opacity:.85}
#peto-close{background:transparent;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:2px 6px;width:auto}
#peto-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--bg)}
.pm{max-width:85%;padding:9px 12px;border-radius:14px;font-size:.92rem;line-height:1.4}
.pm.bot{background:var(--card);border:1px solid var(--bd);align-self:flex-start;border-bottom-left-radius:4px}
.pm.me{background:var(--pri);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
#peto-opts{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px;background:var(--bg)}
.popt{background:var(--card);border:1px solid var(--pri);color:var(--pri);border-radius:99px;padding:6px 12px;font-size:.85rem;cursor:pointer;width:auto}
.popt:hover{background:var(--pri);color:#fff}
#peto-form{display:flex;gap:6px;padding:10px;border-top:1px solid var(--bd)}
#peto-input{flex:1}
#peto-send{background:var(--pri);color:#fff;border-color:var(--pri);cursor:pointer;width:auto}
`;
const petoHtml = `
<button id="peto-badge" type="button" onclick="Peto.open()">Ask Peto 👋</button>
<button id="peto-fab" type="button" aria-label="Open Peto assistant" onclick="Peto.open()">⛽</button>
<div id="peto-panel" role="dialog" aria-label="Peto fuel cost assistant">
 <div id="peto-head"><div class="av">🤖</div><div class="ti"><b>Peto</b><small>Fuel cost assistant</small></div><button id="peto-close" aria-label="Close" onclick="Peto.close()">✕</button></div>
 <div id="peto-msgs"></div>
 <div id="peto-opts"></div>
 <form id="peto-form"><input id="peto-input" autocomplete="off" placeholder="Type here…"><button id="peto-send" type="submit">➤</button></form>
</div>`;
// autoOpen: only the home page pops Peto open on its own; other pages just show the button.
const petoScript = (autoOpen) => `
var Peto=(function(){
 var panel,msgs,opts,form,input,state={step:"idle",vehicle:null,matches:[]};
 function el(h){var d=document.createElement("div");d.innerHTML=h;return d.firstChild}
 function say(text){msgs.appendChild(el('<div class="pm bot">'+text+'</div>'));msgs.scrollTop=msgs.scrollHeight}
 function me(text){msgs.appendChild(el('<div class="pm me">'+text.replace(/</g,"&lt;")+'</div>'));msgs.scrollTop=msgs.scrollHeight}
 function showOpts(list){opts.innerHTML="";list.forEach(function(o){var b=document.createElement("button");b.className="popt";b.type="button";b.textContent=o.label;b.onclick=function(){me(o.label);handle(o.value)};opts.appendChild(b)})}
 function clearOpts(){opts.innerHTML=""}
 function findMatches(q){q=q.toLowerCase().trim();var L=VEHICLES.concat(customVehicles());var exact=L.filter(function(c){return c[0].toLowerCase()==q});if(exact.length)return exact;return L.filter(function(c){return c[0].toLowerCase().indexOf(q)>=0}).slice(0,6)}
 function askVehicle(){state.step="askVehicle";state.vehicle=null;state.matches=[];say("Which car or bike do you have? Type its name — e.g. <i>Suzuki Alto</i> or <i>Honda CD 70</i>.");clearOpts()}
 function askFuel(v){state.step="askFuel";state.vehicle=v;var isDieselOnly=v[4]=="d";say("Got it — <b>"+v[0]+"</b> ("+v[3]+" L tank). What fuel do you use?");if(isDieselOnly){showOpts([{label:"Diesel",value:"d"}])}else{showOpts([{label:"Normal (Petrol)",value:"p"},{label:"High Octane",value:"h"},{label:"Diesel",value:"d"}])}}
 function calc(fuelKey){var v=state.vehicle,price=fuelKey=="h"?PRICES.h:(fuelKey=="d"?PRICES.d:PRICES.p);var costV=v[3]*price,label=fuelKey=="h"?"High Octane":(fuelKey=="d"?"Diesel":"Normal petrol");say("Filling the <b>"+v[0]+"</b>'s "+v[3]+" L tank with <b>"+label+"</b> at Rs "+price.toFixed(2)+"/L costs about<br><span style=\\"font-size:1.3rem;font-weight:700;color:var(--acc)\\">"+fmtRs(costV)+"</span>");state.step="askMore";showOpts([{label:"Calculate another vehicle",value:"more"},{label:"No, that's all — thanks",value:"done"}])}
 function handle(val){if(state.step=="askFuel"){clearOpts();calc(val);return}if(state.step=="askMore"){if(val=="more"){askVehicle()}else{say("Happy to help — come back anytime you need a fuel estimate! ⛽");clearOpts()}return}if(state.step=="pickMatch"){var v=state.matches[parseInt(val,10)];if(v){clearOpts();askFuel(v)}return}}
 function handleText(text){text=text.trim();if(!text)return;me(text);if(state.step=="askVehicle"||state.step=="idle"){var m=findMatches(text);if(m.length==1){clearOpts();askFuel(m[0])}else if(m.length>1){state.step="pickMatch";state.matches=m;say("I found a few matches — which one is yours?");showOpts(m.map(function(c,i){return {label:c[0],value:String(i)}}))}else{say("I couldn't find that one in my list yet. Try a shorter name (e.g. just \\"Alto\\" or \\"CD 70\\"), or add it on the <a href=\\"${'/add.html'}\\">add a vehicle</a> page.")}}else{say("Please pick one of the options above, or type the vehicle name again.")}}
 function greet(){msgs.innerHTML="";say("Hi, I'm <b>Peto</b> 👋 I can tell you exactly how much a full tank costs for your car or bike.");askVehicle()}
 function open(){panel.classList.add("open");document.getElementById("peto-badge").style.display="none";if(!msgs.children.length)greet();input.focus()}
 function close(){panel.classList.remove("open")}
 function init(){panel=document.getElementById("peto-panel");msgs=document.getElementById("peto-msgs");opts=document.getElementById("peto-opts");form=document.getElementById("peto-form");input=document.getElementById("peto-input");form.onsubmit=function(e){e.preventDefault();var t=input.value;input.value="";handleText(t)};${autoOpen ? 'setTimeout(function(){if(!panel.classList.contains("open"))open()},2500);' : ''}}
 return{open:open,close:close,init:init}
})();
Peto.init();`;

/* ---------- shared JS helpers embedded on every page ---------- */
const sharedJs = `
var PRICES={p:${pr.petrol},h:${pr.hOctane},d:${pr.diesel}};
var VEHICLES=${JSON.stringify(V)};
function fmtRs(n){return "Rs "+Math.round(n).toLocaleString("en-PK")}
function customVehicles(){try{return JSON.parse(localStorage.getItem("xc")||"[]")}catch(e){return []}}
`;

const nav = `<nav class="top"><div class="w"><a class="brand" href="/"><img src="/logo.svg" alt="" width="22" height="22" style="vertical-align:-5px;margin-right:4px"> FullTank.pk</a><a href="/cars/">Cars</a><a href="/bikes/">Bikes</a><a href="/search.html">Search</a><a href="/blog/">Blog</a><a href="/add.html">Add a vehicle</a><a href="/price-history.html">Price History</a></div></nav>`;
const foot = `<footer>FullTank.pk — Fuel prices: OGRA/PSO notifications. High Octane is deregulated and varies by brand. Tank sizes are approximate. Built with <b>Peto</b>, our fuel-cost assistant — tap the ⛽ button to ask. <a href="/about.html">About</a> · <a href="/privacy.html">Privacy</a> · <a href="/contact.html">Contact</a></footer>`;

function page(file, title, desc, body, opts) {
  opts = opts || {};
  const url = SITE + '/' + file.replace(/index\.html$/, '');
  const ld = opts.ld ? `<script type="application/ld+json">${JSON.stringify(opts.ld)}</script>` : '';
  const auto = !!opts.autoOpenPeto;
  const kw = opts.keywords ? `<meta name="keywords" content="${opts.keywords}">` : '';
  w(file, `<!DOCTYPE html><html lang="en-PK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title><meta name="description" content="${desc}">${kw}<meta name="author" content="FullTank.pk"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}"><link rel="icon" type="image/svg+xml" href="/logo.svg"><meta property="og:site_name" content="FullTank.pk"><meta property="og:locale" content="en_PK"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:type" content="${opts.ogType || 'website'}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${SITE}/og.png">${ld}<style>${CSS}${PETO_CSS}</style><!-- AdSense script here --></head><body>${ICONS}${nav}${opts.band || ''}<div class="w">${body}</div>${foot}${petoHtml}<script>${sharedJs}${opts.extraJs || ''}${petoScript(auto)}</script></body></html>`);
}

const tbl = (L, pre) => `<table><tr><th>Model</th><th>Tank</th><th>Full tank (petrol/diesel)</th></tr>${L.map(c => `<tr><td><a href="${pre}${c[5]}/${slug(c[0])}.html">${c[0]}</a></td><td>${c[3]} L</td><td>${rs(cost(c))}</td></tr>`).join('')}</table>`;

/* ================= HOME — prices + dropdown calculator only ================= */
{
  const optgroups = k => brandsOf(k).map(b => `<optgroup label="${b}">${byName(of(k).filter(c => brand(c[0]) == b)).map(c => `<option value="${c[0]}">${c[0]} — ${c[3]} L</option>`).join('')}</optgroup>`).join('');
  const band = `<div class="hero"><div class="w">
<h1>Today's fuel price in Pakistan</h1>
<p class="lede">Pick your car or bike below and see exactly what a full tank costs — or ask Peto.</p>
<div class="pump" aria-label="Today's fuel prices">
<div class="pd" style="--c:var(--pri)"><svg class="ic"><use href="#i-pump"/></svg><b id="pp" class="digits">${pr.petrol.toFixed(2)}</b><small>Petrol / Normal — Rs per litre</small></div>
<div class="pd" style="--c:var(--acc)"><svg class="ic"><use href="#i-spark"/></svg><b id="hp" class="digits">${pr.hOctane.toFixed(2)}</b><small>High Octane — Rs per litre</small></div>
<div class="pd" style="--c:var(--diesel)"><svg class="ic"><use href="#i-drop"/></svg><b id="dp" class="digits">${pr.diesel.toFixed(2)}</b><small>Diesel (HSD) — Rs per litre</small></div>
</div>
<p class="pump-meta" id="pumpmeta">Updated ${pr.date} · refreshed daily just after midnight (PKT) · High Octane is deregulated and varies by company</p>
</div></div>`;
  const body = `
<div class="receipt">
<h2 style="margin-top:0">Full-tank cost calculator</h2>
<div class="row">
<select id="vtab"><option value="car">Car</option><option value="bike">Bike</option></select>
<select id="vsel"><option value="">Select your car…</option>${optgroups('car')}</select>
</div>
<div class="row"><select id="fsel"><option value="p">Normal (Petrol)</option><option value="h">High Octane</option></select>
<button class="p" id="go" type="button">Calculate</button></div>
<div class="result" id="res"></div>
</div>
<div class="ad" aria-label="Advertisement">Ad slot (AdSense)</div>
<h2>Browse by brand</h2>
<div class="tiles">
<a class="tile car" href="/cars/"><svg class="ic"><use href="#i-car"/></svg> Cars, by brand</a>
<a class="tile bike" href="/bikes/"><svg class="ic"><use href="#i-bike"/></svg> Bikes, by brand</a>
</div>
<p class="meta">Can't find your exact vehicle? <a href="/add.html">Add it manually</a> or <a href="/search.html">search</a>.</p>
<h2>Fuel &amp; car guides</h2>
<div class="guides">
<div class="gcard"><div class="dot" style="background:var(--pri)"><svg class="ic"><use href="#i-calc"/></svg></div><div><a href="/blog/how-to-calculate-car-fuel-average-pakistan.html">How to calculate your car's real fuel average</a><p>The full-tank method, step by step.</p></div></div>
<div class="gcard"><div class="dot" style="background:var(--acc)"><svg class="ic"><use href="#i-leaf"/></svg></div><div><a href="/blog/improve-fuel-economy-tips-pakistan.html">10 tips to save petrol</a><p>Driving and maintenance habits that actually work.</p></div></div>
<div class="gcard"><div class="dot" style="background:var(--diesel)"><svg class="ic"><use href="#i-drop"/></svg></div><div><a href="/blog/petrol-vs-high-octane-vs-diesel.html">Petrol vs High Octane vs Diesel</a><p>Which fuel your vehicle actually needs.</p></div></div>
</div>
<p class="meta"><a href="/blog/">See all guides →</a></p>
`;
  const extraJs = `
var vtab=document.getElementById("vtab"),vsel=document.getElementById("vsel"),fsel=document.getElementById("fsel"),res=document.getElementById("res");
function brand0(n){var m=/^(Road Prince|Super Power|Super Star)/.exec(n);return m?m[1]:n.split(" ")[0]}
function rebuildOptions(){
 var kind=vtab.value;
 var byB={};
 VEHICLES.concat(customVehicles()).filter(function(c){return c[5]==kind}).forEach(function(c){var b=brand0(c[0]);(byB[b]=byB[b]||[]).push(c)});
 var html='<option value="">Select your '+(kind=="bike"?"bike":"car")+'…</option>';
 Object.keys(byB).sort().forEach(function(b){html+='<optgroup label="'+b+'">'+byB[b].sort(function(x,y){return x[0].localeCompare(y[0])}).map(function(c){return '<option value="'+c[0].replace(/"/g,"&quot;")+'">'+c[0]+' — '+c[3]+' L</option>'}).join('')+'</optgroup>'});
 vsel.innerHTML=html;
}
vtab.onchange=rebuildOptions;
rebuildOptions();
function syncFuelOptions(){
 var name=vsel.value,v=VEHICLES.concat(customVehicles()).find(function(c){return c[0]==name});
 if(v&&v[4]=="d"){fsel.innerHTML='<option value="d">Diesel</option>'}
 else{fsel.innerHTML='<option value="p">Normal (Petrol)</option><option value="h">High Octane</option>'}
}
vsel.onchange=syncFuelOptions;
document.getElementById("go").onclick=function(){
 var name=vsel.value;
 if(!name){res.style.display="block";res.innerHTML="Please select a vehicle first.";return}
 var v=VEHICLES.concat(customVehicles()).find(function(c){return c[0]==name});
 var f=fsel.value,price=f=="h"?PRICES.h:(f=="d"?PRICES.d:PRICES.p);
 var amt=v[3]*price;
 res.style.display="block";
 res.innerHTML="<b>"+v[0]+"</b> — "+v[3]+" L tank<br>Full tank ("+(f=="h"?"High Octane":f=="d"?"Diesel":"Normal petrol")+"): <span class=\\"big\\">"+fmtRs(amt)+"</span>";
};
`;
  const brandDesc = `FullTank.pk is Pakistan's free fuel-cost calculator for cars and bikes, with Peto, a built-in assistant that asks which vehicle you have and tells you the full-tank cost in seconds.`;
  page('index.html', 'FullTank.pk — Petrol Price in Pakistan Today & Full Tank Cost Calculator', `FullTank.pk: today's petrol, high octane and diesel price in Pakistan. Pick your car or bike and instantly see the full-tank cost, or ask Peto. Updated ${pr.date}.`, body, {
    autoOpenPeto: true, extraJs, band,
    keywords: 'petrol price in pakistan today, diesel price today, fuel price calculator pakistan, full tank cost calculator, high octane price pakistan, car fuel cost calculator, bike fuel cost calculator',
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebApplication', name: 'FullTank.pk', applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: 'en-PK', description: brandDesc, offers: { '@type': 'Offer', price: '0', priceCurrency: 'PKR' } },
      { '@type': 'Organization', name: 'FullTank.pk', url: SITE + '/', logo: SITE + '/logo.svg', description: brandDesc },
      { '@type': 'WebSite', name: 'FullTank.pk', url: SITE + '/', description: brandDesc, potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: SITE + '/search.html?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
      { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'What is the petrol price in Pakistan today?', acceptedAnswer: { '@type': 'Answer', text: `Petrol is around Rs ${pr.petrol.toFixed(2)} per litre and diesel around Rs ${pr.diesel.toFixed(2)} per litre, updated ${pr.date}.` } }, { '@type': 'Question', name: 'What is Peto?', acceptedAnswer: { '@type': 'Answer', text: brandDesc } }] }
    ] }
  });
}

/* ================= /search.html — target of the Google sitelinks search box ================= */
{
  const body = `
<h1><svg class="ic" style="color:var(--pri)"><use href="#i-search"/></svg> Search cars &amp; bikes</h1>
<div class="calc">
<div class="row"><input id="sq" type="search" placeholder="e.g. Alto, Civic, CD 70…" autofocus></div>
<div id="sres" class="list"></div>
</div>
`;
  const extraJs = `
function brandS(n){var m=/^(Road Prince|Super Power|Super Star)/.exec(n);return m?m[1]:n.split(" ")[0]}
function cardS(c){return '<article class="car"><h3><a href="/'+c[5]+'/'+c[0].toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+'.html">'+c[0]+'</a></h3><div class="c">'+fmtRs(c[3]*PRICES[c[4]])+'</div><div class="s"><span class="tag">'+c[1]+'</span><span class="tag">'+c[2]+'</span>'+c[3]+' L tank</div></article>'}
function runSearch(q){
 var el=document.getElementById("sres");
 q=(q||"").trim();
 if(!q){el.innerHTML='<p class="meta">Type a car or bike name above — e.g. "Alto", "Civic", "CD 70".</p>';return}
 var L=VEHICLES.concat(customVehicles()).filter(function(c){return c[0].toLowerCase().indexOf(q.toLowerCase())>=0});
 if(!L.length){el.innerHTML='<p class="meta">No match for "'+q.replace(/</g,"&lt;")+'". <a href="/add.html">Add it manually</a>, or browse <a href="/cars/">all cars</a> / <a href="/bikes/">all bikes</a>.</p>';return}
 el.innerHTML=L.map(cardS).join("");
}
var sq=document.getElementById("sq");
var params=new URLSearchParams(location.search);
if(params.get("q")){sq.value=params.get("q")}
sq.oninput=function(){runSearch(sq.value);history.replaceState(null,"","/search.html"+(sq.value?"?q="+encodeURIComponent(sq.value):""))};
runSearch(sq.value);
`;
  page('search.html', 'Search Cars & Bikes — Full Tank Cost | FullTank.pk', 'Search any car or bike sold in Pakistan and see its full-tank cost at today\'s fuel price.', body, { extraJs, keywords: 'search car fuel cost pakistan, search bike fuel cost pakistan, full tank cost search, find my car fuel average', ld: crumb([['Home', '/'], ['Search', '/search.html']]) });
}

/* ================= /add.html — separate manual-add page ================= */
{
  const body = `
<h1><svg class="ic" style="color:var(--acc)"><use href="#i-pump"/></svg> Add a car or bike</h1>
<p>Can't find your vehicle in the brand pages? Add it here with its tank size, and it will be included in the calculator and in Peto's matches on this device.</p>
<div class="calc">
<form id="f">
<div class="row"><select id="fk"><option value="car">Car</option><option value="bike">Bike</option></select>
<input id="fn" placeholder="Vehicle name, e.g. Toyota Passo 2015" required></div>
<div class="row"><input id="ft" type="number" min="2" max="200" step="0.5" placeholder="Tank capacity (litres)" required>
<select id="ff"><option value="p">Petrol</option><option value="d">Diesel</option></select></div>
<button class="p" type="submit">Add &amp; calculate</button>
</form>
<p class="meta" style="margin:10px 0 0">Don't know the tank capacity? <a id="g" href="#" target="_blank" rel="noopener">Search it on Google</a> after typing the name.</p>
<div class="result" id="res"></div>
</div>
<h2>Your added vehicles</h2>
<div id="mine"></div>
`;
  const extraJs = `
document.getElementById("fn").oninput=function(e){document.getElementById("g").href="https://www.google.com/search?q="+encodeURIComponent(e.target.value+" fuel tank capacity litres")};
function renderMine(){
 var X=customVehicles(),el=document.getElementById("mine");
 if(!X.length){el.innerHTML='<p class="meta">Nothing added yet.</p>';return}
 el.innerHTML=X.map(function(c){return '<div class="add-list"><b>'+c[0]+'</b> — '+c[3]+' L, '+(c[4]=="d"?"Diesel":"Petrol")+' <span style="float:right;color:var(--acc);font-weight:700">'+fmtRs(c[3]*PRICES[c[4]])+'</span></div>'}).join('')
}
document.getElementById("f").onsubmit=function(e){
 e.preventDefault();
 var n=fn.value.trim(),t=parseFloat(ft.value),f=ff.value,k=fk.value;
 if(!n||!t)return;
 var X=customVehicles();
 X.push([n,f=="d"?"Diesel":"Petrol","Custom",t,f,k]);
 try{localStorage.setItem("xc",JSON.stringify(X))}catch(err){}
 var price=f=="d"?PRICES.d:PRICES.p,amt=t*price;
 res.style.display="block";
 res.innerHTML="Added. <b>"+n+"</b> — "+t+" L tank<br>Full tank: <span class=\\"big\\">"+fmtRs(amt)+"</span>";
 fn.value="";ft.value="";renderMine();
};
renderMine();
`;
  page('add.html', 'Add a Car or Bike – Fuel Tank Cost Calculator Pakistan', 'Add a car or bike not on the list, enter its tank size, and calculate its full-tank cost at today\'s fuel price.', body, { extraJs, keywords: 'add car fuel calculator, add bike fuel calculator, missing car tank capacity, custom vehicle fuel cost pakistan', ld: crumb([['Home', '/'], ['Add a vehicle', '/add.html']]) });
}

/* ================= /cars/ /bikes/ hubs + brand pages + collection pages + vehicle pages ================= */
for (const k of ['car', 'bike']) {
  const D = K[k].dir;
  for (const b of brandsOf(k)) {
    const L = of(k).filter(c => brand(c[0]) == b).sort((x, y) => cost(x) - cost(y));
    const ds = `Full-tank fuel cost for every ${b} ${K[k].one} sold in Pakistan, already calculated at today's price. Cheapest to fill: ${L[0][0]} at ${rs(cost(L[0]))}. Updated ${pr.date}.`;
    page(`${D}/${slug(b)}.html`, `${b} ${K[k].label} Full Tank Cost in Pakistan Today – ${L.length} Models | FullTank.pk`, ds,
      `<p class="crumb"><a href="/">Home</a> › <a href="/${D}/">${K[k].label}</a> › ${b}</p><h1><svg class="ic" style="color:var(--pri)"><use href="#${K[k].one=='car'?'i-car':'i-bike'}"/></svg> ${b} ${K[k].one} full tank cost in Pakistan today</h1><p>${ds}</p>${tbl(L, '../')}<p class="meta">Don't see your ${b} model? <a href="/add.html">Add it</a>.</p>`,
      { keywords: `${b} full tank cost pakistan, ${b} ${K[k].one} fuel average, ${b} ${K[k].one} tank capacity`, ld: crumb([['Home', '/'], [K[k].label, `/${D}/`], [b, `/${D}/${slug(b)}.html`]]) });
  }
  for (const [t, s] of COLL[k]) {
    const L = of(k).filter(c => c[1] == t).sort((x, y) => cost(x) - cost(y)), nmC = collName(k, t);
    if (!L.length) continue;
    page(`${D}/${s}.html`, `${nmC} Full Tank Cost in Pakistan Today – ${L.length} Models`, `Compare the full-tank fuel cost of ${L.length} ${nmC.toLowerCase()} in Pakistan at today's price. Cheapest: ${L[0][0]}, ${rs(cost(L[0]))}.`,
      `<p class="crumb"><a href="/">Home</a> › <a href="/${D}/">${K[k].label}</a> › ${nmC}</p><h1>${nmC}: full tank cost in Pakistan today</h1><p>Sorted from cheapest to most expensive to fill. Updated ${pr.date}.</p>${tbl(L, '../')}`,
      { keywords: `${nmC.toLowerCase()} pakistan, ${nmC.toLowerCase()} fuel cost, ${nmC.toLowerCase()} full tank cost pakistan, best ${nmC.toLowerCase()} fuel average`, ld: crumb([['Home', '/'], [K[k].label, `/${D}/`], [nmC, `/${D}/${s}.html`]]) });
  }
  const hubIcon = k == 'car' ? 'i-car' : 'i-bike';
  const band = `<div class="hubband ${k}"><div class="w"><svg class="ic" style="font-size:1.6rem"><use href="#${hubIcon}"/></svg><h1>${K[k].label}, sorted by brand</h1><p>Petrol Rs ${pr.petrol.toFixed(2)} · Diesel Rs ${pr.diesel.toFixed(2)} per litre (${pr.date})</p></div></div>`;
  const hubBody = `<p class="crumb"><a href="/">Home</a> › ${K[k].label}</p><p>Pick a brand to see every model with its full-tank cost already calculated.</p><div class="hubgrid">${brandsOf(k).map(b => `<a href="${slug(b)}.html">${b}</a>`).join('')}</div><h2>Or browse by type</h2><div class="hubgrid">${COLL[k].filter(([t]) => of(k).some(c => c[1] == t)).map(([t, s]) => `<a href="${s}.html">${collName(k, t)}</a>`).join('')}</div>`;
  page(`${D}/index.html`, `${K[k].label} Full Tank Cost in Pakistan Today – Browse by Brand`, `Full-tank fuel cost of every ${K[k].one} sold in Pakistan, sorted by brand, at today's petrol and diesel price. Updated ${pr.date}.`, hubBody, { band, keywords: `${K[k].label.toLowerCase()} in pakistan, ${K[k].one} fuel cost pakistan, ${K[k].one} brands pakistan, ${K[k].one} full tank cost calculator`, ld: crumb([['Home', '/'], [K[k].label, `/${D}/`]]) });

  for (const c of of(k)) {
    const [name, type, origin, tank, f, kind] = c, p = priceFor(f), B = brand(name), full = tank * p, fuel = f == 'd' ? 'diesel' : 'petrol';
    const bud = kind == 'bike' ? [500, 1000, 1500, 2000] : [2000, 5000, 10000, 15000], ex = bud[1];
    const sim = of(kind).filter(x => x[0] != name && x[1] == type).sort((a, b) => Math.abs(a[3] - tank) - Math.abs(b[3] - tank)).slice(0, 8);
    const a = `The ${name} has a ${tank} litre ${fuel} tank. At Rs ${p.toFixed(2)} per litre (${pr.date}), a full tank costs about ${rs(full)}.`;
    const q2 = `How many litres of ${fuel} does Rs ${ex.toLocaleString('en-PK')} buy for a ${name}?`, a2 = `Rs ${ex.toLocaleString('en-PK')} buys about ${(ex / p).toFixed(1)} litres at Rs ${p.toFixed(2)} per litre. The ${name} tank holds ${tank} litres.`;
    const bc = [['Home', '/'], [K[kind].label, `/${K[kind].dir}/`], [B, `/${K[kind].dir}/${slug(B)}.html`], [name, `/${kind}/${slug(name)}.html`]];
    page(`${kind}/${slug(name)}.html`, `${name} Full Tank Cost in Pakistan Today – ${rs(full)} | FullTank.pk`, a,
      `<p class="crumb"><a href="/">Home</a> › <a href="/${K[kind].dir}/">${K[kind].label}</a> › <a href="/${K[kind].dir}/${slug(B)}.html">${B}</a> › ${name}</p><h1><svg class="ic" style="color:${f=='d'?'var(--diesel)':'var(--pri)'}"><use href="#${f=='d'?'i-drop':'i-pump'}"/></svg> ${name} full tank cost in Pakistan today</h1><p class="big">${rs(full)}</p><p>${a} Tank size is the manufacturer figure and can vary slightly by model year.</p><h2>Fill-up cost</h2><table><tr><th>Fill</th><th>Litres</th><th>Cost</th></tr>${[.25, .5, .75, 1].map(x => `<tr><td>${x * 100}% tank</td><td>${(tank * x).toFixed(1)}</td><td>${rs(full * x)}</td></tr>`).join('')}</table><h2>How much fuel for your budget?</h2><table><tr><th>Budget</th><th>Litres</th></tr>${bud.map(x => `<tr><td>${rs(x)}</td><td>${(x / p).toFixed(1)}${x / p > tank ? ' (more than a full tank)' : ''}</td></tr>`).join('')}</table><h2>Similar ${type} ${K[kind].one}s</h2><ul>${sim.map(x => `<li><a href="/${kind}/${slug(x[0])}.html">${x[0]}</a> – ${x[3]} L, ${rs(cost(x))}</li>`).join('')}</ul>`,
      { keywords: `${name} full tank cost, ${name} fuel average, ${name} ${fuel} tank capacity, ${B} full tank cost pakistan`, ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [[`How much does it cost to fill a ${name} tank in Pakistan?`, a], [q2, a2]].map(([q, t]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: t } })) }, crumb(bc)] });
  }
}

/* ================= price history — day-by-day, with change indicators ================= */
{
  let H = []; try { H = JSON.parse(fs.readFileSync('history.json')); } catch (e) {}
  if (!H.length) H = [{ date: pr.date, petrol: pr.petrol, diesel: pr.diesel }];
  H.sort((a, b) => a.iso < b.iso ? -1 : 1);
  const pts = H.slice(-90), ps = pts.map(x => x.petrol), mn = Math.min(...ps), sp = (Math.max(...ps) - mn) || 1;
  const svg = pts.length > 1 ? `<svg viewBox="0 0 600 160" role="img" aria-label="Petrol price history chart" style="width:100%"><polyline fill="none" stroke="var(--pri)" stroke-width="3" points="${pts.map((x, i) => `${10 + i * 580 / (pts.length - 1)},${150 - (x.petrol - mn) / sp * 140}`).join(' ')}"/></svg>` : '';
  const delta = (cur, prev) => { if (prev == null) return '<span class="meta">—</span>'; const d = cur - prev; if (Math.abs(d) < 0.005) return '<span class="meta">No change</span>'; const up = d > 0; return `<span style="color:${up ? '#c0392b' : 'var(--pri)'};font-weight:600">${up ? '▲' : '▼'} Rs ${Math.abs(d).toFixed(2)}</span>`; };
  const rows = H.slice(-90).slice().reverse().map((x, i, arr) => { const prev = arr[i + 1]; return `<tr><td>${x.date}</td><td class="digits">Rs ${x.petrol.toFixed(2)}</td><td>${delta(x.petrol, prev && prev.petrol)}</td><td class="digits">Rs ${x.diesel.toFixed(2)}</td><td>${delta(x.diesel, prev && prev.diesel)}</td></tr>`; }).join('');
  const band = `<div class="hero"><div class="w"><svg class="ic" style="color:var(--pri)"><use href="#i-pump"/></svg><h1>Petrol &amp; diesel price history, day by day</h1><p class="lede">Every OGRA price revision we've tracked since launch, newest first, with the change from the previous rate.</p>
<div class="pump"><div class="pd" style="--c:var(--pri)"><svg class="ic"><use href="#i-pump"/></svg><b class="digits">${pr.petrol.toFixed(2)}</b><small>Petrol today — Rs/L</small></div><div class="pd" style="--c:var(--diesel)"><svg class="ic"><use href="#i-drop"/></svg><b class="digits">${pr.diesel.toFixed(2)}</b><small>Diesel today — Rs/L</small></div></div>
<p class="pump-meta">Updated ${pr.date}</p></div></div>`;
  page('price-history.html', `Petrol & Diesel Price History in Pakistan — Day by Day | FullTank.pk`, `Petrol price in Pakistan today is Rs ${pr.petrol.toFixed(2)} per litre and diesel Rs ${pr.diesel.toFixed(2)} (${pr.date}). Full day-by-day price history with each change.`,
    `<h2>Price trend</h2>${svg}<h2>Day-by-day history</h2><div style="overflow-x:auto"><table><tr><th>Date</th><th>Petrol</th><th>Change</th><th>Diesel</th><th>Change</th></tr>${rows}</table></div><p class="meta">High Octane (Rs ${pr.hOctane.toFixed(2)}/L) is deregulated and not included in OGRA's official notifications, so it isn't tracked here. New rows are logged automatically every day once this site is deployed — this list will keep growing from here.</p><p><a href="/cars/">Full-tank cost of every car</a> · <a href="/bikes/">Full-tank cost of every bike</a></p>`,
    { band, keywords: 'petrol price history pakistan, diesel price history pakistan, ogra price revisions, petrol price day by day', ld: crumb([['Home', '/'], ['Price history', '/price-history.html']]) });
}
/* ================= /blog/ — guides targeting real long-tail keywords ================= */
{
  const posts = JSON.parse(fs.readFileSync('blog.json', 'utf8')).sort((a, b) => b.date < a.date ? -1 : 1);
  const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  for (const p of posts) {
    page(`blog/${p.slug}.html`, `${p.title} | FullTank.pk Blog`, p.excerpt, `<p class="crumb"><a href="/">Home</a> › <a href="/blog/">Blog</a> › ${p.title}</p><h1>${p.title}</h1><p class="meta">Published ${fmtDate(p.date)} · FullTank.pk</p>${p.body}<div class="ad" aria-label="Advertisement">Ad slot (AdSense)</div><h2>More guides</h2><div class="hubgrid">${posts.filter(x => x.slug != p.slug).slice(0, 4).map(x => `<a href="${x.slug}.html">${x.title}</a>`).join('')}</div>`,
      { keywords: p.keywords, ogType: 'article', ld: [
        { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.excerpt, datePublished: p.date, dateModified: p.date, author: { '@type': 'Organization', name: 'FullTank.pk' }, publisher: { '@type': 'Organization', name: 'FullTank.pk', logo: { '@type': 'ImageObject', url: SITE + '/logo.svg' } }, image: SITE + '/og.png', mainEntityOfPage: SITE + '/blog/' + p.slug + '.html' },
        crumb([['Home', '/'], ['Blog', '/blog/'], [p.title, `/blog/${p.slug}.html`]])
      ] });
  }
  const dots = ['i-calc','i-leaf','i-drop','i-spark','i-car','i-bike'], tones = ['var(--pri)','var(--acc)','var(--diesel)','var(--pri)','var(--acc)','var(--diesel)'];
  const hubBody = `<p class="crumb"><a href="/">Home</a> › Blog</p><h1>Fuel &amp; car guides</h1><p>Practical, Pakistan-specific guides on fuel averages, saving petrol, and choosing the right fuel — written to go with the calculator, not replace it.</p><div class="guides">` +
    posts.map((p, i) => `<div class="gcard"><div class="dot" style="background:${tones[i % tones.length]}"><svg class="ic"><use href="#${dots[i % dots.length]}"/></svg></div><div><a href="${p.slug}.html">${p.title}</a><p>${fmtDate(p.date)} — ${p.excerpt}</p></div></div>`).join('') + `</div>`;
  page('blog/index.html', 'Fuel & Car Guides — FullTank.pk Blog', 'Practical guides on calculating fuel average, saving petrol, choosing the right fuel, and picking an efficient car or bike in Pakistan.', hubBody, { keywords: 'fuel saving tips pakistan, car guides pakistan, fuel average guide, petrol diesel high octane guide, bike fuel guide pakistan', ld: crumb([['Home', '/'], ['Blog', '/blog/']]) });
}

/* ================= About, Contact, Privacy ================= */
{
  const lastUpdated = pr.date;
  const about = `<h1><svg class="ic" style="color:var(--pri)"><use href="#i-pump"/></svg> About FullTank.pk</h1>
<p>FullTank.pk is a free, independent tool that answers one question as quickly as possible: <b>what will it cost to fill my car or bike at today's fuel price?</b></p>
<h2>What we do</h2>
<p>We track Pakistan's official OGRA-notified petrol and diesel prices, and a typical High Octane (HOBC) rate, and combine them with the manufacturer tank capacity of ${V.length}+ car and bike models sold in Pakistan — Suzuki, Toyota, Honda, Hyundai, Kia, Haval, Jetour, BYD, and more — to pre-calculate a full-tank cost for every single one, updated daily.</p>
<h2>Peto</h2>
<p>Peto is the small chat assistant in the corner of every page. It asks which vehicle you have and what fuel you use, then tells you the cost directly — a faster path than browsing for people who already know their exact model. It's a fixed, scripted conversation, not a hosted AI model, so it works instantly with nothing to configure.</p>
<h2>Where our numbers come from</h2>
<ul><li><b>Fuel prices:</b> OGRA and PSO notifications, refreshed daily just after midnight (PKT).</li><li><b>Tank capacities:</b> manufacturer specifications where available, cross-checked against PakWheels listings. We mark these as approximate because real-world variants and model years can differ slightly.</li></ul>
<h2>What we're not</h2>
<p>We're not affiliated with any car or bike manufacturer, OGRA, PSO, or any fuel company. We don't sell vehicles, fuel, or financial products — the calculator and guides are free to use, and the site is supported by advertising. See our <a href="/privacy.html">Privacy Policy</a> for how that works.</p>
<h2>Questions or a correction?</h2>
<p>If a tank capacity looks wrong, or your vehicle is missing, see <a href="/contact.html">Contact</a> — or <a href="/add.html">add it yourself</a> in the meantime.</p>`;

  const contact = `<h1><svg class="ic" style="color:var(--pri)"><use href="#i-search"/></svg> Contact</h1>
<p>Questions, corrections, or advertising inquiries — we'd like to hear from you.</p>
<div class="guides">
<div class="gcard"><div class="dot" style="background:var(--pri)"><svg class="ic"><use href="#i-pump"/></svg></div><div><b>General &amp; corrections</b><p>Spotted a wrong tank size or fuel price? Email <a href="mailto:hello@fulltank.pk">hello@fulltank.pk</a>.</p></div></div>
<div class="gcard"><div class="dot" style="background:var(--acc)"><svg class="ic"><use href="#i-spark"/></svg></div><div><b>Advertising</b><p>For ad or partnership inquiries, email <a href="mailto:ads@fulltank.pk">ads@fulltank.pk</a>.</p></div></div>
<div class="gcard"><div class="dot" style="background:var(--diesel)"><svg class="ic"><use href="#i-car"/></svg></div><div><b>Missing a vehicle?</b><p>You don't need to wait on us — <a href="/add.html">add it yourself</a> and it calculates instantly.</p></div></div>
</div>
<p class="meta">We read every message but can't guarantee a reply time, since FullTank.pk is run as an independent, free project.</p>`;

  const privacy = `<h1><svg class="ic" style="color:var(--pri)"><use href="#i-pump"/></svg> Privacy Policy</h1>
<p class="meta">Last updated: ${lastUpdated}</p>
<p>This policy explains what information FullTank.pk collects, how cookies and advertising work on this site, and the choices available to you.</p>

<h2>Information we collect</h2>
<p>We do not require sign-up, and we do not collect your name, email, or any personal identifier to use the calculator, Peto, or the search tool. Any car or bike you add through <a href="/add.html">Add a vehicle</a> is stored only in your own browser's local storage — it is never sent to us or to any server, and it stays on your device until you clear your browser data.</p>

<h2>Cookies and advertising (Google AdSense)</h2>
<p>This site may show ads served by Google and its advertising partners, through Google AdSense. As part of that:</p>
<ul>
<li>Google and its partners use cookies — including the DoubleClick DART cookie and similar technologies — to serve ads based on your prior visits to this and other websites.</li>
<li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the internet.</li>
<li>You can opt out of personalized advertising by visiting <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>.</li>
<li>You can also opt out of a third-party vendor's use of cookies for personalized advertising by visiting <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener">www.aboutads.info</a>.</li>
<li>Most browsers let you block or delete cookies yourself, in your browser's settings — doing so may affect how ads and some site features behave.</li>
</ul>

<h2>Third-party vendors</h2>
<p>Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to our site and/or other sites on the internet. We don't control these third-party cookies directly — each vendor's own privacy policy governs how they're used.</p>

<h2>Analytics</h2>
<p>We may use standard, privacy-respecting analytics to understand overall traffic (for example, which pages are popular) to improve the site. This data is aggregated and is not used to personally identify you.</p>

<h2>Links to other sites</h2>
<p>Our pages link to external sources — including OGRA notifications, manufacturer sites, and Google's own ad settings pages. We aren't responsible for the privacy practices of those external sites.</p>

<h2>Children's privacy</h2>
<p>This site is not directed at children under 13, and we do not knowingly collect information from children.</p>

<h2>Changes to this policy</h2>
<p>We may update this policy from time to time; the "last updated" date above will reflect the latest revision.</p>

<h2>Contact</h2>
<p>Questions about this policy? See <a href="/contact.html">Contact</a>.</p>`;

  page('about.html', 'About FullTank.pk — Pakistan Fuel Cost Calculator', `What FullTank.pk is, how we calculate full-tank cost for ${V.length}+ cars and bikes, and where our price and tank-capacity data comes from.`, about, { keywords: 'about fulltank.pk, pakistan fuel cost calculator, who runs fulltank.pk, peto fuel assistant', ld: crumb([['Home', '/'], ['About', '/about.html']]) });
  page('contact.html', 'Contact — FullTank.pk', 'Get in touch with FullTank.pk for corrections, missing vehicles, or advertising inquiries.', contact, { keywords: 'contact fulltank.pk, fulltank.pk advertising, fuel calculator feedback pakistan', ld: crumb([['Home', '/'], ['Contact', '/contact.html']]) });
  page('privacy.html', 'Privacy Policy — FullTank.pk', 'How FullTank.pk handles data, cookies, and Google AdSense advertising, and how to opt out of personalized ads.', privacy, { keywords: 'fulltank.pk privacy policy, google adsense cookies, ad personalization opt out pakistan', ld: crumb([['Home', '/'], ['Privacy Policy', '/privacy.html']]) });
}

/* ================= sitemap + robots ================= */
const blogSlugs = JSON.parse(fs.readFileSync('blog.json', 'utf8')).map(p => p.slug);
const urls = ['', 'cars/', 'bikes/', 'search.html', 'blog/', ...blogSlugs.map(s => `blog/${s}.html`), 'add.html', 'price-history.html', 'about.html', 'privacy.html', 'contact.html',
  ...['car', 'bike'].flatMap(k => [...brandsOf(k).map(b => `${K[k].dir}/${slug(b)}.html`), ...COLL[k].filter(([t]) => of(k).some(c => c[1] == t)).map(([t, s]) => `${K[k].dir}/${s}.html`)]),
  ...V.map(c => `${c[5]}/${slug(c[0])}.html`)];
const d = new Date().toISOString().slice(0, 10);
w('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${SITE}/${u}</loc><lastmod>${d}</lastmod></url>`).join('')}</urlset>`);
w('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
w('prices.json', JSON.stringify(pr));
if (fs.existsSync('og.png')) fs.copyFileSync('og.png', 'dist/og.png');
if (fs.existsSync('logo.svg')) fs.copyFileSync('logo.svg', 'dist/logo.svg');
console.log('built', urls.length, 'indexed URLs');
