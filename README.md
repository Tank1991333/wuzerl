# Wuzerl

Eine kleine Web-App für Schwangerschaft, Babyzeit und die ersten Kleinkindjahre. Ausgerichtet auf Österreich, gebaut für den Eigengebrauch.

**Version 1.0.0**

## Datenschutz

Alle Einträge bleiben ausschließlich auf dem Gerät, im Speicher des Browsers (IndexedDB). Es gibt keinen Server, keine Cloud, kein Konto, kein Tracking und keine externen Schriften oder Skripte.

Das Repository enthält nur den Programmcode, nie eure Daten. Beim Aufrufen der Seite sieht GitHub wie jede Website technische Zugriffsdaten (z. B. die IP-Adresse), aber keine Inhalte der App.

Zum Abgleich zwischen zwei Handys schickt man sich eine Datei direkt von Gerät zu Gerät (z. B. per AirDrop oder Signal). Diese Datei enthält alle Einträge inklusive Gesundheitsdaten und Fotos. Bitte nicht in Gruppen-Chats, öffentliche Cloud-Ordner oder dieses Repository legen. Die `.gitignore` verhindert, dass Exportdateien versehentlich eingecheckt werden.

## Funktionen

- **Heute:** Schwangerschaftswoche bzw. Alter des Babys und die nächsten fälligen Punkte
- **Termine:** Fristen und Untersuchungen nach österreichischem Stand, eigene Arzttermine, Export in den Kalender
- **Listen:** Kliniktasche, Erstausstattung, Daheim vorbereiten, Namensliste
- **Baby:** Stillen, Fläschchen, Windeln, Schlaf, Fieber und Medikamente
- **Pass:** Untersuchungen, Impfungen, Messungen, Wachstumskurve, Tagebuch mit Fotos
- **Wehen-Timer** ab der 34. Woche, **wichtige Nummern** und eine **Kurzansicht** für Großeltern

## Veröffentlichen mit GitHub Pages

1. Neues Repository auf GitHub anlegen, z. B. `wuzerl`.
2. Alle Dateien aus diesem Ordner hochladen (inklusive `.nojekyll` und `.gitignore`).
3. Im Repository unter **Settings → Pages** bei „Source“ **Deploy from a branch** wählen, Branch `main` und Ordner `/ (root)`, dann speichern.
4. Nach ein bis zwei Minuten ist die App unter `https://<benutzername>.github.io/wuzerl/` erreichbar.

GitHub Pages ist im kostenlosen Tarif nur für öffentliche Repositories verfügbar. Das ist unbedenklich, weil hier nur Code liegt.

## Am Handy installieren

- **iPhone (Safari):** Seite öffnen, Teilen-Symbol, „Zum Home-Bildschirm“.
- **Android (Chrome):** Seite öffnen, Menü, „App installieren“ oder „Zum Startbildschirm hinzufügen“.

Danach startet die App wie eine normale App und funktioniert auch offline.

## Abgleich zwischen zwei Handys

1. Auf Handy A: Einstellungen → **Daten teilen**, Datei an Handy B schicken.
2. Auf Handy B: Einstellungen → **Importieren**, Datei auswählen.
3. Danach in die andere Richtung genauso.

Einträge werden zusammengeführt. Wurde derselbe Eintrag auf beiden Geräten geändert, gewinnt die neuere Änderung. Gelöschtes bleibt gelöscht. Die geteilte Datei ist gleichzeitig eine Sicherung: Wer die Browser-Daten am Handy löscht, löscht auch die Einträge.

## Aufbau

```
index.html             die komplette App (HTML, CSS, JavaScript)
manifest.webmanifest   Angaben für die Installation am Startbildschirm
sw.js                  Service Worker für die Offline-Nutzung
icons/                 App-Icons
```

Kein Build-Schritt, keine Abhängigkeiten. Zum lokalen Testen reicht ein einfacher Webserver, z. B. `python3 -m http.server` im Ordner und dann `http://localhost:8000` öffnen.

## Neue Version veröffentlichen

1. Änderungen in `index.html` machen und `APP_VERSION` erhöhen.
2. In `sw.js` den Wert von `CACHE` auf die neue Version setzen, damit die Handys das Update laden.
3. Eintrag in `CHANGELOG.md` ergänzen, hochladen, optional einen Release mit Tag (z. B. `v1.1.0`) anlegen.

## Hinweis

Fristen, Untersuchungszeiträume und Impf-Richtwerte entsprechen dem österreichischen Stand von Oktober 2026 und sind als Orientierung gedacht. Verbindlich sind die Angaben von ÖGK, oesterreich.gv.at, Arbeiterkammer sowie Ärztin, Arzt oder Hebamme. Die App ersetzt keine medizinische Beratung.
