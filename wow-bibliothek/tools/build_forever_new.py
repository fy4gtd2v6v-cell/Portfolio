"""Baut die Einträge „Neu in Forever“ (neue Gebiete und Dungeons) aus den Forever-Ergänzungsdaten
der QuestieDB: Quests, Questgeber mit Koordinaten, Belohnungen, bekannte Gegner, Eingänge, Karten.

Aufruf: python3 build_forever_new.py <arbeitsordner>
Eingaben im Arbeitsordner: db/forever.json, db/forever_delta.json, db/dungeons.json, db/zones.json,
questiedb-src/l10n/Forever/traces/*/deDE.lua, wci082/ (Classic-Werte für bekannte Gegenstände)
Ausgabe: db/forever_new.json  ({"FOREVER": [...], "MAPS": {...}})
"""
import json, sys, os, re, math
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from luaparse import parse_assignment

W = sys.argv[1]
base = json.load(open(f'{W}/db/forever.json'))
delta = json.load(open(f'{W}/db/forever_delta.json'))
entr = json.load(open(f'{W}/db/dungeons.json'))
zones_old = json.load(open(f'{W}/db/zones.json'))
wci = {w['itemId']: w for w in json.load(open(f'{W}/wci082/package/data/json/data.json'))}
ZN = delta['zones']

def l10n(kind, var):
    out = {}
    for p in (f'{W}/questiedb-src/l10n/Forever/{kind}/deDE.lua', f'{W}/questiedb-src/l10n/Forever/traces/{kind}/deDE.lua'):
        if os.path.exists(p):
            v = parse_assignment(open(p, encoding='utf-8').read(), f'l10n.{var}["deDE"]')
            out.update({str(k): x for k, x in (v.items() if isinstance(v, dict) else enumerate(v, 1))})
    return out
deQ, deN, deI = l10n('lookupQuests', 'questLookup'), l10n('lookupNpcs', 'npcNameLookup'), l10n('lookupItems', 'itemLookup')

# Deutsche Namen der neuen Gebiete (Questie-Lokalisierung)
ZDE = {16591: ('Riverglades', 'Flusslande'), 16593: ('Zephras Isle', 'Die Insel Zephras'), 616: ('Mount Hyjal', 'Hyjal'),
       16651: ("Shen'dralas", "Shen'dralas"), 16606: ('Darkspear Islands', 'Darkspear-Inseln'),
       16544: ('City of Dalaran', 'Dalaran'), 16560: ('City of Dalaran', 'Dalaran'), 16611: ('Ruins of Lordaeron', 'Die Ruinen von Lordaeron'),
       16732: ('Excavation Site: Wetlands', 'Ausgrabungsstätte: Sumpfland'), 16919: ('The Hall of Thanes', 'Die Halle der Thanen'),
       16985: ("The Shaper's Terrace", 'Die Terrasse des Formers'), 17780: ("Krol'dok Stronghold", "Krol'dok Stronghold")}
def zname(z):
    if z in ZDE: return ZDE[z]
    o = zones_old.get(str(z))
    if o: return (o['en'], o['de'])
    n = ZN.get(str(z), str(z)).replace('_FOREVER', '').replace('_', ' ').title()
    return (n, n)

# ---------- NPCs: Classic-Basis + Forever-Ergänzung ----------
def npc(nid):
    nid = str(nid); b = base['npc']['data'].get(nid); d = delta['npc'].get(nid, {})
    if not b and not d: return None
    r = {'name': (b[0] if b else None), 'min': b[3] if b else None, 'max': b[4] if b else None, 'rank': b[5] if b else 0,
         'spawns': (b[6] if b else None) or {}, 'zone': b[8] if b else None, 'fr': b[12] if b else None, 'sub': b[13] if b else None}
    for k, kk in (('name', 'name'), ('minLevel', 'min'), ('maxLevel', 'max'), ('rank', 'rank'), ('spawns', 'spawns'),
                  ('zoneID', 'zone'), ('friendlyToFaction', 'fr'), ('subName', 'sub')):
        if k in d: r[kk] = d[k]
    r['name'] = r['name'] or d.get('_label') or '?'
    de = deN.get(nid); r['de'] = (de[0] if isinstance(de, list) else de) or r['name']
    r['id'] = int(nid)
    return r

ALLI = {'HUMAN', 'DWARF', 'NIGHT_ELF', 'GNOME', 'SKYBORNE_ALLIANCE', 'ALL_ALLIANCE'}
HORDE = {'ORC', 'UNDEAD', 'TAUREN', 'TROLL', 'SKYBORNE_HORDE', 'ALL_HORDE'}
def side_of(races):
    if not races or not isinstance(races, str): return 'B'
    s = {x.split(':')[1] for x in races.split('|')}
    a, h = bool(s & ALLI), bool(s & HORDE)
    return 'A' if a and not h else 'H' if h and not a else 'B'

