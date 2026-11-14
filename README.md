# Portfolio

Persönlicher Portfolio-Tracker im Browser – für Edelmetalle (in Gramm), Aktien/ETFs und Krypto.

## Funktionen

- **Edelmetalle in Gramm**: Gold, Silber, Platin, Palladium. Gewicht in g, kg oder Feinunzen eingeben,
  mit Feingehalt in ‰ (z. B. 999,9 oder 916,7 für Krügerrand) – bewertet wird nach Feingewicht.
  Preise trägst du **manuell** ein (€/g, €/oz oder €/kg).
- **Aktien & ETFs**: Kurse per [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
  (kostenloser Key, 25 Abfragen/Tag). Kurse in USD/GBP/CHF werden mit EZB-Kursen
  ([Frankfurter](https://www.frankfurter.app)) in Euro umgerechnet.
- **Krypto**: Kurse per [CoinGecko](https://www.coingecko.com/en/api) – ohne Key nutzbar.
- Mehrere Käufe pro Position, Einstandspreis, Gewinn/Verlust, Aufteilung nach Anlageklasse.
- Daten bleiben lokal im Browser; Export/Import als JSON (API-Keys werden nicht exportiert).

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

## Entwicklung

```bash
npm test           # Unit-Tests (Vitest)
npm run typecheck
```
