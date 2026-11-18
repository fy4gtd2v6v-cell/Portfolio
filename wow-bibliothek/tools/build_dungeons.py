"""Dungeon-Eingänge (Forever-Koordinaten) aus support/Forever/Zones/dungeons.lua."""
import re, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from luaparse import P
t = open(sys.argv[1] + '/support/Forever/Zones/dungeons.lua', encoding='utf-8').read()
base = t[t.index('local dungeons = {'):]; base = base[:base.index('\n}\n')]
out = {}
for line in base.split('\n'):
    m = re.match(r'\s*\[(\d+)\]\s*=\s*(\{.*\}),?\s*(--.*)?$', line)
    if m and 'isHorde' not in line: out[m.group(1)] = P(m.group(2)).val()
json.dump(out, open(sys.argv[2], 'w'))
