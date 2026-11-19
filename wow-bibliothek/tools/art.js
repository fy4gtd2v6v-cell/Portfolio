/* ===================== Bilder =====================
   Gegenstände: Original-Symbole aus dem Spiel, beim Anzeigen direkt vom Wowhead-Bildserver geladen
   (nicht im Repo gespeichert). Ohne Verbindung erscheint das gezeichnete Ersatzsymbol.
   Bosse, Monster, Dungeons: eigene Illustrationen (SVG), keine Spielgrafiken. */
const ICON_URL = (ic, size) => `https://wow.zamimg.com/images/wow/icons/${size}/${encodeURIComponent(String(ic).toLowerCase())}.jpg`;
function itemIcon(i, size="medium"){
  const fb = SLOT_ICON(i.s);
  if(!i.ic) return `<span class="fb">${fb}</span>`;
  return `<img class="ic" src="${ICON_URL(i.ic,size)}" alt="" loading="lazy" decoding="async" data-fb="${esc(fb)}">`;
}
document.addEventListener("error", e=>{
  const t = e.target;
  if(t && t.tagName==="IMG" && t.classList.contains("ic")){ const s=document.createElement("span"); s.className="fb"; s.textContent=t.dataset.fb||"⛨"; t.replaceWith(s); }
}, true);

