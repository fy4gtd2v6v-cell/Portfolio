# Portfolio

Persönlicher Portfolio-Tracker im Browser – für Edelmetalle (in Gramm), Aktien/ETFs und Krypto.

## Funktionen

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
  (nur wenn alle Positionen einen Kurs haben) – Diagramm mit Zeitraum 1 M / 6 M / 1 J / Alles.
- Gewinn/Verlust, Aufteilung nach Anlageklasse – die Klassen-Karten filtern die Positionstabelle,
  die Spalten lassen sich sortieren, ein Klick auf eine Zeile öffnet die Position.
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
