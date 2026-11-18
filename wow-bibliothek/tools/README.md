# Werkzeuge zum Prüfen und Aktualisieren der Daten

Die Daten in `index.html` lassen sich jederzeit neu gegen die Datenbanken abgleichen.
Alle Skripte lesen die Datenbanken nur als Daten (es wird kein heruntergeladener Code ausgeführt).

```bash
W=/tmp/wowdb && mkdir -p $W/db && cd $W
# 1. Quellen holen
git clone --depth 1 https://github.com/Questie/QuestieDB questiedb-src
git clone --depth 1 --filter=blob:none --sparse https://github.com/Questie/Questie questie-src
(cd questie-src && git sparse-checkout set Localization)
mkdir wci && (cd wci && npm pack wow-classic-items@2.0.1 && tar xzf *.tgz)
mkdir wci082 && (cd wci082 && npm pack wow-classic-items@0.8.2 && tar xzf *.tgz)

# 2. In JSON umwandeln (tools/ aus diesem Ordner)
python3 build_db.py questiedb-src db/forever.json          # QuestieDB Forever
python3 build_zones.py questie-src db/zones.json            # Zonennamen DE/EN
python3 build_dungeons.py questiedb-src db/dungeons.json    # Dungeon-Eingänge

# 3. Abgleichen und zurückschreiben
node extract.cjs db/mine.json        # aktuelle Daten aus index.html
python3 enrich.py $W                 # -> db/enriched.json + db/report.md
python3 build_maps.py $W             # -> db/maps.json (eigene Zonenkarten)
python3 inject.py $W                 # -> index.html
```

Von Hand gepflegt werden nur Beschreibungen, Taktiken, Abläufe und Quest-Schritte. Beim nächsten Lauf
bleiben diese erhalten; Namen, Stufen, Questgeber, Koordinaten, Beute und Belohnungen werden neu berechnet.
`manual_fixes.py` enthält die einmaligen Korrekturen aus dem ersten Abgleich (Nov. 2026).
