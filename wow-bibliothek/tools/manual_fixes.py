"""Einmalige Korrekturen aus dem Datenbank-Abgleich (Stand: Nov. 2026)."""
import json, sys
p = sys.argv[1]; d = json.load(open(p))
D = {x['id']: x for x in d['DUNGEONS']}
def quest(did, name): return next(q for q in D[did]['quests'] if q['name'] == name)
def boss(did, name): return next(b for b in D[did]['bosses'] if b['name'] == name)

# Scharlachrotes Kloster: Vorrel-Quest heißt "Vorrel's Revenge" und startet bei Vorrel selbst
q = quest('sm', 'Vorrel Sengutz')
q.update(name="Vorrel's Revenge", giver='Vorrel Sengutz', loc='Im Dungeon (Friedhof)', obj='Bring Vorrels Ehering zu Monika Sengutz.',
         steps=['Vorrel Sengutz liegt sterbend im Friedhof-Flügel und gibt dir seinen Ring.', 'Den Ring zu Monika Sengutz nach Tarrens Mühle bringen.'])
# Gnomeregan
quest('gnomer', 'Save Techbot!')['name'] = "Save Techbot's Brain!"
# Molten Core: Quintessenz über Duke Hydraxis
q = quest('mc', 'Aqual Quintessence')
q.update(name='Hands of the Enemy', giver='Duke Hydraxis', obj='Bring die Hände von Lucifron, Sulfuron, Gehennas und Shazzrah.',
         steps=['Teil der Questreihe der Hydraxianischen Wasserfürsten (Azshara).', 'Ab „Wohlwollend“ (Agent of Hydraxis) gibt Duke Hydraxis die Aqual Quintessence zum Löschen der Runen.'])
# BWL: Horde-Kopfquest heißt ebenfalls "The Lord of Blackrock"
D['bwl']['quests'] = [q for q in D['bwl']['quests'] if q['name'] != 'Lord Victor Nefarius']
q = quest('bwl', 'The Lord of Blackrock'); q.update(side='B', giver='Head of Nefarian', loc='Abgabe: Thrall (Orgrimmar) bzw. Bolvar Fordragon (Sturmwind)')
# BRD: Royal Rescue ist Horde (Thrall); Allianz-Gegenstück "The Fate of the Kingdom"
q = quest('brd', 'The Royal Rescue')
q.update(side='H', giver='Thrall', loc='Orgrimmar', steps=['Thaurissan im Thronsaal töten, Prinzessin Moira dabei am Leben lassen.', 'Danach mit Moira sprechen („The Princess Saved?“).'])
D['brd']['quests'].insert(2, {'name': 'The Fate of the Kingdom', 'side': 'A', 'giver': 'King Magni Bronzebeard', 'loc': 'Eisenschmiede',
    'obj': 'Rette Prinzessin Moira aus den Klauen von Imperator Thaurissan.',
    'steps': ['Vorquests: „Kharan Mighthammer“, „Kharan\'s Tale“, „The Bearer of Bad News“.', 'Thaurissan töten, Moira dabei NICHT töten.', 'Danach „The Princess\'s Surprise“ bei Magni.'], 'reward': ''})
q = quest('brd', 'Dark Iron Legacy')
q.update(steps=['Fineous Darkvire töten – er hat den großen Hammer Ironfel.', 'Ironfel am Schrein von Thaurissan ablegen – ergibt den Shadowforge Key.'])
b = boss('brd', 'Fineous Darkvire'); b['tactic'] = 'Einfacher Kampf. Er trägt Ironfel für die Quest „Dark Iron Legacy“.'
# Stratholme / Scholomance / Uldaman / RFK: Questgeber laut Datenbank
quest('scholo', 'Plagued Hatchlings').update(giver='Betina Bigglezink', loc='Östliche Pestländer, Kapelle des Hoffnungsvollen Lichts')
quest('rfk', 'Going, Going, Guano!').update(giver='Master Apothecary Faranell', loc='Unterstadt, Apothekarium')
quest('ulda', 'Necklace Recovery').update(side='H', giver='Dran Droffers', loc='Orgrimmar')
quest('strat', 'The Restless Souls').update(steps=['Vorquest: Caretaker Alen an der Kapelle schickt dich zu Egan.', "Egan steht vor Stratholme und gibt dir Egan's Blaster.", 'Spektrale Bürger beschießen, dann töten.'])
quest('rfd', 'An Unholy Alliance').update(steps=['Ambassador Malcin vor dem Dungeon töten; er hat eine kleine Schriftrolle dabei.', 'Kopf zu Varimathras bringen.'])
quest('bfd', 'Allegiance to the Old Gods').update(giver='Je\'neu Sancrea', loc='Eschental, Zoram\'gar-Außenposten',
    steps=['Damp Note (Drop von Ghamoo-ra) zu Je\'neu bringen.', 'Danach Lorgus Jett im Dungeon töten.'])
# Baron Aquanis: der Fathom Core stammt aus dem Fathom Stone (Objekt)
b = boss('bfd', 'Baron Aquanis'); b['tactic'] = 'Wird über den Fathom Stone im Wasser gerufen (Hordenquest „Amongst the Ruins“); der Fathom Core liegt im Stein. Normaler Kampf.'
# Onyxia: bekannte Drops, die in den Datenbanken keine Quelle haben, bleiben als "nicht belegt"
ony = boss('ony', 'Onyxia')
for n in ['Bloodfang Hood', 'Nemesis Skullcap', 'Netherwind Crown', 'Halo of Transcendence', 'Stormrage Cover',
          "Dragonstalker's Helm", 'Helm of Wrath', 'Judgement Crown', 'Helmet of Ten Storms']:
    ony['drops'].append({'n': n, 'q': 'epic', 's': 'Kopf'})
ony['drops'] = [x for x in ony['drops'] if not x['n'].startswith('Tier-')]
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('ok')
