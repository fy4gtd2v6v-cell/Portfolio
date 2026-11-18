"""Gleicht die Daten der Azeroth-Bibliothek mit der QuestieDB (Forever) und
wow-classic-items ab und ergänzt deutsche Namen, Koordinaten, Beute und Belohnungen.

Eingaben (siehe tools/README.md):
  db/mine.json     aktuelle Daten aus index.html (tools/extract.js)
  db/forever.json  QuestieDB Forever als JSON (tools/build_db.py)
  db/zones.json    Zonennamen EN/DE
  db/dungeons.json Dungeon-Eingänge (Forever-Koordinaten)
  wci/data.json    wow-classic-items (Qualität, Slot, Tooltip, Dropchance)
Ausgaben:
  db/enriched.json  neue Daten
  db/report.md      Prüfbericht
"""
import json, re, sys, difflib, os
from collections import defaultdict

D = sys.argv[1]
mine = json.load(open(sys.argv[2] if len(sys.argv) > 2 else f'{D}/db/mine.json'))
db = json.load(open(f'{D}/db/forever.json'))
zones = json.load(open(f'{D}/db/zones.json'))
entr = json.load(open(f'{D}/db/dungeons.json'))
wci_classic = json.load(open(f'{D}/wci082/package/data/json/data.json'))  # Classic-Werte (2020)
wci_new = json.load(open(f'{D}/wci/package/data/json/data.json'))         # enthält z. T. TBC-Werte
TBC_LINE = re.compile(r'rating|spell power|Socket|expertise|Unique-Equipped|Phase \d', re.I)
_have = {w['itemId'] for w in wci_classic}
for w in wci_new:
    if w['itemId'] < 24000 and w['itemId'] not in _have:
        w = dict(w); w['tooltip'] = [t for t in w.get('tooltip', []) if not TBC_LINE.search(t['label'])]; w['_fallback'] = True
        wci_classic.append(w)
wci = wci_classic

Q, N, I = db['quest']['data'], db['npc']['data'], db['item']['data']
deQ, deN, deI = db['deQuest'], db['deNpc'], db['deItem']
report = defaultdict(list)
def rep(sec, msg): report[sec].append(msg)

# ---------------- Indizes ----------------
def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower().replace('&', 'and'))
npc_by = defaultdict(list)
for k, v in N.items(): npc_by[norm(v[0])].append(int(k))
quest_by = defaultdict(list)
for k, v in Q.items(): quest_by[norm(v[0])].append(int(k))
wci_by_id = {}
wci_by_name = defaultdict(list)
for it in wci:
    if it['itemId'] < 24000:  # nur Classic-Gegenstände
        wci_by_id[it['itemId']] = it; wci_by_name[norm(it['name'])].append(it)
qitem_by = defaultdict(list)
for k, v in I.items(): qitem_by[norm(v[0])].append(int(k))
drops_by_npc = defaultdict(set)
for k, v in I.items():
    for n in (v[1] or []):
        drops_by_npc[n].add(int(k))
wci_by_source = defaultdict(list)
for it in wci_by_id.values():
    src = it.get('source') or {}
    if src.get('category') == 'Boss Drop' and src.get('name'):
        wci_by_source[norm(src['name'])].append(it)
objective_items = set()
for k, v in Q.items():
    ob = v[9] if len(v) > 9 else None
    if ob and len(ob) > 2 and ob[2]:
        for x in ob[2]:
            if x: objective_items.add(x[0])
reward_items = defaultdict(list)
for k, v in I.items():
    for q in (v[5] or []):
        reward_items[q].append(int(k))

def zname(zid):
    z = zones.get(str(zid)); return (z['en'], z['de']) if z else (str(zid), str(zid))

# ---------------- Übersetzungen ----------------
SLOT = {'One-Hand': 'Einhand', 'Two-Hand': 'Zweihand', 'Main Hand': 'Waffenhand', 'Off Hand': 'Schildhand',
        'Held In Off-hand': 'In Schildhand geführt', 'Ranged': 'Distanz', 'Head': 'Kopf', 'Neck': 'Hals',
        'Shoulder': 'Schulter', 'Back': 'Rücken', 'Chest': 'Brust', 'Wrist': 'Handgelenke', 'Hands': 'Hände',
        'Waist': 'Taille', 'Legs': 'Beine', 'Feet': 'Füße', 'Finger': 'Finger', 'Trinket': 'Schmuckstück',
        'Thrown': 'Wurfwaffe', 'Relic': 'Relikt', 'Bag': 'Tasche', 'Shirt': 'Hemd', 'Tabard': 'Wappenrock',
        'Ammo': 'Munition', 'Shield': 'Schildhand', 'Robe': 'Brust', 'Non-equippable': ''}
