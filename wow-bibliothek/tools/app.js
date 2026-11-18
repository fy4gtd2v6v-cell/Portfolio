/* ===================== Hilfsfunktionen ===================== */
const $ = s => document.querySelector(s);
const QUAL = {poor:"Schlecht",common:"Gewöhnlich",uncommon:"Selten",rare:"Rar",epic:"Episch",legendary:"Legendär",quest:"Quest"};
const SIDE = {A:["Allianz","a"],H:["Horde","h"],B:["Beide","n"],N:["Neutral","n"]};
const SLOT_ICON = s => /schwert/i.test(s)?"⚔":/axt/i.test(s)?"🪓":/dolch/i.test(s)?"🗡":/streitkolben|hammer/i.test(s)?"🔨":/zauberstab|stab|stangen/i.test(s)?"🪄":/bogen|armbrust|schuss|wurf/i.test(s)?"🏹":/schild/i.test(s)?"🛡":/finger/i.test(s)?"💍":/hals/i.test(s)?"📿":/rücken/i.test(s)?"🧣":/tasche/i.test(s)?"👜":/schmuck/i.test(s)?"✦":/reittier/i.test(s)?"🐎":/quest|schlüssel|startet/i.test(s)?"!":/kopf/i.test(s)?"⛑":/hände/i.test(s)?"🧤":/füße/i.test(s)?"🥾":/stoff$|material|handwerk/i.test(s)?"🧵":"⛨";
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let state = {faction:"horde", tab:"dungeons", sel:null, inner:"bosses", search:"", showAll:false, lootQ:"all"};
try{ const s = JSON.parse(localStorage.getItem("azeroth-bib")||"{}"); if(s.faction) state.faction=s.faction; if(s.showAll) state.showAll=true; }catch(e){}
const save = () => { try{ localStorage.setItem("azeroth-bib", JSON.stringify({faction:state.faction, showAll:state.showAll})); }catch(e){} };

const myside = () => state.faction==="horde" ? "H" : "A";
const questVisible = q => state.showAll || q.side==="B" || q.side===myside();
const bossName = b => b.de || b.name;
const variantFor = q => (q.variants||[]).find(v=>v.side===myside()) || (q.variants||[]).find(v=>v.side==="B") || (q.variants||[])[0] || null;

/* Gegenstände: Register für Tooltips, Suche und Beute-Liste */
const ITEMS = {};
const ALL_ITEMS = [];
function reg(i, src, where, ref){
  const key = (i.id||i.n)+"|"+src;
  ITEMS[key] = {...i, src, where};
  ALL_ITEMS.push({...i, src, where, ...ref, key});
  return key;
}
DUNGEONS.forEach(d=>{
  d.bosses.forEach(b=>b.drops.forEach(i=>{ i._k = reg(i, bossName(b), d.de, {did:d.id, boss:b.name}); }));
  d.quests.forEach(q=>(q.rewards||[]).forEach(i=>{ i._k = reg(i, "Belohnung: "+(q.de||q.name), d.de, {did:d.id, qn:q.name, reward:true}); }));
});
MONSTERS.forEach((m,mi)=>m.drops.forEach(i=>{ i._k = reg(i, m.de||m.name, m.zoneDe||m.zone, {mid:mi}); }));

const match = (...parts) => !state.search || parts.join(" ").toLowerCase().includes(state.search);

