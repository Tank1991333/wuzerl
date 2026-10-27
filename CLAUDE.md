# CLAUDE.md – Wuzerl

Übergabe-Dokument für die Weiterentwicklung mit Claude Code. Bitte vor jeder Änderung lesen.

## Worum es geht

Wuzerl ist eine private Web-App für ein Paar in Österreich: Schwangerschaft, Babyzeit und erste Kleinkindjahre organisieren. Nutzer sind die beiden Eltern (Rollen „M“ = Mama, „P“ = Partner:in), optional Großeltern über eine Kurzansicht. Kein Produkt für Dritte.

Aktuelle Version: **1.0.1** (`APP_VERSION` in `index.html`, `CACHE` in `sw.js`).

## Harte Regeln (nicht verhandelbar)

1. **Keine Daten verlassen das Gerät.** Kein Backend, keine Cloud, kein Analytics, kein Tracking, keine Fehlerberichte an Dritte.
2. **Keine externen Ressourcen zur Laufzeit.** Keine CDNs, keine Google Fonts, keine externen Bilder. Alles liegt im Repo. Systemschriften verwenden.
3. **Keine Nutzerdaten im Repository.** Exportdateien (`wuzerl-*.json`, `unser-baby-*.json`, `*.ics`) stehen in `.gitignore`.
4. **Abgleich nur per Datei** von Gerät zu Gerät (Web Share API, sonst Download). Ein späterer automatischer Abgleich wäre nur selbst gehostet denkbar (z. B. Raspberry Pi im Heimnetz) und muss vorher mit dem Nutzer abgesprochen werden.
5. **Rückwärtskompatibilität:** Gespeicherte Daten und Exportdateien älterer Versionen müssen weiter funktionieren. Speicher-Schlüssel und Datenbankname nicht umbenennen (siehe unten, sie heißen aus historischen Gründen noch `unserbaby`/`unser-baby`).
6. **Inhalte beziehen sich auf Österreich** (Eltern-Kind-Pass, ÖGK, Mutterschutz, Karenz, Kinderbetreuungsgeld, Familienzeitbonus, Impfplan Österreich). Fristen sind als Richtwerte gekennzeichnet, keine medizinischen oder rechtlichen Ratschläge.

## Aufbau

```
index.html             gesamte App: HTML, CSS, JavaScript (Vanilla, kein Framework)
manifest.webmanifest   PWA-Manifest
sw.js                  Service Worker (nur App-Dateien cachen, nie Nutzerdaten)
icons/                 App-Icons (192, 512, maskable 512, apple-touch 180)
README.md              Anleitung für Nutzer (GitHub Pages, Installation, Abgleich)
CHANGELOG.md           Versionshistorie
.nojekyll              GitHub Pages ohne Jekyll
```

Kein Build-Schritt, keine Abhängigkeiten. Hosting: GitHub Pages (öffentliches Repo, nur Code).

Die App läuft zusätzlich als Artifact in claude.ai. Deshalb gibt es optionale Pfade für `window.claude` (nur `downloads` für Dateiexport). Der Service Worker wird nur registriert, wenn `location.protocol === 'https:'` und `window.claude` fehlt. Diese Weichen beibehalten.

### Abschnitte in `index.html` (Script)

Die Datei ist mit Kommentaren `/* ---------- name ---------- */` gegliedert:

| Abschnitt | Inhalt |
|---|---|
| helpers | Datums- und Formatfunktionen (`pd`, `iso`, `addD`, `diff`, `fmt`, `hm`, `dur`), `esc` für HTML-Escaping |
| store | IndexedDB-Speicher, `put`, `del`, `live`, `arr`, `meta`, `putMeta` |
| Abgleich per Datei | `saveFile`, `shareData`, `mergeData`, `importFile` |
| settings & status | Schwangerschaftswoche bzw. Babyalter (`status`, `babyAge`) |
| Austrian timeline | `DEFS`: alle Fristen und Untersuchungen, `tasks()`, `groupTasks()` |
| calendar export | `buildIcs()` für .ics-Dateien |
| checklists | `LISTS` mit Standard-Checklisten |
| tracker | Log-Typen (`LT`), Gesundheitstypen (`HEALTH`) |
| views | je Ansicht eine Funktion `viewXxx()`, die einen HTML-String liefert |
| render | baut `#app` und `#nav` neu auf |
| actions | Objekt `A`: alle Klick-Aktionen über `data-a` und `data-id` |
| start | Service Worker, `load()`, optional `claude.use('downloads')` |

