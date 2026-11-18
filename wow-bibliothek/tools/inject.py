"""Schreibt geprüfte Daten (db/enriched.json) und tools/app.js in index.html."""
import json, sys, os, re
D = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
html_p = os.path.join(here, '..', 'index.html')
h = open(html_p, encoding='utf-8').read()
data = json.load(open(f'{D}/db/enriched.json'))
app = open(os.path.join(here, 'art.js'), encoding='utf-8').read() + '\n' + open(os.path.join(here, 'app.js'), encoding='utf-8').read()
def js(arr):
    return '[\n' + ',\n'.join(json.dumps(x, ensure_ascii=False, separators=(',', ':')) for x in arr) + '\n]'
header = '''/* =====================================================================
   DATEN – geprüft gegen QuestieDB (Forever) und wow-classic-items
   ---------------------------------------------------------------------
   Neu erzeugen: siehe tools/README.md. Von Hand gepflegt sind nur
   Beschreibungen, Taktiken, Abläufe und Quest-Schritte; Namen (DE/EN),
   Stufen, Questgeber, Koordinaten, Beute und Belohnungen stammen aus
   den Datenbanken.
   Gegenstand: {id, n: englisch, de: deutsch, q: Qualität, s: Slot/Typ,
                tip: Tooltip-Zeilen, c: Dropchance %, v: 0 = nicht belegt}
   Quest:      {name, de, side: A|H|B, variants: [{side, giver:{de,en,zone,xy}}],
                objDe/objEn: offizieller Questtext, steps, rewards}
   ===================================================================== */
'''
maps = json.load(open(f'{D}/db/maps.json')) if os.path.exists(f'{D}/db/maps.json') else {}
mapjs = '/* Zonenkarten (tools/build_maps.py): Dichteraster 75x50 aus Spawn-Positionen, Flugpunkte f, Dungeon-Eingänge d */\nconst MAPS = {\n' + ',\n'.join(json.dumps(k) + ':' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) for k, v in maps.items()) + '\n};\n\n'
block = header + mapjs + 'const DUNGEONS = ' + js(data['DUNGEONS']) + ';\n\nconst MONSTERS = ' + js(data['MONSTERS']) + ';\n\n' + app
a = h.index('<script>') + len('<script>\n')
b = h.rindex('</script>')
h = h[:a] + block + h[b:]
open(html_p, 'w', encoding='utf-8').write(h)
print('ok', len(h))
