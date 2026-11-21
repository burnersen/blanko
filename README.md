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

- **Alle Schul-Lineaturen**, orientiert an DIN 16552-1: SL, 0, 1, 1q, 2, 3, 3R, VA, 4, 9, 21, 25, 25A, 27, R, ZL, 5, 7, 8f, 10, 22, 23, 26, 26A, 28, 29, 40, 47, GR, 6 und 14. Welche Maße genau und woher sie stammen, steht in [docs/lineaturen.md](docs/lineaturen.md).
- **Nach Klasse sortiert:** 1. bis 4. Klasse und ab Klasse 5, dazu eine Suche, die „3“, „Lin 3“ und „Lineatur 3“ versteht.
- **Mathe-Hilfen:** bunte Einmaleins-Tafel (mit Lücken oder leer zum Üben), Einmaleins-Reihen als Übungsblatt mit Lösungsblatt, Hundertertafel, Zahlenstrahl, Stellenwerttafel, Koordinatensystem, Millimeterpapier. Ziffern in Schulschrift, wie Kinder sie lernen.
- **Papier-Baukasten:** alles in einem Fenster. Art auswählen (liniert, kariert, Punkte, Millimeter, Isometrie, Sechsecke, Notenlinien, Tabelle, Kasten zum Malen), mit Schnellwahl für Lineatur 1 bis 4, Karo 5, 7 und 10 mm und mehr. Bis zu drei Bereiche auf einem Blatt, zum Beispiel oben malen und unten schreiben. Jedes Papier lässt sich mit „Im Baukasten weiterbearbeiten“ dorthin mitnehmen.
- **Vorlagen:** Stundenplan, Vokabelliste, Hausaufgabenplan, Wochenplan, Malen und Schreiben (Lineatur 1, 2 und 3), Rechengeschichte, Lesetagebuch und Tabellen nach Wunsch.
- **Favoriten:** Stern auf jeder Karte, die Favoriten stehen ganz oben auf der Startseite und sind über den Stern im Kopf immer mit einem Tipp erreichbar.
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

Auf jedem Ausdruck steht unten links „Kostenlos erstellt mit blanko.burnersen.de“ und rechts „Noch mehr cooles Zeugs auf burnersen.de“.

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
tools/               Release bauen, Installer-Vorlage
```

Jedes Papier hat seine eigene Adresse (`?p=lin-3`), mit passendem Titel und Beschreibung für Suchmaschinen. Eine Sitemap gibt es unter `?action=sitemap`.

**Ein neues Papier dazu:** Eintrag in `catalog.json` mit einem vorhandenen Generator (`gen`) und eigenen Grundwerten (`def`). Für ganz neue Arten einen Generator in `papers.js` ergänzen.

## Lizenz

GNU Affero General Public License v3.0, siehe [LICENSE](LICENSE). © burnersen, [burnersen.de](https://burnersen.de)