### Rendering-Muster

- Jede Ansicht gibt einen HTML-String zurück. `render()` ersetzt `#app` komplett.
- **Alle Nutzertexte immer mit `esc()` ausgeben.** Fotos nur rendern, wenn der String mit `data:image/` beginnt.
- Klicks laufen über einen zentralen Listener: `data-a="aktion"` und `data-id="…"` rufen `A[aktion](id)` auf.
- Solange ein Eingabefeld im Fokus ist, wird `render()` aufgeschoben (`pending`) und beim Verlassen nachgeholt. Vor dem Speichern aus Formularen `blur()` aufrufen.
- Löschen ist zweistufig über `arm(act, id, fn)`: erster Tipp zeigt „Wirklich löschen?“, zweiter löscht.
- Navigation: `S.ui.tab`. Unteransichten (`wehen`, `kontakte`, `settings`) hängen über `PARENT` an einem Haupt-Tab.

## Datenmodell

Gespeichert wird ein einziges Objekt `S.d` in IndexedDB (Datenbank `unser-baby`, Store `kv`, Schlüssel `data`). Fallback: `localStorage` unter `unserbaby:v1`.

`S.d` hat feste Sammlungen (`COLLS`), jede ist ein Objekt `{ id: dokument }`:

| Sammlung | Inhalt | wichtige Felder |
|---|---|---|
| `meta` | `settings`, `state` | settings: `et`, `birth` (ISO-Datum), `ks`, `nameM`, `nameP`, `nameBaby`, `birthWeight` (g), `birthLength` (cm). state: `sleepStart`, `contrStart` (ms) |
| `checks` | erledigt/zuständig für Fristen (`t_<defId>`), Checklisten (`c_<liste>_<index>`), eigene Listenpunkte | `done`, `who` (M/P/B), bei eigenen: `custom`, `list`, `text`, `created` |
| `logs` | Tracker-Einträge | `type`, `at` (ms), `by`, je nach Typ `ml`, `end`, `temp`, `med`, `dose`, `note` |
| `pass` | Pass-Einträge | `kind`, `date`, `for` (kind/mama), `title`, `weight`, `height`, `note` |
| `appts` | eigene Termine | `title`, `date`, `time`, `place`, `note`, `who` |
| `contr` | Wehen | `start`, `end` (ms) |
| `names` | Namensliste | `name`, `by`, `vM`, `vP` (ja/vl/nein) |
| `contacts` | Kontakte | `name`, `role`, `phone` |
| `diary` | Tagebuch | `date`, `text`, `photo` (JPEG als Data-URL, verkleinert auf unter ca. 190 kB) |

Regeln:

- **Jede Änderung über `put()` bzw. `del()`.** `put` setzt `_u` (Zeitstempel der letzten Änderung). `del` schreibt einen Grabstein `{_del:true,_u}` statt zu löschen, damit Löschungen beim Abgleich erhalten bleiben.
- **Lesen nur über `live()`, `arr()` oder `meta()`**, die Grabsteine ausfiltern. Nie direkt `S.d.x[id]` lesen.
- Neue Felder dürfen ergänzt werden, bestehende nicht umbenennen. Neue Sammlung: in `COLLS` aufnehmen. `mergeData` funktioniert dann automatisch.
- Pro-Gerät-Einstellungen liegen in `localStorage`: `unserbaby:me` (wer nutzt das Gerät), `unserbaby:kurz` (Kurzansicht), `unserbaby:sync` (letzter Export/Import).

### Exportformat

```json
{ "app": "wuzerl", "version": 1, "appVersion": "1.0.0", "exported": 1791549921679, "from": "M", "data": { ...S.d } }
```

Import akzeptiert `app` = `wuzerl` und das alte `unser-baby`. Zusammenführen pro Dokument: das mit dem höheren `_u` gewinnt. Bei Formatänderungen `version` erhöhen und eine Migration in `importFile`/`load` ergänzen.

