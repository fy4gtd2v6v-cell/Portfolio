"""Liest die Forever-Ergänzungsdaten der QuestieDB (src/corrections/Forever/generated/*.lua)
als reine Daten und schreibt sie als JSON. Es wird kein Lua-Code ausgeführt: Konstanten
wie zoneIDs.RIVERGLADES werden per Textersetzung in Zahlen bzw. Namen übersetzt.

Aufruf: python3 build_forever_delta.py <questiedb-src> <ausgabe.json>
"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from luaparse import P

src, out = sys.argv[1], sys.argv[2]
enum = open(f'{src}/src/corrections/enum/zones.lua', encoding='utf-8').read()
ZONES = {m.group(1): int(m.group(2)) for m in re.finditer(r'^\s*([A-Z][A-Z0-9_]*)\s*=\s*(\d+)', enum, re.M)}
RANKS = {'NORMAL': 0, 'ELITE': 1, 'RARE_ELITE': 2, 'BOSS': 3, 'RARE': 4}

def prep(text):
    a = text.index('return {', text.index(':Load('))
    body = text[a + len('return'):]
    body = body[:body.rindex('\nend')]
    body = body[:body.rindex('}') + 1]
    body = re.sub(r'\[(?:npcKeys|questKeys|itemKeys|objectKeys|keys)\.([A-Za-z_]+)\]', r'["\1"]', body)
    body = re.sub(r'zoneIDs\.([A-Z0-9_]+)', lambda m: str(ZONES.get(m.group(1), 0)), body)
    body = re.sub(r'npcRanks\.([A-Z_]+)', lambda m: str(RANKS.get(m.group(1), 0)), body)
    body = re.sub(r'(raceIDs|classIDs|sortKeys)\.([A-Z0-9_]+)', r'"\1:\2"', body)
    body = re.sub(r'"\s*\+\s*"', '|', body)          # "raceIDs:A" + "raceIDs:B" -> "raceIDs:A|raceIDs:B"
    body = re.sub(r'(?<=[\s=])-(\d)', r'-\1', body)
    return body

res = {}
for kind, f in [('npc', 'foreverBaseNpc'), ('quest', 'foreverBaseQuest'), ('item', 'foreverBaseItem'), ('object', 'foreverBaseObject')]:
    t = open(f'{src}/src/corrections/Forever/generated/{f}.lua', encoding='utf-8').read()
    data = P(prep(t)).val()
    # Kommentar-Namen (z. B. "-- Elimara : https://...") mitnehmen
    names = {int(m.group(1)): m.group(2) for m in re.finditer(r'^\s*\[(\d+)\] = \{ -- (.*?) : https://wowhead\.com', t, re.M)}
    res[kind] = {str(k): dict(v, _label=names.get(k)) if isinstance(v, dict) else v for k, v in data.items()}
    print(kind, len(res[kind]))
res['zones'] = {str(v): k for k, v in ZONES.items()}
json.dump(res, open(out, 'w'), ensure_ascii=False)
