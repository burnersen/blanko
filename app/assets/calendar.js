/* blanko – Kalender: Jahr, Jahresplaner, Monat, Familienplaner, Woche, Tag und Geburtstage.
   Alles wird im Browser berechnet, auch ohne Netz:
   - Feiertage aller 16 Bundesländer (Ostern nach der Gaußschen Osterformel, alles Bewegliche hängt daran)
   - Brückentage (ein Arbeitstag zwischen Feiertag und Wochenende)
   - Mondphasen (Neumond, Vollmond, Viertel; nach Meeus, auf wenige Minuten genau)
   - Schulferien aus ferien.json (offizielle Tabellen der KMK, monatlich automatisch aktualisiert)
   Meldet sich als Generator „cal“ bei papers.js an. */
(function () {
    'use strict';
    const BP = self.BLPapers, { clamp, num, light, darkC, fitText: fit } = BP.helpers;

    const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const WDL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const LANDS = [['de', 'nur bundesweite Feiertage'], ['BW', 'Baden-Württemberg'], ['BY', 'Bayern'], ['BE', 'Berlin'], ['BB', 'Brandenburg'], ['HB', 'Bremen'],
        ['HH', 'Hamburg'], ['HE', 'Hessen'], ['MV', 'Mecklenburg-Vorpommern'], ['NI', 'Niedersachsen'], ['NW', 'Nordrhein-Westfalen'], ['RP', 'Rheinland-Pfalz'],
        ['SL', 'Saarland'], ['SN', 'Sachsen'], ['ST', 'Sachsen-Anhalt'], ['SH', 'Schleswig-Holstein'], ['TH', 'Thüringen']];
    const LANDNAME = Object.fromEntries(LANDS);
    // Monatsfarben: Winter kühl, Sommer warm
    const MONTH12 = ['#4a7fc1', '#5b8def', '#3fa58a', '#5fb35a', '#8fbf3f', '#e0a52a', '#ef8a2f', '#e35d52', '#d9558f', '#b0628a', '#8a6fc4', '#3f6fb5'];

    /* ---------- Ferien (Daten von der KMK, in die Seite eingebettet) ---------- */
    let FER = { laender: {}, bis: '', stand: '' };
    try { FER = JSON.parse(document.getElementById('ferien').textContent) || FER; } catch (e) {}
    const fmtDate = iso => { const [y, m, d] = String(iso).split('-'); return y ? +d + '.' + +m + '.' + y : ''; };

    /* ---------- Datum ohne Zeitzonen-Ärger: alles in UTC ---------- */
    const D = (y, m, d) => new Date(Date.UTC(y, m, d));
    const key = d => d.toISOString().slice(0, 10);
    const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
    const wd = d => (d.getUTCDay() + 6) % 7;   // Montag = 0
    const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    function isoWeek(dt) {
        const d = D(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
        d.setUTCDate(d.getUTCDate() + 3 - wd(d));
        const y0 = D(d.getUTCFullYear(), 0, 4);
        return 1 + Math.round(((d - y0) / 864e5 - 3 + wd(y0)) / 7);
    }
    function easter(y) {
        const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        return D(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
    }

    /* ---------- Feiertage nach Bundesland ---------- */
    const holCache = new Map();
    function holidays(y, land) {
        const ck = y + land;
        if (holCache.has(ck)) return holCache.get(ck);
        const map = new Map(), in_ = list => list.includes(land);
        const add = (d, n) => map.set(key(d), n);
        const E = easter(y);
        add(D(y, 0, 1), 'Neujahr');
        if (in_(['BW', 'BY', 'ST'])) add(D(y, 0, 6), 'Heilige Drei Könige');
        if ((land === 'BE' && y >= 2019) || (land === 'MV' && y >= 2023)) add(D(y, 2, 8), 'Internationaler Frauentag');
        add(addDays(E, -2), 'Karfreitag');
        if (land === 'BB') add(E, 'Ostersonntag');
        add(addDays(E, 1), 'Ostermontag');
        add(D(y, 4, 1), 'Tag der Arbeit');
        add(addDays(E, 39), 'Christi Himmelfahrt');
        if (land === 'BB') add(addDays(E, 49), 'Pfingstsonntag');
        add(addDays(E, 50), 'Pfingstmontag');
        if (in_(['BW', 'BY', 'HE', 'NW', 'RP', 'SL'])) add(addDays(E, 60), 'Fronleichnam');
        if (land === 'SL') add(D(y, 7, 15), 'Mariä Himmelfahrt');
        if (land === 'BY') add(D(y, 7, 15), 'Mariä Himmelfahrt (in vielen Gemeinden)');
        if (land === 'TH' && y >= 2019) add(D(y, 8, 20), 'Weltkindertag');
        add(D(y, 9, 3), 'Tag der Deutschen Einheit');
        if (in_(['BB', 'MV', 'SN', 'ST', 'TH']) || (in_(['HB', 'HH', 'NI', 'SH']) && y >= 2018) || y === 2017) add(D(y, 9, 31), 'Reformationstag');
        if (in_(['BW', 'BY', 'NW', 'RP', 'SL'])) add(D(y, 10, 1), 'Allerheiligen');
        if (land === 'SN') { const d = D(y, 10, 22); add(addDays(d, -((wd(d) - 2 + 7) % 7)), 'Buß- und Bettag'); }
        add(D(y, 11, 25), '1. Weihnachtstag');
        add(D(y, 11, 26), '2. Weihnachtstag');
        holCache.set(ck, map);
        return map;
    }
    const holName = (d, land) => holidays(d.getUTCFullYear(), land).get(key(d)) || null;
    const isOff = (d, land) => wd(d) >= 5 || !!holName(d, land);
    /** Brückentag: Arbeitstag zwischen zwei freien Tagen, davon mindestens einer ein Feiertag */
    function isBridge(d, land) {
        if (isOff(d, land)) return false;
        const a = addDays(d, -1), b = addDays(d, 1);
        return isOff(a, land) && isOff(b, land) && (!!holName(a, land) || !!holName(b, land));
    }

    /* ---------- Schulferien ---------- */
    const ferCache = new Map();
    function ferienMap(land) {
        if (ferCache.has(land)) return ferCache.get(land);
        const map = new Map();
        for (const [a, b, n] of (FER.laender && FER.laender[land]) || []) {
            for (let d = new Date(a + 'T00:00:00Z'), e = new Date(b + 'T00:00:00Z'); d <= e; d = addDays(d, 1)) map.set(key(d), n);
        }
        ferCache.set(land, map);
        return map;
    }

    /* ---------- Mondphasen nach Meeus (Kapitel 49), Ergebnis als deutsches Datum ---------- */
    const rad = x => x * Math.PI / 180;
    function phaseJDE(k, ph) {
        const T = (k + ph / 4) / 1236.85, K = k + ph / 4;
        let jde = 2451550.09766 + 29.530588861 * K + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
        const E = 1 - 0.002516 * T - 0.0000074 * T * T;
        const M = rad(2.5534 + 29.1053567 * K - 0.0000014 * T * T), Mp = rad(201.5643 + 385.81693528 * K + 0.0107582 * T * T + 0.00001238 * T ** 3);
        const F = rad(160.7108 + 390.67050284 * K - 0.0016118 * T * T), Om = rad(124.7746 - 1.56375588 * K + 0.0020672 * T * T);
        const s = Math.sin, c = Math.cos;
        if (ph === 0 || ph === 2) {
            const n = ph === 0;
            jde += (n ? -0.4072 : -0.40614) * s(Mp) + (n ? 0.17241 : 0.17302) * E * s(M) + (n ? 0.01608 : 0.01614) * s(2 * Mp) + (n ? 0.01039 : 0.01043) * s(2 * F)
                + (n ? 0.00739 : 0.00734) * E * s(Mp - M) - (n ? 0.00514 : 0.00515) * E * s(Mp + M) + (n ? 0.00208 : 0.00209) * E * E * s(2 * M)
                - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F)
                + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om);
        } else {
            jde += -0.62801 * s(Mp) + 0.17172 * E * s(M) - 0.01183 * E * s(Mp + M) + 0.00862 * s(2 * Mp) + 0.00804 * s(2 * F) + 0.00454 * E * s(Mp - M)
                + 0.00204 * E * E * s(2 * M) - 0.0018 * s(Mp - 2 * F) - 0.0007 * s(Mp + 2 * F) - 0.0004 * s(3 * Mp) - 0.00034 * E * s(2 * Mp - M)
                + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F) - 0.00028 * E * E * s(Mp + 2 * M) + 0.00027 * E * s(2 * Mp + M) - 0.00017 * s(Om);
            const W = 0.00306 - 0.00038 * E * c(M) + 0.00026 * c(Mp) - 0.00002 * c(Mp - M) + 0.00002 * c(Mp + M) + 0.00002 * c(2 * F);
            jde += ph === 1 ? W : -W;
        }
        return jde;
    }
    /** Deutsche Zeit: MEZ, im Sommer MESZ (letzter Sonntag im März bis letzter Sonntag im Oktober, je 1 Uhr UTC) */
    function germanDay(ms) {
        const y = new Date(ms).getUTCFullYear();
        const lastSun = m => { const d = D(y, m + 1, 0); return addDays(d, -((d.getUTCDay() + 7) % 7)).getTime() + 36e5; };
        const off = ms >= lastSun(2) && ms < lastSun(9) ? 2 : 1;
        return key(new Date(ms + off * 36e5));
    }
    const moonCache = new Map();
    function moonMap(y) {
        if (moonCache.has(y)) return moonCache.get(y);
        const map = new Map(), k0 = Math.floor((y - 2000 - .1) * 12.3685);
        for (let k = k0; k < k0 + 16; k++) {
            for (let ph = 0; ph < 4; ph++) {
                const ms = (phaseJDE(k, ph) - 2440587.5) * 864e5 - 69e3;   // ΔT etwa 69 s
                map.set(germanDay(ms), ph);
            }
        }
        moonCache.set(y, map);
        return map;
    }
    const moonOf = d => moonMap(d.getUTCFullYear()).get(key(d));

    /* ---------- Was ist an einem Tag los? ---------- */
    function info(d, o) {
        const land = o.land || 'de';
        const hol = o.hol ? holName(d, land) : null;
        return {
            d, hol, we: wd(d) >= 5,
            bridge: o.bridge && !hol ? isBridge(d, land) : false,
            fer: o.fer && land !== 'de' ? ferienMap(land).get(key(d)) || null : null,
            moon: o.moon ? moonOf(d) : undefined,
        };
    }

    /* ---------- Zeichnen ---------- */
    const monthColor = (m, o) => o.scheme === 'one' ? o.cMain : o.scheme === 'gray' ? '#5f6670' : o.scheme === 'bw' ? '#222222' : MONTH12[m % 12];
    function header(P, x, y, w, h, text, col, o, al, size) {
        const T = fit(P, text, w - (al === 'l' ? h * .7 : 3), size || Math.min(h * .62, 9), true, 1.8);
        const fs = T.s;
        text = T.t;
        if (o.headStyle === 'band') {
            P.rect(x, y, w, h, { fill: col, r: o.shape === 'square' || o.shape === 'plain' ? 0 : Math.min(2.5, h / 3) });
            P.text(al === 'l' ? x + h * .35 : x + w / 2, y + h / 2 + fs * .36, text, { s: fs, b: true, al: al || 'c', c: '#ffffff' });
        } else if (o.headStyle === 'frame') {
            P.rect(x, y, w, h, { c: col, w: .5, r: o.shape === 'square' || o.shape === 'plain' ? 0 : Math.min(2.5, h / 3) });
            P.text(al === 'l' ? x + h * .35 : x + w / 2, y + h / 2 + fs * .36, text, { s: fs, b: true, al: al || 'c', c: col });
        } else {
            P.text(al === 'l' ? x : x + w / 2, y + h / 2 + fs * .36, text, { s: fs, b: true, al: al || 'c', c: col });
            P.line(x, y + h - .3, x + w, y + h - .3, { w: .5, c: col });
        }
    }
    /** Hintergrund eines Tages in der gewählten Form */
    function mark(P, x, y, w, h, fill, o, line) {
        if (!fill) return;
        if (o.shape === 'circle') { const r = Math.min(w, h) * .46; P.circle(x + w / 2, y + h / 2, r, { fill }); }
        else if (o.shape === 'round') P.rect(x + .3, y + .3, w - .6, h - .6, { fill, r: Math.min(w, h) * .28 });
        else if (o.shape === 'plain') { if (line) P.rect(x, y + h - .9, w, .9, { fill: darkC(fill, .15) }); }
        else P.rect(x, y, w, h, { fill });
    }
    /** Farbe für einen Tag: Feiertag vor Brückentag vor Ferien vor Wochenende */
    function dayFill(I, o) {
        if (I.hol) return light(o.cHol, .78);
        if (I.bridge) return o.cBridge;
        if (I.fer) return o.cFer;
        if (I.we) return o.cWe;
        return null;
    }
    const dayInk = (I, o) => I.hol ? o.cHol : I.we ? '#555555' : '#222222';
    function num2(P, x, y, s, h, o, al, c) {
        if (o.font === 'school') P.digits(x, y, s, { h, al, c, w: h * .1 });
        else P.text(x, y, s, { s: h * 1.4, al, c, b: false });
    }
    function moonIcon(P, cx, cy, r, ph) {
        if (ph == null) return;
        const st = { w: Math.max(.15, r * .18), c: '#444444' };
        if (ph === 0) P.circle(cx, cy, r, { fill: '#444444' });
        else if (ph === 2) P.circle(cx, cy, r, { ...st, fill: '#ffffff' });
        else {
            P.circle(cx, cy, r, { ...st, fill: '#ffffff' });
            const a = BLPdf.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);   // rechte Hälfte (zunehmend)
            if (ph === 3) a.forEach(s => { for (let i = 1; i < s.length; i += 2) s[i] = 2 * cx - s[i]; });
            P.path([...a, ['Z']], { fill: '#444444' });
        }
    }

    /** Ein kleiner Monat (für den Jahreskalender) */
    function miniMonth(P, X, Y, W, H, y, m, o) {
        const col = monthColor(m, o), hh = Math.min(7, H * .14);
        header(P, X, Y, W, hh, MONTHS[m] + (o._showYear ? ' ' + y : ''), col, o, 'c', Math.min(hh * .6, 4.2));
        const kw = o.kw ? 1 : 0, cw = W / (7 + kw * .8), x0 = X + kw * cw * .8;
        const rh = (H - hh - 1) / 7, ty = Y + hh + 1;
        WD.forEach((t, i) => P.text(x0 + i * cw + cw / 2, ty + rh * .72, t, { s: Math.min(rh * .55, 2.8), al: 'c', b: true, c: i >= 5 ? darkC(col, .1) : '#666666' }));
        const first = D(y, m, 1), off = wd(first), n = dim(y, m), fs = Math.min(rh * .42, cw * .3);
        for (let i = 0; i < n; i++) {
            const d = addDays(first, i), r = Math.floor((off + i) / 7), c = (off + i) % 7, I = info(d, o);
            const x = x0 + c * cw, yy = ty + rh * (r + 1);
            mark(P, x + .15, yy + .15, cw - .3, rh - .3, dayFill(I, o), o, !!I.fer);
            if (I.bridge && o.shape !== 'plain') P.rect(x + .5, yy + .5, cw - 1, rh - 1, { c: darkC(o.cBridge, .35), w: .25, dash: [.6, .5], r: o.shape === 'round' ? rh * .25 : 0 });
            num2(P, x + cw / 2, yy + rh / 2 + fs * .5, String(i + 1), fs, o, 'c', dayInk(I, o));
            if (I.moon != null) moonIcon(P, x + cw - cw * .14, yy + rh * .2, Math.min(cw, rh) * .1, I.moon);
            if (kw && (c === 0 || i === 0)) P.text(X + cw * .4, yy + rh / 2 + fs * .32, String(isoWeek(d)), { s: fs * .7, al: 'c', c: '#9aa0a8' });
        }
    }

    /** Legende: Farben und Liste der Feiertage */
    function legend(P0, A, y0, years, o, dry) {
        // dry: nur ausmessen, nichts zeichnen
        const P = dry ? new Proxy(P0, { get: (t, k) => k === 'text' || k === 'rect' || k === 'circle' || k === 'path' ? () => P : t[k] }) : P0;
        const land = o.land || 'de', items = [];
        if (o.hol) items.push([light(o.cHol, .78), 'Feiertag']);
        if (o.bridge) items.push([o.cBridge, 'Brückentag']);
        if (o.fer && land !== 'de') items.push([o.cFer, 'Schulferien']);
        items.push([o.cWe, 'Wochenende']);
        let x = A.x0, y = y0 + 3;
        const chip = (w, drawIt) => { if (x + w > A.x1 && x > A.x0) { x = A.x0; y += 4.2; } drawIt(x); x += w; };
        for (const [c, t] of items) chip(8 + P.textWidth(t, 2.6), x => { P.rect(x, y - 2.4, 3.2, 3.2, { fill: c, r: o.shape === 'circle' ? 1.6 : o.shape === 'round' ? .8 : 0 }); P.text(x + 4.4, y, t, { s: 2.6, c: '#444444' }); });
        if (o.moon) for (const [ph, t] of [[0, 'Neumond'], [2, 'Vollmond']]) chip(8 + P.textWidth(t, 2.6), x => { moonIcon(P, x + 1.6, y - .8, 1.4, ph); P.text(x + 4.4, y, t, { s: 2.6, c: '#444444' }); });
        const note = land === 'de' ? 'Bundesweite Feiertage' : 'Feiertage ' + LANDNAME[land];
        if (x + P.textWidth(note, 2.4) + 4 <= A.x1) P.text(A.x1, y, note, { s: 2.4, al: 'r', c: '#777777' });
        y += 4.6;
        if (o.hol && o.legend) {
            const parts = [];
            for (const yy of years) for (const [k, n] of holidays(yy, land)) {
                const d = new Date(k + 'T00:00:00Z');
                if (o._range && (d < o._range[0] || d > o._range[1])) continue;
                parts.push(d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.' + (years.length > 1 ? String(yy).slice(2) : '') + ' ' + n);
            }
            let line = '';
            for (const p of parts) {
                const t = line ? line + '  ·  ' + p : p;
                if (P.textWidth(t, 2.5) > A.w) { P.text(A.x0, y, line, { s: 2.5, c: '#333333' }); y += 3.4; line = p; } else line = t;
            }
            if (line) { P.text(A.x0, y, line, { s: 2.5, c: '#333333' }); y += 3.4; }
        }
        if (o.fer && land !== 'de') {
            const last = years[years.length - 1];
            const txt = FER.bis ? 'Schulferien ' + LANDNAME[land] + ' laut Kultusministerkonferenz (Stand ' + FER.stand + '), hinterlegt bis ' + fmtDate(FER.bis) + '.'
                + (FER.bis < last + '-12-31' ? ' Spätere Ferien sind noch nicht veröffentlicht.' : '') : 'Keine Schulferien hinterlegt.';
            for (const l of BP.helpers.wrap(P, txt, A.w, 2.3)) { P.text(A.x0, y, l, { s: 2.3, c: '#777777' }); y += 3.1; }
        }
        return y;
    }
    const legendH = (P, A, years, o) => legend(P, A, 0, years, o, true) + 1;

    /** Titel oben: eigener Titel aus „Überschrift“ oder automatisch */
    function title(P, A, text, o, col) {
        const t = o.title ? null : text;   // eigener Titel wird schon von area() gesetzt
        if (!t) return A.y0;
        const T = fit(P, t, A.w, 9, true, 4);
        P.text(A.x0, A.y0 + 7.5, T.t, { s: T.s, b: true, c: col || '#222222' });
        return A.y0 + 12;
    }

    /* ---------- Die Kalenderarten ---------- */
    function drawYear(P, A, o, pi) {
        const y = +o.year + pi, sm = (+o.startMonth || 1) - 1;
        const label = sm === 7 ? 'Schuljahr ' + y + '/' + String(y + 1).slice(2) : sm === 0 ? 'Kalender ' + y : y + '/' + String(y + 1).slice(2);
        let top = title(P, A, label, o, o.scheme === 'one' ? o.cMain : '#222222');
        const lh = legendH(P, A, sm ? [y, y + 1] : [y], { ...o, _range: [D(y, sm, 1), D(y + 1, sm, 0)] });
        const q = A.w > A.h, cols = q ? 4 : 3, rows = 12 / cols, gx = 5, gy = 4;
        const W = (A.w - (cols - 1) * gx) / cols, H = (A.y1 - lh - top - (rows - 1) * gy) / rows;
        o._showYear = sm !== 0;
        for (let i = 0; i < 12; i++) {
            const mm = (sm + i) % 12, yy = y + Math.floor((sm + i) / 12);
            miniMonth(P, A.x0 + (i % cols) * (W + gx), top + Math.floor(i / cols) * (H + gy), W, H, yy, mm, o);
        }
        o._range = [D(y, sm, 1), D(y + Math.floor((sm + 11) / 12), (sm + 11) % 12, dim(y + Math.floor((sm + 11) / 12), (sm + 11) % 12))];
        legend(P, A, A.y1 - lh + 1, sm ? [y, y + 1] : [y], o);
        o._range = null;
    }

    function drawPlanner(P, A, o, pi) {
        const per = +o.plannerRows === 6 ? 6 : 12, sm = (+o.startMonth || 1) - 1, y = +o.year;
        const start = sm + pi * per;
        const label = 'Jahresplaner ' + (sm === 0 && per === 12 ? y : y + '/' + String(y + 1).slice(2));
        let top = title(P, A, label, o, o.scheme === 'one' ? o.cMain : '#222222');
        const lh = legendH(P, A, [y, y + 1], { ...o, _range: [D(y + Math.floor(start / 12), start % 12, 1), D(y + Math.floor((start + per) / 12), (start + per) % 12, 0)] }), lab = 20, cw = (A.w - lab) / 31, hh = 5;
        const rh = (A.y1 - lh - top - hh) / per;
        for (let d = 1; d <= 31; d++) P.text(A.x0 + lab + (d - .5) * cw, top + 3.6, String(d), { s: Math.min(2.8, cw * .5), al: 'c', b: true, c: '#555555' });
        const years = new Set();
        for (let r = 0; r < per; r++) {
            const mm = (start + r) % 12, yy = y + Math.floor((start + r) / 12), yt = top + hh + r * rh, col = monthColor(mm, o);
            years.add(yy);
            header(P, A.x0, yt + .4, lab - 1.5, rh - .8, MONTHS[mm].slice(0, 3) + ' ' + String(yy).slice(2), col, o, 'l', Math.min(3.4, rh * .4));
            for (let d = 1; d <= 31; d++) {
                const x = A.x0 + lab + (d - 1) * cw;
                if (d > dim(yy, mm)) { P.rect(x, yt, cw, rh, { fill: '#f1f1f1' }); continue; }
                const I = info(D(yy, mm, d), o);
                mark(P, x + .15, yt + .15, cw - .3, rh - .3, dayFill(I, o), o, !!I.fer);
                if (I.bridge && o.shape !== 'plain') P.rect(x + .4, yt + .4, cw - .8, rh - .8, { c: darkC(o.cBridge, .35), w: .25, dash: [.6, .5] });
                P.text(x + cw / 2, yt + Math.min(3.4, rh * .4), WD[wd(I.d)], { s: Math.min(2.2, cw * .38, rh * .3), al: 'c', c: I.hol ? o.cHol : '#888888', b: !!I.hol });
                if (I.moon != null && rh > 7) moonIcon(P, x + cw / 2, yt + rh - 1.8, Math.min(cw * .18, 1.1), I.moon);
            }
        }
        const L = [];
        for (let r = 0; r <= per; r++) L.push([A.x0 + lab, top + hh + r * rh, A.x1, top + hh + r * rh]);
        for (let d = 0; d <= 31; d++) L.push([A.x0 + lab + d * cw, top + hh, A.x0 + lab + d * cw, top + hh + per * rh]);
        P.lines(L, { w: .2, c: o.lc });
        const yS = y + Math.floor(start / 12), yE = y + Math.floor((start + per - 1) / 12), mE = (start + per - 1) % 12;
        o._range = [D(yS, start % 12, 1), D(yE, mE, dim(yE, mE))];
        legend(P, A, A.y1 - lh + 1, [...years].sort(), o);
        o._range = null;
    }

    function drawMonth(P, A, o, pi) {
        const sm = (+o.startMonth || 1) - 1 + pi, y = +o.year + Math.floor(sm / 12), m = sm % 12, col = monthColor(m, o);
        let top = A.y0;
        const pic = clamp(num(o.pic, 0), 0, 70);
        if (pic > 0) {
            const ph = A.h * pic / 100;
            P.rect(A.x0, top, A.w, ph - 4, { c: col, w: .5, r: o.shape === 'square' ? 0 : 3 });
            P.text(A.x0 + 3, top + 6, 'Mein Bild für den ' + MONTHS[m], { s: 3.2, c: '#9a9a9a' });
            top += ph;
        }
        const hh = 12;
        header(P, A.x0, top, A.w, hh, o.title ? o.title + ' · ' + MONTHS[m] + ' ' + y : MONTHS[m] + ' ' + y, col, o, 'c', 7);
        top += hh + 1.5;
        const notesH = o.notes ? Math.min(30, A.h * .14) : 0, lh = o.hol && o.legend ? 0 : 0;
        const kw = o.kw ? 6 : 0, cw = (A.w - kw) / 7, first = D(y, m, 1), off = wd(first), n = dim(y, m);
        const rows = Math.ceil((off + n) / 7), wh = 5.5, rh = (A.y1 - notesH - lh - top - wh) / rows;
        WD.forEach((t, i) => P.text(A.x0 + kw + i * cw + cw / 2, top + 4, WDL[i].slice(0, cw > 24 ? 10 : 2), { s: 3, al: 'c', b: true, c: i >= 5 ? col : '#555555' }));
        const gy = top + wh, L = [];
        for (let i = 0; i < n; i++) {
            const d = addDays(first, i), r = Math.floor((off + i) / 7), c = (off + i) % 7, I = info(d, o);
            const x = A.x0 + kw + c * cw, yy = gy + r * rh;
            const fill = dayFill(I, o), fs = Math.min(5.5, rh * .22);
            if (o.shape === 'circle') {
                // Kreis um die Zahl, die Zahl steht mittig darin
                const r = fs * 1.15, cx = x + 1.2 + r, cy = yy + 1.2 + r;
                if (fill) P.circle(cx, cy, r, { fill });
                num2(P, cx, cy + fs * .5, String(i + 1), fs, o, 'c', dayInk(I, o));
            } else {
                if (fill) mark(P, x, yy, cw, rh, fill, o, !!I.fer);
                num2(P, x + 2, yy + fs * 1.25, String(i + 1), fs, o, 'l', dayInk(I, o));
            }
            let ty = yy + rh - 1.6;
            const small = (t, c) => { const T = fit(P, t, cw - 3, Math.min(2.5, cw * .11), false, 1.6); P.text(x + 1.6, ty, T.t, { s: T.s, c }); ty -= 3; };
            if (I.hol && o.holNames) small(I.hol, darkC(o.cHol, .1));
            if (I.bridge) small('Brückentag', darkC(o.cBridge, .5));
            if (I.fer && (i === 0 || !info(addDays(d, -1), o).fer || c === 0)) small(I.fer, '#8a6d1a');
            if (I.moon != null) moonIcon(P, x + cw - 3, yy + 3, 1.5, I.moon);
            if (kw && (c === 0 || i === 0)) P.text(A.x0 + kw / 2, yy + 4.2, String(isoWeek(d)), { s: 2.4, al: 'c', c: '#9aa0a8' });
        }
        for (let r = 0; r <= rows; r++) L.push([A.x0 + kw, gy + r * rh, A.x1, gy + r * rh]);
        for (let c = 0; c <= 7; c++) L.push([A.x0 + kw + c * cw, gy, A.x0 + kw + c * cw, gy + rows * rh]);
        P.lines(L, { w: .25, c: o.lc });
        if (kw) P.text(A.x0 + kw / 2, gy - 1.5, 'KW', { s: 2.2, al: 'c', c: '#9aa0a8' });
        if (notesH) {
            const ny = A.y1 - notesH + 4;
            P.text(A.x0, ny, 'Notizen', { s: 3.2, b: true, c: col });
            const NL = [];
            for (let yy = ny + 7; yy <= A.y1; yy += 7) NL.push([A.x0, yy, A.x1, yy]);
            P.lines(NL, { w: .2, c: o.lc });
        }
    }

    function drawFamily(P, A, o, pi) {
        const sm = (+o.startMonth || 1) - 1 + pi, y = +o.year + Math.floor(sm / 12), m = sm % 12, col = monthColor(m, o);
        const names = String(o.names || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
        if (!names.length) names.push('');
        const hh = 11;
        header(P, A.x0, A.y0, A.w, hh, (o.title || 'Familienplaner') + ' · ' + MONTHS[m] + ' ' + y, col, o, 'c', 6.5);
        const top = A.y0 + hh + 2, dw = Math.min(34, A.w * .2), nw = (A.w - dw) / names.length, nh = 7, n = dim(y, m);
        const rh = (A.y1 - top - nh) / n;
        names.forEach((t, i) => {
            const c = o.scheme === 'rainbow' ? MONTH12[(m + i * 3) % 12] : col;
            P.rect(A.x0 + dw + i * nw + .4, top, nw - .8, nh, { fill: light(c, .7), r: o.shape === 'square' || o.shape === 'plain' ? 0 : 1.5 });
            if (t) { const T = fit(P, t, nw - 2, Math.min(4, nh * .55), true, 1.8); P.text(A.x0 + dw + i * nw + nw / 2, top + nh * .68, T.t, { s: T.s, b: true, al: 'c', c: darkC(c, .45) }); }
        });
        const L = [], fs = Math.min(3.2, rh * .55);
        for (let i = 0; i < n; i++) {
            const d = D(y, m, i + 1), I = info(d, o), yy = top + nh + i * rh;
            const fill = dayFill(I, o);
            if (fill) P.rect(A.x0, yy, A.w, rh, { fill: o.shape === 'plain' ? '#ffffff' : fill });
            P.text(A.x0 + 1.5, yy + rh / 2 + fs * .36, WD[wd(d)] + ' ' + (i + 1) + '.', { s: fs, b: true, c: dayInk(I, o) });
            const extra = I.hol || (I.bridge ? 'Brückentag' : '') || (I.fer && (i === 0 || !info(addDays(d, -1), o).fer) ? I.fer : '');
            if (extra) {
                const ex = A.x0 + 1.5 + P.textWidth(WD[wd(d)] + ' 30.', fs, true) + 1.5, T = fit(P, extra, A.x0 + dw - (o.moon ? 5 : 1) - ex, Math.min(2.2, fs * .75), false, 1.4);
                P.text(ex, yy + rh / 2 + fs * .3, T.t, { s: T.s, c: I.hol ? o.cHol : '#777777' });
            }
            if (I.moon != null) moonIcon(P, A.x0 + dw - 2.5, yy + rh / 2, Math.min(1.3, rh * .25), I.moon);
            L.push([A.x0, yy + rh, A.x1, yy + rh]);
        }
        for (let i = 0; i <= names.length; i++) L.push([A.x0 + dw + i * nw, top + nh, A.x0 + dw + i * nw, top + nh + n * rh]);
        L.push([A.x0, top + nh, A.x1, top + nh], [A.x0, top + nh, A.x0, top + nh + n * rh], [A.x1, top + nh, A.x1, top + nh + n * rh]);
        P.lines(L, { w: .25, c: o.lc });
    }

    function startDate(o) {
        const y = +o.year, m = (+o.startMonth || 1) - 1;
        return D(y, m, clamp(Math.round(num(o.startDay, 1)), 1, dim(y, m)));
    }
    function dayHead(P, x, y, w, h, d, o, long) {
        const I = info(d, o), col = monthColor(d.getUTCMonth(), o);
        const t = (long ? WDL[wd(d)] + ', ' : WD[wd(d)] + ' ') + d.getUTCDate() + '. ' + (long ? MONTHS[d.getUTCMonth()] : MONTHS[d.getUTCMonth()].slice(0, 3) + '.');
        header(P, x, y, w, h, t, I.hol ? o.cHol : I.we ? darkC(col, .15) : col, o, 'l', Math.min(h * .55, 4.2));
        const sub = I.hol || (I.bridge ? 'Brückentag' : '') || I.fer || '';
        return { I, sub };
    }
    function drawWeek(P, A, o, pi) {
        const s0 = startDate(o), mon = addDays(s0, -wd(s0) + pi * 7), sun = addDays(mon, 6);
        const col = monthColor(mon.getUTCMonth(), o);
        const head = (o.title ? o.title + ' · ' : '') + 'KW ' + isoWeek(mon) + ' · ' + mon.getUTCDate() + '. ' + MONTHS[mon.getUTCMonth()] + (mon.getUTCFullYear() !== sun.getUTCFullYear() ? ' ' + mon.getUTCFullYear() : '') + ' bis ' + sun.getUTCDate() + '. ' + MONTHS[sun.getUTCMonth()] + ' ' + sun.getUTCFullYear();
        const HT = fit(P, head, A.w, 6, true, 3);
        P.text(A.x0, A.y0 + 7, HT.t, { s: HT.s, b: true, c: o.scheme === 'bw' ? '#222222' : darkC(col, .1) });
        const top = A.y0 + 11, H = A.y1 - top, lay = o.weekLayout;
        const sub = (x, y, w, t) => { if (t) { const T = fit(P, t, w - 2, 2.5, false, 1.5); P.text(x, y, T.t, { s: T.s, c: '#777777' }); } };
        if (lay === 'columns') {
            const hf = clamp(Math.round(num(o.hFrom, 7)), 0, 23), ht = clamp(Math.round(num(o.hTo, 20)), hf + 1, 24), lab = 8, cw = (A.w - lab) / 7, hh = 9, rows = ht - hf, rh = (H - hh - 4) / rows;
            for (let i = 0; i < 7; i++) {
                const d = addDays(mon, i), { I, sub: s } = dayHead(P, A.x0 + lab + i * cw + .4, top, cw - .8, hh, d, o);
                const f = dayFill(I, o);
                if (f && o.shape !== 'plain') P.rect(A.x0 + lab + i * cw, top + hh + 4, cw, rows * rh, { fill: light(f, .4) });
                sub(A.x0 + lab + i * cw + 1, top + hh + 3, cw, s);
                if (I.moon != null) moonIcon(P, A.x0 + lab + (i + 1) * cw - 3, top + hh + 2, 1.2, I.moon);
            }
            const L = [], LD = [];
            for (let r = 0; r <= rows; r++) {
                const yy = top + hh + 4 + r * rh;
                L.push([A.x0 + lab, yy, A.x1, yy]);
                if (r < rows) { LD.push([A.x0 + lab, yy + rh / 2, A.x1, yy + rh / 2]); P.text(A.x0 + lab - 1, yy + 2.6, String(hf + r), { s: 2.6, al: 'r', c: '#888888' }); }
            }
            for (let i = 0; i <= 7; i++) L.push([A.x0 + lab + i * cw, top + hh + 4, A.x0 + lab + i * cw, top + hh + 4 + rows * rh]);
            P.lines(L, { w: .25, c: o.lc }).lines(LD, { w: .15, c: o.lc, dash: [.8, .8] });
            return;
        }
        // Blöcke: 2 Spalten mit je 4 Feldern (7 Tage und Notizen) oder 7 Zeilen
        const blocks = lay === 'rows' ? 7 : 8, cols = lay === 'rows' ? 1 : 2, per = Math.ceil(blocks / cols), gx = 5, gy = 3;
        const bw = (A.w - (cols - 1) * gx) / cols, bh = (H - (per - 1) * gy) / per;
        for (let b = 0; b < blocks; b++) {
            const x = A.x0 + Math.floor(b / per) * (bw + gx), y = top + (b % per) * (bh + gy), hh = Math.min(8, bh * .25);
            if (b === 7) {
                header(P, x, y, bw, hh, 'Notizen', '#888888', o, 'l', Math.min(hh * .55, 4.2));
            } else {
                const d = addDays(mon, b), { I, sub: s } = dayHead(P, x, y, bw, hh, d, o);
                const f = dayFill(I, o);
                if (f && o.shape !== 'plain') P.rect(x, y + hh, bw, bh - hh, { fill: light(f, .45) });
                if (s) { const T = fit(P, s, bw - 3, 2.5, false, 1.5); P.text(x + bw - 1.5, y + hh + 3, T.t, { s: T.s, al: 'r', c: I.hol ? o.cHol : '#777777' }); }
                if (I.moon != null) moonIcon(P, x + bw - 3, y + hh / 2, 1.3, I.moon);
            }
            const L = [];
            for (let yy = y + hh + 7; yy < y + bh - .5; yy += 7) L.push([x, yy, x + bw, yy]);
            P.lines(L, { w: .2, c: o.lc });
            P.rect(x, y, bw, bh, { w: .3, c: o.lc, r: o.shape === 'round' || o.shape === 'circle' ? 2 : 0 });
        }
    }

    function drawDay(P, A, o, pi) {
        const d = addDays(startDate(o), pi), I = info(d, o), col = I.hol ? o.cHol : monthColor(d.getUTCMonth(), o);
        const hh = 13;
        const dTitle = WDL[wd(d)] + ', ' + d.getUTCDate() + '. ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
        const sub = [o.kw ? 'KW ' + isoWeek(d) : '', I.hol || '', I.bridge ? 'Brückentag' : '', I.fer || ''].filter(Boolean).join('  ·  ');
        // Titel links (höchstens 60 % der Breite, wenn rechts noch etwas steht), Zusatz rechts im Rest
        const TT = fit(P, dTitle, (sub ? A.w * .6 : A.w) - hh * .7, 6.5, true, 3);
        header(P, A.x0, A.y0, A.w, hh, TT.t, col, o, 'l', TT.s);
        if (sub) {
            const used = P.textWidth(TT.t, TT.s, true) + hh * .35 + 5;
            const T = fit(P, sub, A.w - used - 3, 3, false, 1.6);
            P.text(A.x1 - 2, A.y0 + hh / 2 + 1.2, T.t, { s: T.s, al: 'r', c: o.headStyle === 'band' ? '#ffffff' : '#666666' });
        }
        if (I.moon != null) moonIcon(P, A.x1 - 3, A.y0 + hh + 4, 2, I.moon);
        const top = A.y0 + hh + 5, lw = A.w * .58, rx = A.x0 + lw + 6, rw = A.w - lw - 6;
        const hf = clamp(Math.round(num(o.hFrom, 7)), 0, 23), ht = clamp(Math.round(num(o.hTo, 20)), hf + 1, 24), rows = ht - hf, rh = (A.y1 - top) / rows;
        const L = [], LD = [];
        for (let r = 0; r <= rows; r++) {
            const y = top + r * rh;
            L.push([A.x0 + 9, y, A.x0 + lw, y]);
            if (r < rows) { LD.push([A.x0 + 9, y + rh / 2, A.x0 + lw, y + rh / 2]); P.text(A.x0 + 7.5, y + 3.2, String(hf + r).padStart(2, '0') + ':00', { s: 2.6, al: 'r', c: '#888888' }); }
        }
        P.lines(L, { w: .25, c: o.lc }).lines(LD, { w: .15, c: o.lc, dash: [.8, .8] });
        const box = (y, h, t, check) => {
            header(P, rx, y, rw, 7, t, col, o, 'l', 3.8);
            const B = [];
            for (let yy = y + 15; yy < y + h; yy += 8) {
                B.push([rx + (check ? 6 : 0), yy, rx + rw, yy]);
                if (check) P.rect(rx + .5, yy - 4, 3.6, 3.6, { c: o.lc, w: .3, r: o.shape === 'round' || o.shape === 'circle' ? .8 : 0 });
            }
            P.lines(B, { w: .2, c: o.lc });
        };
        const H = A.y1 - top;
        box(top, H * .55, 'Wichtig heute', true);
        box(top + H * .55 + 4, H * .45 - 4, 'Notizen', false);
    }

    function drawBirthday(P, A, o, pi) {
        if (o.bStyle === 'days') {
            const m = ((+o.startMonth || 1) - 1 + pi) % 12, col = monthColor(m, o), hh = 12;
            header(P, A.x0, A.y0, A.w, hh, (o.title || 'Geburtstage') + ' im ' + MONTHS[m], col, o, 'c', 7);
            const top = A.y0 + hh + 3, n = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m], rh = (A.y1 - top) / n, L = [];
            for (let i = 0; i < n; i++) {
                const y = top + i * rh;
                P.rect(A.x0, y + .4, 12, rh - .8, { fill: light(col, i % 2 ? .82 : .72), r: o.shape === 'square' || o.shape === 'plain' ? 0 : 1.2 });
                num2(P, A.x0 + 6, y + rh / 2 + Math.min(3.2, rh * .5) * .5, String(i + 1), Math.min(3.2, rh * .45), o, 'c', darkC(col, .4));
                L.push([A.x0 + 14, y + rh, A.x1, y + rh]);
            }
            P.lines(L, { w: .2, c: o.lc });
            return;
        }
        if (!o.title) P.text(A.x0, A.y0 + 7.5, 'Geburtstage', { s: 9, b: true, c: o.scheme === 'one' ? o.cMain : '#222222' });
        const top = o.title ? A.y0 : A.y0 + 12, q = A.w > A.h, cols = q ? 4 : 3, rows = 12 / cols, gx = 5, gy = 4;
        const W = (A.w - (cols - 1) * gx) / cols, H = (A.y1 - top - (rows - 1) * gy) / rows;
        for (let i = 0; i < 12; i++) {
            const x = A.x0 + (i % cols) * (W + gx), y = top + Math.floor(i / cols) * (H + gy), col = monthColor(i, o), hh = Math.min(7.5, H * .14);
            header(P, x, y, W, hh, MONTHS[i], col, o, 'c', 4.2);
            const L = [];
            for (let yy = y + hh + 7; yy <= y + H; yy += 7) L.push([x, yy, x + W, yy], [x + 9, yy - 5.5, x + 9, yy]);
            P.lines(L, { w: .2, c: o.lc });
            P.rect(x, y, W, H, { w: .3, c: o.lc, r: o.shape === 'round' || o.shape === 'circle' ? 2 : 0 });
        }
    }

    /* ---------- Anmeldung als Generator ---------- */
    const COLORS = [['#e03131', 'Rot'], ['#2b8a3e', 'Grün'], ['#1c6fd1', 'Blau'], ['#7b45c5', 'Lila'], ['#e8590c', 'Orange'], ['#c2255c', 'Pink'], ['#495057', 'Grau']];
    const LIGHTS = [['#fff1c2', 'Hellgelb'], ['#d3f0d8', 'Hellgrün'], ['#d8e8f8', 'Hellblau'], ['#fbe0d4', 'Rosa'], ['#ece5f8', 'Lila'], ['#eef0f3', 'Hellgrau']];
    const kindIs = (...k) => o => k.includes(o.kind);
    const ferHint = FER.bis ? 'Offizielle Termine der Kultusministerkonferenz, hinterlegt bis ' + fmtDate(FER.bis) + ' (Stand ' + FER.stand + '). Werden automatisch aktualisiert.' : 'Keine Ferientermine hinterlegt.';
    BP.gens.cal = {
        group: 'Kalender',
        def: {
            kind: 'year', year: 0, startMonth: 1, startDay: 1, months: 12, weeks: 4, days: 7, plannerRows: 12, land: 'de',
            hol: true, holNames: true, bridge: true, fer: true, kw: true, moon: false, legend: true,
            names: 'Mama, Papa, Kind 1, Kind 2', weekLayout: 'blocks', hFrom: 7, hTo: 20, pic: 0, notes: false, bStyle: 'boxes',
            scheme: 'rainbow', cMain: '#1c6fd1', cHol: '#e03131', cBridge: '#d3f0d8', cFer: '#fff1c2', cWe: '#eef0f3',
            shape: 'round', headStyle: 'band', font: 'print', lc: '#c3c9d1', mt: 8, mb: 13, ml: 8, mr: 8,
        },
        /** Jahr 0 = automatisch: ab Oktober schon das nächste Jahr, beim Schuljahr ab Mai das kommende Schuljahr */
        fix(o) {
            if (+o.year) return o;
            const now = new Date(), y = now.getFullYear(), m = now.getMonth();
            // Woche und Tag: ab heute
            if (o.kind === 'week' || o.kind === 'day') return { ...o, year: y, startMonth: m + 1, startDay: now.getDate() };
            const sm = (+o.startMonth || 1) - 1;
            return { ...o, year: sm === 0 ? (m >= 9 ? y + 1 : y) : (m >= sm - 3 ? y : y - 1) };
        },
        pages(o) {
            return o.kind === 'month' || o.kind === 'family' ? clamp(Math.round(num(o.months, 12)), 1, 36)
                : o.kind === 'planner' ? (+o.plannerRows === 6 ? 2 : 1)
                    : o.kind === 'week' ? clamp(Math.round(num(o.weeks, 4)), 1, 60)
                        : o.kind === 'day' ? clamp(Math.round(num(o.days, 7)), 1, 120)
                            : o.kind === 'birthday' && o.bStyle === 'days' ? 12 : 1;
        },
        schema: [
            { g: 'Kalender', k: 'kind', t: 'sel', l: 'Art', opts: [['year', 'Jahreskalender (12 Monate auf einer Seite)'], ['planner', 'Jahresplaner / Urlaubsplaner'], ['month', 'Monatskalender (ein Monat pro Seite)'], ['family', 'Familienplaner (eine Spalte pro Person)'], ['week', 'Wochenkalender'], ['day', 'Tagesplaner'], ['birthday', 'Geburtstagskalender (immerwährend)']] },
            { g: 'Kalender', k: 'year', t: 'num', l: 'Jahr', min: 1900, max: 2200, step: 1, show: o => o.kind !== 'birthday' },
            { g: 'Kalender', k: 'startMonth', t: 'sel', l: 'Beginnt im', show: o => !(o.kind === 'birthday' && o.bStyle !== 'days'), opts: MONTHS.map((n, i) => [String(i + 1), n + (i === 7 ? ' (Schuljahr)' : '')]) },
            { g: 'Kalender', k: 'startDay', t: 'num', l: 'am Tag', min: 1, max: 31, step: 1, show: kindIs('week', 'day') },
            { g: 'Kalender', k: 'months', t: 'num', l: 'Anzahl Monate', min: 1, max: 36, step: 1, show: kindIs('month', 'family') },
            { g: 'Kalender', k: 'weeks', t: 'num', l: 'Anzahl Wochen', min: 1, max: 60, step: 1, show: kindIs('week') },
            { g: 'Kalender', k: 'days', t: 'num', l: 'Anzahl Tage', min: 1, max: 120, step: 1, show: kindIs('day') },
            { g: 'Kalender', k: 'plannerRows', t: 'seg', l: 'Monate pro Seite', show: kindIs('planner'), opts: [['12', '12 (ganzes Jahr)'], ['6', '6 (größer, 2 Seiten)']] },
            { g: 'Kalender', k: 'bStyle', t: 'seg', l: 'Aufteilung', show: kindIs('birthday'), opts: [['boxes', '12 Monate auf einer Seite'], ['days', 'ein Monat pro Seite (1 bis 31)']] },
            { g: 'Kalender', k: 'land', t: 'sel', l: 'Bundesland', show: o => o.kind !== 'birthday', opts: LANDS, hint: 'für Feiertage, Brückentage und Schulferien' },
            { g: 'Kalender', k: 'names', t: 'text', l: 'Namen (durch Komma getrennt)', ph: 'z. B. Mama, Papa, Lena, Tim', show: kindIs('family') },
            { g: 'Kalender', k: 'weekLayout', t: 'seg', l: 'Aufteilung der Woche', show: kindIs('week'), opts: [['blocks', '8 Felder mit Notizen'], ['rows', '7 Zeilen'], ['columns', 'Spalten mit Uhrzeiten']] },
            { g: 'Kalender', k: 'hFrom', t: 'num', l: 'Uhrzeit von', u: 'Uhr', min: 0, max: 23, step: 1, show: o => o.kind === 'day' || (o.kind === 'week' && o.weekLayout === 'columns') },
            { g: 'Kalender', k: 'hTo', t: 'num', l: 'bis', u: 'Uhr', min: 1, max: 24, step: 1, show: o => o.kind === 'day' || (o.kind === 'week' && o.weekLayout === 'columns') },
            { g: 'Kalender', k: 'pic', t: 'num', l: 'Platz für ein Bild', u: '%', min: 0, max: 70, step: 5, show: kindIs('month'), hint: 'zum Malen oder Einkleben, 0 = kein Bild' },
            { g: 'Kalender', k: 'notes', t: 'chk', l: 'Notizzeilen unten', show: kindIs('month') },
            { g: 'Einträge', k: 'hol', t: 'chk', l: 'Feiertage markieren', show: o => o.kind !== 'birthday' },
            { g: 'Einträge', k: 'holNames', t: 'chk', l: 'Namen der Feiertage eintragen', show: o => o.hol && o.kind === 'month' },
            { g: 'Einträge', k: 'bridge', t: 'chk', l: 'Brückentage markieren', show: o => o.kind !== 'birthday', hint: 'ein Urlaubstag zwischen Feiertag und Wochenende' },
            { g: 'Einträge', k: 'fer', t: 'chk', l: 'Schulferien markieren', show: o => o.kind !== 'birthday' && o.land !== 'de', hint: ferHint },
            { g: 'Einträge', k: 'kw', t: 'chk', l: 'Kalenderwochen', show: kindIs('year', 'month', 'day') },
            { g: 'Einträge', k: 'moon', t: 'chk', l: 'Mondphasen (Neumond, Vollmond, Viertel)', show: o => o.kind !== 'birthday' },
            { g: 'Einträge', k: 'legend', t: 'chk', l: 'Feiertagsliste und Farberklärung', show: kindIs('year', 'planner') },
            { g: 'Farben und Form', k: 'scheme', t: 'sel', l: 'Farben', opts: [['rainbow', 'bunt (jeder Monat eine eigene Farbe)'], ['one', 'eine Farbe nach Wunsch'], ['gray', 'grau'], ['bw', 'schwarzweiß (spart Tinte)']] },
            { g: 'Farben und Form', k: 'cMain', t: 'color', l: 'Hauptfarbe', show: o => o.scheme === 'one', opts: COLORS },
            { g: 'Farben und Form', k: 'cHol', t: 'color', l: 'Feiertage', show: o => o.hol && o.kind !== 'birthday', opts: COLORS },
            { g: 'Farben und Form', k: 'cBridge', t: 'color', l: 'Brückentage', show: o => o.bridge && o.kind !== 'birthday', opts: LIGHTS },
            { g: 'Farben und Form', k: 'cFer', t: 'color', l: 'Schulferien', show: o => o.fer && o.land !== 'de' && o.kind !== 'birthday', opts: LIGHTS },
            { g: 'Farben und Form', k: 'cWe', t: 'color', l: 'Wochenende', show: o => o.kind !== 'birthday', opts: LIGHTS },
            { g: 'Farben und Form', k: 'shape', t: 'seg', l: 'Form der Tage', opts: [['round', 'abgerundet'], ['square', 'eckig'], ['circle', 'Kreise'], ['plain', 'nur Schrift']] },
            { g: 'Farben und Form', k: 'headStyle', t: 'seg', l: 'Überschriften', opts: [['band', 'farbiger Balken'], ['frame', 'Rahmen'], ['text', 'nur Schrift']] },
            { g: 'Farben und Form', k: 'font', t: 'seg', l: 'Zahlen', opts: [['print', 'Druckschrift'], ['school', 'Schulschrift']] },
        ],
        draw(P, A, o, pi) {
            const f = { year: drawYear, planner: drawPlanner, month: drawMonth, family: drawFamily, week: drawWeek, day: drawDay, birthday: drawBirthday }[o.kind] || drawYear;
            f(P, A, { ...o }, pi);
        },
    };

    self.BLCal = { holidays, easter, isoWeek, isBridge, moonMap, ferienMap, FER, LANDS };
})();