/* ---------- Kreatur-Wappen ---------- */
const GLYPH = {
  dragon:`<path d="M14 44c4-10 10-16 19-18l-6-9 11 6c8-1 15 2 19 8l-8-1 4 6-9-2c-2 6-7 10-14 11l2 7-7-5-5 6-1-8z"/><circle cx="41" cy="31" r="2.2" class="eye"/><path d="M33 26l-4-14 8 10zM40 25l1-13 4 12z"/>`,
  spider:`<ellipse cx="32" cy="36" rx="9" ry="11"/><circle cx="32" cy="22" r="6"/><path d="M24 30L10 20l-2-8M24 35L8 32l-4-6M24 40l-14 6-3 8M25 44l-9 12M40 30l14-10 2-8M40 35l16-3 4-6M40 40l14 6 3 8M39 44l9 12" fill="none" stroke-width="3.2" stroke-linecap="round"/><circle cx="29.5" cy="21" r="1.4" class="eye"/><circle cx="34.5" cy="21" r="1.4" class="eye"/>`,
  beast:`<path d="M12 22l8-12 6 10c4-2 8-2 12 0l6-10 8 12c2 8 0 14-4 19l-8 13c-3 3-11 3-14 0l-8-13c-4-5-6-11-6-19z"/><path d="M24 30l5 3M40 30l-5 3" stroke-width="2.5" class="ln"/><path d="M28 44h8l-4 5z" class="eye"/>`,
  humanoid:`<path d="M18 30c0-11 6-18 14-18s14 7 14 18v8c0 7-4 12-8 15h-12c-4-3-8-8-8-15z"/><path d="M18 30h28v5H18zM30 35h4v16h-4z" class="eye"/><path d="M32 12V5" stroke-width="3" class="ln"/>`,
  caster:`<path d="M32 6l16 30c3 6 2 14-3 20H19c-5-6-6-14-3-20z"/><path d="M24 40c2-6 5-9 8-9s6 3 8 9c-2 5-5 7-8 7s-6-2-8-7z" class="eye"/><circle cx="28.5" cy="40" r="1.6"/><circle cx="35.5" cy="40" r="1.6"/>`,
  undead:`<path d="M32 9c-11 0-18 8-18 18 0 7 3 11 7 13v7h22v-7c4-2 7-6 7-13 0-10-7-18-18-18z"/><circle cx="25" cy="28" r="4.5" class="eye"/><circle cx="39" cy="28" r="4.5" class="eye"/><path d="M32 33l-3 6h6z" class="eye"/><path d="M26 47v7M32 47v7M38 47v7" stroke-width="3" class="ln"/>`,
  ghost:`<path d="M16 54V28c0-11 7-18 16-18s16 7 16 18v26l-5-5-5 5-6-6-6 6-5-5z"/><ellipse cx="26" cy="29" rx="3.5" ry="5" class="eye"/><ellipse cx="38" cy="29" rx="3.5" ry="5" class="eye"/>`,
  fire:`<path d="M32 6c3 10 14 15 14 29 0 11-6 19-14 19s-14-8-14-19c0-6 3-10 6-13 0 5 2 8 4 9-1-9 2-17 4-25z"/><path d="M32 30c3 5 7 8 7 14 0 5-3 8-7 8s-7-3-7-8c0-5 4-8 7-14z" class="eye"/>`,
  water:`<path d="M32 6c7 12 18 22 18 33 0 10-8 17-18 17s-18-7-18-17c0-11 11-21 18-33z"/><path d="M22 40c4 4 9 6 16 4" fill="none" stroke-width="3" class="ln"/>`,
  earth:`<path d="M10 50l6-22 10-8 9 3 9-9 10 12 0 24z"/><path d="M26 20l4 12-6 6M44 14l-4 14 7 9" fill="none" stroke-width="2.5" class="ln"/><circle cx="28" cy="40" r="2.5" class="eye"/><circle cx="40" cy="40" r="2.5" class="eye"/>`,
  demon:`<path d="M14 8c0 10 4 15 9 17-3 4-5 9-5 14 0 10 6 17 14 17s14-7 14-17c0-5-2-10-5-14 5-2 9-7 9-17-5 6-10 8-15 8h-6c-5 0-10-2-15-8z"/><path d="M24 36l6 3M40 36l-6 3" stroke-width="3" class="ln"/><path d="M27 47h10l-5 4z" class="eye"/>`,
  ogre:`<path d="M14 26c0-10 8-16 18-16s18 6 18 16v12c0 10-8 16-18 16s-18-6-18-16z"/><circle cx="32" cy="30" r="5.5" class="eye"/><circle cx="32" cy="30" r="2"/><path d="M22 44c6 4 14 4 20 0" fill="none" stroke-width="3" class="ln"/><path d="M24 45l2 5M40 45l-2 5" stroke-width="3" class="ln"/>`,
  troll:`<path d="M10 22l12 6c2-9 6-14 10-14s8 5 10 14l12-6-8 12c0 12-6 20-14 20s-14-8-14-20z"/><path d="M24 33l5 2M40 33l-5 2" stroke-width="3" class="ln"/><path d="M24 44l-3 8 6-5M40 44l3 8-6-5" class="eye"/>`,
  mech:`<path d="M29 6h6l1 7 5 2 5-5 4 4-5 5 2 5 7 1v6l-7 1-2 5 5 5-4 4-5-5-5 2-1 7h-6l-1-7-5-2-5 5-4-4 5-5-2-5-7-1v-6l7-1 2-5-5-5 4-4 5 5 5-2z"/><circle cx="32" cy="32" r="8" class="eye"/>`,
  murloc:`<path d="M12 40c0-14 9-24 22-24 8 0 14 4 18 10l-6 3 7 3-6 3 6 4c-4 7-11 11-19 11-12 0-22-3-22-10z"/><path d="M22 16l4-9 4 9 4-9 3 9" /><circle cx="40" cy="30" r="3" class="eye"/><path d="M20 44h18" stroke-width="2.5" class="ln"/>`,
  insect:`<ellipse cx="32" cy="38" rx="12" ry="15"/><path d="M32 23v30" stroke-width="2" class="ln"/><ellipse cx="32" cy="18" rx="7" ry="5"/><path d="M27 14l-7-8M37 14l7-8M20 32l-10-4M20 40l-11 2M21 47l-8 7M44 32l10-4M44 40l11 2M43 47l8 7" fill="none" stroke-width="3" stroke-linecap="round"/>`,
  plant:`<path d="M32 56V30"/><path d="M32 56c-1-14 0-26 0-26" fill="none" stroke-width="4"/><path d="M32 34C18 34 10 24 12 10c12 0 20 8 20 24zM32 30c2-14 10-22 22-22 1 14-8 22-22 22z"/><path d="M22 20l8 10M44 16l-10 12" fill="none" stroke-width="2" class="ln"/>`,
  slime:`<path d="M10 50c0-12 8-26 22-26 4-6 8-8 12-6-2 2-2 5 0 8 6 4 10 14 10 24z"/><circle cx="26" cy="40" r="3" class="eye"/><circle cx="38" cy="40" r="3" class="eye"/><circle cx="20" cy="20" r="3"/><circle cx="48" cy="14" r="2"/>`,
  serpent:`<path d="M44 12c8 0 12 6 9 12-2 5-8 6-12 4-6-3-14 0-14 7 0 6 6 8 12 8 9 0 14 6 12 12-3 6-12 7-24 5 8-2 16-3 15-7-1-3-6-4-11-4-10 0-16-6-14-15 2-10 12-14 21-11l2-6c-4-1-6-3-6-5z"/><circle cx="47" cy="17" r="1.8" class="eye"/>`,
  bat:`<path d="M32 22c3 0 5 2 5 6l9-8c4 2 10 2 14 0-2 6-1 13 2 18-6-1-12 1-15 6-4-2-9-2-12 2-3-4-8-4-12-2-3-5-9-7-15-6 3-5 4-12 2-18 4 2 10 2 14 0l9 8c0-4 2-6 5-6z"/><path d="M29 22l-2-6 4 4M35 22l2-6-4 4"/><circle cx="30" cy="29" r="1.3" class="eye"/><circle cx="34" cy="29" r="1.3" class="eye"/>`,
  turtle:`<ellipse cx="30" cy="36" rx="18" ry="13"/><path d="M47 33c5-3 10-2 11 2-2 4-6 5-10 3zM16 47l-4 6M42 47l4 6M18 26l-5-5M40 25l4-5"/><path d="M18 36h24M30 24v24M22 28l16 16M38 28L22 44" fill="none" stroke-width="2" class="ln"/><circle cx="54" cy="34" r="1.2" class="eye"/>`,
  king:`<path d="M12 22l10 8 10-16 10 16 10-8-4 22H16z"/><rect x="16" y="46" width="32" height="6" rx="1"/><circle cx="12" cy="20" r="3"/><circle cx="32" cy="12" r="3"/><circle cx="52" cy="20" r="3"/><circle cx="32" cy="36" r="3.5" class="eye"/>`,
  eye:`<path d="M6 32c8-12 16-18 26-18s18 6 26 18c-8 12-16 18-26 18S14 44 6 32z"/><circle cx="32" cy="32" r="11" class="eye"/><ellipse cx="32" cy="32" rx="3.5" ry="9"/>`,
  brute:`<path d="M16 24c2-9 9-14 16-14s14 5 16 14l4 10-6 2v6c0 7-6 12-14 12s-14-5-14-12v-6l-6-2z"/><path d="M22 30h8M34 30h8" stroke-width="3.2" class="ln"/><path d="M26 44h12" stroke-width="3" class="ln"/>`
};
const GLYPH_COLORS = {
  dragon:["#7a1f12","#2a0906"], spider:["#3d3550","#120e1c"], beast:["#6b4a22","#22150a"], humanoid:["#4b4f5c","#16181e"],
  caster:["#4a2a6b","#170b24"], undead:["#3e5240","#0f170f"], ghost:["#4c6b7a","#132027"], fire:["#a8401a","#3a0f05"],
  water:["#1f5f8a","#071c2b"], earth:["#6b5a3e","#201a10"], demon:["#5a1e4a","#1d0618"], ogre:["#6b6a2a","#1f1f08"],
  troll:["#2f6b5a","#0a201a"], mech:["#5e6066","#1a1b1e"], murloc:["#2a6b6b","#0a2020"], insect:["#8a6a1a","#2a1f05"],
  plant:["#3f6b25","#0f1f08"], slime:["#4f7a1e","#152008"], serpent:["#2f6a3a","#0a1f10"], bat:["#4a3a5e","#140e1c"],
  turtle:["#3a5e4a","#0f1c14"], king:["#8a6a1a","#2a1f05"], eye:["#5a1e4a","#1d0618"], brute:["#5e4a3a","#1c140e"]
};
const BOSS_ART = {
 "Oggleflint":"brute","Taragaman the Hungerer":"demon","Jergosh the Invoker":"caster","Bazzalan":"demon",
 "Rhahk'Zor":"ogre","Miner Johnson":"humanoid","Sneed's Shredder / Sneed":"mech","Gilnid":"mech","Mr. Smite":"humanoid","Captain Greenskin":"humanoid","Edwin VanCleef":"humanoid","Cookie":"murloc",
 "Lady Anacondra":"serpent","Lord Cobrahn":"serpent","Kresh":"turtle","Lord Pythas":"serpent","Skum":"beast","Lord Serpentis":"serpent","Verdan the Everliving":"plant","Mutanus the Devourer":"murloc",
 "Rethilgore":"beast","Razorclaw the Butcher":"beast","Baron Silverlaine":"ghost","Commander Springvale":"undead","Odo the Blindwatcher":"beast","Fenrus the Devourer":"beast","Wolf Master Nandos":"beast","Archmage Arugal":"caster",
 "Ghamoo-ra":"turtle","Lady Sarevess":"murloc","Gelihast":"murloc","Lorgus Jett":"caster","Baron Aquanis":"water","Twilight Lord Kelris":"caster","Aku'mai":"serpent",
 "Targorr the Dread":"ogre","Kam Deepfury":"humanoid","Hamhock":"ogre","Bazil Thredd":"humanoid","Dextren Ward":"humanoid","Bruegal Ironknuckle":"humanoid",
 "Interrogator Vishas":"humanoid","Bloodmage Thalnos":"undead","Houndmaster Loksey":"humanoid","Arcanist Doan":"caster","Herod":"humanoid","Scarlet Commander Mograine":"humanoid","High Inquisitor Whitemane":"caster",
 "Antu'sul":"troll","Theka the Martyr":"troll","Witch Doctor Zum'rah":"troll","Sergeant Bly & Gruppe":"humanoid","Nekrum Gutchewer & Shadowpriest Sezz'ziz":"undead","Hydromancer Velratha":"murloc","Gahz'rilla":"serpent","Chief Ukorz Sandscalp":"troll",
 "Noxxion":"slime","Razorlash":"plant","Lord Vyletongue":"demon","Celebras the Cursed":"ghost","Landslide":"earth","Tinkerer Gizlock":"mech","Rotgrip":"beast","Princess Theradras":"earth",
 "Lord Roccor":"fire","High Interrogator Gerstahn":"caster","Ring of Law":"humanoid","Golem Lord Argelmach":"mech","Hurley Blackbreath":"humanoid","Fineous Darkvire":"humanoid","General Angerforge":"humanoid","Ambassador Flamelash":"fire","Magmus":"earth","Emperor Dagran Thaurissan":"king",
 "Kirtonos the Herald":"bat","Jandice Barov":"caster","Rattlegore":"undead","Ras Frostwhisper":"undead","Darkmaster Gandling":"caster",
 "Timmy the Cruel":"undead","Cannon Master Willey":"humanoid","Archivist Galford":"humanoid","Balnazzar":"demon","Baroness Anastari":"ghost","Nerub'enkan":"spider","Maleki the Pallid":"undead","Magistrate Barthilas":"undead","Ramstein the Gorger":"undead","Baron Rivendare":"undead",
 "Grubbis":"brute","Viscous Fallout":"slime","Electrocutioner 6000":"mech","Crowd Pummeler 9-60":"mech","Dark Iron Ambassador":"fire","Mekgineer Thermaplugg":"mech",
 "Roogug":"beast","Aggem Thorncurse":"beast","Death Speaker Jargba":"beast","Overlord Ramtusk":"beast","Agathelos the Raging":"beast","Blind Hunter":"bat","Charlga Razorflank":"caster",
 "Tuten'kash":"spider","Mordresh Fire Eye":"undead","Glutton":"undead","Ragglesnout":"beast","Plaguemaw the Rotting":"undead","Amnennar the Coldbringer":"undead",
 "Revelosh":"brute","Baelog & Olaf & Eric":"humanoid","Ironaya":"earth","Obsidian Sentinel":"earth","Ancient Stone Keeper":"earth","Galgann Firehammer":"humanoid","Grimlok":"brute","Archaedas":"earth",
 "Atal'alarion":"earth","Dreamscythe & Weaver":"dragon","Jammal'an the Prophet & Ogom the Wretched":"troll","Morphaz & Hazzas":"dragon","Shade of Eranikus":"dragon","Avatar of Hakkar":"serpent",
 "Pusillin":"demon","Zevrim Thornhoof":"demon","Lethtendris":"caster","Alzzin the Wildshaper":"demon","Tendris Warpwood":"plant","Immol'thar":"demon","Prince Tortheldrin":"caster","King Gordok":"ogre",
 "Highlord Omokk":"ogre","Shadow Hunter Vosh'gajin":"troll","War Master Voone":"troll","Mother Smolderweb":"spider","Urok Doomhowl":"ogre","Overlord Wyrmthalak":"dragon","Pyroguard Emberseer":"fire","Warchief Rend Blackhand & Gyth":"dragon","The Beast":"beast","General Drakkisath":"dragon",
 "Lucifron":"fire","Magmadar":"beast","Gehennas":"fire","Garr":"earth","Shazzrah":"fire","Baron Geddon":"fire","Golemagg the Incinerator":"earth","Sulfuron Harbinger":"fire","Majordomo Executus":"fire","Ragnaros":"fire",
 "Onyxia":"dragon","Razorgore the Untamed":"dragon","Vaelastrasz the Corrupt":"dragon","Broodlord Lashlayer":"dragon","Firemaw / Ebonroc / Flamegor":"dragon","Chromaggus":"beast","Nefarian":"dragon",
 "High Priestess Jeklik":"bat","High Priest Venoxis":"serpent","High Priestess Mar'li":"spider","Bloodlord Mandokir":"troll","High Priest Thekal":"beast","High Priestess Arlokk":"beast","Jin'do the Hexxer":"troll","Hakkar":"serpent",
 "Kurinnaxx":"insect","General Rajaxx":"insect","Moam":"earth","Buru the Gorger":"insect","Ayamiss the Hunter":"insect","Ossirian the Unscarred":"earth",
 "The Prophet Skeram":"insect","Silithid Royalty (Bug Trio)":"insect","Battleguard Sartura":"insect","Fankriss the Unyielding":"insect","Viscidus":"slime","Princess Huhuran":"insect","Twin Emperors":"king","Ouro":"insect","C'Thun":"eye",
 "Anub'Rekhan / Faerlina / Maexxna":"spider","Noth / Heigan / Loatheb":"undead","Razuvious / Gothik / Four Horsemen":"undead","Patchwerk / Grobbulus / Gluth / Thaddius":"undead","Sapphiron":"dragon","Kel'Thuzad":"undead",
 "Azuregos":"dragon","Lord Kazzak":"demon","Drachen des Albtraums":"dragon","Jadefire Satyrs":"demon","Winterfall Furbolgs":"beast","Deadwood Furbolgs":"beast","Defias Pillager / Looter":"humanoid",
 "Durgen Dirgehammer":"undead","Faldrim Anvilmar":"ghost","Magmatus":"fire","Plunder":"beast","Bjork":"undead","Broodwidow":"spider","Lordaeron Captain":"undead",
 "Rath'mael":"undead","The Abandoned":"undead","The Baron":"undead","Viktor the Vile":"undead","Dragonmaw Thaumaturgist":"caster","Dragonmaw Warder":"humanoid",
 "Highland Horror":"plant","Shadetooth":"beast","Thicket Lurker":"beast","Thicket Matriarch":"beast"
};
let _gid = 0;
function emblem(name, cls="emb"){
  const t = BOSS_ART[name] || "humanoid", [c1,c2] = GLYPH_COLORS[t], id = "g"+(_gid++);
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="${id}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
    <circle cx="32" cy="32" r="30" fill="url(#${id})" stroke="#a07a2a" stroke-width="3"/>
    <circle cx="32" cy="32" r="26.5" fill="none" stroke="rgba(255,230,160,.18)" stroke-width="1"/>
    <g class="gl" transform="translate(32 32) scale(.78) translate(-32 -32)" fill="#efdcae" stroke="#efdcae">${GLYPH[t]}</g></svg>`;
}

/* ---------- Dungeon-Szenen ---------- */
const SCENE_OF = {rfc:"lava",dm:"mine",wc:"cave",sfk:"castle",bfd:"water",stocks:"prison",sm:"cathedral",zf:"pyramid",mara:"cave2",brd:"forge",scholo:"castle2",strat:"ruins",
  gnomer:"tech",rfk:"thorns",rfd:"thorns2",ulda:"titan",st:"temple",dmaul:"elven",brs:"mountain",mc:"lava2",ony:"lair",bwl:"mountain2",zg:"jungle",aq20:"desert",aq40:"desert2",naxx:"necro"};
const SCENE_PAL = {
  lava:["#2a0a05","#7a1a08","#ff7a2a"], lava2:["#1f0703","#8a2008","#ffb04a"], mine:["#120c08","#3a2a1a","#e0a050"], cave:["#0f1a14","#2e4a36","#9ed39a"], cave2:["#1a1024","#4a2a5e","#d39ae8"],
  castle:["#0d1020","#2a2f50","#c8d2ff"], castle2:["#0c0f14","#2a333d","#a8c8b8"], water:["#04141f","#0e3b52","#7fd0ff"], prison:["#101012","#2f2f36","#e8c070"], cathedral:["#1a0606","#5a1414","#ffe0a0"],
  pyramid:["#3a2210","#b8783a","#ffe2a0"], forge:["#1a0805","#4a1508","#ff9040"], ruins:["#0f140a","#3a4220","#c8e070"], tech:["#0a1418","#1e3a44","#7ff0d0"], thorns:["#20140a","#6a4a22","#ffd080"],
  thorns2:["#14101a","#3a3048","#c0b0ff"], titan:["#1a140c","#5a4630","#ffe0b0"], temple:["#0a1810","#1e4a30","#a0ffb0"], elven:["#0e1424","#2a3a5e","#d0e0ff"], mountain:["#1a0a08","#4a1e14","#ff8a50"],
  mountain2:["#100608","#3a1018","#ff5050"], lair:["#0a0606","#2a1210","#ff6030"], jungle:["#06140a","#1a4a24","#d0ff90"], desert:["#3a2a10","#c8963a","#fff0b0"], desert2:["#2a1608","#a0602a","#ffd27a"], necro:["#0a0f0a","#1a2a1a","#7aff7a"], meadow:["#2a4a6a","#8ab0c8","#ffe6a0"], sky:["#1a3a6a","#6a9ad0","#fff2c0"]
};
function scene(d){
  const th = SCENE_OF[d.id] || d.theme || "cave", [a,b,c] = SCENE_PAL[th] || SCENE_PAL.cave, id="s"+d.id;
  const base = th.replace(/\d$/,"");
  const sil = "#0b0705";
  let fg = "";
  const R = (n,seed)=>{ let s=seed; return Array.from({length:n},()=>{ s=(s*9301+49297)%233280; return s/233280; }); };
  const rnd = R(40, d.id.length*97 + d.id.charCodeAt(0));
  const stalactites = ()=>{ let p=`M0 0`; for(let x=0;x<=800;x+=40){ const h=20+rnd[(x/40)%40]*55; p+=`L${x} 0L${x+20} ${h}L${x+40} 0`; } return `<path d="${p}Z" fill="${sil}"/>`; };
  const ground = (y=160)=>`<path d="M0 ${y}Q200 ${y-14} 400 ${y-4}T800 ${y-8}V180H0Z" fill="${sil}"/>`;
  switch(base){
    case "lava": fg = stalactites()+`<path d="M0 150Q120 120 260 140T520 135T800 145V180H0Z" fill="${sil}"/><path d="M0 165Q200 150 400 162T800 158V180H0Z" fill="${c}" opacity=".85"/><circle cx="600" cy="90" r="5" fill="${c}"/><circle cx="640" cy="70" r="3" fill="${c}"/>`; break;
    case "mine": fg = `<path d="M120 180V40h24v140M120 40h560M656 40v140h24V40" fill="none" stroke="${sil}" stroke-width="22"/><path d="M300 40v140M480 40v140" stroke="${sil}" stroke-width="14"/><circle cx="390" cy="78" r="10" fill="${c}"/><path d="M390 58v10" stroke="${sil}" stroke-width="3"/><path d="M0 172h800" stroke="${sil}" stroke-width="18"/><path d="M200 165h420" stroke="#5a4a3a" stroke-width="4"/><path d="M220 165v14M260 165v14M300 165v14M340 165v14M380 165v14M420 165v14M460 165v14M500 165v14M540 165v14M580 165v14" stroke="#5a4a3a" stroke-width="3"/>`; break;
    case "cave": fg = stalactites()+ground(150)+`<ellipse cx="400" cy="120" rx="160" ry="70" fill="${c}" opacity=".12"/>`; break;
    case "water": fg = stalactites()+`<path d="M220 180V70l30-20 30 20v110M520 180V60l30-20 30 20v110" fill="${sil}"/><path d="M0 140Q100 132 200 140T400 140T600 140T800 140V180H0Z" fill="${c}" opacity=".35"/><path d="M0 150Q100 142 200 150T400 150T600 150T800 150V180H0Z" fill="${b}"/>`; break;
    case "castle": case "prison": case "cathedral":
      fg = `<circle cx="640" cy="50" r="24" fill="${c}" opacity=".85"/>`+`<path d="M150 180V80h30V60h-10V45h10V35h12v10h10V35h12v10h10v15h-10v20h30v-20h20l25-30 25 30h20v100h40V95h18V80h12v15h18v85h50V70h-8V55h12V40h14v15h12V40h14v15h12v15h-8v110z" fill="${sil}"/>`+(base==="cathedral"?`<path d="M560 180V90l40-50 40 50v90z" fill="${sil}"/><path d="M600 20v40M588 34h24" stroke="${sil}" stroke-width="6"/>`:"")+(base==="prison"?`<path d="M520 180V100h160v80" fill="${sil}"/><path d="M540 110v60M560 110v60M580 110v60M600 110v60M620 110v60M640 110v60M660 110v60" stroke="${c}" stroke-width="3" opacity=".6"/>`:"")+ground(172); break;
    case "pyramid": case "temple":
      fg = `<circle cx="160" cy="55" r="26" fill="${c}" opacity=".8"/><path d="M250 180L320 150V130h20v-20h20V90h80v20h20v20h20v20l70 30z" fill="${sil}"/><path d="M380 90V70h40v20" fill="${sil}"/>`+(base==="temple"?`<path d="M0 150Q200 140 400 152T800 146V180H0Z" fill="${b}"/><path d="M60 180V120c10-30 30-40 50-30M700 180V110c-10-30-30-35-50-25" stroke="${sil}" stroke-width="10" fill="none"/>`:ground(172)); break;
    case "jungle": fg = `<path d="M260 180l50-30v-20h20v-20h20V90h100v20h20v20h20v20l50 30z" fill="${sil}"/>`+[60,140,620,720].map((x,i)=>`<path d="M${x} 180V${80+i*8}" stroke="${sil}" stroke-width="10"/><path d="M${x} ${80+i*8}q-40 0-60 30M${x} ${80+i*8}q40 0 60 30M${x} ${80+i*8}q-20-30-50-30M${x} ${80+i*8}q20-30 50-30" stroke="${sil}" stroke-width="9" fill="none"/>`).join("")+ground(174); break;
    case "forge": fg = `<path d="M0 180V60l80-30 80 40v110M640 180V70l80-40 80 30v120" fill="${sil}"/><path d="M300 0v70M500 0v90" stroke="${sil}" stroke-width="6" stroke-dasharray="10 6"/><path d="M260 180V120h280v60" fill="${sil}"/><path d="M290 130h220" stroke="${c}" stroke-width="6"/><path d="M0 172Q200 160 400 170T800 168V180H0Z" fill="${c}" opacity=".8"/>`; break;
    case "ruins": fg = `<path d="M60 180V90l10-8 10 8v20h20V70l15-15 15 15v110M260 180v-50l20-10 10 15v45M480 180V100h20l10-15 10 15h20v80M660 180V80l20-20 20 20v100" fill="${sil}"/><path d="M0 150Q200 120 400 140T800 135" stroke="${c}" stroke-width="40" opacity=".12" fill="none"/>`+ground(172); break;
    case "tech": fg = `<g fill="${sil}"><circle cx="150" cy="90" r="60"/><circle cx="330" cy="140" r="40"/><circle cx="650" cy="80" r="70"/></g><g fill="${b}"><circle cx="150" cy="90" r="18"/><circle cx="330" cy="140" r="12"/><circle cx="650" cy="80" r="22"/></g><path d="M0 40h800M0 175h800M420 0v180" stroke="${sil}" stroke-width="16"/><path d="M420 60h80v60" stroke="${c}" stroke-width="4" fill="none"/>`; break;
    case "thorns": fg = `<path d="M-20 180C80 120 60 60 160 20M120 180C200 100 300 120 340 40M820 180C720 110 760 50 640 10M600 180c-40-70 20-110-60-160" stroke="${sil}" stroke-width="26" fill="none" stroke-linecap="round"/>`+[[110,70],[200,120],[300,80],[700,70],[590,110],[560,40]].map(([x,y])=>`<path d="M${x} ${y}l-16-14 20 4zM${x} ${y}l14-16-2 20z" fill="${sil}"/>`).join("")+ground(170); break;
    case "titan": fg = `<path d="M240 180V30h320v150" fill="${sil}"/><path d="M300 180V70h200v110" fill="${b}"/><path d="M360 180v-70h80v70" fill="${sil}"/><circle cx="400" cy="50" r="10" fill="${c}"/><path d="M140 180V50h40v130M620 180V50h40v130" fill="${sil}"/>`+ground(176); break;
    case "elven": fg = `<path d="M100 180V80q60-80 120 0v100h-20V90q-40-50-80 0v90zM560 180V70q70-90 140 0v110h-24V80q-46-60-92 0v100z" fill="${sil}"/><path d="M330 180v-60h30v-20h20v80" fill="${sil}"/><circle cx="420" cy="40" r="18" fill="${c}" opacity=".85"/>`+ground(172)+[40,760].map(x=>`<path d="M${x} 180V60" stroke="${sil}" stroke-width="12"/><circle cx="${x}" cy="60" r="34" fill="${sil}"/>`).join(""); break;
    case "mountain": fg = `<path d="M0 180L180 90l60 30 160-110 160 110 60-30 180 90z" fill="${sil}"/><path d="M370 30q30-40 60 0" stroke="${c}" stroke-width="6" fill="none" opacity=".7"/><path d="M380 10q20-20 40 0" stroke="${c}" stroke-width="4" fill="none" opacity=".4"/>`+(d.id==="bwl"?`<path d="M560 60l40-20 20 10 40-20-10 20 30 10-40 4-20 16z" fill="${sil}"/>`:""); break;
    case "lair": fg = stalactites()+`<path d="M250 150c40-50 120-60 170-40l60-30-20 40 60 10-70 10c-20 30-90 40-150 20z" fill="#000"/><ellipse cx="460" cy="112" rx="7" ry="3" fill="${c}"/>`+ground(160); break;
    case "desert": fg = `<path d="M0 150Q150 120 300 145T600 135T800 150V180H0Z" fill="${b}"/><path d="M0 165Q200 150 400 165T800 160V180H0Z" fill="${sil}"/><path d="M330 160V40l20-20 20 20v120M430 160V40l20-20 20 20v120" fill="${sil}"/><path d="M330 60h140" stroke="${sil}" stroke-width="18"/><circle cx="400" cy="100" r="22" fill="${c}" opacity=".6"/>`; break;
    case "meadow": fg = `<circle cx="640" cy="50" r="24" fill="${c}" opacity=".9"/><path d="M0 130Q160 90 320 125T640 110T800 120V180H0Z" fill="#2a3a18"/><path d="M0 150Q200 120 420 150T800 145V180H0Z" fill="${sil}"/><path d="M80 180Q300 150 420 160T760 180" stroke="${b}" stroke-width="10" fill="none" opacity=".8"/>`+[120,180,560,610,700].map((x,i)=>`<path d="M${x} ${150-i%2*12}v-30" stroke="${sil}" stroke-width="5"/><circle cx="${x}" cy="${118-i%2*12}" r="${16+i%3*4}" fill="${sil}"/>`).join(""); break;
    case "sky": fg = `<circle cx="160" cy="45" r="22" fill="${c}"/>`+[[300,95,120],[560,70,90],[120,130,70],[700,120,60]].map(([x,y,w])=>`<path d="M${x-w} ${y}h${2*w}l-${w*.35} 22l-${w*.3} 28l-${w*.35}-18l-${w*.3}-10z" fill="${sil}"/><path d="M${x-w*.4} ${y}v-28l10-10 10 10v28" fill="${sil}"/>`).join("")+`<path d="M0 170Q200 160 400 168T800 165" stroke="#fff" stroke-width="14" opacity=".25" fill="none"/>`; break;
    case "necro": fg = `<path d="M260 100l40-40h200l40 40-40 30H300z" fill="${sil}"/><path d="M300 60l20-30h160l20 30z" fill="${sil}"/><path d="M340 130l60 40 60-40" fill="${sil}"/><ellipse cx="400" cy="140" rx="160" ry="16" fill="${c}" opacity=".18"/>`+ground(176)+`<path d="M560 176v-30l10-10 10 10v30M210 176v-20l8-8 8 8v20" fill="${sil}"/>`; break;
  }
  const stars = ["castle","prison","cathedral","elven","necro","ruins"].includes(base) ? R(18, 7).map((r,i)=>`<circle cx="${(r*800).toFixed(0)}" cy="${(rnd[i]*70+5).toFixed(0)}" r="${(rnd[i+18]*1.4+.4).toFixed(1)}" fill="#fff" opacity=".6"/>`).join("") : "";
  return `<svg class="scene" viewBox="0 0 800 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration ${esc(d.de)}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".75" stop-color="${b}"/><stop offset="1" stop-color="${c}" stop-opacity=".6"/></linearGradient>
    <radialGradient id="${id}v" cx=".5" cy=".55" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient></defs>
    <rect width="800" height="180" fill="url(#${id})"/>${stars}${fg}<rect width="800" height="180" fill="url(#${id}v)"/></svg>`;
}