WSUB = {0: 'Axt', 1: 'Axt', 2: 'Bogen', 3: 'Schusswaffe', 4: 'Streitkolben', 5: 'Streitkolben', 6: 'Stangenwaffe', 7: 'Schwert',
        8: 'Schwert', 10: 'Stab', 13: 'Faustwaffe', 15: 'Dolch', 16: 'Wurfwaffe', 18: 'Armbrust', 19: 'Zauberstab'}
ASUB = {0: 'Schmuck/Sonstiges', 1: 'Stoff', 2: 'Leder', 3: 'Schwere Rüstung', 4: 'Platte', 6: 'Schild'}
CLS = {0: 'Verbrauchbar', 1: 'Behälter', 7: 'Handwerkswaren', 9: 'Rezept', 12: 'Questgegenstand', 15: 'Sonstiges'}
def item(iid):
    s = str(iid); d = delta['item'].get(s, {}); b = base['item']['data'].get(s)
    w = wci.get(int(iid))
    name = d.get('name') or (b[0] if b else None) or d.get('_label') or (w or {}).get('name')
    if not name: return None
    e = {'id': int(iid), 'n': name, 'de': deI.get(s) or name}
    if w:  # bekannter Classic-Gegenstand: Qualität/Symbol aus wow-classic-items
        e.update(q=w['quality'].lower(), ic=w.get('icon'), lvl=w.get('itemLevel'))
        e['s'] = ' · '.join(x for x in (w.get('slot') or '', w.get('subclass') or '') if x and x != 'Non-equippable')
        return e
    cls = d.get('class', b[11] if b and len(b) > 11 else None); sub = d.get('subClass', b[12] if b and len(b) > 12 else None)
    e['q'] = 'quest' if cls == 12 else 'unknown'
    e['s'] = 'Waffe · ' + WSUB.get(sub, '') if cls == 2 else 'Rüstung · ' + ASUB.get(sub, '') if cls == 4 else CLS.get(cls, 'Gegenstand')
    if d.get('itemLevel'): e['lvl'] = d['itemLevel']
    e['tip'] = ['Neuer Forever-Gegenstand: Qualität und Werte sind in den Datenbanken noch nicht hinterlegt.']
    return e

rewards = defaultdict(list)
for k, v in delta['item'].items():
    for q in (v.get('questRewards') or []) + (v.get('questRewards_add') or []): rewards[q].append(k)
for k, v in base['item']['data'].items():
    for q in (v[5] or []): rewards[q].append(k)
drops = defaultdict(set)
for k, v in delta['item'].items():
    for n in (v.get('npcDrops') or []) + (v.get('npcDrops_add') or []): drops[n].add(k)

def quest(qid, v):
    b = base['quest']['data'].get(str(qid))
    name = v.get('name') or (b[0] if b else v.get('_label'))
    sb = v.get('startedBy') or (b[1] if b else None) or []
    side = side_of(v.get('requiredRaces'))
    g = None
    if sb and sb[0]:
        n = npc(sb[0][0])
        if n:
            sp = {int(z): c for z, c in (n['spawns'] or {}).items() if c and c[0] and c[0][0] >= 0}
            zz = next(iter(sp), None)
            xy = [round(sp[zz][0][0]), round(sp[zz][0][1])] if zz else None
            g = {'en': n['name'], 'de': n['de'], 'zone': zname(zz or n['zone'] or 0)[1] if (zz or n['zone']) else '', 'xy': xy}
            if zz: g['zid'] = zz
    elif len(sb) > 2 and sb[2]:
        it = item(sb[2][0]) or {'n': '?', 'de': '?'}
        g = {'en': it['n'], 'de': it['de'], 'zone': 'Startet durch Gegenstand', 'xy': None, 'item': True}
    elif len(sb) > 1 and sb[1]:
        g = {'en': 'Objekt', 'de': 'Objekt', 'zone': 'Startet an einem Objekt', 'xy': None, 'object': True}
    fb = v.get('finishedBy') or (b[2] if b else None) or []
    turnin = None
    if fb and fb[0]:
        n = npc(fb[0][0])
        if n:
            sp = {int(z): c for z, c in (n['spawns'] or {}).items() if c and c[0] and c[0][0] >= 0}
            zz = next(iter(sp), None)
            turnin = {'en': n['name'], 'de': n['de'], 'zone': zname(zz)[1] if zz else '', 'xy': [round(sp[zz][0][0]), round(sp[zz][0][1])] if zz else None}
            if zz: turnin['zid'] = zz
    dq = deQ.get(str(qid))
    obj = v.get('objectivesText') or (b[7] if b else None) or []
    q = {'name': name, 'de': (dq[0] if dq else name), 'side': side, 'lvl': v.get('questLevel'), 'min': v.get('requiredLevel'),
         'objEn': ' '.join(x for x in obj if x), 'steps': [], 'giver': g['en'] if g else '',
         'variants': [{'id': int(qid), 'side': side, 'giver': g}]}
    if dq and len(dq) > 1 and dq[1]: q['objDe'] = ' '.join(x for x in dq[1] if x)
    if turnin: q['turnin'] = turnin
    rw = [item(i) for i in dict.fromkeys(rewards.get(int(qid), []))]
    rw = [r for r in rw if r]
    if rw: q['rewards'] = rw
    else: q['reward'] = 'Erfahrung und Gold (keine Gegenstände hinterlegt)'
    return q