function itemHTML(i){
  return `<div class="item" data-ik="${esc(i._k)}" tabindex="0">
    <div class="slot q-${i.q}">${itemIcon(i)}</div>
    <div style="min-width:0"><div class="nm q-${i.q}">${esc(i.de||i.n)}</div>
    <div class="ty">${i.de && i.de!==i.n?`<i>${esc(i.n)}</i> · `:""}${esc(i.s)}${i.c?` · ${String(i.c).replace(".",",")} %`:""}${i.v===0?` · <span title="Quelle in den Datenbanken nicht belegt">⚠</span>`:""}</div></div></div>`;
}
function miniMap(xy, label, zid){
  if(!xy) return "";
  const [x,y]=xy;
  if(zid && typeof MAPS!=="undefined" && MAPS[zid]){
    return `<button type="button" class="minimap" data-map="${zid}" data-x="${x}" data-y="${y}" title="Karte vergrößern">
      <canvas width="300" height="200" aria-label="Karte ${esc(label)}, Position ${x}, ${y}"></canvas>
      <span>${esc(label)} · ${x}, ${y} <b aria-hidden="true">⤢</b></span></button>`;
  }
  const X=x*1.5, Y=y;
  let grid=""; for(let i=1;i<10;i++) grid+=`<line x1="${i*15}" y1="0" x2="${i*15}" y2="100"/><line x1="0" y1="${i*10}" x2="150" y2="${i*10}"/>`;
  return `<div class="minimap"><svg viewBox="0 0 150 100" role="img" aria-label="Karte ${esc(label)} ${x}, ${y}">
    <g stroke="rgba(90,55,15,.22)" stroke-width=".6">${grid}</g>
    <path d="M${X} ${Y} l-4 -9 a4.5 4.5 0 1 1 8 0 z" fill="#c8231b" stroke="#3f1503" stroke-width="1"/></svg>
    ${esc(label)} · ${x}, ${y}</div>`;
}

/* ===================== Zonenkarten =====================
   Eigene Karten aus den Spawn-Positionen aller NPCs und Objekte (QuestieDB).
   Helle Flächen = erschlossenes Gebiet, dunkle Flecken = Siedlungen, Lager, Wege. */