SUB = {'Sword': 'Schwert', 'Axe': 'Axt', 'Mace': 'Streitkolben', 'Dagger': 'Dolch', 'Staff': 'Stab',
       'Polearm': 'Stangenwaffe', 'Fist Weapon': 'Faustwaffe', 'Bow': 'Bogen', 'Gun': 'Schusswaffe',
       'Crossbow': 'Armbrust', 'Wand': 'Zauberstab', 'Thrown': 'Wurfwaffe', 'Cloth': 'Stoff', 'Leather': 'Leder',
       'Mail': 'Schwere Rüstung', 'Plate': 'Platte', 'Shield': 'Schild', 'Libram': 'Buchband', 'Idol': 'Götze',
       'Totem': 'Totem', 'Fishing Pole': 'Angelrute', 'Quest': 'Quest', 'Key': 'Schlüssel', 'Bag': 'Tasche',
       'Junk': 'Plunder', 'Reagent': 'Reagenz', 'Trade Goods': 'Handwerkswaren', 'Cloth ': 'Stoff',
       'Miscellaneous': '', 'Mount': 'Reittier', 'Consumable': 'Verbrauchbar', 'Leatherworking': 'Lederverarbeitung',
       'Blacksmithing': 'Schmiedekunst', 'Tailoring': 'Schneiderei', 'Engineering': 'Ingenieurskunst',
       'Alchemy': 'Alchemie', 'Enchanting': 'Verzauberkunst', 'Book': 'Buch', 'Potion': 'Trank', 'Elixir': 'Elixier',
       'Parts': 'Teile', 'Metal & Stone': 'Metall & Stein', 'Meat': 'Fleisch', 'Herb': 'Kraut', 'Elemental': 'Elementar',
       'Jewelcrafting': 'Juwelierskunst', 'Devices': 'Geräte', 'Explosives': 'Sprengstoff', 'Other': 'Sonstiges'}
STAT = {'Stamina': 'Ausdauer', 'Strength': 'Stärke', 'Agility': 'Beweglichkeit', 'Intellect': 'Intelligenz',
        'Spirit': 'Willenskraft', 'Fire Resistance': 'Feuerwiderstand', 'Frost Resistance': 'Frostwiderstand',
        'Nature Resistance': 'Naturwiderstand', 'Shadow Resistance': 'Schattenwiderstand',
        'Arcane Resistance': 'Arkanwiderstand', 'All Resistances': 'Alle Widerstandsarten'}
SCHOOL = {'Shadow': 'Schatten', 'Fire': 'Feuer', 'Frost': 'Frost', 'Nature': 'Natur', 'Arcane': 'Arkan', 'Holy': 'Heilig'}
WSKILL = {'Bows': 'Bogen', 'Crossbows': 'Armbrüste', 'Guns': 'Schusswaffen', 'Swords': 'Schwerter', 'Axes': 'Äxte', 'Maces': 'Streitkolben',
          'Daggers': 'Dolche', 'Two-handed Swords': 'Zweihandschwerter', 'Two-handed Axes': 'Zweihandäxte', 'Two-handed Maces': 'Zweihandstreitkolben',
          'Staves': 'Stäbe', 'Fist Weapons': 'Faustwaffen', 'Polearms': 'Stangenwaffen'}
CLASSES = {'Warrior': 'Krieger', 'Paladin': 'Paladin', 'Hunter': 'Jäger', 'Rogue': 'Schurke', 'Priest': 'Priester',
           'Shaman': 'Schamane', 'Mage': 'Magier', 'Warlock': 'Hexenmeister', 'Druid': 'Druide'}