def quests_in(zids):
    out = [quest(int(k), v) for k, v in delta['quest'].items() if v.get('zoneOrSort') in zids and (v.get('name') or v.get('_label'))]
    out = [q for q in out if not re.search(r'\b(TEST|NYI|DEPRECATED|UNUSED)\b|\[', q['name'], re.I)]
    out.sort(key=lambda q: (q['lvl'] or 0, q['name']))
    return out

def lvl_range(qs):
    l = sorted(q['lvl'] for q in qs if q.get('lvl'))
    if not l: return '?', 0
    lo, hi = l[int(len(l) * .05)], l[min(len(l) - 1, int(len(l) * .95))]  # ohne Ausreißer
    return (f'{lo}' if lo == hi else f'{lo}–{hi}'), lo

def faction_of(qs):
    c = Counter(q['side'] for q in qs)
    if c['A'] and not c['H']: return 'A'
    if c['H'] and not c['A']: return 'H'
    return 'N'

def known_enemies(zids):
    res = []
    for k, v in delta['npc'].items():
        n = None
        sp = v.get('spawns') or {}
        if v.get('zoneID') in zids or any(int(z) in zids for z in sp):
            n = npc(k)
        if not n or n['fr']: continue  # freundliche NPCs auslassen
        it = [item(i) for i in sorted(drops.get(int(k), []))]
        lv = f"{n['min']}" if n['min'] == n['max'] or not n['max'] else f"{n['min']}–{n['max']}"
        res.append({'name': n['name'], 'de': n['de'] if n['de'] != n['name'] else None, 'lvl': lv if n['min'] else None,
                    'rare': n['rank'] in (2, 4), 'tag': {1: 'Elite', 2: 'Seltene Elite', 3: 'Boss', 4: 'Selten'}.get(n['rank'], 'Gegner'),
                    'tactic': 'Noch keine Taktik erfasst – in den Datenbanken stehen bisher nur Name, Stufe und Fundort.',
                    'npcs': [{'id': n['id'], 'en': n['name'], 'de': n['de'], 'lvl': lv}], 'drops': [x for x in it if x]})
    res.sort(key=lambda b: (-('Boss' == b['tag']), -('Elite' in b['tag']), b['name']))
    return res

ZONES = [
    ('fv_riverglades', [16591], 'meadow', 'Neues Gebiet in World of Warcraft: Forever mit über 150 Quests. Quests für Allianz und Horde, u. a. rund um Bolder\'ok, Farholde Keep und Powderfuse Port.'),
    ('fv_zephras', [16593], 'sky', 'Startgebiet der neuen Rasse Skyborne (laut Blizzard Stufe 1–12), angelehnt an die Himmelswand (Skywall).'),
    ('fv_hyjal', [616, 16848], 'elven', 'Hyjal ist in Forever als neues Gebiet spielbar.'),
    ('fv_shendralas', [16651], 'elven', "Neues Gebiet in Kalimdor rund um die Shen'dralar-Elfen."),
    ('fv_darkspear', [16606], 'jungle', 'Die Darkspear-Inseln mit einer eigenen kleinen Questreihe.'),
]
DUNGEONS = [
    ('fv_thanes', [16919], 16919, 'forge', 'Neuer Dungeon unter Alt-Eisenschmiede.'),
    ('fv_lordaeron', [16611], 16611, 'ruins', 'Neuer Dungeon in den Ruinen der alten Hauptstadt über Unterstadt.'),
    ('fv_excavation', [16732], 16732, 'titan', 'Neuer Dungeon an einer Titanen-Ausgrabungsstätte im Sumpfland.'),
    ('fv_dalaran', [16544, 16560], 16544, 'castle', 'Neuer Dungeon in der Stadt Dalaran.'),
    ('fv_shaper', [16985], 16985, 'titan', 'Neuer Dungeon für Stufe 60 im Krater von Un\'Goro.'),
]
out = []
for fid, zids, theme, desc in ZONES:
    qs = quests_in(set(zids)); lv, lo = lvl_range(qs); en, de = zname(zids[0])
    hub = Counter(tuple(q['variants'][0]['giver']['xy']) for q in qs if q['variants'][0]['giver'] and q['variants'][0]['giver'].get('xy') and q['variants'][0]['giver'].get('zid') == zids[0])
    e = {'id': fid, 'forever': True, 'kind': 'zone', 'theme': theme, 'name': en, 'de': de, 'zone': 'Neues Gebiet', 'level': lv, 'min': lo or 1,
         'faction': faction_of(qs), 'desc': desc, 'entrance': f'{len(qs)} Quests in der Datenbank. Die Karte zeigt den Ort mit den meisten Questgebern.',
         'bosses': [], 'route': [], 'quests': qs}
    if hub: e['xy'] = list(hub.most_common(1)[0][0]); e['xyZid'] = zids[0]; e['xyZone'] = de
    out.append(e)
