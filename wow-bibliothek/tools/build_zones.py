"""Zonennamen (ID -> englisch/deutsch) aus den Questie-Lokalisierungsdateien."""
import re, json, glob, sys
q = sys.argv[1] + '/Localization/'
z = open(q + 'lookups/lookupZones.lua', encoding='utf-8').read()
z = z[z.index('l10n.zoneLookup'):z.index('l10n.zoneCategoryLookup')]
z = '\n'.join(l for l in z.split('\n') if not l.strip().startswith('--'))
ids = {}
for m in re.finditer(r'\[(\d+)\]\s*=\s*"([^"]+)"', z): ids.setdefault(int(m.group(1)), m.group(2))
de = {}
for f in glob.glob(q + 'Translations/Zones/*.lua'):
    t = open(f, encoding='utf-8').read()
    for m in re.finditer(r'\["([^"]+)"\]\s*=\s*\{\s*\["enUS"\][^\n]*\n\s*\["deDE"\]\s*=\s*([^\n]+)', t):
        s = re.findall(r'"([^"]+)"', m.group(2)); de[m.group(1)] = s[-1] if s else m.group(1)
json.dump({str(k): {'en': v, 'de': de.get(v, v)} for k, v in ids.items()}, open(sys.argv[2], 'w'), ensure_ascii=False)