PHRASES = [
    (r'^Binds when picked up$', 'Wird beim Aufheben gebunden'),
    (r'^Binds when equipped$', 'Wird beim Anlegen gebunden'),
    (r'^Binds when used$', 'Wird bei Benutzung gebunden'),
    (r'^Quest Item$', 'Questgegenstand'),
    (r'^Unique$', 'Einzigartig'),
    (r'^Unique \((\d+)\)$', r'Einzigartig (\1)'),
    (r'^Item Level (\d+)$', r'Gegenstandsstufe \1'),
    (r'^Requires Level (\d+)$', r'Benötigt Stufe \1'),
    (r'^Durability (\d+) / (\d+)$', r'Haltbarkeit \1 / \2'),
    (r'^(\d+) Armor$', r'\1 Rüstung'),
    (r'^(\d+) - (\d+) Damage$', r'\1 - \2 Schaden'),
    (r'^\+ ?(\d+) - (\d+) (\w+) Damage$', r'+\1 - \2 \3schaden'),
    (r'^Speed ([\d.]+)$', lambda m: 'Tempo ' + m.group(1).replace('.', ',')),
    (r'^\(([\d.]+) damage per second\)$', lambda m: '(' + m.group(1).replace('.', ',') + ' Schaden pro Sekunde)'),
    (r'^(\d+) Slot Bag$', r'Tasche mit \1 Plätzen'),
    (r'^Equip: Increases attack power by (\d+)\.$', r'Anlegen: Erhöht die Angriffskraft um \1.'),
    (r'^Equip: \+(\d+) Attack Power\.$', r'Anlegen: +\1 Angriffskraft.'),
    (r'^Equip: \+(\d+) ranged Attack Power\.$', r'Anlegen: +\1 Distanzangriffskraft.'),
    (r'^Equip: Improves your chance to hit by (\d+)%\.$', r'Anlegen: Erhöht Eure Trefferchance um \1%.'),
    (r'^Equip: Improves your chance to get a critical strike by (\d+)%\.$',
     r'Anlegen: Erhöht Eure Chance, einen kritischen Treffer zu erzielen, um \1%.'),
    (r'^Equip: Improves your chance to hit with spells by (\d+)%\.$', r'Anlegen: Erhöht Eure Trefferchance mit Zaubern um \1%.'),
    (r'^Equip: Improves your chance to get a critical strike with spells by (\d+)%\.$',
     r'Anlegen: Erhöht Eure Chance, einen kritischen Treffer mit Zaubern zu erzielen, um \1%.'),
    (r'^Equip: Increases damage and healing done by magical spells and effects by up to (\d+)\.$',
     r'Anlegen: Erhöht durch Zauber und magische Effekte zugefügten Schaden und Heilung um bis zu \1.'),
    (r'^Equip: Increases healing done by spells and effects by up to (\d+)\.$',
     r'Anlegen: Erhöht durch Zauber und Effekte verursachte Heilung um bis zu \1.'),
    (r'^Equip: Restores (\d+) mana per 5 sec\.$', r'Anlegen: Stellt alle 5 Sek. \1 Mana wieder her.'),
    (r'^Equip: Restores (\d+) health per 5 sec\.$', r'Anlegen: Stellt alle 5 Sek. \1 Gesundheit wieder her.'),
    (r'^Equip: Increased Defense \+(\d+)\.$', r'Anlegen: Verteidigung +\1.'),
    (r'^Equip: Increases your chance to dodge an attack by (\d+)%\.$', r'Anlegen: Erhöht Eure Chance, einem Angriff auszuweichen, um \1%.'),
    (r'^Equip: Increases your chance to parry an attack by (\d+)%\.$', r'Anlegen: Erhöht Eure Chance, einen Angriff zu parieren, um \1%.'),
    (r'^Equip: Increases your chance to block attacks with a shield by (\d+)%\.$',
     r'Anlegen: Erhöht Eure Chance, Angriffe mit einem Schild zu blocken, um \1%.'),
    (r'^Equip: Increases the block value of your shield by (\d+)\.$', r'Anlegen: Erhöht den Blockwert Eures Schildes um \1.'),
    (r'^Equip: Increases damage done by (\w+) spells and effects by up to (\d+)\.$',
     lambda m: f'Anlegen: Erhöht den durch {SCHOOL.get(m.group(1), m.group(1))}zauber und -effekte zugefügten Schaden um bis zu {m.group(2)}.'),
    (r'^Equip: (Bows|Crossbows|Guns|Swords|Axes|Maces|Daggers|Two-handed Swords|Two-handed Axes|Two-handed Maces|Staves|Fist Weapons|Polearms) \+(\d+)\.$',
     lambda m: f'Anlegen: {WSKILL[m.group(1)]} +{m.group(2)}.'),
    (r'^Equip: Decreases the magical resistances of your spell targets by (\d+)\.$', r'Anlegen: Verringert die Magiewiderstände der Ziele Eurer Zauber um \1.'),
    (r'^Equip: Increased (\w+(?: \w+)?) \+(\d+)\.$', r'Anlegen: \1 +\2.'),
    (r'^Equip: (.*)$', r'Anlegen: \1'),
    (r'^Use: (.*)$', r'Benutzen: \1'),
    (r'^Chance on hit: (.*)$', r'Chance bei Treffer: \1'),
    (r'^Unique-Equipped$', 'Einzigartig anlegbar'),
    (r'^Classes: (.*)$', lambda m: 'Klassen: ' + ', '.join(CLASSES.get(c.strip(), c.strip()) for c in m.group(1).split(','))),
    (r'^Requires (.*)$', r'Benötigt \1'),
    (r'^Set: (.*)$', r'Set: \1'),
    (r'^"(.*)"$', r'„\1“'),
    (r'^Begins a Quest$|^This Item Begins a Quest$', 'Dieser Gegenstand startet eine Quest'),
]
def tr_line(s):
    if s in SLOT: return SLOT[s]
    if s in SUB and SUB[s]: return SUB[s]
    m = re.match(r'^([+-]\d+) (.+)$', s)
    if m and m.group(2) in STAT: return f'{m.group(1)} {STAT[m.group(2)]}'
    for pat, rep_ in PHRASES:
        m = re.match(pat, s)
        if m: return rep_(m) if callable(rep_) else m.expand(rep_)
    return s
