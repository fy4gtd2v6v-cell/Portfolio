"""Wandelt die Forever-Daten der QuestieDB (Lua-Literale) in JSON um."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from luaparse import parse_assignment

src, out = sys.argv[1], sys.argv[2]
res = {}
for kind, f in [('quest', 'foreverQuestDB'), ('npc', 'foreverNpcDB'), ('item', 'foreverItemDB'), ('object', 'foreverObjectDB')]:
    t = open(f'{src}/data/Forever/{f}.lua', encoding='utf-8').read()
    keys = parse_assignment(t, f'QuestieDB.{kind}Keys')
    data = parse_assignment(t, f'QuestieDB.{kind}Data')
    res[kind] = {'keys': keys, 'data': {str(k): v for k, v in data.items()}}
    print(kind, len(data))
for kind, f, var in [('deQuest', 'lookupQuests', 'questLookup'), ('deNpc', 'lookupNpcs', 'npcNameLookup'),
                     ('deItem', 'lookupItems', 'itemLookup'), ('deObject', 'lookupObjects', 'objectLookup')]:
    t = open(f'{src}/l10n/Forever/{f}/deDE.lua', encoding='utf-8').read()
    v = parse_assignment(t, f'l10n.{var}["deDE"]')
    res[kind] = {str(k): x for k, x in (v.items() if isinstance(v, dict) else enumerate(v, 1))}
    print(kind, len(res[kind]))
json.dump(res, open(out, 'w'), ensure_ascii=False)