const MW=75, MH=50, CH="0123456789abcdefghijklmnopqrstuvwxyz";
const mapCache = {};
function mapLayers(zid){
  if(mapCache[zid]) return mapCache[zid];
  const g = MAPS[zid].g, v = new Uint8Array(MW*MH);
  for(let i=0;i<v.length;i++) v[i]=CH.indexOf(g[i]);
  const land = document.createElement("canvas"), dens = document.createElement("canvas");
  land.width=dens.width=MW; land.height=dens.height=MH;
  const L=land.getContext("2d").createImageData(MW,MH), Dd=dens.getContext("2d").createImageData(MW,MH);
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    const i=y*MW+x; let near=0;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){ const xx=x+dx, yy=y+dy; if(xx>=0&&yy>=0&&xx<MW&&yy<MH&&v[yy*MW+xx]) near++; }
    const a = Math.min(255, near*34);
    L.data.set([238,222,182,a], i*4);
    let sum=0, w=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx=x+dx, yy=y+dy; if(xx>=0&&yy>=0&&xx<MW&&yy<MH){ const f=(dx||dy)?1:2; sum+=v[yy*MW+xx]*f; w+=f; } }
    const d = sum/w; Dd.data.set([105,62,24, d ? Math.min(220, 18+d*7) : 0], i*4);
  }
  land.getContext("2d").putImageData(L,0,0); dens.getContext("2d").putImageData(Dd,0,0);
  return mapCache[zid] = {land, dens};
}
function paintMap(cv, zid, px, py, big){
  const m = MAPS[zid], c = cv.getContext("2d"), W = cv.width, H = cv.height, k = W/100, kh = H/100;
  const bg = c.createLinearGradient(0,0,W,H); bg.addColorStop(0,"#c9ab72"); bg.addColorStop(1,"#b8975c");
  c.fillStyle = bg; c.fillRect(0,0,W,H);
  const {land, dens} = mapLayers(zid);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
  c.drawImage(land,0,0,W,H); c.drawImage(land,0,0,W,H);
  c.drawImage(dens,0,0,W,H);
  c.strokeStyle="rgba(80,50,15,.13)"; c.lineWidth=1;
  for(let i=1;i<10;i++){ c.beginPath(); c.moveTo(i*W/10,0); c.lineTo(i*W/10,H); c.moveTo(0,i*H/10); c.lineTo(W,i*H/10); c.stroke(); }
  const fs = big ? 15 : 11;
  c.font = `${fs}px Georgia, serif`; c.textAlign="center"; c.textBaseline="middle";
  const fac = myside();
  (m.f||[]).filter(f=>!f[2] || f[2].includes(fac)).forEach(f=>{
    const x=f[0]*k, y=f[1]*kh; c.fillStyle = fac==="H" ? "#7d1612" : "#1d4592";
    c.beginPath(); c.arc(x,y,fs*.75,0,7); c.fill(); c.fillStyle="#fff1b8"; c.fillText("✈",x,y+1);
  });
  (m.d||[]).forEach(d=>{
    const x=d[0]*k, y=d[1]*kh; c.fillStyle="#2b1a0b";
    c.beginPath(); c.moveTo(x,y-fs*.7); c.lineTo(x+fs*.6,y); c.lineTo(x,y+fs*.7); c.lineTo(x-fs*.6,y); c.closePath(); c.fill();
    c.fillStyle="#f8d16a"; c.beginPath(); c.arc(x,y,fs*.22,0,7); c.fill();
    if(big){ c.fillStyle="#2b1a0b"; c.font=`bold 13px Georgia, serif`; c.fillText(d[2], x, y-fs-2); c.font=`${fs}px Georgia, serif`; }
  });
  const x=px*k, y=py*kh, r = big ? 11 : 8;
  c.strokeStyle="rgba(200,30,10,.45)"; c.setLineDash([4,4]); c.lineWidth=1.5;
  c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); c.setLineDash([]);
  c.fillStyle="rgba(200,30,10,.25)"; c.beginPath(); c.arc(x,y,r*1.6,0,7); c.fill();
  c.fillStyle="#c8231b"; c.strokeStyle="#3f1503"; c.lineWidth=1.5;
  c.beginPath(); c.moveTo(x,y); c.bezierCurveTo(x-r*1.1,y-r*1.4,x-r,y-r*2.6,x,y-r*2.6); c.bezierCurveTo(x+r,y-r*2.6,x+r*1.1,y-r*1.4,x,y); c.fill(); c.stroke();
  c.fillStyle="#fff1b8"; c.beginPath(); c.arc(x,y-r*1.75,r*.35,0,7); c.fill();
  c.strokeStyle="#6b4c1d"; c.lineWidth=big?4:3; c.strokeRect(0,0,W,H);
}
function paintAllMaps(root=document){
  if(typeof MAPS==="undefined") return;
  root.querySelectorAll("[data-map] canvas").forEach(cv=>{ const b=cv.parentElement; paintMap(cv, b.dataset.map, +b.dataset.x, +b.dataset.y, false); });
}
function openMap(btn){
  const zid=btn.dataset.map, m=MAPS[zid], x=+btn.dataset.x, y=+btn.dataset.y;
  const dlg=$("#mapDlg");
  dlg.querySelector("h3").textContent = m.de + (m.en!==m.de ? ` (${m.en})` : "");
  dlg.querySelector(".mapinfo").textContent = `Markierung bei ${x}, ${y}`;
  const cv=dlg.querySelector("canvas"); paintMap(cv, zid, x, y, true);
  dlg.hidden=false; dlg.querySelector(".mapclose").focus();
}
function closeMap(){ $("#mapDlg").hidden=true; }
function chipSide(s){ const [t,c]=SIDE[s]; return `<span class="chip ${c}">${t}</span>`; }
const enSub = (de, en) => de && en && de!==en ? `<span class="en">${esc(en)}</span>` : "";

/* ===================== Linke Liste ===================== */
function renderFilters(){
  const f = $("#filters");
  if(state.tab==="quests"){
    f.innerHTML = `<div class="filter-row"><label><input type="checkbox" id="showAll" ${state.showAll?"checked":""}> Quests der anderen Fraktion zeigen</label></div>`;
    $("#showAll").onchange = e => { state.showAll = e.target.checked; save(); render(); };
  } else if(state.tab==="loot"){
    f.innerHTML = `<div class="filter-row"><select id="lootQ" aria-label="Qualität">
      ${["all","legendary","epic","rare","uncommon","common","quest"].map(q=>`<option value="${q}" ${state.lootQ===q?"selected":""}>${q==="all"?"Alle Qualitäten":QUAL[q]}</option>`).join("")}
    </select></div>`;
    $("#lootQ").onchange = e => { state.lootQ = e.target.value; renderList(); };
  } else f.innerHTML = "";
}