SKIP = re.compile(r'^(Phase \d|Sell Price:?|Dropped by|Drop Chance|Item Level)')

def item_entry(iid, src_names=(), quest=False):
    w = wci_by_id.get(iid)
    qi = I.get(str(iid))
    en = (w or {}).get('name') or (qi[0] if qi else None)
    if not en: return None
    e = {'id': iid, 'n': en, 'de': deI.get(str(iid)) or en}
    if w:
        q = w['quality'].lower()
        e['q'] = 'quest' if (w['class'] == 'Quest' or quest) and q in ('common', 'poor') else q
        slot = SLOT.get(w.get('slot'), w.get('slot') or '')
        sub = SUB.get(w.get('subclass'), w.get('subclass') or '')
        if w['class'] == 'Quest': slot, sub = 'Questgegenstand', ''
        if w['class'] in ('Armor',) and w.get('subclass') in ('Miscellaneous',): sub = ''
        e['s'] = ' · '.join(x for x in (slot, sub) if x) or SUB.get(w['class'], w['class'])
        tip = []
        for t in w.get('tooltip', [])[1:]:
            lab = t['label'].strip()
            if not lab or SKIP.match(lab): continue
            if t.get('format') == 'alignRight' and tip:
                tip[-1] += '\t' + tr_line(lab)
            else:
                tip.append(tr_line(lab))
        e['tip'] = tip
        e['lvl'] = w.get('itemLevel')
        src = w.get('source') or {}
        if src.get('dropChance') and norm(src.get('name', '')) in {norm(x) for x in src_names}:
            e['c'] = round(src['dropChance'] * 100, 1)
    else:
        e['q'] = 'quest' if quest or (qi and qi[11] == 12) else 'common'
        e['s'] = 'Questgegenstand' if e['q'] == 'quest' else 'Gegenstand'
        e['tip'] = []
    if qi and qi[4]:
        e['startsQuest'] = deQ.get(str(qi[4]), [Q.get(str(qi[4]), ['?'])[0]])[0]
    return e

# ---------------- NPC-Suche ----------------
DUNGEON_ZONE = {'rfc': 2437, 'dm': 1581, 'wc': 718, 'sfk': 209, 'bfd': 719, 'stocks': 717, 'sm': 796, 'zf': 1176,
                'mara': 2100, 'brd': 1584, 'scholo': 2057, 'strat': 2017, 'gnomer': 721, 'rfk': 491, 'rfd': 722,
                'ulda': 1337, 'st': 1477, 'dmaul': 2557, 'brs': 1583, 'mc': 2717, 'ony': 2159, 'bwl': 2677,
                'zg': 1977, 'aq20': 3429, 'aq40': 3428, 'naxx': 3456}
def zone_set(zid):
    s = {zid}
    e = entr.get(str(zid))
    if e and e[1]: s |= set(e[1])
    return s