## Fristen und Inhalte (`DEFS`)

Jeder Eintrag: `id` (stabil, nie ändern, sonst gehen Häkchen verloren), `p` (preg/baby), `b` (Basis: `lmp` = Termin minus 280 Tage, `et` = Termin, `birth` = Geburt bzw. Termin als Schätzung), `s`/`e` (Tage relativ zur Basis, Zahl oder Funktion von `ks`), `w` (Standard-Zuständigkeit), `tag`, `t` (Titel), `i` (Erklärung), `ms` (Meilenstein, nicht abhakbar).

Hilfsfunktionen: `w(n)` = Beginn SSW n, `we(n)` = Ende SSW n, `M(x)` = x Monate in Tagen.

Stand der Inhalte: Oktober 2026. Bekannte Punkte:

- Der elektronische Eltern-Kind-Pass wurde auf voraussichtlich Herbst 2027 verschoben. Seit Oktober 2026 gibt es zusätzliche Untersuchungen und eine kostenlose Eltern-Beratung (Zusatzheft).
- Familienleistungen sind 2026 und 2027 nicht valorisiert.
- Inhaltliche Änderungen nur mit Quelle (oesterreich.gv.at, gesundheit.gv.at, ÖGK, Bundeskanzleramt Familienportal, Arbeiterkammer) und im CHANGELOG vermerken.

## Gestaltung und Sprache

- Oberfläche komplett **Deutsch (Österreich)**: „Jänner“ über `de-AT`, österreichische Begriffe (Gewand, Meldezettel, Krippe).
- Typografische Anführungszeichen in sichtbarem Text: „…“ und Apostroph ’. Im Code gerade Anführungszeichen.
- Farben nur über CSS-Variablen auf `:root`, mit Dunkelmodus über `prefers-color-scheme` und `data-theme`. Leitfarbe ist das Gelb des Eltern-Kind-Passes (`--pass`), Personen: `--mama`, `--papa`, `--both`.
- Mobile first, sichere Bereiche (`env(safe-area-inset-*)`) beachten, Navigation unten fixiert.
- Übersichtlichkeit ist ausdrücklicher Wunsch des Nutzers: keine neuen Haupt-Tabs. Neue Funktionen als Bereich (`seg`) innerhalb eines Tabs, als Unteransicht oder nur dann einblenden, wenn sie gerade relevant sind (Beispiel: Wehen-Timer erst ab SSW 34).
- Barrierefreiheit: echte `<button>`, `aria-label` bei Icon-Buttons, `aria-pressed` bei Umschaltern, `aria-current` in der Navigation.

## Testen

```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```

Vor jedem Commit prüfen:

1. JavaScript-Syntax (z. B. Script extrahieren und `node --check`).
2. Ablauf im Browser: Geburtstermin setzen, alle Tabs öffnen, Eintrag anlegen und löschen, Seite neu laden (Daten bleiben).
3. Abgleich mit zwei Browser-Profilen: auf A exportieren, auf B importieren, Löschungen kommen mit.
4. Kalender-Export erzeugt eine gültige .ics-Datei.
5. Keine Netzwerkanfragen an fremde Domains (DevTools, Reiter Netzwerk).

Für automatisierte Tests eignet sich Playwright, Testdateien nicht ins Repo legen oder in einen eigenen Ordner `tests/`.

## Neue Version veröffentlichen

1. `APP_VERSION` in `index.html` erhöhen (SemVer).
2. `CACHE` in `sw.js` auf denselben Wert setzen, sonst bekommen installierte Apps das Update nicht.
3. `CHANGELOG.md` ergänzen.
4. Commit, Tag `vX.Y.Z`, push. GitHub Pages veröffentlicht automatisch.

## Mögliche nächste Schritte (nur nach Rücksprache)

- `index.html` in Module aufteilen (z. B. `css/`, `js/`), weiterhin ohne Build-Schritt, Service-Worker-Liste anpassen.
- Selbst gehosteter Abgleich im Heimnetz (Raspberry Pi), Ende-zu-Ende-verschlüsselt.
- Exportdatei optional mit Passwort verschlüsseln (Web Crypto, AES-GCM).
- Erinnerungen über lokale Benachrichtigungen, soweit am Handy ohne Server möglich.