for fid, zids, aid, theme, desc in DUNGEONS:
    qs = quests_in(set(zids)); lv, lo = lvl_range(qs); en, de = zname(aid)
    e = {'id': fid, 'forever': True, 'kind': 'dungeon', 'theme': theme, 'name': en, 'de': de, 'zone': 'Neuer Dungeon', 'level': lv, 'min': lo or 1,
         'faction': 'N', 'desc': desc, 'bosses': known_enemies(set(zids)), 'route': [], 'quests': qs,
         'entrance': 'Eingang laut Datenbank siehe Karte.' if str(aid) in entr else 'Für den Eingang gibt es noch keine Koordinaten in der Datenbank.'}
    if str(aid) in entr:
        loc = entr[str(aid)][3][0]; e['xy'] = [round(loc[1]), round(loc[2])]; e['xyZid'] = loc[0]; e['xyZone'] = zname(loc[0])[1]
    out.append(e)

# ---------- Karten der neuen Gebiete ----------
need = {e['xyZid'] for e in out if e.get('xyZid')} | {v['giver']['zid'] for e in out for q in e['quests'] for v in q['variants'] if v['giver'] and v['giver'].get('zid')}
pts = defaultdict(list); flights = defaultdict(list)
ids = set(base['npc']['data']) | set(delta['npc'])
for k in ids:
    n = npc(k)
    if not n: continue
    for z, c in (n['spawns'] or {}).items():
        z = int(z)
        if z in need:
            for p in c or []:
                if p and 0 <= p[0] <= 100 and 0 <= p[1] <= 100: pts[z].append(p)
    if n['sub'] in ('Gryphon Master', 'Wind Rider Master', 'Hippogryph Master', 'Bat Handler', 'Flight Master'):
        for z, c in (n['spawns'] or {}).items():
            if int(z) in need and c and c[0][0] >= 0: flights[int(z)].append([round(c[0][0], 1), round(c[0][1], 1), n['fr'] or '', n['de']])
for v in base['object']['data'].values():
    if len(v) > 3 and isinstance(v[3], dict):
        for z, c in v[3].items():
            if int(z) in need: pts[int(z)].extend(p for p in c or [] if p and 0 <= p[0] <= 100)
dg = defaultdict(list)
for aid, e in entr.items():
    for loc in e[3] or []:
        if isinstance(loc, list) and len(loc) == 3 and loc[0] in need:
            dg[loc[0]].append([round(loc[1], 1), round(loc[2], 1), zname(int(aid))[1] if int(aid) in ZDE else (zones_old.get(aid) or {'de': e[0]})['de']])
CH = '0123456789abcdefghijklmnopqrstuvwxyz'; MW, MH = 75, 50
maps = {}
for z in need:
    if len(pts[z]) < 30: continue
    g = [[0] * MW for _ in range(MH)]
    for x, y in pts[z]: g[min(MH - 1, int(y / 100 * MH))][min(MW - 1, int(x / 100 * MW))] += 1
    mx = max(max(r) for r in g) or 1
    en, de = zname(z)
    maps[str(z)] = {'de': de, 'en': en, 'g': ''.join(CH[0 if c == 0 else 1 + min(34, int(math.log1p(c) / math.log1p(mx) * 34))] for r in g for c in r),
                    'f': flights.get(z, []), 'd': dg.get(z, []), 'n': len(pts[z])}
json.dump({'FOREVER': out, 'MAPS': maps}, open(f'{W}/db/forever_new.json', 'w'), ensure_ascii=False)
for e in out:
    print(f"{e['de']:32} {e['kind']:8} Stufe {e['level']:8} Quests {len(e['quests']):4} Gegner {len(e['bosses']):3} Eingang/Hub {e.get('xy')} {e.get('xyZone','')}")
print('Karten:', {m['de']: m['n'] for m in maps.values()})