ALIAS = {
    "Sneed's Shredder / Sneed": ["Sneed's Shredder", "Sneed"],
    "Sergeant Bly & Gruppe": ["Sergeant Bly"],
    "Nekrum Gutchewer & Shadowpriest Sezz'ziz": ["Nekrum Gutchewer", "Shadowpriest Sezz'ziz"],
    "Ring of Law": ["Gorosh the Dervish", "Grizzle", "Eviscerator", "Ok'thor the Breaker", "Anub'shiah", "Hedrum the Creeper"],
    "Baelog & Olaf & Eric": ["Baelog", "Olaf", "Eric \"The Swift\""],
    "Dreamscythe & Weaver": ["Dreamscythe", "Weaver"],
    "Jammal'an the Prophet & Ogom the Wretched": ["Jammal'an the Prophet", "Ogom the Wretched"],
    "Morphaz & Hazzas": ["Morphaz", "Hazzas"],
    "Warchief Rend Blackhand & Gyth": ["Warchief Rend Blackhand", "Gyth"],
    "Firemaw / Ebonroc / Flamegor": ["Firemaw", "Ebonroc", "Flamegor"],
    "Silithid Royalty (Bug Trio)": ["Lord Kri", "Princess Yauj", "Vem"],
    "Twin Emperors": ["Emperor Vek'lor", "Emperor Vek'nilash"],
    "Anub'Rekhan / Faerlina / Maexxna": ["Anub'Rekhan", "Grand Widow Faerlina", "Maexxna"],
    "Noth / Heigan / Loatheb": ["Noth the Plaguebringer", "Heigan the Unclean", "Loatheb"],
    "Razuvious / Gothik / Four Horsemen": ["Instructor Razuvious", "Gothik the Harvester", "Thane Korth'azz", "Highlord Mograine", "Lady Blaumeux", "Sir Zeliek"],
    "Patchwerk / Grobbulus / Gluth / Thaddius": ["Patchwerk", "Grobbulus", "Gluth", "Thaddius"],
    "Drachen des Albtraums": ["Ysondre", "Emeriss", "Lethon", "Taerar"],
    "Defias Pillager / Looter": ["Defias Pillager", "Defias Looter"],
    "Jadefire Satyrs": ["Jadefire Satyr", "Jadefire Rogue", "Jadefire Trickster", "Jadefire Betrayer", "Jadefire Felsworn", "Jadefire Shadowstalker", "Jadefire Hellcaller"],
    "Winterfall Furbolgs": ["Winterfall Shaman", "Winterfall Den Watcher", "Winterfall Pathfinder", "Winterfall Totemic", "Winterfall Ursa", "Winterfall Runner"],
    "Deadwood Furbolgs": ["Deadwood Warrior", "Deadwood Gardener", "Deadwood Pathfinder", "Deadwood Den Watcher", "Deadwood Avenger", "Deadwood Shaman"],
}
def find_npcs(name, zs=None):
    ids = list(npc_by.get(norm(name), []))
    if zs:
        inz = [i for i in ids if N[str(i)][8] in zs or any(int(z) in zs for z in (N[str(i)][6] or {}))]
        if inz: ids = inz
    ids.sort(key=lambda i: (-(N[str(i)][5] or 0), i))  # höchster Rang zuerst
    return ids
def find_npc(name, zs=None):
    ids = find_npcs(name, zs); return ids[0] if ids else None
def npc_info(nid):
    v = N[str(nid)]; d = deN.get(str(nid)) or [v[0], v[13]]
    lv = f'{v[3]}' if v[3] == v[4] else f'{v[3]}–{v[4]}'
    return {'id': nid, 'en': v[0], 'de': d[0] or v[0], 'lvl': '??' if v[3] in (63,) else lv, 'rank': v[5]}