function renderList(){
  const L = $("#list"); let h = "";
  if(state.tab==="dungeons"){
    const ds = DUNGEONS.filter(d=>match(d.name,d.de,d.zone,d.bosses.map(b=>b.name+" "+(b.de||"")+" "+b.drops.map(x=>x.n+" "+(x.de||"")).join(" ")).join(" "),d.quests.map(q=>q.name+" "+(q.de||"")).join(" ")))
      .sort((a,b)=>a.min-b.min);
    [["Dungeons",ds.filter(d=>!d.raid)],["Schlachtzüge",ds.filter(d=>d.raid)]].forEach(([title,arr])=>{
      if(!arr.length) return;
      h += `<div class="list-head">${title}</div>`;
      arr.forEach(d=>{
        const own = d.faction==="N" || d.faction===myside();
        const abbr = d.de.replace(/^(Der|Die|Das) /,"").split(/[\s'-]+/).filter(w=>/^[A-ZÄÖÜ]/.test(w)).map(w=>w[0]).join("").slice(0,2) || d.de[0];
        h += `<button class="entry ${state.sel===d.id?"on":""}" data-d="${d.id}" style="${own?"":"opacity:.62"}">
          <div class="ico">${abbr}</div>
          <div class="t"><b>${esc(d.de)}</b><span>${esc(d.name)} · ${esc(d.zone)}</span></div><span class="lvl">${d.raid?d.size+"er":d.level}</span></button>`;
      });
    });
    if(!ds.length) h = `<p class="hidden-note" style="color:#b59d77">Nichts gefunden.</p>`;
  }
  if(state.tab==="quests"){
    let any=false;
    [...DUNGEONS].sort((a,b)=>(a.raid?1:0)-(b.raid?1:0) || a.min-b.min).forEach(d=>{
      const qs = d.quests.filter(q=>{ const v=variantFor(q); return questVisible(q) && match(q.name,q.de,q.giver,v&&v.giver&&(v.giver.de+" "+v.giver.en),q.objDe,d.name,d.de); });
      if(!qs.length) return; any=true;
      h += `<div class="list-head">${esc(d.de)} · ${d.raid?"Schlachtzug":d.level}</div>`;
      qs.forEach(q=>{ const v=variantFor(q); h += `<button class="entry" data-d="${d.id}" data-inner="quests" data-q="${esc(q.name)}">
        <div class="ico" style="color:#ffd100">!</div><div class="t"><b>${esc(q.de||q.name)}</b><span>${esc(v&&v.giver?v.giver.de:q.giver)}</span></div>${chipSide(q.side)}</button>`; });
    });
    if(!any) h = `<p class="hidden-note" style="color:#b59d77">Keine Quests gefunden.</p>`;
  }
  if(state.tab==="monsters"){
    const ms = MONSTERS.map((m,i)=>({...m,i})).filter(m=>match(m.name,m.de,m.zone,m.zoneDe,m.type,m.drops.map(x=>x.n+" "+(x.de||"")).join(" ")));
    const groups = [...new Set(ms.map(m=>m.type))];
    groups.forEach(g=>{
      h += `<div class="list-head">${g}</div>`;
      ms.filter(m=>m.type===g).forEach(m=>{ h += `<button class="entry ${state.sel==="mon:"+m.i?"on":""}" data-m="${m.i}">
        <span class="ico embwrap">${emblem(m.name)}</span><div class="t"><b>${esc(m.de||m.name)}</b><span>${esc(m.zoneDe||m.zone)}</span></div><span class="lvl">${esc(m.level)}</span></button>`; });
    });
    if(!ms.length) h = `<p class="hidden-note" style="color:#b59d77">Nichts gefunden.</p>`;
  }
  if(state.tab==="loot"){
    const order = {legendary:0,epic:1,rare:2,uncommon:3,common:4,poor:5,quest:6};
    const its = ALL_ITEMS.filter(i=>(state.lootQ==="all"||i.q===state.lootQ) && match(i.n,i.de,i.s,i.src,i.where))
      .sort((a,b)=>order[a.q]-order[b.q] || (a.de||a.n).localeCompare(b.de||b.n));
    const shown = its.slice(0,400);
    shown.forEach(i=>{ h += `<button class="entry" ${i.did?`data-d="${i.did}"`:`data-m="${i.mid}"`} ${i.boss?`data-boss-open="${esc(i.boss)}"`:""} ${i.reward?`data-inner="quests" data-q="${esc(i.qn)}"`:""} data-ik="${esc(i.key)}">
      <div class="ico q-${i.q} icimg" style="border-color:currentColor">${itemIcon(i)}</div>
      <div class="t"><b class="q-${i.q}">${esc(i.de||i.n)}</b><span>${esc(i.src)} · ${esc(i.where)}</span></div></button>`; });
    if(its.length>shown.length) h += `<p class="hidden-note" style="color:#b59d77">${its.length-shown.length} weitere – Suche oder Filter eingrenzen.</p>`;
    if(!its.length) h = `<p class="hidden-note" style="color:#b59d77">Keine Gegenstände gefunden.</p>`;
  }
  L.innerHTML = h;
}

/* ===================== Detailansicht ===================== */
function renderWelcome(){
  $("#detailTitle").textContent = "Bibliothek";
  const fac = state.faction==="horde";
  $("#detail").innerHTML = `<div class="welcome">
    <svg class="emblem"><use href="#sym-${state.faction}"/></svg>
    <h2>${fac?"Lok'tar, Reisender!":"Für die Allianz, Reisender!"}</h2>
    <p class="muted">Wähle links einen Dungeon, eine Quest, ein Monster oder einen Gegenstand.<br>
    Quests werden für die ${fac?"Horde":"Allianz"} gefiltert – oben rechts kannst du die Fraktion wechseln.</p>
    <div class="stat-row">
      <div class="stat"><b>${DUNGEONS.filter(d=>!d.raid).length}</b>Dungeons</div>
      <div class="stat"><b>${DUNGEONS.filter(d=>d.raid).length}</b>Schlachtzüge</div>
      <div class="stat"><b>${DUNGEONS.reduce((a,d)=>a+d.bosses.length,0)}</b>Bosse</div>
      <div class="stat"><b>${DUNGEONS.reduce((a,d)=>a+d.quests.filter(q=>q.side==="B"||q.side===myside()).length,0)}</b>${fac?"Horde":"Allianz"}-Quests</div>
      <div class="stat"><b>${new Set(ALL_ITEMS.map(i=>i.id||i.n)).size}</b>Gegenstände</div>
    </div>
    <div class="box" style="text-align:left;max-width:640px;margin:0 auto">
      <h4>Empfohlene Reihenfolge (${fac?"Horde":"Allianz"})</h4>
      ${DUNGEONS.filter(d=>!d.raid&&(d.faction==="N"||d.faction===myside())).sort((a,b)=>a.min-b.min).map(d=>`<button class="link" data-d="${d.id}">${esc(d.de)}</button> <span class="muted">(${d.level})</span>`).join(" → ")}
    </div></div>`;
}

function bossHTML(b, open){
  const npcs = b.npcs||[];
  const enNames = npcs.length ? npcs.map(n=>n.en).join(" & ") : b.name;
  const lvl = b.lvl ? (b.lvl==="??" ? `<span class="lvlb" title="Stufe ??">☠ ??</span>` : `<span class="lvlb">Stufe ${esc(b.lvl)}</span>`) : "";
  return `<details class="boss" ${open?"open":""} data-boss="${esc(b.name)}">
    <summary>${emblem(b.name, "skull emb"+(b.rare?" rare":""))}
      <h3>${esc(b.de||b.name)}${enSub(b.de||b.name, enNames)}</h3>${lvl}<span class="tag">${esc(b.tag||"")}</span><span class="arrow">▶</span></summary>
    <div class="body"><p class="tactic"><b>Taktik:</b> ${esc(b.tactic)}</p>
      ${b.drops.length?`<div class="loot">${b.drops.map(itemHTML).join("")}</div>`:`<p class="hidden-note">Keine besonderen Drops in der Datenbank.</p>`}
    </div></details>`;
}

function questHTML(q){
  const v = variantFor(q); const g = v && v.giver;
  const others = (q.variants||[]).filter(x=>x!==v && x.giver);
  const xy = g && g.xy;
  const giver = g ? `${esc(g.de)}${g.en!==g.de?` <i class="muted">(${esc(g.en)})</i>`:""}` : esc(q.giver);
  const where = g ? esc(g.zone||"") : esc(q.loc);
  const lvl = q.lvl ? `<span class="chip">Stufe ${q.lvl}${q.min?` · ab ${q.min}`:""}</span>` : "";
  const rewards = q.rewards && q.rewards.length ? `<div class="loot">${q.rewards.map(itemHTML).join("")}</div>` : esc(q.reward||"");
  return `<div class="quest" data-qname="${esc(q.name)}">
    <h3>${esc(q.de||q.name)} ${chipSide(q.side)} ${lvl}</h3>
    ${q.de && q.de!==q.name?`<div class="en" style="margin:-2px 0 6px">${esc(q.name)}</div>`:""}
    <div class="mapwrap"><div><dl class="qgrid">
      <dt>Questgeber</dt><dd>${giver}${g&&g.item?` <span class="chip">Gegenstand</span>`:""}${g&&g.object?` <span class="chip">Objekt</span>`:""}</dd>
      <dt>Fundort</dt><dd>${where}${xy?`<span class="coord">${xy[0]}, ${xy[1]}</span>`:""}</dd>
      ${others.length?`<dt>Andere Fraktion</dt><dd>${others.map(o=>`${SIDE[o.side][0]}: ${esc(o.giver.de)} – ${esc(o.giver.zone||"")}${o.giver.xy?` (${o.giver.xy[0]}, ${o.giver.xy[1]})`:""}`).join("<br>")}</dd>`:""}
      <dt>Ziel</dt><dd>${esc(q.objDe||q.obj)}${q.objDe&&q.objEn?`<div class="en">${esc(q.objEn)}</div>`:""}</dd>
      <dt>Vorgehen</dt><dd><ol class="steps">${(q.steps||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ol></dd>
      <dt>Belohnung</dt><dd>${rewards}</dd>
    </dl></div>${miniMap(xy, (g&&g.zone)||"", g&&g.zid)}</div></div>`;
}

function renderDungeon(d){
  $("#detailTitle").textContent = d.de;
  const quests = d.quests.filter(questVisible);
  const hiddenQ = d.quests.length - quests.length;
  const tabs = [["bosses","Bosse & Beute"],["quests",`Quests (${quests.length})`],["route","Vorgehen"]];
  let body = "";
  if(state.inner==="bosses") body = d.bosses.map((b,bi)=>bossHTML(b, state.openBoss ? state.openBoss===b.name : bi<1)).join("");
  if(state.inner==="quests"){
    body = quests.map(questHTML).join("") || `<p class="muted">Für deine Fraktion gibt es hier keine Quests.</p>`;
    if(hiddenQ && !state.showAll) body += `<p class="hidden-note">${hiddenQ} Quest(s) der anderen Fraktion ausgeblendet. <button class="link" id="showOther">Anzeigen</button></p>`;
  }
  const entranceMap = miniMap(d.xy, d.xyZone||d.zone, d.xyZid) + (d.xy2?miniMap(d.xy2.xy, d.xy2.zone, d.xy2.zid):"");
  if(state.inner==="route"){
    body = `<div class="box mapwrap"><div><h4>Weg zum Eingang</h4>${esc(d.entrance)}</div>${entranceMap}</div>
      <h3 class="sec-title">Ablauf im Dungeon</h3>
      <ol class="steps" style="font-size:17px">${d.route.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>`;
  }
  const facChip = d.faction==="N" ? `<span class="chip n">Beide Fraktionen</span>` : `<span class="chip ${SIDE[d.faction][1]}">Vor allem ${SIDE[d.faction][0]}</span>`;
  $("#detail").innerHTML = `
    <div class="banner">${scene(d)}</div>
    <div class="d-head"><div style="flex:1;min-width:220px">
      <h2>${esc(d.de)}</h2><div class="sub">${esc(d.name)} · ${esc(d.zone)}</div>
      <div class="chips"><span class="chip">Stufe ${d.level}</span>${d.raid?`<span class="chip h" style="background:#5b2a8a;border-color:#2c1046">Schlachtzug · ${d.size} Spieler</span>`:""}${facChip}<span class="chip">${d.bosses.length} Bosse</span></div>
    </div></div>
    <p>${esc(d.desc)}</p>
    <div class="box mapwrap"><div><h4>Fundort / Eingang ${d.xy?`<span class="coord">${d.xy[0]}, ${d.xy[1]}</span>`:""}</h4>${esc(d.entrance)}</div>${entranceMap}</div>
    <div class="inner-tabs">${tabs.map(([k,t])=>`<button class="tab ${state.inner===k?"on":""}" data-inner-tab="${k}">${t}</button>`).join("")}</div>
    ${body}`;
  const so = $("#showOther"); if(so) so.onclick = () => { state.showAll = true; save(); render(); };
  paintAllMaps($("#detail"));
}

function renderMonster(m){
  $("#detailTitle").textContent = m.de||m.name;
  const en = (m.npcs||[]).map(n=>n.en).join(", ");
  $("#detail").innerHTML = `<div class="d-head">${emblem(m.name, "emb big")}
    <div style="flex:1"><h2>${esc(m.de||m.name)}</h2><div class="sub">${esc(m.type)} · ${esc(m.zoneDe||m.zone)}${en?` · ${esc(en)}`:""}</div>
    <div class="chips"><span class="chip">Stufe ${esc(m.level)}</span></div></div></div>
    <p>${esc(m.desc)}</p>
    <div class="box"><h4>Fundort</h4>${esc(m.zone)}</div>
    <h3 class="sec-title">Vorgehen</h3><p class="tactic">${esc(m.tactic)}</p>
    <h3 class="sec-title">Beute</h3>${m.drops.length?`<div class="loot">${m.drops.map(itemHTML).join("")}</div>`:`<p class="hidden-note">Keine Drops belegt.</p>`}`;
}

function renderDetail(){
  if(!state.sel) return renderWelcome();
  if(state.sel.startsWith("mon:")) return renderMonster(MONSTERS[+state.sel.slice(4)]);
  const d = DUNGEONS.find(x=>x.id===state.sel); if(d) renderDungeon(d); else renderWelcome();
}

function applyFaction(){
  document.documentElement.dataset.faction = state.faction;
  $("#brandEmblem use").setAttribute("href", "#sym-"+state.faction);
  document.querySelectorAll(".faction-switch button").forEach(b=>b.classList.toggle("on", b.dataset.f===state.faction));
}
function render(){
  applyFaction();
  document.querySelectorAll("#mainTabs .tab").forEach(t=>t.classList.toggle("on", t.dataset.tab===state.tab));
  renderFilters(); renderList(); renderDetail();
}

/* ===================== Ereignisse ===================== */
document.querySelectorAll(".faction-switch button").forEach(b=>b.onclick=()=>{ state.faction=b.dataset.f; save(); render(); });
$("#mainTabs").onclick = e => { const t=e.target.closest(".tab"); if(!t) return; state.tab=t.dataset.tab; render(); };
$("#search").oninput = e => { state.search = e.target.value.trim().toLowerCase(); renderList(); };
$("#closeDetail").onclick = () => { state.sel=null; render(); };

document.addEventListener("click", e=>{
  const it = e.target.closest("[data-inner-tab]");
  if(it){ state.inner = it.dataset.innerTab; state.openBoss=null; renderDetail(); return; }
  const mb = e.target.closest("[data-map]");
  if(mb){ openMap(mb); return; }
  if(e.target.closest(".mapclose") || e.target.id==="mapDlg"){ closeMap(); return; }
  if(e.target.closest("#mapDlg")) return;
  const card = e.target.closest(".item");
  if(card){ showTip(card); return; }
  hideTip();
  const en = e.target.closest("[data-d],[data-m]");
  if(!en) return;
  if(en.dataset.m!==undefined){ state.sel = "mon:"+en.dataset.m; }
  else {
    state.sel = en.dataset.d;
    state.inner = en.dataset.inner || "bosses";
    state.openBoss = en.dataset.bossOpen || null;
  }
  renderList(); renderDetail();
  const target = en.dataset.q ? document.querySelector(`[data-qname="${CSS.escape(en.dataset.q)}"]`)
               : state.openBoss ? document.querySelector(`[data-boss="${CSS.escape(state.openBoss)}"]`) : null;
  if(window.innerWidth<=860) (target||$(".detail")).scrollIntoView({behavior:"smooth",block:"start"});
  else if(target) target.scrollIntoView({behavior:"smooth",block:"center"});
});

/* Tooltip im Spielstil (Maus: folgt dem Zeiger, Touch: Antippen) */
const tip = $("#tip");
function tipHTML(i){
  const lines = (i.tip||[]).map(l=>{
    const [a,b] = l.split("\t");
    const cls = /^(Anlegen|Benutzen|Chance bei Treffer|Set):/.test(a) ? "tgr" : /^„/.test(a) ? "tq" : "tw";
    return b ? `<div class="tr ${cls}"><span>${esc(a)}</span><span>${esc(b)}</span></div>` : `<div class="${cls}">${esc(a)}</div>`;
  }).join("");
  return `${i.ic?`<img class="tipic" src="${ICON_URL(i.ic,"large")}" alt="" onerror="this.remove()">`:""}<div class="tn q-${i.q}">${esc(i.de||i.n)}</div>
    ${i.de && i.de!==i.n?`<div class="tg">${esc(i.n)}</div>`:""}
    ${lines || `<div class="tw">${esc(i.s)}</div>`}
    ${i.startsQuest?`<div class="ty2">Startet die Quest: ${esc(i.startsQuest)}</div>`:""}
    <div class="ty2">Quelle: ${esc(i.src)}${i.c?` (${String(i.c).replace(".",",")} %)`:""}</div>
    ${i.v===0?`<div class="tg">⚠ Quelle in den Datenbanken nicht belegt</div>`:""}
    ${i.lvl?`<div class="tg">Gegenstandsstufe ${i.lvl}</div>`:""}`;
}
function placeTip(x, y){
  const tx = Math.max(8, Math.min(x+16, window.innerWidth - tip.offsetWidth - 8));
  const ty = Math.max(8, Math.min(y+16, window.innerHeight - tip.offsetHeight - 8));
  tip.style.left = tx+"px"; tip.style.top = ty+"px";
}
function showTip(el, ev){
  const i = ITEMS[el.dataset.ik]; if(!i) return;
  tip.innerHTML = tipHTML(i); tip.style.display = "block";
  if(ev) placeTip(ev.clientX, ev.clientY);
  else { const r = el.getBoundingClientRect(); placeTip(r.left - 16, r.bottom - 8); }
}
function hideTip(){ tip.style.display = "none"; }
document.addEventListener("mousemove", e=>{
  if(e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
  const el = e.target.closest("[data-ik]");
  if(!el){ hideTip(); return; }
  showTip(el, e);
});
document.addEventListener("focusin", e=>{ const el=e.target.closest(".item"); if(el) showTip(el); });
document.addEventListener("scroll", hideTip, true);
document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ closeMap(); hideTip(); } });

render();
