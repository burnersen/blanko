#!/usr/bin/env node
/* blanko – automatische Prüfung aller Papiere. Läuft bei jedem Push als GitHub Action (.github/workflows/pruefen.yml).
 *
 *   node tools/pruefen.js            alles prüfen
 *   node tools/pruefen.js lin-3      nur bestimmte Papiere (Komma-getrennt)
 *
 * 1. Darstellung: jedes Papier in 10 Formaten, mit jeder Auswahl, den kleinsten und größten Zahlenwerten und langen Texten.
 *    Gemeldet wird: fehlende Zeichen oder Texte, Inhalt außerhalb der Seite, Inhalt im Branding-Bereich unten,
 *    Text an der Blattkante, überlappende oder zu eng stehende Zahlen und Texte.
 * 2. Rechenblätter: 128 000 Aufgaben auf richtiges Ergebnis, Zahlenraum, Zehnerübergang, Teilen durch 0.
 * 3. Kalender: Ostern, Feiertage, Kalenderwochen, Brückentage und Mondphasen gegen bekannte Daten.
 * Endet mit Fehlercode 1, wenn etwas auffällt.
 */
'use strict';
const path = require('path'), fs = require('fs');
global.self = global;
const A = path.join(__dirname, '..', 'app', 'assets') + path.sep;
require(A + 'pdf.js'); require(A + 'papers.js');
const FJ = fs.readFileSync(A + 'ferien.json', 'utf8');
global.document = { getElementById: id => id === 'ferien' ? { textContent: FJ } : null };
require(A + 'calendar.js');
let failed = 0;