EQUIP_CLASSES = ('Weapon', 'Armor', 'Container', 'Recipe', 'Quest', 'Key', 'Consumable', 'Miscellaneous')
def boss_drops(npc_ids, names, keep_manual):
    found = {}
    for nid in npc_ids:
        for iid in drops_by_npc.get(nid, ()):
            qi = I[str(iid)]
            w = wci_by_id.get(iid)
            many = len(qi[1] or []) > 4
            is_q = qi[11] in (12, 13) or (w and w['class'] in ('Quest', 'Key')) or qi[4] or (len(qi) > 14 and qi[14]) or iid in objective_items
            good = w and w['quality'] in ('Rare', 'Epic', 'Legendary')
            srcs = set(qi[1] or [])
            specific = srcs and srcs <= set(npc_ids) or (w and (w.get('source') or {}).get('category') == 'Boss Drop'
                                                       and norm(w['source']['name']) in {norm(x) for x in names})
            gear = w and w['class'] in EQUIP_CLASSES and w['quality'] in ('Common', 'Uncommon')
            if (good and not many) or (is_q and len(qi[1] or []) <= 2) or (gear and specific):
                found[iid] = item_entry(iid, names, quest=bool(is_q and not good))
    for nm in names:
        for w in wci_by_source.get(norm(nm), []):
            if (w['quality'] in ('Rare', 'Epic', 'Legendary') or w['class'] in EQUIP_CLASSES) and w['itemId'] not in found:
                found[w['itemId']] = item_entry(w['itemId'], names)
    # Von Hand eingetragene Gegenstände: behalten, wenn die Datenbanken keine andere Quelle nennen
    have = {norm(e['n']) for e in found.values() if e}
    for o in keep_manual:
        if norm(o) in have: continue
        w = (wci_by_name.get(norm(o)) or [None])[0]
        qids = qitem_by.get(norm(o)) or []
        other = None
        if w and (w.get('source') or {}).get('category') == 'Boss Drop':
            other = w['source']['name']
        for qid in qids:
            srcs = I[str(qid)][1] or []
            if srcs and not set(srcs) & set(npc_ids):
                other = other or N.get(str(srcs[0]), ['?'])[0]
            if I[str(qid)][2]:
                other = other or 'einem Objekt'
        if other:
            rep('Drops korrigiert', f"{CUR[0]} – {CUR[1]}: „{o}“ droppt laut Datenbank bei **{other}** → hier entfernt")
        elif w or qids:
            e = item_entry(w['itemId'] if w else qids[0], names)
            if e:
                e['v'] = 0; found[e['id']] = e
                rep('Drops ohne Quelle in der Datenbank (behalten, markiert)', f"{CUR[0]} – {CUR[1]}: {o}")
        else:
            rep('Drops korrigiert', f"{CUR[0]} – {CUR[1]}: Platzhalter „{o}“ → durch echte Gegenstände ersetzt")
    order = {'legendary': 0, 'epic': 1, 'rare': 2, 'uncommon': 3, 'common': 4, 'poor': 5, 'quest': 6}
    out, seen = [], set()
    for e in sorted([e for e in found.values() if e], key=lambda e: (order.get(e['q'], 9), e['n'])):
        if norm(e['n']) in seen: continue
        seen.add(norm(e['n'])); out.append(e)
    return out
CUR = ['', '']

