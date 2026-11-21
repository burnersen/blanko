#!/usr/bin/env python3
"""blanko – Schulferien aus den offiziellen Ferientabellen der Kultusministerkonferenz (KMK) holen.

Läuft monatlich als GitHub Action (.github/workflows/ferien.yml), kann aber auch von Hand gestartet werden:

    python3 tools/ferien.py            # schreibt app/assets/ferien.json

Die KMK veröffentlicht pro Schuljahr ein PDF unter einer festen Adresse (FER2026_27.pdf usw.).
Das Skript probiert die Schuljahre vom letzten bis fünf Jahre voraus, liest die Tabellen über die
Wortpositionen aus (pdftotext -bbox, Paket poppler-utils) und prüft das Ergebnis, bevor es etwas schreibt.
Ist etwas unstimmig, bricht es mit Fehler ab und die alte Datei bleibt, wie sie ist.
"""
import datetime as dt, html, json, os, re, subprocess, sys, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'assets', 'ferien.json')
URL = 'https://www.kmk.org/fileadmin/Dateien/pdf/Ferienkalender/FER{a}_{b:02d}.pdf'
LANDS = [('Baden-Württemberg', 'BW'), ('Bayern', 'BY'), ('Berlin', 'BE'), ('Brandenburg', 'BB'), ('Bremen', 'HB'), ('Hamburg', 'HH'),
         ('Hessen', 'HE'), ('Mecklenburg-Vorpommern', 'MV'), ('Niedersachsen', 'NI'), ('Nordrhein-Westfalen', 'NW'), ('Rheinland-Pfalz', 'RP'),
         ('Saarland', 'SL'), ('Sachsen', 'SN'), ('Sachsen-Anhalt', 'ST'), ('Schleswig-Holstein', 'SH'), ('Thüringen', 'TH')]
COLS = ['Herbst', 'Weihnachten', 'Winter', 'Ostern/Frühjahr', 'Himmelfahrt/Pfingsten', 'Sommer']


def words(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True, check=True).stdout
    return [(float(m[1]), float(m[2]), float(m[3]), float(m[4]), html.unescape(m[5]))
            for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', out)]


def name_of(col, month):
    if col == 'Herbst': return 'Herbstferien'
    if col == 'Weihnachten': return 'Weihnachtsferien'
    if col == 'Winter': return 'Winterferien'
    if col == 'Ostern/Frühjahr': return 'Winterferien' if month <= 2 else 'Osterferien'
    if col == 'Himmelfahrt/Pfingsten': return 'Pfingstferien'
    return 'Sommerferien'


def parse(pdf, Y):
    W = words(pdf)
    cx = {}
    for x0, y0, x1, y1, t in W:
        if t in COLS and t not in cx: cx[t] = (x0 + x1) / 2
    if len(cx) != 6: raise SystemExit(f'{pdf}: Spalten nicht gefunden: {cx}')
    ly = []
    for name, code in LANDS:
        c = [(y0 + y1) / 2 for x0, y0, x1, y1, t in W if t == name and x0 < 120]
        if not c: raise SystemExit(f'{pdf}: Land fehlt: {name}')
        ly.append((code, c[0]))
    ly.sort(key=lambda a: a[1])
    res = {}
    for i, (code, yc) in enumerate(ly):
        top = (ly[i - 1][1] + yc) / 2 if i else yc - 14
        bot = (yc + ly[i + 1][1]) / 2 if i + 1 < len(ly) else yc + 14
        cell = {c: [] for c in COLS}
        for x0, y0, x1, y1, t in W:
            ym = (y0 + y1) / 2
            if not (top <= ym < bot) or x0 < 150 or not re.match(r'^(\d\d\.\d\d\.|-|–|und|--)$', t): continue
            c = min(COLS, key=lambda c: abs(cx[c] - (x0 + x1) / 2))
            cell[c].append((round(ym, 1), x0, t))
        out = []
        for c in COLS:
            seq = ' '.join(t for _, _, t in sorted(cell[c])).replace('–', '-')
            for m in re.finditer(r'(\d\d)\.(\d\d)\.(?:\s*-\s*(\d\d)\.(\d\d)\.)?', seq):
                d1, m1 = int(m[1]), int(m[2])
                d2, m2 = (int(m[3]), int(m[4])) if m[3] else (d1, m1)
                yr = lambda mon: Y + 1 if c == 'Sommer' else Y if c == 'Herbst' else (Y if mon >= 8 else Y + 1) if c == 'Weihnachten' else Y + 1
                a, b = dt.date(yr(m1), m1, d1), dt.date(yr(m2), m2, d2)
                if b < a or (b - a).days > 70: raise SystemExit(f'{pdf}: unplausibel {code} {c} {a} {b}')
                out.append([a.isoformat(), b.isoformat(), name_of(c, m1)])
        if not any(r[2] == 'Sommerferien' for r in out): raise SystemExit(f'{pdf}: keine Sommerferien für {code}')
        res[code] = out
    stand = re.search(r'Stand:\s*([\d.]+)', subprocess.run(['pdftotext', pdf, '-'], capture_output=True, text=True).stdout)
    return res, stand[1] if stand else ''


def main():
    now = dt.date.today().year
    laender, jahre, stand = {c: [] for _, c in LANDS}, [], []
    with tempfile.TemporaryDirectory() as tmp:
        for Y in range(now - 1, now + 6):
            url = URL.format(a=Y, b=(Y + 1) % 100)
            pdf = os.path.join(tmp, f'{Y}.pdf')
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'blanko-ferien (github.com/burnersen/blanko)'}), timeout=60) as r:
                    data = r.read()
            except Exception as e:
                print(f'{Y}/{(Y + 1) % 100:02d}: nicht verfügbar ({e})')
                continue
            if not data.startswith(b'%PDF'): continue
            open(pdf, 'wb').write(data)
            res, st = parse(pdf, Y)
            for k, v in res.items(): laender[k].extend(v)
            jahre.append(f'{Y}/{(Y + 1) % 100:02d}')
            if st: stand.append(st)
            print(f'{Y}/{(Y + 1) % 100:02d}: gelesen, Stand {st}')
    if len(jahre) < 2: raise SystemExit('Zu wenige Schuljahre gefunden, nichts geschrieben.')
    bis = max(r[1] for v in laender.values() for r in v)
    stand_max = max(stand, key=lambda s: dt.datetime.strptime(s, '%d.%m.%Y')) if stand else ''
    data = {'quelle': 'Kultusministerkonferenz (KMK), kmk.org/service/ferien.html', 'stand': stand_max, 'jahre': jahre, 'bis': bis, 'laender': laender}
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
    old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    if old == text:
        print('Keine Änderung.')
        return
    open(OUT, 'w', encoding='utf-8').write(text)
    print(f'Geschrieben: {OUT} (Schuljahre {", ".join(jahre)}, hinterlegt bis {bis})')


if __name__ == '__main__':
    main()