/* ===== 1. Darstellung ===== */
{

const cat = JSON.parse(fs.readFileSync(A + 'catalog.json'));
const only = process.argv[2] ? process.argv[2].split(',') : null;
const FMT = [['A4', 'h'], ['A4', 'q'], ['A5', 'h'], ['A5', 'q'], ['A5x2', 'h'], ['A5x2', 'q'], ['A3', 'h'], ['A3', 'q'], ['A6', 'h'], ['A6', 'q']];
const problems = new Map();
const note = (key, msg) => { if (!problems.has(key)) problems.set(key, new Set()); problems.get(key).add(msg); };
const ptsOf = d => { const p = []; for (const s of d) for (let i = 1; i < s.length; i += 2) p.push([s[i], s[i + 1]]); return p; };
function check(p, o, label) {
  BLPdf.warnings.length = 0;
  let doc;
  try { doc = BLPapers.build(p, o); } catch (e) { note(p.id, label + ': FEHLER ' + e.message); return; }
  for (const w of BLPdf.warnings) note(p.id, label + ': ' + w);
  doc.pages.forEach((pg, pi) => {
    let clip = 0; const boxes = [];
    for (const op of pg.ops) {
      if (op.k === 'clip') { clip++; continue; }
      if (op.k === 'unclip') { clip--; continue; }
      if (op.box) boxes.push(op);
      if (clip) continue;
      const pts = op.k === 'p' ? ptsOf(op.d) : [[op.box[0], op.box[1]], [op.box[2], op.box[3]]];
      for (const [x, y] of pts) {
        if (x < -0.3 || y < -0.3 || x > pg.w + 0.3 || y > pg.h + 0.3) { note(p.id, label + ` S${pi + 1}: außerhalb der Seite (${x.toFixed(1)}, ${y.toFixed(1)})`); break; }
        if (y > pg.h - 9 && p.id !== 'druckertest') { note(p.id, label + ` S${pi + 1}: im Branding-Bereich (y ${y.toFixed(1)} von ${pg.h})`); break; }
      }
      if (op.box && (op.box[0] < 2 || op.box[2] > pg.w - 2)) note(p.id, label + ` S${pi + 1}: Text am Rand abgeschnitten „${op.s || ''}“`);
    }
    // Überlappende Texte und Zahlen
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].box, b = boxes[j].box;
      const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      // zu eng: auf gleicher Höhe, aber kaum Abstand dazwischen
      if (oy > Math.min(a[3] - a[1], b[3] - b[1]) * .6 && ox <= 0 && ox > -Math.min(.6, (a[3] - a[1]) * .12)) note(p.id, label + ` S${pi + 1}: zu eng „${boxes[i].s || boxes[i].str || ''}“ / „${boxes[j].s || boxes[j].str || ''}“ (${(-ox).toFixed(2)} mm)`);
      if (ox <= 0 || oy <= 0) continue;
      const small = Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]));
      if (ox * oy > small * .12 && ox > .4) { note(p.id, label + ` S${pi + 1}: Überlappung „${boxes[i].s || 'Ziffern'}“ / „${boxes[j].s || 'Ziffern'}“`); }
    }
  });
}
let n = 0;
for (const p of cat.papers) {
  if (only && !only.includes(p.id)) continue;
  const base = BLPapers.options(p);
  if (p.gen === 'cal') Object.assign(base, { months: 2, weeks: 2, days: 2 });
  for (const [fmt, ori] of FMT) { check(p, { ...base, fmt, ori }, fmt + ' ' + ori); n++; }
  for (const s of BLPapers.schema(p)) {
    if (!['sel', 'seg', 'chk'].includes(s.t) || ['fmt', 'ori', 'rand', 'head'].includes(s.k) && p.gen !== 'lines' && p.gen !== 'grid') continue;
    const vals = s.t === 'chk' ? [true, false] : s.opts.map(x => typeof base[s.k] === 'number' ? +x[0] : x[0]);
    for (const v of vals) for (const ori of ['h', 'q']) {
      const o = { ...base, [s.k]: v, ori };
      if (s.show && !s.show(o)) continue;
      check(p, o, `${s.k}=${v} ${ori}`); n++;
    }
  }
  // Zahlenregler: kleinster und größter Wert, auch in A5
  for (const s of BLPapers.schema(p)) {
    if (s.t !== 'num' || ['mt', 'mb', 'ml', 'mr', 'lw', 'pages', 'year', 'randW'].includes(s.k)) continue;
    for (const v of [s.min, s.max]) for (const [fmt, ori] of [['A4', 'h'], ['A4', 'q'], ['A5', 'h']]) {
      const o = { ...base, [s.k]: v, fmt, ori };
      if (s.show && !s.show(o)) continue;
      check(p, o, `${s.k}=${v} ${fmt} ${ori}`); n++;
    }
  }
  // Ränder ganz klein und ganz groß
  for (const m of [0, 40]) { check(p, { ...base, mt: m, ml: m, mr: m, mb: Math.max(12, m) }, 'Ränder ' + m); n++; }
  // Text-Eingaben mit langem Text
  for (const s of BLPapers.schema(p)) if (s.t === 'text') { check(p, { ...base, [s.k]: 'Ein sehr langer Text, ' + 'Spiel, '.repeat(25) + 'Ende' }, s.k + '=lang'); n++; }
}
console.log('Geprüft:', n, 'Varianten');
for (const [id, set] of problems) { console.log('\n## ' + id + ' (' + set.size + ')'); [...set].slice(0, 20).forEach(m => console.log('  ' + m)); }
console.log('\nPapiere mit Auffälligkeiten:', problems.size);
if (problems.size) failed++;

}

