# blanko

**Papier zum Ausdrucken: alle Lineaturen für die Schule, Karopapier, Einmaleins und vieles mehr.**

[![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-777BB4?logo=php&logoColor=white)](#voraussetzungen)
[![Lizenz: AGPLv3](https://img.shields.io/badge/Lizenz-AGPLv3-blue)](#lizenz)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Unterst%C3%BCtze%20mich-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/burnersen)

**[🌐 blanko.burnersen.de](https://blanko.burnersen.de)** · **[⬇️ Neuestes Release](../../releases/latest)** · **[☕ Spendier mir einen Kaffee](https://ko-fi.com/burnersen)**

<p align="center"><img src="branding/blanko-logo.png" alt="blanko" width="360"></p>

Samstagabend, auf der Materialliste steht „Lineatur 3“, und kein Laden hat mehr offen? blanko hat das Papier:
Lineatur antippen, drucken, fertig. In Originalgröße, kostenlos, ohne Werbung, ohne Anmeldung und auch ohne Internet.

## Was blanko kann

- **Alle Schul-Lineaturen**, orientiert an DIN 16552-1: SL, 0, 1, 1q, 2, 3, 3R, VA, dm, GS, A1, 4, 9, 21, 25, 25A, 27, R, ZL, 5, 7, 8f, 10, 22, 23, 26, 26A, 28, 29, 40, 47, GR, 6 und 14. Welche Maße genau und woher sie stammen, steht in [docs/lineaturen.md](docs/lineaturen.md).
- **Nach Klasse sortiert:** 1. bis 4. Klasse und ab Klasse 5, dazu eine Suche, die „3“, „Lin 3“ und „Lineatur 3“ versteht.
- **Mathe-Hilfen:** Rechenblätter bis 20, 100 und 1000 (Plus, Minus, Mal, Geteilt, mit Platzhaltern, ohne Zehnerübergang, mit Lösungsblatt), Ziffern schreiben zum Nachspuren, Uhr lernen, Zahlenmauern und Rechendreiecke, bunte Einmaleins-Tafel (mit Lücken oder leer zum Üben), Einmaleins-Reihen als Übungsblatt mit Lösungsblatt, Hundertertafel, Zahlenstrahl, Stellenwerttafel, Koordinatensystem, Millimeterpapier. Ziffern in Schulschrift, wie Kinder sie lernen.
- **Papier-Baukasten:** alles in einem Fenster. Art auswählen (liniert, kariert, Punkte, Millimeter, Isometrie, Sechsecke, Notenlinien, Tabelle, Kasten zum Malen), mit Schnellwahl für Lineatur 1 bis 4, Karo 5, 7 und 10 mm und mehr. Bis zu drei Bereiche auf einem Blatt, zum Beispiel oben malen und unten schreiben. Jedes Papier lässt sich mit „Im Baukasten weiterbearbeiten“ dorthin mitnehmen.
- **Vorlagen:** Stundenplan, Vokabelliste, Hausaufgabenplan, Wochenplan, Malen und Schreiben (Lineatur 1, 2 und 3), Rechengeschichte, Lesetagebuch und Tabellen nach Wunsch.
- **Favoriten:** Stern auf jeder Karte, die Favoriten stehen ganz oben auf der Startseite und sind über den Stern im Kopf immer mit einem Tipp erreichbar.
- **Kalender:** Jahreskalender, Schuljahreskalender (August bis Juli), Jahresplaner / Urlaubsplaner, Monatskalender, Bastelkalender zum Bemalen, Familienplaner (eine Spalte pro Person), Wochenkalender, Tagesplaner und immerwährender Geburtstagskalender. Mit Feiertagen aller 16 Bundesländer, Brückentagen, Schulferien, Kalenderwochen und Mondphasen. Farben, Form der Tage, Überschriften und Schrift frei wählbar, alle Formate von A6 bis A3, hoch oder quer.
- **Kreativ:** Punktraster, Isometrie, Dreiecke, Sechsecke, Storyboard, Comic, Kalligrafie, Handlettering.
- **Spezialpapiere** in einem eigenen Bereich: Logarithmenpapier, Polarkoordinaten, Wahrscheinlichkeitsnetz, Gitarren-Tabulatur, Tianzige, Mizige, Genkō yōshi und ein Druckertest.
- **Original oder angepasst:** Jede Lineatur startet im Original. Alles lässt sich verstellen (Linienabstände, Kästchen, Rand, Kopfzeile mit Name und Datum, Farben, Format, Seitenzahl). Verstelltes zeigt „Angepasst“, ein Tipp bringt das Original zurück.
- **Live-Vorschau**, die genau zeigt, was aus dem Drucker kommt, mit Lupe.
- **2 × A5 auf A4** zum Durchschneiden, für die vielen A5-Hefte der Grundschule.
- **PDF ohne fremde Bibliothek**, als Vektorgrafik in echten Millimetern, mit dem Hinweis „Originalgröße drucken“ für den Drucker.
- **Link teilen:** Die Einstellungen stecken im Link. Eine Lehrerin kann ihren Eltern genau ihr Blatt schicken.
- **Meine Blätter**, Favoriten und Einstellungen bleiben nur auf dem eigenen Gerät.
- **Als App installierbar** (PWA) auf jedem System, mit Anleitung für iPhone, iPad, Android, Mac und PC. Läuft danach offline und holt sich neue Versionen von selbst.
- **Kein Tracking, keine Datenbank, keine Konten.** Nichts wird von fremden Servern geladen.

Die Startseite ist zweigeteilt: oben alles für die Schule, darunter abgesetzt „Für zu Hause, Hobby und Beruf“ (Planen und Tabellen, Kreativ, Spezialpapiere).

Auf jedem Ausdruck steht unten links „Kostenlos erstellt mit blanko.burnersen.de“ und rechts „Noch mehr cooles Zeugs auf burnersen.de“.

## Kalender: Feiertage, Brückentage, Schulferien

- **Feiertage** werden für jedes Jahr im Browser berechnet (Ostern nach der Gaußschen Osterformel, alle beweglichen Feiertage hängen daran), für alle 16 Bundesländer. Kein Internet nötig.
- **Brückentage:** ein Arbeitstag zwischen einem Feiertag und dem Wochenende.
- **Mondphasen** nach Jean Meeus, auf wenige Minuten genau.
- **Schulferien** stammen aus den offiziellen Ferientabellen der Kultusministerkonferenz (`app/assets/ferien.json`). Die GitHub Action „Schulferien“ (`.github/workflows/ferien.yml`) holt sie am 3. jedes Monats neu (`tools/ferien.py`), prüft sie und baut bei Änderungen automatisch ein neues Release. Jede Installation holt sich das dann von selbst. Auf jedem Kalender steht, bis wann Ferien hinterlegt sind.

## Voraussetzungen

- Webspace mit **PHP 7.4** oder neuer. Keine Datenbank nötig.
- **HTTPS**, sonst lässt sich blanko nicht als App installieren.
- Für Updates von allein: `curl` oder `allow_url_fopen` und ausgehende Verbindungen zu GitHub. Fehlt das, läuft blanko ganz normal, nur ohne Update von allein.

## Installation

1. Aus dem [neuesten Release](../../releases/latest) die Datei `blanko-install.php` herunterladen.
2. In das Verzeichnis der Subdomain hochladen (z. B. `blanko.burnersen.de`).
3. `https://blanko.burnersen.de/blanko-install.php` im Browser aufrufen und auf „Jetzt installieren“ klicken. Die Datei packt das Programm aus, löscht sich selbst und leitet weiter.

Alternativ das ZIP aus dem Release entpacken und den Inhalt des Ordners `blanko/` hochladen.

## Updates

blanko schaut höchstens alle 15 Minuten beim neuesten GitHub-Release nach (immer erst, nachdem eine Seite ausgeliefert ist).
Gibt es eine neue Version, holt es den Installer, prüft ihn per SHA-256-Prüfsumme, legt die laufende Version in `data/update-prev.txt` ab und spielt die neue ein.
Die Geräte bemerken die neue Version beim nächsten Öffnen über den Service Worker und laden sie im Hintergrund.

Abschalten: in `data/config.php` den Eintrag `'auto_update' => false` setzen.

**Neues Release bauen:** Version in `index.php` (`BL_VERSION`) erhöhen, committen, dann unter Actions → Release → „Run workflow“ starten (oder einen Tag wie `1.0.1` pushen).

## Prüfung

`node tools/pruefen.js` erzeugt jedes Papier in 10 Formaten und mit allen Auswahlmöglichkeiten, den kleinsten und größten Zahlenwerten und langen Texten (über 6000 Varianten). Gemeldet werden fehlende Zeichen oder Texte, Inhalt außerhalb der Seite oder im Branding-Bereich, Text an der Blattkante und überlappende oder zu eng stehende Zahlen. Dazu werden 128 000 Rechenaufgaben nachgerechnet und die Kalender gegen bekannte Daten geprüft. Läuft bei jedem Push automatisch (GitHub Action „Prüfen“) und vor jedem Ferien-Update.

## Aufbau

```
index.php            Einstieg, Version, Auslieferung von Seite, Dateien, Service Worker, Manifest, Sitemap
app/lib/core.php     Grundlagen
app/lib/update.php   Updates von allein aus dem GitHub-Release
app/views/app.php    Die Seite (mit Liste aller Papiere für Suchmaschinen)
app/assets/pdf.js    Druck-Engine: Zeichenbefehle in mm → Canvas-Vorschau und PDF, Schulschrift-Ziffern, Branding
app/assets/papers.js Die Generatoren (Linien, Kästchen, Einmaleins, …) und ihre Regler
app/assets/catalog.json  Alle Papiere mit Namen, Klassen, Stichwörtern, Grundwerten und Quellen
app/assets/app.js    Die Oberfläche
app/assets/sw.js     Service Worker (offline)
branding/            Logos von blanko und burnersen als SVG und PNG
docs/lineaturen.md   Maße und Quellen aller Lineaturen
tools/               Release bauen, Installer-Vorlage, Schulferien holen (ferien.py), Prüfung (pruefen.js)
```

Jedes Papier hat seine eigene Adresse (`?p=lin-3`), mit passendem Titel und Beschreibung für Suchmaschinen. Eine Sitemap gibt es unter `?action=sitemap`.

**Ein neues Papier dazu:** Eintrag in `catalog.json` mit einem vorhandenen Generator (`gen`) und eigenen Grundwerten (`def`). Für ganz neue Arten einen Generator in `papers.js` ergänzen.

## Lizenz

GNU Affero General Public License v3.0, siehe [LICENSE](LICENSE). © burnersen, [burnersen.de](https://burnersen.de)