# ---------------- Dungeons & Bosse ----------------
for d in mine['DUNGEONS']:
    zid = DUNGEON_ZONE[d['id']]; zs = zone_set(zid)
    en, de = zname(zid)
    d['zoneId'] = zid
    if not de.isdigit() and d['id'] not in ('aq40',) and d['de'] != de:
        rep('Dungeon-Namen', f"{d['de']} → offiziell: **{de}** ({en})")
        d['de'] = de
    e = entr.get(str(zid))
    if e:
        locs = e[3]
        pz = locs[0][0]; d['xy'] = [round(locs[0][1]), round(locs[0][2])]
        d['xyZone'] = zname(pz)[1]
        if len(locs) > 1: d['xy2'] = {'zone': zname(locs[1][0])[1], 'xy': [round(locs[1][1]), round(locs[1][2])]}
    for b in d['bosses']:
        names = ALIAS.get(b['name'], [b['name']])
        infos = []
        for nm in names:
            nid = find_npc(nm, zs)
            if nid is None:
                rep('Bosse nicht gefunden', f"{d['de']}: {nm}"); continue
            infos.append(npc_info(nid))
        old = [x['n'] for x in b.get('drops', [])]
        b['npcs'] = [{'id': x['id'], 'en': x['en'], 'de': x['de'], 'lvl': x['lvl']} for x in infos]
        if infos:
            b['de'] = ' & '.join(x['de'] for x in infos) if len(infos) <= 3 else None
            lv = sorted({x['lvl'] for x in infos}); b['lvl'] = lv[0] if len(lv) == 1 else ' / '.join(lv)
        CUR[0], CUR[1] = d['de'], b['name']
        allids = [i for nm in names for i in find_npcs(nm)]  # alle Einträge gleichen Namens (z. B. Gefangener/Gegner)
        new = boss_drops(allids, [x['en'] for x in infos], old)
        added = [x['n'] for x in new if norm(x['n']) not in {norm(o) for o in old}]
        if added: rep('Drops ergänzt', f"{d['de']} – {b['name']}: +{len(added)} ({', '.join(added[:6])}{' …' if len(added) > 6 else ''})")
        b['drops'] = new

    # ---------------- Quests ----------------
    for q in d['quests']:
        ids = quest_by.get(norm(q['name']), [])
        if not ids:
            sug = difflib.get_close_matches(norm(q['name']), quest_by.keys(), n=1, cutoff=0.8)
            if sug:
                ids = quest_by[sug[0]]
                rep('Quest-Namen korrigiert', f"„{q['name']}“ → „{Q[str(ids[0])][0]}“")
                q['name'] = Q[str(ids[0])][0]
        if not ids:
            rep('Quests nicht gefunden', f"{d['de']}: {q['name']}"); q['variants'] = []; continue
        variants = []
        for qid in sorted(ids):
            v = Q[str(qid)]
            if v[6]:  # Klassenquest
                pass
            r = (v[5] or 0) & 0xFF
            side = 'A' if r == 77 or (r and not r & 178) else 'H' if r == 178 or (r and not r & 77) else 'B'
            sb = v[1] or []
            giver = None
            if len(sb) > 0 and sb[0]:
                nid = sb[0][0]; ni = N.get(str(nid))
                if ni:
                    zs_ = {int(z): c for z, c in (ni[6] or {}).items()}
                    zz = next((z for z, c in zs_.items() if c and c[0][0] != -1), None)
                    xy = [round(zs_[zz][0][0]), round(zs_[zz][0][1])] if zz else None
                    ze, zd = zname(zz) if zz else zname(ni[8])
                    if zd in ('Östliche Königreiche', 'Kalimdor') and ni[8]: ze, zd = zname(ni[8])
                    if zd in ('Östliche Königreiche', 'Kalimdor'): zd, xy = 'Der Schwarzfels' if d['id'] in ('brd', 'brs', 'mc', 'bwl') else zd, None
                    if not zz and ni[8] in DUNGEON_ZONE.values(): zd = f'im Dungeon ({zd})'
                    giver = {'en': ni[0], 'de': (deN.get(str(nid)) or [ni[0]])[0] or ni[0], 'zone': zd, 'xy': xy}
            if not giver and len(sb) > 2 and sb[2]:
                it = I.get(str(sb[2][0]))
                giver = {'en': it[0] if it else '?', 'de': deI.get(str(sb[2][0])) or (it[0] if it else '?'), 'zone': 'Startet durch Gegenstand', 'xy': None, 'item': True}
            if not giver and len(sb) > 1 and sb[1]:
                oid = sb[1][0]; ob = db['object']['data'].get(str(oid))
                oen = ob[0] if ob else 'Objekt'
                giver = {'en': oen, 'de': db['deObject'].get(str(oid)) or oen, 'zone': 'Objekt im Dungeon', 'xy': None, 'object': True}
            variants.append({'id': qid, 'side': side, 'giver': giver, 'lvl': v[4], 'min': v[3], 'cls': bool(v[6]),
                             'obj': ' '.join(x for x in (v[7] or []) if x)})
        # Klassenquests nur behalten, wenn alle Varianten Klassenquests sind
        if not all(x['cls'] for x in variants): variants = [x for x in variants if not x['cls']]
        # Bei Questreihen mit gleichem Namen den passenden Teil wählen
        def toks(s): return {w.lower() for w in re.findall(r"[A-Z][\w']+", s or '') if len(w) > 2}
        mine_t = toks(q['obj']) | toks(' '.join(q.get('steps', [])))
        def score(x):
            g = x['giver'] or {}
            gm = 2 if g and (norm(g['en']) in norm(q['giver']) or norm(g['de']) in norm(q['giver'])) else 0
            ot = toks(x['obj']); ov = len(ot & mine_t) / (len(ot) or 1)
            return gm + ov * 3
        if len(variants) > 1:
            variants.sort(key=score, reverse=True)
            best = variants[0]
            def shape(s): return re.sub(r"[A-Z][\w']+|\s+", ' ', s or '').strip()
            keep = [best]
            for x in variants[1:]:
                if x['side'] != best['side'] and x['side'] not in {k['side'] for k in keep} and \
                        difflib.SequenceMatcher(None, shape(x['obj']), shape(best['obj'])).ratio() > 0.6:
                    keep.append(x)
            variants = keep
        sides = {x['side'] for x in variants}
        newside = 'B' if ('B' in sides or {'A', 'H'} <= sides) else sides.pop()
        if newside != q['side']:
            rep('Fraktion korrigiert', f"{q['name']}: {q['side']} → {newside}")
        q['side'] = newside
        main = variants[0]; qd = deQ.get(str(main['id']))
        q['de'] = qd[0] if qd else q['name']
        q['lvl'], q['min'] = main['lvl'], main['min']
        if qd and qd[1]:
            q['objDe'] = ' '.join(x for x in qd[1] if x)
        objEn = Q[str(main['id'])][7]
        q['objEn'] = ' '.join(x for x in (objEn or []) if x)
        # Questgeber prüfen
        gv = [x['giver'] for x in variants if x['giver']]
        if gv and not any(norm(g['en']) in norm(q['giver']) or norm(g['de']) in norm(q['giver']) for g in gv):
            g = gv[0]
            sec = 'Questgeber korrigiert' if not (g.get('item') or g.get('object')) else 'Quest startet durch Gegenstand/Objekt'
            rep(sec, f"{q['name']}: „{q['giver']}“ → **{g['de']}** ({g['en']})")
        q['variants'] = [{'id': x['id'], 'side': x['side'], 'giver': x['giver']} for x in variants]
        # Belohnungen
        rew = []
        for x in variants:
            for iid in reward_items.get(x['id'], []):
                if iid not in [r['id'] for r in rew]:
                    e = item_entry(iid)
                    if e: rew.append(e)
        if rew:
            old = q.get('reward', '')
            names_ = {norm(r['n']) for r in rew}
            for part in re.split(r',| oder ', old):
                p = part.strip()
                if p and re.search(r"[A-Z][a-z]+'?s? ", p) and norm(p) not in names_ and not p.startswith('Wahl') and not p.startswith('Erfahrung'):
                    rep('Belohnungen korrigiert', f"{q['name']}: „{p}“ ist keine Belohnung dieser Quest")
            q['rewards'] = rew
            q.pop('reward', None)
        else:
            old = q.get('reward', '') or ''
            q['reward'] = old if re.search(r'Einstimmung|Zugang|Folgequest|Buff|Siegel|Seal|Scepter|Schlüssel|Key', old) else 'Erfahrung und Gold (keine Gegenstände)'
        for k in ('xy', 'giver', 'loc'):
            q.pop(k, None) if k == 'xy' else None