/* ===== 2. Rechenblätter ===== */
{

const { task } = BLPapers._test, { rng } = BLPapers.helpers;
let bad = 0, total = 0;
const err = m => { if (bad++ < 15) console.log('FEHLER', m); };
for (const R of [10, 20, 100, 1000]) for (const op of ['+', '-', '*', ':']) for (const nc of [false, true]) {
  const rand = rng(R * 31 + op.charCodeAt(0) + (nc ? 7 : 0));
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const [a, o, b, c] = task(rand, op, R, nc); total++;
    seen.add(a + o + b);
    const ok = o === '+' ? a + b === c : o === '-' ? a - b === c : o === '*' ? a * b === c : b !== 0 && a === b * c;
    if (!ok) err(`${a} ${o} ${b} = ${c} falsch gerechnet`);
    if ([a, b, c].some(v => v < 0 || !Number.isInteger(v))) err(`${a} ${o} ${b} = ${c} negativ/keine ganze Zahl`);
    const big = o === '+' ? c : o === '-' ? a : o === '*' ? c : a;
    if (big > R) err(`${a} ${o} ${b} = ${c} über dem Zahlenraum ${R}`);
    if (o === '+' && a === 0 && b === 0) err('0 + 0');
    if (nc && R > 10 && o === '+' && (a % 10) + (b % 10) > 9) err(`${a} + ${b} mit Zehnerübergang`);
    if (nc && R > 10 && o === '-' && (a % 10) < (b % 10)) err(`${a} - ${b} mit Zehnerübergang`);
    if ((o === '*' || o === ':') && (a === 0 || b === 0)) err(`${a} ${o} ${b} mit 0`);
  }
}
console.log('Aufgaben geprüft:', total, 'Fehler:', bad);
if (bad) failed++;

}

/* ===== 3. Kalender ===== */
{

const C = BLCal, k = d => d.toISOString().slice(0, 10);
let calBad = 0;
const chk = (label, got, want) => { if (got !== want) { calBad++; console.log('FEHLER ' + label + ': ' + got + ' (erwartet ' + want + ')'); } };
chk('Ostern 2024', k(C.easter(2024)), '2024-03-31'); chk('Ostern 2025', k(C.easter(2025)), '2025-04-20'); chk('Ostern 2027', k(C.easter(2027)), '2027-03-28'); chk('Ostern 2038', k(C.easter(2038)), '2038-04-25');
const hs = (y, l) => [...C.holidays(y, l).entries()];
const find = (y, l, n) => (hs(y, l).find(e => e[1] === n) || [''])[0];
chk('Fronleichnam 2027 BY', find(2027, 'BY', 'Fronleichnam'), '2027-05-27');
chk('Buß- und Bettag 2026 SN', find(2026, 'SN', 'Buß- und Bettag'), '2026-11-18');
chk('Buß- und Bettag 2027 SN', find(2027, 'SN', 'Buß- und Bettag'), '2027-11-17');
chk('Himmelfahrt 2027', find(2027, 'de', 'Christi Himmelfahrt'), '2027-05-06');
chk('Feiertage bundesweit 2027', hs(2027, 'de').length, 9);
chk('Feiertage BY 2027 (mit Mariä Himmelfahrt in vielen Gemeinden)', hs(2027, 'BY').length, 13);
chk('Feiertage BE 2027', hs(2027, 'BE').length, 10);
chk('KW 1.1.2027', C.isoWeek(new Date('2027-01-01T00:00:00Z')), 53);
chk('KW 4.1.2027', C.isoWeek(new Date('2027-01-04T00:00:00Z')), 1);
chk('KW 31.12.2024', C.isoWeek(new Date('2024-12-31T00:00:00Z')), 1);
chk('Brückentag 7.5.2027 (Fr nach Himmelfahrt)', C.isBridge(new Date('2027-05-07T00:00:00Z'), 'de'), true);
chk('kein Brückentag 6.5.2027', C.isBridge(new Date('2027-05-06T00:00:00Z'), 'de'), false);
const mm = y => C.moonMap(y);
chk('Vollmond 13.1.2025', mm(2025).get('2025-01-13'), 2);
chk('Neumond 8.4.2024', mm(2024).get('2024-04-08'), 0);
chk('Vollmond 22.6.2024', mm(2024).get('2024-06-22'), 2);
chk('Neumond 29.3.2025', mm(2025).get('2025-03-29'), 0);
chk('Ferien BY Sommer 2027', C.ferienMap('BY').get('2027-08-02'), 'Sommerferien');

console.log('Kalender-Prüfungen: Fehler', calBad);
if (calBad) failed++;
}

process.exit(failed ? 1 : 0);
