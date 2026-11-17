# Portfolio

Persönlicher Portfolio-Tracker im Browser – für Edelmetalle (in Gramm), Aktien/ETFs und Krypto.

## Funktionen

- **Startseite „Vermögen“**: Gesamtvermögen, Stückelung als Kreisdiagramm (nach Anlageklassen oder
  einzelnen Positionen) und Vermögensverlauf mit umschaltbarem Zeitraum (1 W, 1 M, 3 M, 6 M,
  seit Jahresbeginn, 1 J, Max).

- **Edelmetalle in Gramm**: Gold, Silber, Platin, Palladium. Gewicht in g, kg oder Feinunzen eingeben,
  mit Feingehalt in ‰ (z. B. 999,9 oder 916,7 für Krügerrand) – bewertet wird nach Feingewicht.
  Preise kommen wahlweise **live** als Börsenpreis (Spot, über [gold-api.com](https://gold-api.com),
  ohne Key) oder **manuell** (€/g, €/oz oder €/kg), z. B. der Ankaufspreis deines Händlers.
- **Aktien & ETFs**: Kurse per [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
  (kostenloser Key, 25 Abfragen/Tag). Kurse in USD/GBP/CHF werden mit EZB-Kursen
  ([Frankfurter](https://frankfurter.dev)) in Euro umgerechnet.
- **Krypto**: Kurse per [CoinGecko](https://www.coingecko.com/en/api) – ohne Key nutzbar.
- Käufe **und Verkäufe** pro Position. Einstand und realisierter Gewinn nach **FIFO**
  (wie bei Wertpapieren steuerlich vorgeschrieben); Verkäufe über den Bestand werden abgelehnt.
- **Wertverlauf**: Jeden Tag, an dem die App geöffnet wird, speichert sie den Gesamtwert
  (nur wenn alle Positionen einen Kurs haben) – der Verlauf beginnt mit dem ersten Tag der Nutzung.
- **Livekurse**: Tabelle aller gehaltenen Positionen mit Kurs, Tagesveränderung, Bestand, Wert und
  Gewinn/Verlust – sortierbar und nach Anlageklasse filterbar. Krypto und Edelmetalle werden jede
  Minute automatisch aktualisiert (abschaltbar), Aktien wegen des Tageslimits nur über „Kurse aktualisieren“.
  „Heute“ bedeutet bei Krypto die letzten 24 Stunden, bei Aktien seit dem letzten Börsenschluss,
  bei Edelmetallen seit dem letzten Abruf an einem früheren Tag.
- **Konten**: Girokonten und andere Bankkonten zählen als vierte Anlageklasse zum Gesamtvermögen
  (nicht zum investierten Kapital).
- **Datei-Import** (Positionen → „Datei importieren“): CSV-Exporte aus dem Online-Banking, z. B. von
  ING, Sparkasse oder Trade Republic. Erkannt werden Kontoumsätze (→ Kontostand), Depotbestände
  (→ Positionen mit Stückzahl und Einstand) und Wertpapier-Transaktionen (→ Käufe und Verkäufe).
  Die Spalten werden an ihren Überschriften erkannt und lassen sich von Hand zuordnen; vor dem
  Import gibt es eine Vorschau. Die Datei wird nur im Browser gelesen.
  Bei Transaktionslisten (z. B. Trade Republic) werden alle Käufe eines Wertpapiers zu einer Position
  zusammengefasst; jeder Kauf bleibt mit Kurs, Gebühr, Betrag und Sparplan-Kennzeichen sichtbar.
  Das Guthaben und bereits bezahlte, offene Aufträge können als Konto übernommen werden.
  Spätere oder überlappende Exporte werden **ergänzt**, nicht doppelt gezählt: Jede Buchung wird an
  ihrer Buchungsnummer erkannt (ohne Nummer an Datum, Stückzahl und Betrag), das Guthaben wird mit
  den neuen Buchungen fortgeschrieben.
- **Mehrere Depots**: Jede Position merkt sich ihr Depot (z. B. ING, Trade Republic, Flexgold; beim
  Import vorausgefüllt). Ein Import gleicht nur innerhalb desselben Depots ab – dasselbe Wertpapier in
  zwei Depots bleibt zwei Positionen, die sich denselben Kurs teilen. Getestet mit der ING-
  „Depotübersicht“ (CSV mit Vorspann, Windows-1252). Positionen und Livekurse sind nach Depot gruppiert
  (mit Summen, zuklappbar, Zustand wird gespeichert); die Startseite zeigt die Aufteilung nach Depot.
  Das Depot lässt sich bei jeder Position auch von Hand setzen.
- **Edelmetall-Konten** (z. B. Flexgold): Der Transaktionsverlauf als Excel-Datei (.xlsx) oder CSV
  wird je Metall zu einer Position in Gramm mit allen Käufen; Ein- und Auszahlungen bilden das Guthaben.
  Excel-Dateien werden ohne Zusatzbibliothek direkt im Browser entpackt.
- **Kategorien mit eigenen Farben**: Aktien, ETFs & Fonds, Gold, Silber, Platin, Palladium, Konten und
  Krypto – in Kreisdiagramm, Filtern und Listen. Ob eine Position Aktie oder ETF ist, kommt aus dem
  Import oder dem Namen und lässt sich bei der Position umstellen. Die Farbreihenfolge ist so gewählt,
  dass benachbarte Segmente auch bei Farbsehschwäche unterscheidbar bleiben.
- **Börsensymbol suchen**: Importierte Wertpapiere kennen zunächst nur ihre ISIN und werden mit dem
  Kurs des letzten Kaufs bewertet. Bei der Position lässt sich das Symbol über den Namen bei
  Alpha Vantage suchen (US-Aktien an der US-Börse, sonst bevorzugt Xetra in Euro).
- Neue Positionen werden über „Neue Position“ in einem eigenen Fenster angelegt.
- Daten bleiben lokal im Browser; Export/Import als JSON (API-Keys werden nicht exportiert).

## Sicherheit

- **Passwortschutz** (Einstellungen): Daten und API-Keys werden mit AES-256-GCM verschlüsselt im
  Browser gespeichert; der Schlüssel wird per PBKDF2-SHA256 (600.000 Runden) aus dem Passwort
  abgeleitet und existiert nur im Arbeitsspeicher. Die App sperrt sich nach 10 Minuten ohne
  Eingabe, per „Sperren“-Knopf und beim Schließen des Tabs.
- **Passwort vergessen**: Beim Aktivieren wird einmalig ein Wiederherstellungsschlüssel angezeigt.
  Damit lässt sich auf dem Sperrbildschirm ein neues Passwort setzen, ohne Daten zu verlieren.
  Technisch ist der zufällige Datenschlüssel zweimal verschlüsselt abgelegt – einmal mit dem
  Passwort, einmal mit dem Wiederherstellungsschlüssel. Ohne beides sind die Daten nicht lesbar.
- **Verschlüsselter Export**: Mit aktivem Passwortschutz ist auch die Sicherungsdatei verschlüsselt.
- **Content-Security-Policy**: Die gebaute Seite führt nur ihr eigenes (per Hash festgelegtes)
  Skript aus und darf ausschließlich die vier Kursdienste kontaktieren.
- Grenzen: Der Schutz gilt für gespeicherte Daten. Solange die App entsperrt ist, kann Schadsoftware
  oder eine bösartige Browser-Erweiterung auf dem Rechner mitlesen. Der Alpha-Vantage-Key wird
  (von der API so vorgegeben) als Teil der Adresse an alphavantage.co gesendet.

## Auf dem Mac starten

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
```

Oder als einzelne Datei bauen und direkt öffnen:

```bash
npm run build      # erzeugt dist/index.html (alles in einer Datei)
open dist/index.html
```

Tipp: In Safari (macOS Sonoma+) über *Ablage → Zum Dock hinzufügen* wie eine eigene App nutzen.
Die Daten hängen am Browser und an der Adresse, unter der die App geöffnet wird – also immer
dieselbe Adresse verwenden und regelmäßig exportieren.

## Online über GitHub Pages

Der Workflow `.github/workflows/pages.yml` testet und baut bei jedem Push auf `main` und
veröffentlicht die App auf GitHub Pages. Einmalig einrichten:

1. Im Repo unter **Settings → Pages → Build and deployment → Source** „**GitHub Actions**“ wählen.
2. Den Branch nach `main` mergen – danach ist die App unter `https://<nutzer>.github.io/Portfolio/` erreichbar.

Hinweis: Für **private** Repos gibt es GitHub Pages nur mit GitHub Pro (oder Team/Enterprise).
Die veröffentlichte Seite selbst enthält keine persönlichen Daten – Positionen und Keys
liegen nur im jeweiligen Browser.

## Entwicklung

```bash
npm test           # Unit-Tests (Vitest)
npm run typecheck
```