# ---------------- Monster ----------------
MON_ZONE = {'Azuregos': 16, 'Lord Kazzak': 4}
for m in mine['MONSTERS']:
    names = ALIAS.get(m['name'], [m['name']])
    infos = []
    for nm in names:
        nid = find_npc(nm)
        if nid: infos.append(npc_info(nid))
        else: rep('Monster nicht gefunden', nm)
    m['npcs'] = [{'id': x['id'], 'en': x['en'], 'de': x['de'], 'lvl': x['lvl']} for x in infos]
    if infos:
        m['de'] = infos[0]['de'] if len(infos) == 1 else None
        z = N[str(infos[0]['id'])][8]
        if z: m['zoneDe'] = zname(z)[1]
        nums = [int(n) for x in infos for n in re.findall(r'\d+', x['lvl'])]
        m['level'] = '??' if not nums else (str(min(nums)) if min(nums) == max(nums) else f'{min(nums)}–{max(nums)}')
    if m['type'] == 'Weltboss':
        CUR[0], CUR[1] = 'Weltboss', m['name']
        m['drops'] = boss_drops([x['id'] for x in infos], [x['en'] for x in infos], [x['n'] for x in m['drops']])
    else:
        ids = {x['id'] for x in infos}
        keep = []
        for o in m['drops']:
            iid = (qitem_by.get(norm(o['n'])) or [None])[0]
            src = set(I[str(iid)][1] or []) if iid else set()
            if iid and src & ids:
                keep.append(item_entry(iid, quest=o['q'] == 'quest'))
            else:
                rep('Drops korrigiert', f"{m['name']}: „{o['n']}“ nicht als Drop dieser Gegner belegt → entfernt")
        m['drops'] = [k for k in keep if k]

json.dump(mine, open(f'{D}/db/enriched.json', 'w'), ensure_ascii=False, indent=1)
with open(f'{D}/db/report.md', 'w') as f:
    for sec, items in report.items():
        f.write(f'## {sec} ({len(items)})\n'); f.writelines(f'- {x}\n' for x in items); f.write('\n')
print({k: len(v) for k, v in report.items()})
