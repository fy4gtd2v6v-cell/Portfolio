"""Erzeugt eigene Zonenkarten aus den Spawn-Positionen aller NPCs und Objekte der QuestieDB.

Jede Zone wird als Dichteraster (75 x 50 Felder) gespeichert: dort, wo viele NPCs und Objekte stehen,
liegen Wege, Siedlungen und Lager. Dazu kommen Flugpunkte und Dungeon-Eingänge.
Es werden keine Kartenbilder aus dem Spiel verwendet.
"""
import json, sys, math
from collections import defaultdict
D = sys.argv[1]
db = json.load(open(f'{D}/db/forever.json'))
zones = json.load(open(f'{D}/db/zones.json'))
entr = json.load(open(f'{D}/db/dungeons.json'))
data = json.load(open(f'{D}/db/enriched.json'))
N, O = db['npc']['data'], db['object']['data']
deN = db['deNpc']
W, H = 75, 50

need = set()
for d in data['DUNGEONS']:
    if d.get('xyZid'): need.add(d['xyZid'])
    if d.get('xy2'): need.add(d['xy2']['zid'])
    for q in d['quests']:
        for v in q.get('variants', []):
            g = v.get('giver') or {}
            if g.get('zid'): need.add(g['zid'])

pts = defaultdict(list)
def add(spawns):
    for z, c in (spawns or {}).items():
        z = int(z)
        if z in need:
            for p in c or []:
                if p and len(p) >= 2 and 0 <= p[0] <= 100 and 0 <= p[1] <= 100: pts[z].append(p)
for v in N.values(): add(v[6])
for v in O.values():
    if len(v) > 3 and isinstance(v[3], dict): add(v[3])

FLIGHT = ('Gryphon Master', 'Wind Rider Master', 'Hippogryph Master', 'Bat Handler', 'Flight Master')
flights = defaultdict(list)
for k, v in N.items():
    if v[13] in FLIGHT:
        for z, c in (v[6] or {}).items():
            z = int(z)
            if z in need and c and c[0][0] >= 0:
                de = (deN.get(k) or [v[0]])
                flights[z].append([round(c[0][0], 1), round(c[0][1], 1), v[12] or '', de[0] or v[0]])

dungeons = defaultdict(list)
for aid, e in entr.items():
    for loc in e[3] or []:
        if isinstance(loc, list) and len(loc) == 3 and loc[0] in need:
            z = zones.get(aid) or {'de': e[0]}
            dungeons[loc[0]].append([round(loc[1], 1), round(loc[2], 1), z['de'] if not z['de'].isdigit() else e[0]])

CH = '0123456789abcdefghijklmnopqrstuvwxyz'
maps = {}
for z in sorted(need):
    g = [[0] * W for _ in range(H)]
    for x, y in pts[z]:
        g[min(H - 1, int(y / 100 * H))][min(W - 1, int(x / 100 * W))] += 1
    mx = max(max(r) for r in g) or 1
    enc = ''.join(CH[0 if c == 0 else 1 + min(34, int(math.log1p(c) / math.log1p(mx) * 34))] for r in g for c in r)
    zz = zones.get(str(z), {'de': str(z), 'en': str(z)})
    maps[str(z)] = {'de': zz['de'], 'en': zz['en'], 'g': enc, 'f': flights.get(z, []), 'd': dungeons.get(z, []), 'n': len(pts[z])}
json.dump(maps, open(f'{D}/db/maps.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(maps), 'Zonen', sum(len(m['g']) for m in maps.values()) // 1024, 'KB Raster;',
      'wenig Daten:', [m['de'] for m in maps.values() if m['n'] < 150])
