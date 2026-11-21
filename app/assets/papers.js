/* blanko – die Papiere. Jedes Papier im Katalog (catalog.json) nennt einen Generator (gen) und seine Grundeinstellungen (def).
   Ein Generator zeichnet mit der Druck-Engine (pdf.js) in eine Fläche, alle Maße in mm.

   BLPapers.options(paper)      alle Einstellungen eines Papiers im Original (gemeinsame + eigene)
   BLPapers.schema(paper)       die Regler dazu, in Gruppen
   BLPapers.build(paper, o)     fertiges Dokument (doc.draw für die Vorschau, doc.bytes für das PDF)
   BLPapers.changed(paper, o)   welche genormten Werte vom Original abweichen ([] = noch Original) */
(function () {
    'use strict';

    /* ---------- Hilfen ---------- */
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);
    function mix(hex, to, t) {
        const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
        const c = [16, 8, 0].map(s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t));
        return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    }
    const light = (c, t) => mix(c, '#ffffff', t);
    const darkC = (c, t) => mix(c, '#000000', t);
    /** Zufall mit Startwert, damit Lücken beim Neuzeichnen gleich bleiben */
    function rng(seed) {
        let a = (seed >>> 0) || 1;
        return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }
    // Die Farben der Zahlen 1 bis 10, wie auf bunten Einmaleins-Tafeln
    const RAINBOW = ['#e35d52', '#ec8a3a', '#efbf3f', '#bfd662', '#8fbf9b', '#9fcbe6', '#c39ad0', '#9696cc', '#e07f80', '#ecaa9c'];
    const STRONG = ['#e03131', '#f76707', '#f59f00', '#74b816', '#2f9e44', '#1c7ed6', '#ae3ec9', '#5f3dc4', '#c2255c', '#e8590c'];
    function numColor(i, scheme) {
        const base = (scheme === 'strong' ? STRONG : RAINBOW)[(i - 1) % 10];
        const c = i > 10 ? light(base, .35) : base;
        return scheme === 'pastel' ? light(c, .45) : c;
    }

    /* ---------- Gemeinsame Einstellungen aller Papiere ---------- */
    const COMMON = {
        fmt: 'A4', ori: 'h', pages: 1,
        mt: 10, mb: 14, ml: 10, mr: 10,
        rand: 'none', randW: 18, head: 'none', title: '',
        lc: '#8c9aa8', lw: 0.2,
    };
    const FORMATS = { A4: [210, 297], A5: [148, 210], A3: [297, 420], A6: [105, 148] };
    const LINE_COLORS = [['#8c9aa8', 'Grau'], ['#b9c3cc', 'Hellgrau'], ['#6d9bd1', 'Blau'], ['#7fbf8a', 'Grün'], ['#d9822b', 'Orange'], ['#333333', 'Schwarz']];

    const COMMON_SCHEMA = [
        { g: 'Papier', k: 'fmt', t: 'sel', l: 'Format', opts: [['A4', 'A4'], ['A5x2', '2 × A5 auf A4 (zum Schneiden)'], ['A5', 'A5'], ['A3', 'A3'], ['A6', 'A6']] },
        { g: 'Papier', k: 'ori', t: 'seg', l: 'Ausrichtung', opts: [['h', 'Hochformat'], ['q', 'Querformat']] },
        { g: 'Papier', k: 'pages', t: 'num', l: 'Seiten', min: 1, max: 50, step: 1 },
        { g: 'Rand und Kopf', k: 'rand', t: 'sel', l: 'Korrekturrand', norm: true, opts: [['none', 'ohne Rand'], ['r', 'rechts'], ['l', 'links'], ['lr', 'Doppelrand (links und rechts)'], ['out', 'außen (für beidseitigen Druck)'], ['all', 'Umrandung rundum']] },
        { g: 'Rand und Kopf', k: 'randW', t: 'num', l: 'Randbreite', u: 'mm', min: 3, max: 120, step: 1, norm: true, show: o => o.rand !== 'none' && o.rand !== 'all' },
        { g: 'Rand und Kopf', k: 'head', t: 'sel', l: 'Kopfzeile', opts: [['none', 'keine'], ['name', 'Name'], ['namedate', 'Name und Datum'], ['nameklasse', 'Name, Klasse und Datum']] },
        { g: 'Rand und Kopf', k: 'title', t: 'text', l: 'Überschrift', ph: 'z. B. Diktat, Hausaufgabe' },
        { g: 'Farbe', k: 'lc', t: 'color', l: 'Linienfarbe', opts: LINE_COLORS },
        { g: 'Farbe', k: 'lw', t: 'num', l: 'Linienstärke', u: 'mm', min: 0.05, max: 1, step: 0.05 },
        { g: 'Seitenränder', k: 'mt', t: 'num', l: 'oben', u: 'mm', min: 0, max: 60, step: 1 },
        { g: 'Seitenränder', k: 'mb', t: 'num', l: 'unten', u: 'mm', min: 12, max: 60, step: 1 },
        { g: 'Seitenränder', k: 'ml', t: 'num', l: 'links', u: 'mm', min: 0, max: 60, step: 1 },
        { g: 'Seitenränder', k: 'mr', t: 'num', l: 'rechts', u: 'mm', min: 0, max: 60, step: 1 },
    ];

    /* ---------- Fläche für den Inhalt: Seitenränder, Kopfzeile, Überschrift und Korrekturrand ---------- */
    function area(P, fr, o, pi) {
        let x0 = fr.x + clamp(num(o.ml, 10), 0, fr.w / 3), x1 = fr.x + fr.w - clamp(num(o.mr, 10), 0, fr.w / 3);
        let y0 = fr.y + clamp(num(o.mt, 10), 0, fr.h / 3);
        const y1 = fr.y + fr.h - clamp(num(o.mb, 14), 12, fr.h / 3);
        const ink = '#555555';
        if (o.title) {
            P.text((x0 + x1) / 2, y0 + 6, o.title, { s: 6, b: true, al: 'c', c: '#222222' });
            y0 += 10;
        }
        if (o.head && o.head !== 'none') {
            const fields = o.head === 'name' ? [['Name', 1]] : o.head === 'namedate' ? [['Name', .62], ['Datum', .38]] : [['Name', .5], ['Klasse', .18], ['Datum', .32]];
            let x = x0;
            const W = x1 - x0, y = y0 + 6;
            for (const [label, share] of fields) {
                const w = W * share;
                P.text(x, y, label + ':', { s: 3.6, c: ink });
                const lx = x + P.textWidth(label + ':', 3.6) + 2;
                P.line(lx, y + .8, x + w - 5, y + .8, { w: .25, c: '#999999' });
                x += w;
            }
            y0 += 11;
        }
        const st = { w: Math.max(.25, num(o.lw, .2) * 1.4), c: o.lc || COMMON.lc };
        const rw = clamp(num(o.randW, 18), 3, (x1 - x0) * .6);
        let side = o.rand;
        if (side === 'out') side = pi % 2 ? 'l' : 'r';
        if (side === 'l' || side === 'lr') { P.line(x0 + rw, y0, x0 + rw, y1, st); x0 += rw; }
        if (side === 'r' || side === 'lr') { P.line(x1 - rw, y0, x1 - rw, y1, st); x1 -= rw; }
        if (side === 'all') {
            P.rect(x0, y0, x1 - x0, y1 - y0, st);
            x0 += 4; x1 -= 4; y0 += 4;
            return { x0, y0, x1, y1: y1 - 4, w: x1 - x0, h: y1 - 4 - y0 };
        }
        return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
    }
    /** Raster mittig in die Fläche setzen: nur ganze Kästchen */
    function fit(A, cw, ch) {
        const cols = Math.max(1, Math.floor(A.w / cw + 1e-6)), rows = Math.max(1, Math.floor(A.h / ch + 1e-6));
        const x = A.x0 + (A.w - cols * cw) / 2, y = A.y0 + (A.h - rows * ch) / 2;
        return { cols, rows, x, y, w: cols * cw, h: rows * ch };
    }
    const rectPath = (x, y, w, h) => [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];

    /* =====================================================================================================
       Generatoren. Jeder hat: def (Grundwerte), schema (Regler) und draw(P, A, o, pi) für eine Fläche.
       ===================================================================================================== */
    const G = {};

    /* ---------- Liniert: 1 Linie, 2 Linien (Mittelband) oder 4-Linien-System, mit Kontrast und Schräglinien ---------- */
    G.lines = {
        group: 'Linien',
        def: { sys: 'single', pitch: 9, band: 5, ratio: '1:1:1', gap: 5, band2: 0, mode2: 'half', n1: 2, pic: false, gs: false, base: false, dashMid: false, kon: 'none', kc: '#dcefd6', slant: 0, slantGap: 10 },
        schema: [
            { k: 'sys', t: 'sel', l: 'Liniensystem', norm: true, opts: [['single', '1 Linie (Schreiblinie)'], ['double', '2 Linien (mit Mittelband)'], ['four', '4 Linien (mit Ober- und Unterlänge)']] },
            { k: 'pitch', t: 'num', l: 'Zeilenabstand', u: 'mm', min: 3, max: 40, step: .5, norm: true, show: o => o.sys !== 'four', hint: 'von Schreiblinie zu Schreiblinie' },
            { k: 'band', t: 'num', l: 'Mittelband', u: 'mm', min: 1.5, max: 30, step: .5, norm: true, show: o => o.sys !== 'single', hint: 'Höhe der kleinen Buchstaben wie a, c, e' },
            { k: 'ratio', t: 'sel', l: 'Ober : Mitte : Unter', norm: true, show: o => o.sys === 'four', opts: [['1:1:1', '1 : 1 : 1 (Grundschule)'], ['5:7:5', '5 : 7 : 5 (Grundschrift)'], ['7:10:7', '7 : 10 : 7'], ['3:4:3', '3 : 4 : 3'], ['2:3:2', '2 : 3 : 2'], ['2:1:2', '2 : 1 : 2'], ['4:5:4', '4 : 5 : 4 (Kalligrafie)'], ['3:2:3', '3 : 2 : 3']] },
            { k: 'gap', t: 'num', l: 'Abstand zwischen den Systemen', u: 'mm', min: 0, max: 40, step: .5, norm: true, show: o => o.sys === 'four' },
            { k: 'band2', t: 'num', l: 'Zweite Größe (Mittelband)', u: 'mm', min: 0, max: 30, step: .5, norm: true, show: o => o.sys === 'four', hint: '0 = alle Zeilen gleich groß' },
            { k: 'mode2', t: 'seg', l: 'Übergang', norm: true, show: o => o.sys === 'four' && +o.band2 > 0, opts: [['count', 'feste Anzahl groß'], ['half', 'obere/untere Hälfte'], ['linear', 'nach unten kleiner']] },
            { k: 'n1', t: 'num', l: 'Systeme in der ersten Größe', min: 1, max: 20, step: 1, norm: true, show: o => o.sys === 'four' && +o.band2 > 0 && o.mode2 === 'count' },
            { k: 'pic', t: 'chk', l: 'Bildkasten neben den großen Zeilen', show: o => o.sys === 'four' && +o.band2 > 0 && o.mode2 === 'count' },
            { k: 'gs', t: 'chk', l: 'Grundschrift-Stil (graues Mittelband, nur Grundlinie)', norm: true, show: o => o.sys === 'four' },
            { k: 'base', t: 'chk', l: 'Schreiblinie kräftiger' },
            { k: 'dashMid', t: 'chk', l: 'Mittellinie gestrichelt', show: o => o.sys !== 'single' },
            { k: 'kon', t: 'sel', l: 'Kontrast (farbig)', norm: true, show: o => o.sys !== 'single', opts: [['none', 'ohne'], ['gaps', 'Zwischenräume farbig'], ['mid', 'Mittelband farbig']] },
            { k: 'kc', t: 'color', l: 'Kontrastfarbe', show: o => o.kon !== 'none' && o.sys !== 'single', opts: [['#dcefd6', 'Grün'], ['#fdf1b8', 'Gelb'], ['#d8e8f8', 'Blau'], ['#fbe0d4', 'Rosa'], ['#e9e3f5', 'Lila'], ['#e6e6e6', 'Grau']] },
            { k: 'slant', t: 'num', l: 'Schräglinien', u: '°', min: 0, max: 89, step: 1, hint: '0 = keine, Kalligrafie meist 55 bis 85' },
            { k: 'slantGap', t: 'num', l: 'Abstand der Schräglinien', u: 'mm', min: 3, max: 50, step: 1, show: o => +o.slant > 0 },
        ],
        draw(P, A, o) {
            const st = { w: num(o.lw, .2), c: o.lc };
            const bst = o.base ? { w: st.w * 1.8, c: darkC(o.lc, .25) } : st;
            const mst = o.dashMid ? { w: st.w, c: o.lc, dash: [1.2, 1] } : st;
            const H = [], B = [], M = [];   // normale Linien, Schreiblinien, Mittellinien
            const fills = [];               // farbige Flächen [y, h, Farbe]
            const sys = [];                 // Systeme [oben, unten, Einzug] für den Kontrast
            const T = [], PIC = [];         // Begrenzungsstriche (Grundschrift), Bildkasten
            let shift = 0, shiftN = 0;      // die ersten Linien beginnen rechts vom Bildkasten
            if (o.sys === 'four') {
                const r = String(o.ratio || '1:1:1').split(':').map(Number);
                const b1 = clamp(num(o.band, 5), 1, 50), b2 = num(o.band2, 0) > 0 ? clamp(+o.band2, 1, 50) : b1, gap = clamp(num(o.gap, 5), 0, 60);
                let y = A.y0;
                const list = [], n1 = clamp(Math.round(num(o.n1, 2)), 1, 50);
                for (let n = 0; n < 500; n++) {
                    const t = (y - A.y0) / A.h;
                    const band = b2 === b1 ? b1 : o.mode2 === 'linear' ? b1 + (b2 - b1) * Math.min(1, t * 1.15) : o.mode2 === 'count' ? (n < n1 ? b1 : b2) : (t < .5 ? b1 : b2);
                    const u = band / r[1], O = r[0] * u, Mb = band, U = r[2] * u;
                    if (y + O + Mb + U > A.y1 + 1e-6) break;
                    list.push({ y, O, Mb, U });
                    y += O + Mb + U + gap * band / b1;
                }
                // übrigen Platz gleichmäßig oben und unten verteilen
                const used = list.length ? list[list.length - 1].y + list[list.length - 1].O + list[list.length - 1].Mb + list[list.length - 1].U - A.y0 : 0;
                const off = (A.h - used) / 2;
                // Bildkasten links neben den großen Zeilen (wie im Schreiblernheft)
                const big = o.pic && b2 !== b1 && o.mode2 === 'count' ? list.slice(0, n1) : [];
                const picW = big.length ? Math.min(A.w * .28, big[big.length - 1].y + big[big.length - 1].O + big[big.length - 1].Mb + big[big.length - 1].U - big[0].y) : 0;
                list.forEach((s, i) => {
                    const y0 = s.y + off, y3 = y0 + s.O + s.Mb + s.U;
                    if (o.gs) {
                        // Grundschrift: graues Mittelband, darunter die Grundlinie, an den Enden kurze Begrenzungen
                        fills.push([y0 + s.O, s.Mb, '#e6e7e9']);
                        B.push(y0 + s.O + s.Mb);
                        T.push([A.x0, y0, A.x0, y3], [A.x1, y0, A.x1, y3]);
                        return;
                    }
                    H.push(y0, y3);
                    M.push(y0 + s.O);
                    B.push(y0 + s.O + s.Mb);
                    sys.push([y0, y3, i < big.length ? picW + 4 : 0]);
                    if (o.kon === 'mid') fills.push([y0 + s.O, s.Mb]);
                });
                if (big.length) {
                    PIC.push([A.x0, big[0].y + off, picW, picW]);
                    shift = picW + 4; shiftN = big.length * 2;
                }
            } else if (o.sys === 'double') {
                const band = clamp(num(o.band, 3.5), 1, 50), pitch = Math.max(band + 1, clamp(num(o.pitch, 13), 2, 80));
                const n = Math.floor((A.h - band) / pitch + 1e-6) + 1;
                const off = (A.h - ((n - 1) * pitch + band)) / 2;
                for (let i = 0; i < n; i++) {
                    const y = A.y0 + off + i * pitch;
                    M.push(y); B.push(y + band);
                    sys.push([y - (pitch - band) * .45, y + band + (pitch - band) * .45]);
                    if (o.kon === 'mid') fills.push([y, band]);
                }
            } else {
                const pitch = clamp(num(o.pitch, 9), 2, 80);
                const n = Math.floor(A.h / pitch + 1e-6);
                const off = (A.h - n * pitch) / 2;
                for (let i = 1; i <= n; i++) B.push(A.y0 + off + i * pitch);
            }
            // Kontrast: farbiges Blatt, die Schreibzeilen bleiben weiß
            if (o.kon === 'gaps' && sys.length) {
                P.rect(A.x0, A.y0, A.w, A.h, { fill: o.kc });
                for (const [a, b, ind] of sys) P.rect(A.x0 + (ind || 0), a, A.w - (ind || 0), b - a, { fill: '#ffffff' });
            }
            for (const [y, h, c] of fills) P.rect(A.x0, y, A.w, h, { fill: c || o.kc });
            for (const [x, y, w, h] of PIC) P.rect(x, y, w, h, { fill: '#ffffff', c: o.lc, w: st.w * 1.4 });
            if (T.length) P.lines(T, st);
            // Schräglinien unter den Zeilen
            if (+o.slant > 0) {
                const a = clamp(+o.slant, 1, 89) * Math.PI / 180, dx = A.h / Math.tan(a), gap = clamp(num(o.slantGap, 10), 2, 80);
                const L = [];
                for (let x = A.x0 - dx; x < A.x1; x += gap) L.push([x, A.y1, x + dx, A.y0]);
                P.clip(rectPath(A.x0, A.y0, A.w, A.h)).lines(L, { w: st.w * .7, c: light(o.lc, .35) }).unclip();
            }
            // Linien der großen Systeme neben dem Bildkasten beginnen weiter rechts (H: 2 pro System, M und B: 1)
            const hl = (ys, per) => ys.map((y, i) => [A.x0 + (i < shiftN / 2 * per ? shift : 0), y, A.x1, y]);
            if (H.length) P.lines(hl(H, 2), st);
            if (M.length) P.lines(hl(M, 1), mst);
            if (B.length) P.lines(hl(B, 1), o.gs ? { w: st.w * 1.6, c: darkC(o.lc, .2) } : bst);
        },
    };

    /* ---------- Kariert und rautiert, auch mit kleiner werdenden Kästchen (ZL) ---------- */
    G.grid = {
        group: 'Kästchen',
        def: { cw: 5, ch: 5, bold: 0, shrink: 0, frame: true },
        schema: [
            { k: 'cw', t: 'num', l: 'Kästchenbreite', u: 'mm', min: 1, max: 40, step: .5, norm: true },
            { k: 'ch', t: 'num', l: 'Kästchenhöhe', u: 'mm', min: 1, max: 40, step: .5, norm: true, hint: 'anders als die Breite = rautiert' },
            { k: 'shrink', t: 'num', l: 'Nach unten kleiner bis', u: 'mm', min: 0, max: 40, step: .5, norm: true, hint: '0 = alle Kästchen gleich' },
            { k: 'bold', t: 'num', l: 'Jede n-te Linie kräftiger', min: 0, max: 20, step: 1, hint: '0 = aus' },
            { k: 'frame', t: 'chk', l: 'Rahmen um das Raster' },
        ],
        draw(P, A, o) {
            const st = { w: num(o.lw, .2), c: o.lc }, bst = { w: num(o.lw, .2) * 2, c: darkC(o.lc, .2) };
            const cw = clamp(num(o.cw, 5), .5, 100), ch = clamp(num(o.ch, 5), .5, 100);
            if (num(o.shrink, 0) > 0) {
                // Reihen von Kästchen, die von oben nach unten kleiner werden (Zahlen schreiben lernen)
                const to = clamp(+o.shrink, .5, 100);
                const rows = [];
                let y = A.y0, n = 0;
                const est = Math.max(2, Math.round(A.h / ((cw + to) / 2 * 1.35)));
                for (; n < 200; n++) {
                    const s = cw + (to - cw) * Math.min(1, n / (est - 1));
                    if (y + s > A.y1 + 1e-6) break;
                    rows.push([y, s]);
                    y += s + s * .35;
                }
                const off = (A.y1 - (y - (rows.length ? rows[rows.length - 1][1] * .35 : 0))) / 2;
                for (const [yy, s] of rows) {
                    const cols = Math.floor(A.w / s + 1e-6), x = A.x0 + (A.w - cols * s) / 2, y0 = yy + off;
                    const L = [[x, y0, x + cols * s, y0], [x, y0 + s, x + cols * s, y0 + s]];
                    for (let c = 0; c <= cols; c++) L.push([x + c * s, y0, x + c * s, y0 + s]);
                    P.lines(L, st);
                }
                return;
            }
            const F = fit(A, cw, ch), L = [], BL = [], bn = Math.round(num(o.bold, 0));
            for (let c = 0; c <= F.cols; c++) ((bn && c % bn === 0) ? BL : L).push([F.x + c * cw, F.y, F.x + c * cw, F.y + F.h]);
            for (let r = 0; r <= F.rows; r++) ((bn && r % bn === 0) ? BL : L).push([F.x, F.y + r * ch, F.x + F.w, F.y + r * ch]);
            P.lines(L, st);
            if (BL.length) P.lines(BL, bst);
            if (o.frame) P.rect(F.x, F.y, F.w, F.h, { w: st.w * 1.6, c: o.lc });
        },
    };

    /* ---------- Millimeterpapier ---------- */
    G.mm = {
        group: 'Millimeter',
        def: { lc: '#d9822b', unit: 1 },
        schema: [{ k: 'unit', t: 'sel', l: 'Feinste Teilung', norm: true, opts: [['1', '1 mm'], ['2', '2 mm'], ['5', '5 mm']] }],
        draw(P, A, o) {
            const u = +o.unit || 1, F = fit(A, 10, 10), w = num(o.lw, .2);
            const fine = [], mid = [], big = [];
            for (let i = 0; i <= F.cols * 10; i += u) (i % 10 === 0 ? big : i % 5 === 0 ? mid : fine).push([F.x + i, F.y, F.x + i, F.y + F.h]);
            for (let i = 0; i <= F.rows * 10; i += u) (i % 10 === 0 ? big : i % 5 === 0 ? mid : fine).push([F.x, F.y + i, F.x + F.w, F.y + i]);
            P.lines(fine, { w: w * .4, c: light(o.lc, .35) });
            P.lines(mid, { w: w * .8, c: o.lc });
            P.lines(big, { w: w * 1.5, c: o.lc });
        },
    };

    /* ---------- Punkte und Kreuze ---------- */
    G.dots = {
        group: 'Punkte',
        def: { sp: 5, r: .3, style: 'dot', lc: '#8c9aa8' },
        schema: [
            { k: 'sp', t: 'num', l: 'Abstand', u: 'mm', min: 2, max: 30, step: .5, norm: true },
            { k: 'r', t: 'num', l: 'Punktgröße', u: 'mm', min: .1, max: 2, step: .05 },
            { k: 'style', t: 'seg', l: 'Art', opts: [['dot', 'Punkte'], ['cross', 'Kreuze']] },
        ],
        draw(P, A, o) {
            const sp = clamp(num(o.sp, 5), 1, 100), F = fit(A, sp, sp), pts = [];
            for (let r = 0; r <= F.rows; r++) for (let c = 0; c <= F.cols; c++) pts.push([F.x + c * sp, F.y + r * sp]);
            const rr = clamp(num(o.r, .3), .05, 5);
            if (o.style === 'cross') P.lines(pts.flatMap(p => [[p[0] - rr * 2, p[1], p[0] + rr * 2, p[1]], [p[0], p[1] - rr * 2, p[0], p[1] + rr * 2]]), { w: num(o.lw, .2), c: o.lc });
            else P.dots(pts, rr, o.lc);
        },
    };

    /* ---------- Blanko ---------- */
    G.blank = { group: 'Blanko', def: {}, schema: [], draw() {} };

    /* ---------- Isometrie: Punkte, Linien oder Dreiecke ---------- */
    G.iso = {
        group: 'Isometrie',
        def: { sp: 5, style: 'dots', r: .35 },
        schema: [
            { k: 'sp', t: 'num', l: 'Kantenlänge', u: 'mm', min: 2, max: 40, step: .5, norm: true },
            { k: 'style', t: 'seg', l: 'Art', opts: [['dots', 'Punkte'], ['lines', 'Linien'], ['tri', 'Dreiecke']] },
            { k: 'r', t: 'num', l: 'Punktgröße', u: 'mm', min: .1, max: 2, step: .05, show: o => o.style === 'dots' },
        ],
        draw(P, A, o) {
            const s = clamp(num(o.sp, 5), 1, 100), dx = s * Math.sqrt(3) / 2;
            const cols = Math.floor(A.w / dx + 1e-6), x0 = A.x0 + (A.w - cols * dx) / 2;
            const rows = Math.floor((A.h - s / 2) / s + 1e-6), y0 = A.y0 + (A.h - rows * s - s / 2) / 2;
            const st = { w: num(o.lw, .2), c: o.lc };
            if (o.style === 'dots') {
                const pts = [];
                for (let c = 0; c <= cols; c++) for (let r = 0; r <= rows; r++) pts.push([x0 + c * dx, y0 + r * s + (c % 2 ? s / 2 : 0)]);
                P.dots(pts, clamp(num(o.r, .35), .05, 5), o.lc);
                return;
            }
            const X1 = x0 + cols * dx, Y1 = y0 + rows * s + s / 2, L = [];
            const t = Math.tan(Math.PI / 6), H = Y1 - y0, span = H + (X1 - x0) * t;
            if (o.style === 'lines') for (let c = 0; c <= cols; c++) L.push([x0 + c * dx, y0, x0 + c * dx, Y1]);
            else for (let y = y0; y <= Y1 + 1e-6; y += s / 2) L.push([x0, y, X1, y]);
            for (let k = -Math.ceil(span / s) - 1; k <= Math.ceil(span / s) + 1; k++) {
                const yA = y0 + k * s;
                L.push([x0, yA, X1, yA + (X1 - x0) * t], [x0, yA, X1, yA - (X1 - x0) * t]);
            }
            P.clip(rectPath(x0, y0, X1 - x0, Y1 - y0)).lines(L, st).unclip();
            P.rect(x0, y0, X1 - x0, Y1 - y0, st);
        },
    };

    /* ---------- Sechsecke ---------- */
    G.hex = {
        group: 'Sechsecke',
        def: { sp: 6 },
        schema: [{ k: 'sp', t: 'num', l: 'Kantenlänge', u: 'mm', min: 2, max: 40, step: .5, norm: true }],
        draw(P, A, o) {
            const s = clamp(num(o.sp, 6), 1, 100), w = s * 1.5, h = s * Math.sqrt(3);
            const cols = Math.floor((A.w - s / 2) / w + 1e-6), rows = Math.floor((A.h - h / 2) / h + 1e-6);
            const ox = A.x0 + (A.w - (cols * w + s / 2)) / 2 + s, oy = A.y0 + (A.h - (rows * h + h / 2)) / 2 + h / 2;
            const d = [];
            for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
                const cx = ox + c * w, cy = oy + r * h + (c % 2 ? h / 2 : 0);
                for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; d.push([i ? 'L' : 'M', cx + s * Math.cos(a), cy + s * Math.sin(a)]); }
                d.push(['Z']);
            }
            P.path(d, { w: num(o.lw, .2), c: o.lc, join: 'round' });
        },
    };

    /* ---------- Notenlinien und Gitarren-Tabulatur ---------- */
    G.staff = {
        group: 'Notenlinien',
        def: { n: 5, lg: 2.3, sgap: 22, tab: false, lc: '#555555' },
        schema: [
            { k: 'n', t: 'num', l: 'Linien pro System', min: 1, max: 8, step: 1, norm: true },
            { k: 'lg', t: 'num', l: 'Linienabstand', u: 'mm', min: 1, max: 10, step: .1, norm: true },
            { k: 'sgap', t: 'num', l: 'Abstand zwischen den Systemen', u: 'mm', min: 2, max: 60, step: .5, norm: true },
            { k: 'tab', t: 'chk', l: '„TAB“ am Anfang (Gitarre)' },
        ],
        draw(P, A, o) {
            const n = clamp(Math.round(num(o.n, 5)), 1, 12), lg = clamp(num(o.lg, 2.5), .5, 20), gap = clamp(num(o.sgap, 12), 0, 100);
            const sh = (n - 1) * lg, pitch = sh + gap;
            const cnt = Math.max(1, Math.floor((A.h - sh) / pitch + 1e-6) + 1);
            const off = (A.h - ((cnt - 1) * pitch + sh)) / 2, L = [];
            for (let i = 0; i < cnt; i++) {
                const y = A.y0 + off + i * pitch;
                for (let k = 0; k < n; k++) L.push([A.x0, y + k * lg, A.x1, y + k * lg]);
                L.push([A.x0, y, A.x0, y + sh], [A.x1, y, A.x1, y + sh]);
                if (o.tab && n > 2) {
                    const fs = Math.min(lg * 1.25, 5);
                    'TAB'.split('').forEach((ch, j) => P.text(A.x0 + 2.2, y + sh / 2 + (j - 1) * fs * 1.05 + fs * .35, ch, { s: fs, b: true, c: '#333333' }));
                }
            }
            P.lines(L, { w: num(o.lw, .2), c: o.lc });
        },
    };

    /* ---------- Koordinatensystem ---------- */
    G.coord = {
        group: 'Koordinatensystem',
        def: { cell: 5, n: 1, unit: 2, quad: 'all', labels: true, lc: '#9fb0c0' },
        schema: [
            { k: 'n', t: 'seg', l: 'Anzahl pro Seite', opts: [['1', '1'], ['2', '2'], ['4', '4'], ['6', '6']] },
            { k: 'quad', t: 'seg', l: 'Achsen', opts: [['all', 'mit negativen Zahlen'], ['first', 'nur positiv']] },
            { k: 'cell', t: 'num', l: 'Kästchen', u: 'mm', min: 2, max: 20, step: .5 },
            { k: 'unit', t: 'num', l: 'Kästchen pro Einheit', min: 1, max: 10, step: 1 },
            { k: 'labels', t: 'chk', l: 'Zahlen an den Achsen' },
        ],
        draw(P, A, o) {
            const n = +o.n || 1, cols = n === 1 ? 1 : 2, rows = n <= 2 ? n : n / 2, gp = 6;
            const pw = (A.w - (cols - 1) * gp) / cols, ph = (A.h - (rows - 1) * gp) / rows;
            const cell = clamp(num(o.cell, 5), 1, 50), unit = clamp(Math.round(num(o.unit, 2)), 1, 20);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const S = { x0: A.x0 + c * (pw + gp), y0: A.y0 + r * (ph + gp), w: pw, h: ph };
                let F = fit(S, cell, cell);
                // gerade Anzahl Kästchen, damit der Ursprung auf einer Linie liegt
                if (o.quad === 'all') {
                    const cc = F.cols - F.cols % 2, rr = F.rows - F.rows % 2;
                    F = { cols: cc, rows: rr, x: S.x0 + (S.w - cc * cell) / 2, y: S.y0 + (S.h - rr * cell) / 2, w: cc * cell, h: rr * cell };
                }
                const L = [];
                for (let i = 0; i <= F.cols; i++) L.push([F.x + i * cell, F.y, F.x + i * cell, F.y + F.h]);
                for (let i = 0; i <= F.rows; i++) L.push([F.x, F.y + i * cell, F.x + F.w, F.y + i * cell]);
                P.lines(L, { w: num(o.lw, .2), c: o.lc });
                const ox = o.quad === 'all' ? F.x + F.cols / 2 * cell : F.x + cell * Math.min(2, F.cols / 4 | 0);
                const oy = o.quad === 'all' ? F.y + F.rows / 2 * cell : F.y + F.h - cell * Math.min(2, F.rows / 4 | 0);
                const ax = { w: .45, c: '#222222' };
                P.line(F.x, oy, F.x + F.w, oy, ax).line(ox, F.y + F.h, ox, F.y, ax);
                const ar = 2.2;
                P.polyline([[F.x + F.w - ar * 1.4, oy - ar * .6], [F.x + F.w, oy], [F.x + F.w - ar * 1.4, oy + ar * .6]], { fill: '#222222', c: '#222222', w: .2 }, true);
                P.polyline([[ox - ar * .6, F.y + ar * 1.4], [ox, F.y], [ox + ar * .6, F.y + ar * 1.4]], { fill: '#222222', c: '#222222', w: .2 }, true);
                P.text(F.x + F.w - 1.2, oy - 2.2, 'x', { s: 4, b: true, al: 'r' }).text(ox + 2, F.y + 4, 'y', { s: 4, b: true });
                if (o.labels) {
                    const fs = Math.min(2.6, cell * unit * .45), u = cell * unit;
                    for (let k = -100; k <= 100; k++) {
                        if (!k) continue;
                        const x = ox + k * u, y = oy - k * u;
                        if (x > F.x + .1 && x < F.x + F.w - 3) { P.line(x, oy - .8, x, oy + .8, ax).text(x, oy + fs + 1.3, String(k), { s: fs, al: 'c', c: '#333333' }); }
                        if (y > F.y + 5 && y < F.y + F.h - .1) { P.line(ox - .8, y, ox + .8, y, ax).text(ox - 1.3, y + fs * .35, String(k), { s: fs, al: 'r', c: '#333333' }); }
                    }
                    P.text(ox - 1.3, oy + fs + 1.3, '0', { s: fs, al: 'r', c: '#333333' });
                }
            }
        },
    };

    /* ---------- Einmaleins-Tafel, bunt und kindgerecht ---------- */
    const SCHEMES = [['rainbow', 'Regenbogen'], ['pastel', 'Pastell'], ['strong', 'Kräftig'], ['rows', 'Zeilen bunt'], ['head', 'Nur Kopf bunt'], ['gray', 'Graustufen']];
    const FILL = [['all', 'mit allen Ergebnissen'], ['gaps', 'mit Lücken zum Ausfüllen'], ['empty', 'leer zum Ausfüllen'], ['squares', 'nur Quadratzahlen']];
    function cellFill(scheme, i) {
        if (scheme === 'gray') return '#e9e9e9';
        return numColor(i, scheme === 'rows' || scheme === 'head' ? 'rainbow' : scheme);
    }
    G.times = {
        group: 'Einmaleins',
        def: { n: 10, scheme: 'rainbow', fill: 'all', gapPct: 40, seed: 7, squares: true, font: 'school', op: '·', title: 'Das Einmaleins', lc: '#444444' },
        schema: [
            { k: 'n', t: 'seg', l: 'Größe', opts: [['10', 'bis 10'], ['12', 'bis 12'], ['15', 'bis 15'], ['20', 'bis 20']] },
            { k: 'scheme', t: 'sel', l: 'Farben', opts: SCHEMES },
            { k: 'fill', t: 'sel', l: 'Inhalt', opts: FILL },
            { k: 'gapPct', t: 'num', l: 'Anteil der Lücken', u: '%', min: 5, max: 95, step: 5, show: o => o.fill === 'gaps' },
            { k: 'seed', t: 'shuffle', l: 'Lücken neu mischen', show: o => o.fill === 'gaps' },
            { k: 'squares', t: 'chk', l: 'Quadratzahlen hervorheben' },
            { k: 'op', t: 'seg', l: 'Malzeichen', opts: [['·', '·'], ['×', '×']] },
            { k: 'font', t: 'seg', l: 'Schrift', opts: [['school', 'Schulschrift'], ['print', 'Druckschrift']] },
        ],
        draw(P, A, o, pi) {
            const n = clamp(+o.n || 10, 2, 20), size = Math.min(A.w, A.h), cs = size / (n + 1);
            const x0 = A.x0 + (A.w - cs * (n + 1)) / 2, y0 = A.y0 + (A.h - cs * (n + 1)) / 2;
            const rand = rng(+o.seed * 997 + pi * 31 + 1), pct = clamp(num(o.gapPct, 40), 0, 100) / 100;
            const write = (x, y, s, h, c) => o.font === 'print'
                ? P.text(x, y + h * .5, s, { s: h * 1.45, al: 'c', c: c || '#222222' })
                : P.digits(x, y + h / 2, s, { h, al: 'c', c: c || '#222222', w: h * .095 });
            const scheme = o.scheme;
            for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) {
                const x = x0 + c * cs, y = y0 + r * cs;
                let bg = '#ffffff';
                if (!r && !c) bg = '#e8e8e8';
                else if (!r || !c) bg = cellFill(scheme, r || c);
                else if (o.squares && r === c) bg = scheme === 'gray' ? '#d6d6d6' : '#e6e6e6';
                else if (scheme === 'rows') bg = light(numColor(r, 'rainbow'), .8);
                if (bg !== '#ffffff') P.rect(x, y, cs, cs, { fill: bg });
            }
            const L = [];
            for (let i = 0; i <= n + 1; i++) L.push([x0 + i * cs, y0, x0 + i * cs, y0 + (n + 1) * cs], [x0, y0 + i * cs, x0 + (n + 1) * cs, y0 + i * cs]);
            P.lines(L, { w: Math.max(.25, num(o.lw, .2)), c: o.lc });
            const h = cs * (n > 12 ? .38 : .42);
            for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) {
                const cx = x0 + c * cs + cs / 2, cy = y0 + r * cs + cs / 2;
                if (!r && !c) { write(cx, cy, o.op || '·', h); continue; }
                if (!r || !c) { write(cx, cy, String(r || c), h, scheme === 'gray' ? '#222222' : '#1f1f1f'); continue; }
                const show = o.fill === 'all' || (o.fill === 'squares' && r === c) || (o.fill === 'gaps' && rand() >= pct);
                if (show) write(cx, cy, String(r * c), h);
            }
        },
    };

    /* ---------- Einmaleins-Reihen als Übungsblatt: 3 · 7 = __ ---------- */
    G.rows = {
        group: 'Aufgaben',
        def: { reihen: '2,3,4,5', kind: 'mal', order: 'ordered', results: false, seed: 3, scheme: 'rainbow', font: 'school', op: '·', head: 'name' },
        schema: [
            { k: 'reihen', t: 'multi', l: 'Reihen', opts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => [String(i), String(i)]) },
            { k: 'kind', t: 'seg', l: 'Aufgaben', opts: [['mal', 'Malnehmen'], ['geteilt', 'Teilen'], ['beides', 'Beides']] },
            { k: 'order', t: 'seg', l: 'Reihenfolge', opts: [['ordered', 'der Reihe nach'], ['mixed', 'gemischt']] },
            { k: 'seed', t: 'shuffle', l: 'Neu mischen', show: o => o.order === 'mixed' },
            { k: 'results', t: 'chk', l: 'Ergebnisse eintragen (Lösungsblatt)' },
            { k: 'scheme', t: 'sel', l: 'Farben', opts: [['rainbow', 'Regenbogen'], ['pastel', 'Pastell'], ['strong', 'Kräftig'], ['gray', 'Graustufen']] },
            { k: 'op', t: 'seg', l: 'Malzeichen', opts: [['·', '·'], ['×', '×']] },
            { k: 'font', t: 'seg', l: 'Schrift', opts: [['school', 'Schulschrift'], ['print', 'Druckschrift']] },
        ],
        draw(P, A, o, pi) {
            let list = String(o.reihen || '').split(',').map(Number).filter(v => v >= 1 && v <= 20);
            if (!list.length) list = [2];
            const rand = rng(+o.seed * 131 + pi * 17 + 5);
            const cols = list.length > 1 ? 2 : 1, per = 10;
            const blocks = list.length;
            const bpc = Math.ceil(blocks / cols);
            const colW = (A.w - (cols - 1) * 10) / cols;
            const rowH = Math.min(11, (A.h - bpc * 11) / (bpc * per));
            const h = rowH * .55;
            const write = (x, y, s, al) => o.font === 'print' ? P.text(x, y, s, { s: h * 1.45, al, c: '#222222' }) : P.digits(x, y, s, { h, al, c: '#222222' });
            list.forEach((rr, bi) => {
                const col = Math.floor(bi / bpc), k = bi % bpc;
                const x = A.x0 + col * (colW + 10), yTop = A.y0 + k * (per * rowH + 11);
                const c = o.scheme === 'gray' ? '#dddddd' : numColor(rr, o.scheme);
                P.rect(x, yTop, colW, 7.5, { fill: c, r: 2 });
                P.text(x + 3, yTop + 5.3, 'Die ' + rr + 'er-Reihe', { s: 4.2, b: true, c: '#1f1f1f' });
                const items = [];
                for (let i = 1; i <= 10; i++) {
                    const div = o.kind === 'geteilt' || (o.kind === 'beides' && i % 2 === 0);
                    items.push(div ? [i * rr, ':', rr, i] : [i, o.op || '·', rr, i * rr]);
                }
                if (o.order === 'mixed') for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
                items.forEach((it, i) => {
                    const y = yTop + 9 + (i + 1) * rowH - (rowH - h) / 2;
                    const t = it[0] + ' ' + it[1] + ' ' + it[2] + ' =';
                    write(x + 3, y, t, 'l');
                    const tw = o.font === 'print' ? P.textWidth(t, h * 1.45) : P.digitsWidth(t, h);
                    const ax = x + 3 + tw + 3;
                    if (o.results) write(ax + 2, y, String(it[3]), 'l');
                    else P.line(ax, y + .6, Math.min(ax + 22, x + colW - 2), y + .6, { w: .3, c: '#9a9a9a' });
                });
            });
        },
    };

    /* ---------- Hundertertafel ---------- */
    G.hundred = {
        group: 'Hundertertafel',
        def: { start: 1, fill: 'all', gapPct: 40, seed: 11, scheme: 'five', font: 'school', title: 'Die Hundertertafel', lc: '#444444' },
        schema: [
            { k: 'start', t: 'seg', l: 'Zahlen', opts: [['1', '1 bis 100'], ['0', '0 bis 99']] },
            { k: 'fill', t: 'sel', l: 'Inhalt', opts: [['all', 'alle Zahlen'], ['gaps', 'mit Lücken'], ['tens', 'nur die Zehner'], ['empty', 'leer zum Ausfüllen']] },
            { k: 'gapPct', t: 'num', l: 'Anteil der Lücken', u: '%', min: 5, max: 95, step: 5, show: o => o.fill === 'gaps' },
            { k: 'seed', t: 'shuffle', l: 'Lücken neu mischen', show: o => o.fill === 'gaps' },
            { k: 'scheme', t: 'sel', l: 'Farben', opts: [['five', 'Kraft der Fünf'], ['rainbow', 'Zehner bunt'], ['pastel', 'Zehner Pastell'], ['gray', 'Graustufen'], ['none', 'Schwarzweiß']] },
            { k: 'font', t: 'seg', l: 'Schrift', opts: [['school', 'Schulschrift'], ['print', 'Druckschrift']] },
        ],
        draw(P, A, o, pi) {
            const cs = Math.min(A.w, A.h) / 10, x0 = A.x0 + (A.w - cs * 10) / 2, y0 = A.y0 + (A.h - cs * 10) / 2;
            const st = +o.start === 0 ? 0 : 1, rand = rng(+o.seed * 389 + pi * 7 + 3), pct = clamp(num(o.gapPct, 40), 0, 100) / 100;
            for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
                let bg = null;
                if (o.scheme === 'five') bg = ((r < 5) === (c < 5)) ? '#fff1c7' : '#dcefff';
                else if (o.scheme === 'rainbow' || o.scheme === 'pastel') bg = light(numColor(r + 1, o.scheme), o.scheme === 'pastel' ? .35 : .55);
                else if (o.scheme === 'gray') bg = r % 2 ? '#f0f0f0' : '#ffffff';
                if (bg) P.rect(x0 + c * cs, y0 + r * cs, cs, cs, { fill: bg });
            }
            const L = [], B = [];
            for (let i = 0; i <= 10; i++) {
                (i === 5 ? B : L).push([x0 + i * cs, y0, x0 + i * cs, y0 + 10 * cs]);
                (i === 5 ? B : L).push([x0, y0 + i * cs, x0 + 10 * cs, y0 + i * cs]);
            }
            P.lines(L, { w: Math.max(.25, num(o.lw, .2)), c: o.lc });
            P.lines(B, { w: .7, c: '#333333' });
            P.rect(x0, y0, cs * 10, cs * 10, { w: .7, c: '#333333' });
            const h = cs * .4;
            for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
                const v = st + r * 10 + c;
                const show = o.fill === 'all' || (o.fill === 'tens' && v % 10 === 0) || (o.fill === 'gaps' && rand() >= pct);
                if (!show) continue;
                const cx = x0 + c * cs + cs / 2, cy = y0 + r * cs + cs / 2;
                if (o.font === 'print') P.text(cx, cy + h * .5, String(v), { s: h * 1.45, al: 'c', c: '#222222' });
                else P.digits(cx, cy + h / 2, String(v), { h, al: 'c', c: '#222222' });
            }
        },
    };

    /* ---------- Zahlenstrahl ---------- */
    G.numline = {
        group: 'Zahlenstrahl',
        def: { range: '20', count: 6, labels: 'tens', lc: '#333333' },
        schema: [
            { k: 'range', t: 'seg', l: 'Zahlenraum', opts: [['10', 'bis 10'], ['20', 'bis 20'], ['100', 'bis 100'], ['1000', 'bis 1000']] },
            { k: 'count', t: 'num', l: 'Zahlenstrahlen pro Seite', min: 1, max: 14, step: 1 },
            { k: 'labels', t: 'sel', l: 'Beschriftung', opts: [['all', 'alle großen Striche'], ['tens', 'einige'], ['ends', 'nur Anfang und Ende'], ['none', 'keine']] },
        ],
        draw(P, A, o) {
            const R = +o.range || 20, cnt = clamp(Math.round(num(o.count, 6)), 1, 20);
            const step = R <= 20 ? 1 : R === 100 ? 1 : 10, mid = R <= 20 ? 5 : R === 100 ? 5 : 50, big = R <= 20 ? 10 : R === 100 ? 10 : 100;
            const pitch = A.h / cnt, x0 = A.x0 + 4, x1 = A.x1 - 8, len = x1 - x0;
            const st = { w: .35, c: o.lc };
            for (let i = 0; i < cnt; i++) {
                const y = A.y0 + pitch * (i + .45);
                P.line(x0, y, x1 + 5, y, st);
                P.polyline([[x1 + 3, y - 1.4], [x1 + 6, y], [x1 + 3, y + 1.4]], { fill: o.lc, c: o.lc, w: .2 }, true);
                const L = [];
                for (let v = 0; v <= R; v += step) {
                    const x = x0 + len * v / R, t = v % big === 0 ? 3.2 : v % mid === 0 ? 2.2 : 1.2;
                    L.push([x, y - t, x, y + t]);
                    const lab = o.labels === 'all' ? v % big === 0 || (R <= 10) : o.labels === 'tens' ? (v === 0 || v === R || (R <= 20 ? v % 5 === 0 : v % (big * (R >= 100 ? 5 : 1)) === 0)) : o.labels === 'ends' ? (v === 0 || v === R) : false;
                    if (lab) P.digits(x, y + 8.5, String(v), { h: R >= 1000 ? 3.2 : 3.8, al: 'c', c: '#222222' });
                }
                P.lines(L, st);
            }
        },
    };

    /* ---------- Stellenwerttafel ---------- */
    const PLACE = {
        HZE: [['H', 'Hunderter'], ['Z', 'Zehner'], ['E', 'Einer']],
        THZE: [['T', 'Tausender'], ['H', 'Hunderter'], ['Z', 'Zehner'], ['E', 'Einer']],
        mio: [['M', 'Millionen'], ['HT', 'Hundert-tausender'], ['ZT', 'Zehn-tausender'], ['T', 'Tausender'], ['H', 'Hunderter'], ['Z', 'Zehner'], ['E', 'Einer']],
        dez: [['T', 'Tausender'], ['H', 'Hunderter'], ['Z', 'Zehner'], ['E', 'Einer'], [',', ''], ['z', 'Zehntel'], ['h', 'Hundertstel'], ['t', 'Tausendstel']],
    };
    G.place = {
        group: 'Stellenwerttafel',
        def: { cols: 'THZE', rows: 12, names: true, scheme: 'rainbow', title: 'Stellenwerttafel', lc: '#555555' },
        schema: [
            { k: 'cols', t: 'sel', l: 'Stellen', opts: [['HZE', 'H Z E (bis 1000)'], ['THZE', 'T H Z E (bis 10 000)'], ['mio', 'bis zur Million'], ['dez', 'mit Komma (Dezimalzahlen)']] },
            { k: 'rows', t: 'num', l: 'Zeilen', min: 1, max: 30, step: 1 },
            { k: 'names', t: 'chk', l: 'Namen der Stellen ausschreiben' },
            { k: 'scheme', t: 'sel', l: 'Farben', opts: [['rainbow', 'Bunt'], ['pastel', 'Pastell'], ['gray', 'Graustufen']] },
        ],
        draw(P, A, o) {
            const cols = PLACE[o.cols] || PLACE.THZE, rows = clamp(Math.round(num(o.rows, 12)), 1, 60);
            const weights = cols.map(c => c[0] === ',' ? .35 : 1), tw = weights.reduce((a, b) => a + b, 0);
            const unit = A.w / tw, headH = o.names ? 16 : 10, rowH = Math.min(14, (A.h - headH) / rows);
            let x = A.x0;
            const xs = [];
            cols.forEach(([s, name], i) => {
                const w = weights[i] * unit;
                xs.push([x, w, s]);
                if (s !== ',') {
                    const c = o.scheme === 'gray' ? '#e4e4e4' : numColor([1, 2, 3, 5, 6, 7, 8, 9][i % 8], o.scheme === 'pastel' ? 'pastel' : 'rainbow');
                    P.rect(x, A.y0, w, headH, { fill: c });
                    P.text(x + w / 2, A.y0 + (o.names ? 6.5 : 7), s, { s: 5.2, b: true, al: 'c', c: '#1f1f1f' });
                    if (o.names) {
                        const parts = name.split('-');
                        parts.forEach((p, j) => P.text(x + w / 2, A.y0 + 10.5 + j * 2.8 - (parts.length - 1) * 1.2, p + (j < parts.length - 1 ? '-' : ''), { s: 2.4, al: 'c', c: '#333333' }));
                    }
                } else {
                    P.text(x + w / 2, A.y0 + headH - 3, ',', { s: 6, b: true, al: 'c' });
                }
                x += w;
            });
            const y1 = A.y0 + headH + rows * rowH, L = [];
            for (const [xx] of xs) L.push([xx, A.y0, xx, y1]);
            L.push([A.x1, A.y0, A.x1, y1]);
            for (let r = 0; r <= rows; r++) L.push([A.x0, A.y0 + headH + r * rowH, A.x1, A.y0 + headH + r * rowH]);
            L.push([A.x0, A.y0, A.x1, A.y0]);
            P.lines(L, { w: Math.max(.25, num(o.lw, .2)), c: o.lc });
        },
    };

    /* ---------- Gemeinsames für Arbeitsblätter: Ziffern in Schul- oder Druckschrift schreiben und messen ---------- */
    const SOL = '#2b6cb0';   // Farbe der eingetragenen Lösungen
    function writer(P, font) {
        const school = font !== 'print';
        return {
            w: (s, h) => school ? P.digitsWidth(s, h) : P.textWidth(s, h * 1.45),
            put: (x, y, s, h, al, c) => school ? P.digits(x, y, s, { h, al: al || 'l', c: c || '#222222' }) : P.text(x, y, s, { s: h * 1.45, al: al || 'l', c: c || '#222222' }),
        };
    }
    /** Ganze Zufallszahl von a bis b */
    const rint = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
    /** Fläche in ein Raster aus Zellen teilen */
    function cells(A, n, cols, gap) {
        const rows = Math.ceil(n / cols), cw = (A.w - (cols - 1) * gap) / cols, ch = (A.h - (rows - 1) * gap) / rows, out = [];
        for (let i = 0; i < n; i++) out.push({ x: A.x0 + (i % cols) * (cw + gap), y: A.y0 + Math.floor(i / cols) * (ch + gap), w: cw, h: ch });
        return out;
    }

    /* ---------- Rechenblätter: Plus, Minus, Mal, Geteilt, mit Platzhaltern und Lösungsblatt ---------- */
    const OPSYM = { '+': '+', '-': '−', '*': '·', ':': ':' };
    function task(rand, op, R, noCarry) {
        for (let t = 0; t < 400; t++) {
            let a, b, c;
            if (op === '+') {
                a = rint(rand, R > 20 ? 2 : 0, R - 1); b = rint(rand, R > 20 ? 1 : 0, R - a); c = a + b;
                if (R > 10 && c < R * .25) continue;
                if (noCarry && R > 10 && (a % 10) + (b % 10) > 9) continue;
                if (noCarry && R > 100 && (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) > 9) continue;
            } else if (op === '-') {
                a = rint(rand, R > 20 ? Math.ceil(R * .2) : 1, R); b = rint(rand, 0, a); c = a - b;
                if (noCarry && R > 10 && (a % 10) < (b % 10)) continue;
                if (noCarry && R > 100 && (Math.floor(a / 10) % 10) < (Math.floor(b / 10) % 10)) continue;
            } else {
                if (R <= 20) { a = rint(rand, 1, R <= 10 ? 5 : 10); b = rint(rand, 1, 10); if (a * b > R) continue; }
                else if (R <= 100) { a = rint(rand, 1, 10); b = rint(rand, 1, 10); }
                else { a = rint(rand, 2, 10); b = rint(rand, 2, 100); if (a * b > R) continue; }
                if (op === '*') c = a * b;
                else { const p = a * b; [a, b, c] = [p, a, b]; }
            }
            return [a, op, b, c];
        }
        return [1, '+', 1, 2];
    }
    G.arith = {
        group: 'Rechenaufgaben',
        def: { ops: '+,-', range: 20, kind: 'result', noCarry: false, count: 30, cols: 3, seed: 5, results: false, font: 'school', title: 'Rechnen', head: 'namedate', lc: '#9a9a9a' },
        schema: [
            { k: 'ops', t: 'multi', l: 'Rechenarten', opts: [['+', 'Plus'], ['-', 'Minus'], ['*', 'Mal'], [':', 'Geteilt']] },
            { k: 'range', t: 'seg', l: 'Zahlenraum', opts: [['10', 'bis 10'], ['20', 'bis 20'], ['100', 'bis 100'], ['1000', 'bis 1000']] },
            { k: 'kind', t: 'sel', l: 'Aufgabenart', opts: [['result', 'Ergebnis gesucht (3 + 4 = __)'], ['gap', 'Platzhalter (3 + __ = 7)'], ['mixed', 'gemischt']] },
            { k: 'noCarry', t: 'chk', l: 'Ohne Zehnerübergang', show: o => +o.range > 10 && /[+-]/.test(String(o.ops)) },
            { k: 'count', t: 'num', l: 'Aufgaben pro Seite', min: 4, max: 60, step: 1 },
            { k: 'cols', t: 'seg', l: 'Spalten', opts: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] },
            { k: 'seed', t: 'shuffle', l: 'Neue Aufgaben' },
            { k: 'results', t: 'chk', l: 'Lösungen eintragen (Lösungsblatt)' },
            { k: 'font', t: 'seg', l: 'Schrift', opts: [['school', 'Schulschrift'], ['print', 'Druckschrift']] },
        ],
        draw(P, A, o, pi) {
            const ops = String(o.ops || '+').split(',').filter(x => OPSYM[x]);
            if (!ops.length) ops.push('+');
            const R = +o.range || 20, n = clamp(Math.round(num(o.count, 30)), 1, 100), cols = clamp(+o.cols || 3, 1, 4);
            const rand = rng(+o.seed * 7919 + pi * 104729 + 17), seen = new Set(), list = [];
            for (let i = 0; i < n; i++) {
                let t;
                for (let k = 0; k < 30; k++) { t = task(rand, ops[i % ops.length], R, o.noCarry); if (!seen.has(t.join())) break; }
                seen.add(t.join());
                const hide = o.kind === 'gap' ? (rand() < .5 ? 0 : 2) : o.kind === 'mixed' ? [0, 2, 3, 3][rint(rand, 0, 3)] : 3;
                list.push({ t, hide });
            }
            // gemischte Rechenarten: Reihenfolge durcheinander
            for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
            const rows = Math.ceil(n / cols), colW = A.w / cols, rowH = Math.min(20, A.h / rows);
            const h = clamp(rowH * .42, 2.5, 7), W = writer(P, o.font), digW = W.w('0', h);
            const blank = Math.max(10, digW * (String(R).length + 1.5));
            list.forEach(({ t, hide }, i) => {
                const col = Math.floor(i / rows), row = i % rows;
                let x = A.x0 + col * colW + 2;
                const y = A.y0 + row * rowH + rowH / 2 + h / 2;
                const parts = [t[0], OPSYM[t[1]], t[2], '=', t[3]];
                parts.forEach((part, k) => {
                    const isHidden = k === (hide === 3 ? 4 : hide);
                    if (isHidden) {
                        P.line(x, y + .8, x + blank, y + .8, { w: .3, c: o.lc });
                        if (o.results) W.put(x + blank / 2, y, String(part), h, 'c', SOL);
                        x += blank + digW * .6;
                    } else {
                        W.put(x, y, String(part), h);
                        x += W.w(String(part), h) + digW * .6;
                    }
                });
            });
        },
    };

    /* ---------- Ziffern schreiben üben: vorgeschrieben, zum Nachspuren gepunktet, dann frei ---------- */
    G.trace = {
        group: 'Ziffern',
        def: { digits: '0,1,2,3,4,5,6,7,8,9', grid: 'box', cell: 10, copies: 4, rowsPer: 1, title: 'Ziffern schreiben', head: 'name', lc: '#b9c3cc' },
        schema: [
            { k: 'digits', t: 'multi', l: 'Ziffern', opts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => [String(i), String(i)]) },
            { k: 'grid', t: 'seg', l: 'Hintergrund', opts: [['box', 'Kästchen'], ['lines', 'Linien'], ['none', 'ohne']] },
            { k: 'cell', t: 'seg', l: 'Größe', opts: [['7', 'klein'], ['10', 'mittel'], ['15', 'groß']] },
            { k: 'copies', t: 'num', l: 'Zum Nachspuren pro Zeile', min: 0, max: 20, step: 1, hint: 'der Rest der Zeile bleibt frei zum Selberschreiben' },
            { k: 'rowsPer', t: 'num', l: 'Zeilen pro Ziffer', min: 1, max: 5, step: 1 },
        ],
        draw(P, A, o) {
            let list = String(o.digits || '').split(',').filter(x => /^\d$/.test(x));
            if (!list.length) list = ['1'];
            const c = clamp(+o.cell || 10, 4, 30), pitch = c * 2, h = c * .82;
            const rows = Math.floor((A.h + c) / pitch), cols = Math.floor(A.w / c);
            const x0 = A.x0 + (A.w - cols * c) / 2, y0 = A.y0;
            const st = { w: num(o.lw, .2), c: o.lc };
            if (o.grid === 'box') {
                const L = [], H = Math.min(A.h, rows * pitch);
                for (let i = 0; i <= cols; i++) L.push([x0 + i * c, y0, x0 + i * c, y0 + H]);
                for (let r = 0; r <= H / c + 1e-6; r++) L.push([x0, y0 + r * c, x0 + cols * c, y0 + r * c]);
                P.lines(L, st);
            }
            const per = clamp(Math.round(num(o.rowsPer, 1)), 1, 10), copies = clamp(Math.round(num(o.copies, 4)), 0, 40);
            for (let r = 0; r < rows; r++) {
                const d = list[Math.floor(r / per) % list.length];
                if (Math.floor(r / per) >= list.length) break;
                const base = y0 + r * pitch + c - (c - h) / 2;
                if (o.grid === 'lines') {
                    P.lines([[x0, base - h, x0 + cols * c, base - h], [x0, base - h / 2, x0 + cols * c, base - h / 2]], { ...st, dash: [1, 1] });
                    P.line(x0, base, x0 + cols * c, base, { w: st.w * 1.8, c: darkC(o.lc, .3) });
                }
                for (let k = 0, x = x0 + c / 2; x < x0 + cols * c; k++, x += c * 2) {
                    if (k === 0) P.digits(x, base, d, { h, al: 'c', c: '#222222', w: h * .09 });
                    else if (k <= copies) P.digits(x, base, d, { h, al: 'c', c: '#9aa3ad', w: h * .09, dash: true });
                }
            }
        },
    };

    /* ---------- Uhr lernen: Uhrzeit ablesen oder Zeiger einzeichnen ---------- */
    const p2 = n => String(n).padStart(2, '0');
    G.clock = {
        group: 'Uhren',
        def: { mode: 'read', count: 6, step: 'half', nums: true, h24: false, mins: false, seed: 9, results: false, title: 'Wie spät ist es?', head: 'name', lc: '#333333' },
        schema: [
            { k: 'mode', t: 'sel', l: 'Aufgabe', opts: [['read', 'Uhrzeit ablesen (Zeiger sind gezeichnet)'], ['draw', 'Zeiger einzeichnen (Uhrzeit steht darunter)'], ['blank', 'leere Uhren']] },
            { k: 'count', t: 'seg', l: 'Uhren pro Seite', opts: [['4', '4'], ['6', '6'], ['9', '9'], ['12', '12']] },
            { k: 'step', t: 'sel', l: 'Uhrzeiten', show: o => o.mode !== 'blank', opts: [['full', 'volle Stunden'], ['half', 'halbe Stunden'], ['quarter', 'Viertelstunden'], ['5', 'in 5-Minuten-Schritten'], ['1', 'jede Minute']] },
            { k: 'nums', t: 'chk', l: 'Zahlen 1 bis 12' },
            { k: 'h24', t: 'chk', l: 'Zahlen 13 bis 24 (innen)' },
            { k: 'mins', t: 'chk', l: 'Minuten außen (5, 10, 15 …)' },
            { k: 'seed', t: 'shuffle', l: 'Neue Uhrzeiten', show: o => o.mode !== 'blank' },
            { k: 'results', t: 'chk', l: 'Lösungen eintragen', show: o => o.mode !== 'blank' },
        ],
        draw(P, A, o, pi) {
            const n = +o.count || 6, cols = n <= 6 ? 2 : 3, rand = rng(+o.seed * 3301 + pi * 77 + 9);
            const step = { full: 60, half: 30, quarter: 15, 5: 5, 1: 1 }[o.step] || 30;
            const lab = o.mode === 'blank' ? 0 : 12;
            cells(A, n, cols, 6).forEach(C => {
                const r = Math.min(C.w, C.h - lab) / 2 * (o.mins ? .78 : .9), cx = C.x + C.w / 2, cy = C.y + (C.h - lab) / 2;
                const hh = rint(rand, 1, 12), mm = rint(rand, 0, 60 / step - 1) * step;
                P.circle(cx, cy, r, { w: Math.max(.5, r * .025), c: o.lc, fill: '#ffffff' });
                const T1 = [], T5 = [];
                for (let i = 0; i < 60; i++) {
                    const a = i * Math.PI / 30, big = i % 5 === 0, r2 = r * (big ? .87 : .93);
                    (big ? T5 : T1).push([cx + Math.sin(a) * r2, cy - Math.cos(a) * r2, cx + Math.sin(a) * r * .985, cy - Math.cos(a) * r * .985]);
                }
                P.lines(T1, { w: r * .008 + .1, c: o.lc }).lines(T5, { w: r * .022 + .15, c: o.lc });
                for (let i = 1; i <= 12; i++) {
                    const a = i * Math.PI / 6;
                    if (o.nums) { const h = r * .15; P.digits(cx + Math.sin(a) * r * .72, cy - Math.cos(a) * r * .72 + h / 2, String(i), { h, al: 'c', c: '#222222' }); }
                    if (o.h24) { const h = r * .085; P.digits(cx + Math.sin(a) * r * .52, cy - Math.cos(a) * r * .52 + h / 2, String(i + 12 === 24 ? 24 : i + 12), { h, al: 'c', c: '#777777' }); }
                    if (o.mins) { const h = r * .085; P.digits(cx + Math.sin(a) * r * 1.13, cy - Math.cos(a) * r * 1.13 + h / 2, p2(i * 5 % 60), { h, al: 'c', c: '#2b6cb0' }); }
                }
                const showHands = o.mode === 'read' || (o.mode === 'draw' && o.results);
                if (showHands) {
                    const ah = ((hh % 12) + mm / 60) * Math.PI / 6, am = mm * Math.PI / 30;
                    const col = o.mode === 'draw' ? SOL : '#222222';
                    P.line(cx, cy, cx + Math.sin(ah) * r * .5, cy - Math.cos(ah) * r * .5, { w: r * .06, c: col, cap: 'round' });
                    P.line(cx, cy, cx + Math.sin(am) * r * .8, cy - Math.cos(am) * r * .8, { w: r * .035, c: col, cap: 'round' });
                }
                P.circle(cx, cy, r * .035, { fill: '#222222' });
                if (!lab) return;
                const y = C.y + C.h - 2.5, h = 5;
                if (o.mode === 'draw') {
                    const t = hh + ':' + p2(mm);
                    const w = P.digitsWidth(t, h) + 2 + P.textWidth('Uhr', h * 1.3);
                    P.digits(cx - w / 2, y, t, { h, c: '#222222' }).text(cx - w / 2 + P.digitsWidth(t, h) + 2, y, 'Uhr', { s: h * 1.3, c: '#222222' });
                } else {
                    const bw = 14, x = cx - (bw * 2 + 4 + 12) / 2;
                    P.line(x, y + .6, x + bw, y + .6, { w: .3, c: '#888888' }).digits(x + bw + 2, y, ':', { h, al: 'c' }).line(x + bw + 4, y + .6, x + 2 * bw + 4, y + .6, { w: .3, c: '#888888' });
                    P.text(x + 2 * bw + 6, y, 'Uhr', { s: h * 1.3, c: '#222222' });
                    if (o.results) P.digits(x + bw / 2, y - .4, String(hh), { h, al: 'c', c: SOL }).digits(x + bw * 1.5 + 4, y - .4, p2(mm), { h, al: 'c', c: SOL });
                }
            });
        },
    };

    /* ---------- Zahlenmauern und Rechendreiecke ---------- */
    G.wall = {
        group: 'Zahlenmauern',
        def: { kind: 'wall', levels: 3, range: 20, fill: 'bottom', count: 6, seed: 4, results: false, scheme: 'rainbow', font: 'school', title: 'Zahlenmauern', head: 'name', lc: '#555555' },
        schema: [
            { k: 'kind', t: 'seg', l: 'Art', opts: [['wall', 'Zahlenmauern'], ['tri', 'Rechendreiecke']] },
            { k: 'levels', t: 'seg', l: 'Stufen', show: o => o.kind === 'wall', opts: [['3', '3'], ['4', '4'], ['5', '5']] },
            { k: 'range', t: 'seg', l: 'Zahlenraum', opts: [['10', 'bis 10'], ['20', 'bis 20'], ['100', 'bis 100'], ['1000', 'bis 1000']] },
            { k: 'fill', t: 'sel', l: 'Vorgegeben', opts: [['bottom', 'die unteren Zahlen (bzw. innen)'], ['mixed', 'gemischt, zum Knobeln'], ['empty', 'nichts, selbst ausdenken']] },
            { k: 'count', t: 'num', l: 'Anzahl pro Seite', min: 1, max: 12, step: 1 },
            { k: 'seed', t: 'shuffle', l: 'Neue Zahlen', show: o => o.fill !== 'empty' },
            { k: 'results', t: 'chk', l: 'Lösungen eintragen', show: o => o.fill !== 'empty' },
            { k: 'scheme', t: 'sel', l: 'Farben', opts: [['rainbow', 'bunt'], ['pastel', 'Pastell'], ['gray', 'Graustufen'], ['none', 'ohne']] },
            { k: 'font', t: 'seg', l: 'Schrift', opts: [['school', 'Schulschrift'], ['print', 'Druckschrift']] },
        ],
        draw(P, A, o, pi) {
            const R = +o.range || 20, n = clamp(Math.round(num(o.count, 6)), 1, 20), rand = rng(+o.seed * 6007 + pi * 131 + 1);
            const W = writer(P, o.font), st = { w: .45, c: o.lc };
            const colorOf = i => o.scheme === 'none' ? '#ffffff' : o.scheme === 'gray' ? (i % 2 ? '#ececec' : '#f6f6f6') : light(numColor(i + 1, 'rainbow'), o.scheme === 'pastel' ? .78 : .62);
            const cols = n <= 2 ? 1 : n <= 8 ? 2 : 3;
            const C = cells(A, n, cols, 8);
            const cell = (x, y, w, hgt, val, shown, fill) => {
                P.rect(x, y, w, hgt, { fill, c: o.lc, w: st.w });
                if (val == null) return;
                if (shown) W.put(x + w / 2, y + hgt / 2 + hgt * .2, String(val), hgt * .4, 'c');
                else if (o.results) W.put(x + w / 2, y + hgt / 2 + hgt * .2, String(val), hgt * .4, 'c', SOL);
            };
            C.forEach((B, idx) => {
                if (o.kind === 'tri') {
                    // Innenfelder a, b, c in den Ecken, außen die Summen der Nachbarn
                    let a, b, c;
                    for (let t = 0; t < 300; t++) { a = rint(rand, 0, Math.floor(R / 2)); b = rint(rand, 0, Math.floor(R / 2)); c = rint(rand, 0, Math.floor(R / 2)); if (Math.max(a + b, b + c, a + c) <= R && a + b + c > R * .3) break; }
                    const s = Math.min(B.w, B.h * 1.1) * .78, cx = B.x + B.w / 2, hgt = s * Math.sqrt(3) / 2, top = B.y + (B.h - hgt) / 2 + 2;
                    const V = [[cx, top], [cx - s / 2, top + hgt], [cx + s / 2, top + hgt]];
                    P.polyline(V, { w: .6, c: o.lc, fill: colorOf(idx) }, true);
                    const g = [cx, top + hgt * 2 / 3], box = s * .19;
                    const inner = V.map(v => [g[0] + (v[0] - g[0]) * .55, g[1] + (v[1] - g[1]) * .55]);
                    const vals = [a, b, c], sums = [a + b, b + c, a + c], sumPos = [[0, 1], [1, 2], [0, 2]];
                    const showIn = [true, true, true], showOut = [false, false, false];
                    if (o.fill === 'mixed') {
                        // ein Innenfeld fehlt, dafür steht eine Summe daneben, in der es steckt
                        const k = rint(rand, 0, 2);
                        showIn[k] = false;
                        const withK = sumPos.map((pr, j) => pr.includes(k) ? j : -1).filter(j => j >= 0);
                        showOut[withK[rint(rand, 0, withK.length - 1)]] = true;
                    }
                    inner.forEach((p, i) => cell(p[0] - box / 2, p[1] - box / 2, box, box, o.fill === 'empty' ? null : vals[i], showIn[i], '#ffffff'));
                    sumPos.forEach(([i, j], k) => {
                        const m = [(V[i][0] + V[j][0]) / 2, (V[i][1] + V[j][1]) / 2], d = [m[0] - g[0], m[1] - g[1]], L = Math.hypot(d[0], d[1]);
                        const p = [m[0] + d[0] / L * box * .9, m[1] + d[1] / L * box * .9];
                        cell(p[0] - box * .65, p[1] - box / 2, box * 1.3, box, o.fill === 'empty' ? null : sums[k], showOut[k], '#ffffff');
                    });
                    return;
                }
                const L = +o.levels || 3;
                let base = [];
                const weights = [];
                for (let i = 0; i < L; i++) { let w = 1; for (let k = 0; k < i; k++) w = w * (L - 1 - k) / (k + 1); weights.push(Math.round(w)); }
                for (let t = 0; t < 400; t++) {
                    const max = Math.max(1, Math.floor(R / weights.reduce((x, y) => x + y, 0) * 1.8));
                    base = Array.from({ length: L }, () => rint(rand, R > 10 ? 1 : 0, max));
                    const top = base.reduce((s, v, i) => s + v * weights[i], 0);
                    if (top <= R && top >= R * .35) break;
                }
                const rowsV = [base];
                for (let r = 1; r < L; r++) rowsV.push(rowsV[r - 1].slice(1).map((v, i) => v + rowsV[r - 1][i]));
                const shown = rowsV.map((row, r) => row.map(() => r === 0));
                if (o.fill === 'mixed') {
                    const hide = L >= 4 ? [rint(rand, 0, 1), rint(rand, L - 2, L - 1)] : [rint(rand, 0, L - 1)];
                    for (const i of hide) { shown[0][i] = false; const p = i < L - 1 ? i : i - 1; shown[1][p] = true; }
                }
                const bw = Math.min(B.w * .96 / L, B.h * .9 * 2 / L, 34), bh = bw * .5;
                const yb = B.y + B.h / 2 + L * bh / 2 - bh;
                rowsV.forEach((row, r) => {
                    const w0 = B.x + B.w / 2 - row.length * bw / 2;
                    row.forEach((v, i) => cell(w0 + i * bw, yb - r * bh, bw, bh, o.fill === 'empty' ? null : v, shown[r][i], r === 0 ? colorOf(idx) : '#ffffff'));
                });
            });
        },
    };

    /* ---------- Storyboard und Comic ---------- */
    G.story = {
        group: 'Bilder',
        def: { kind: 'story', cols: 2, rows: 3, ratio: '16:9', tl: 2, lc: '#444444' },
        schema: [
            { k: 'kind', t: 'seg', l: 'Art', opts: [['story', 'Storyboard'], ['comic', 'Comic']] },
            { k: 'cols', t: 'num', l: 'Spalten', min: 1, max: 6, step: 1 },
            { k: 'rows', t: 'num', l: 'Reihen', min: 1, max: 8, step: 1 },
            { k: 'ratio', t: 'sel', l: 'Bildformat', show: o => o.kind === 'story', opts: [['16:9', '16 : 9'], ['4:3', '4 : 3'], ['1:1', 'quadratisch'], ['3:4', 'hoch']] },
            { k: 'tl', t: 'num', l: 'Schreiblinien unter jedem Bild', min: 0, max: 8, step: 1, show: o => o.kind === 'story' },
        ],
        draw(P, A, o, pi) {
            const cols = clamp(Math.round(num(o.cols, 2)), 1, 8), rows = clamp(Math.round(num(o.rows, 3)), 1, 10), g = 5;
            const st = { w: .5, c: o.lc }, lst = { w: .2, c: '#9a9a9a' };
            if (o.kind === 'comic') {
                // unterschiedlich breite Felder, damit es nach Comic aussieht
                const rand = rng(pi * 7 + 13), rh = (A.h - (rows - 1) * g) / rows;
                for (let r = 0; r < rows; r++) {
                    const n = cols === 1 ? 1 : Math.max(1, cols - (rand() < .4 ? 1 : 0));
                    const ws = Array.from({ length: n }, () => .7 + rand() * .8), sum = ws.reduce((a, b) => a + b, 0);
                    let x = A.x0;
                    ws.forEach(w => { const ww = (A.w - (n - 1) * g) * w / sum; P.rect(x, A.y0 + r * (rh + g), ww, rh, { w: .6, c: o.lc, r: 1 }); x += ww + g; });
                }
                return;
            }
            const [rw, rhh] = String(o.ratio || '16:9').split(':').map(Number), tl = clamp(Math.round(num(o.tl, 2)), 0, 12), lp = 7;
            const cw = (A.w - (cols - 1) * g) / cols, cellH = (A.h - (rows - 1) * g) / rows;
            let fw = cw, fh = cw * rhh / rw;
            if (fh + tl * lp > cellH) { fh = Math.max(10, cellH - tl * lp); fw = Math.min(cw, fh * rw / rhh); }
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const x = A.x0 + c * (cw + g) + (cw - fw) / 2, y = A.y0 + r * (cellH + g);
                P.rect(x, y, fw, fh, st);
                const L = [];
                for (let i = 1; i <= tl; i++) L.push([x, y + fh + i * lp, x + fw, y + fh + i * lp]);
                if (L.length) P.lines(L, lst);
            }
        },
    };

    /* ---------- Logarithmenpapier (einfach oder doppelt logarithmisch) ---------- */
    function logTicks(len, dec) {
        const out = [];
        for (let d = 0; d < dec; d++) for (let m = 1; m < 10; m += (m < 2 ? .1 : m < 5 ? .2 : .5)) {
            const v = Math.round(m * 10) / 10;
            out.push({ p: (d + Math.log10(v)) / dec * len, k: v === 1 ? 2 : Number.isInteger(v) ? 1 : 0, v, d });
        }
        out.push({ p: len, k: 2, v: 1, d: dec });
        return out;
    }
    G.log = {
        group: 'Achsen',
        def: { xd: 0, yd: 3, lc: '#3f8f5a' },
        schema: [
            { k: 'xd', t: 'num', l: 'Dekaden waagerecht', min: 0, max: 6, step: 1, norm: true, hint: '0 = gleichmäßige mm-Teilung' },
            { k: 'yd', t: 'num', l: 'Dekaden senkrecht', min: 0, max: 8, step: 1, norm: true, hint: '0 = gleichmäßige mm-Teilung' },
        ],
        draw(P, A, o) {
            const xd = clamp(Math.round(num(o.xd, 0)), 0, 8), yd = clamp(Math.round(num(o.yd, 3)), 0, 10);
            const x0 = A.x0 + 6, y0 = A.y0, W = Math.floor((A.w - 6) / 10) * 10, H = Math.floor((A.h - 6) / 10) * 10;
            const w = num(o.lw, .2), sty = [{ w: w * .4, c: light(o.lc, .45) }, { w: w * .8, c: o.lc }, { w: w * 1.6, c: o.lc }];
            const groups = [[], [], []];
            const lin = len => { const t = []; for (let i = 0; i <= len; i++) t.push({ p: i, k: i % 10 === 0 ? 2 : i % 5 === 0 ? 1 : 0 }); return t; };
            const xt = xd ? logTicks(W, xd) : lin(W), yt = yd ? logTicks(H, yd) : lin(H);
            for (const t of xt) groups[t.k].push([x0 + t.p, y0, x0 + t.p, y0 + H]);
            for (const t of yt) groups[t.k].push([x0, y0 + H - t.p, x0 + W, y0 + H - t.p]);
            groups.forEach((g, i) => P.lines(g, sty[i]));
            const lab = { s: 2.3, c: darkC(o.lc, .3) };
            if (xd) for (const t of xt) if (t.k >= 1 && (t.v === 1 || t.v === 2 || t.v === 5)) P.text(x0 + t.p, y0 + H + 3.2, String(t.v), { ...lab, al: 'c' });
            if (yd) for (const t of yt) if (t.k >= 1 && (t.v === 1 || t.v === 2 || t.v === 5)) P.text(x0 - 1.2, y0 + H - t.p + .8, String(t.v), { ...lab, al: 'r' });
        },
    };

    /* ---------- Polarkoordinaten ---------- */
    G.polar = {
        group: 'Polarkoordinaten',
        def: { ring: 10, deg: 15, lc: '#3f6f9f' },
        schema: [
            { k: 'ring', t: 'num', l: 'Abstand der Kreise', u: 'mm', min: 2, max: 40, step: 1, norm: true },
            { k: 'deg', t: 'sel', l: 'Winkelteilung', norm: true, opts: [['5', '5°'], ['10', '10°'], ['15', '15°'], ['30', '30°']] },
        ],
        draw(P, A, o) {
            const R = Math.min(A.w, A.h - 8) / 2 - 4, cx = (A.x0 + A.x1) / 2, cy = A.y0 + 4 + R + 4, ring = clamp(num(o.ring, 10), 1, 100), deg = +o.deg || 15;
            const w = num(o.lw, .2);
            for (let r = ring / 2, i = 1; r <= R + 1e-6; r += ring / 2, i++) P.circle(cx, cy, r, { w: i % 2 ? w * .4 : w, c: i % 2 ? light(o.lc, .45) : o.lc });
            const L = [], Lb = [];
            for (let a = 0; a < 360; a += deg) {
                const t = a * Math.PI / 180;
                (a % 90 === 0 ? Lb : L).push([cx, cy, cx + R * Math.cos(t), cy - R * Math.sin(t)]);
                P.text(cx + (R + 3.2) * Math.cos(t), cy - (R + 3.2) * Math.sin(t) + .9, a + '°', { s: 2.4, al: 'c', c: darkC(o.lc, .3) });
            }
            P.lines(L, { w: w * .8, c: o.lc }).lines(Lb, { w: w * 1.6, c: o.lc });
        },
    };

    /* ---------- Wahrscheinlichkeitsnetz (Normalverteilung) ---------- */
    function probit(p) {   // Umkehrfunktion der Normalverteilung (Acklam)
        const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
        const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
        const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
        const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
        const q = p < .5 ? p : 1 - p;
        let x;
        if (q < .02425) { const r = Math.sqrt(-2 * Math.log(q)); x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
        else { const r = q - .5, s = r * r; x = (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1); }
        return p < .5 ? x : -x;
    }
    G.prob = {
        group: 'Wahrscheinlichkeitsnetz',
        def: { lc: '#7a4fa0' },
        schema: [],
        draw(P, A, o) {
            const x0 = A.x0 + 10, W = Math.floor((A.w - 10) / 10) * 10, y0 = A.y0 + 2, H = A.h - 6, w = num(o.lw, .2);
            const Z = 3.3, map = p => y0 + H / 2 - probit(p) / Z * H / 2;
            const ps = [.1, .2, .5, 1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 99.5, 99.8, 99.9];
            const minor = [], major = [];
            for (let p = 1; p < 99; p += 1) minor.push(map(p / 100));
            for (const p of ps) major.push(map(p / 100));
            P.lines(minor.map(y => [x0, y, x0 + W, y]), { w: w * .4, c: light(o.lc, .5) });
            P.lines(major.map(y => [x0, y, x0 + W, y]), { w: w, c: o.lc });
            const V = [];
            for (let x = 0; x <= W; x += 2) V.push([x0 + x, map(.999), x0 + x, map(.001), x % 10 === 0]);
            P.lines(V.filter(v => !v[4]), { w: w * .4, c: light(o.lc, .5) }).lines(V.filter(v => v[4]), { w: w, c: o.lc });
            ps.forEach(p => P.text(x0 - 1.2, map(p / 100) + .8, String(p).replace('.', ',') + ' %', { s: 2.2, al: 'r', c: darkC(o.lc, .3) }));
        },
    };

    /* ---------- Schreibkästchen für Chinesisch (Tianzige, Mizige) und Japanisch (Genkō yōshi) ---------- */
    G.tian = {
        group: 'Kästchen',
        def: { cell: 15, mi: false, gapRow: 0, lc: '#c0392b' },
        schema: [
            { k: 'cell', t: 'num', l: 'Kästchengröße', u: 'mm', min: 6, max: 40, step: .5, norm: true },
            { k: 'mi', t: 'chk', l: 'Mit Diagonalen (Mizige)', norm: true },
            { k: 'gapRow', t: 'num', l: 'Abstand zwischen den Reihen', u: 'mm', min: 0, max: 20, step: .5 },
        ],
        draw(P, A, o) {
            const s = clamp(num(o.cell, 15), 2, 80), g = clamp(num(o.gapRow, 0), 0, 50);
            const cols = Math.floor(A.w / s), rows = Math.floor((A.h + g) / (s + g));
            const x0 = A.x0 + (A.w - cols * s) / 2, y0 = A.y0 + (A.h - (rows * (s + g) - g)) / 2;
            const w = num(o.lw, .2), outer = [], inner = [];
            for (let r = 0; r < rows; r++) {
                const y = y0 + r * (s + g);
                outer.push([x0, y, x0 + cols * s, y], [x0, y + s, x0 + cols * s, y + s]);
                for (let c = 0; c <= cols; c++) outer.push([x0 + c * s, y, x0 + c * s, y + s]);
                for (let c = 0; c < cols; c++) {
                    const x = x0 + c * s;
                    inner.push([x, y + s / 2, x + s, y + s / 2], [x + s / 2, y, x + s / 2, y + s]);
                    if (o.mi) inner.push([x, y, x + s, y + s], [x + s, y, x, y + s]);
                }
            }
            P.lines(inner, { w: w * .7, c: light(o.lc, .3), dash: [1, .9] });
            P.lines(outer, { w: w * 1.6, c: o.lc });
        },
    };
    G.genko = {
        group: 'Genkō yōshi',
        def: { cols: 20, rows: 20, lc: '#3f8f5a' },
        schema: [
            { k: 'cols', t: 'num', l: 'Spalten', min: 5, max: 40, step: 1, norm: true },
            { k: 'rows', t: 'num', l: 'Kästchen pro Spalte', min: 5, max: 40, step: 1, norm: true },
        ],
        draw(P, A, o) {
            const cols = clamp(Math.round(num(o.cols, 20)), 1, 60), rows = clamp(Math.round(num(o.rows, 20)), 1, 60), k = .35;
            const s = Math.min(A.h / rows, A.w / (cols + (cols - 1) * k)), gap = s * k;
            const W = cols * s + (cols - 1) * gap, x0 = A.x0 + (A.w - W) / 2, y0 = A.y0 + (A.h - rows * s) / 2, L = [];
            for (let c = 0; c < cols; c++) {
                const x = x0 + c * (s + gap);
                L.push([x, y0, x, y0 + rows * s], [x + s, y0, x + s, y0 + rows * s]);
                for (let r = 0; r <= rows; r++) L.push([x, y0 + r * s, x + s, y0 + r * s]);
            }
            P.lines(L, { w: num(o.lw, .2), c: o.lc });
            P.rect(x0 - 2, y0 - 2, W + 4, rows * s + 4, { w: num(o.lw, .2) * 2.5, c: o.lc });
        },
    };

    /* ---------- Druckertest: druckt der Drucker in Originalgröße? ---------- */
    G.test = {
        group: 'Druckertest',
        def: { title: 'Druckertest: stimmt die Größe?' },
        schema: [],
        draw(P, A, o) {
            const x = A.x0 + 5, y = A.y0 + 22, ink = '#222222';
            P.text(x, A.y0 + 6, 'Leg ein Lineal an die Linie unten. Ist sie genau 10 cm lang, druckt dein Drucker in Originalgröße.', { s: 3.4, c: ink });
            P.text(x, A.y0 + 11, 'Ist sie kürzer: im Druckfenster „Tatsächliche Größe“ oder „100 %“ wählen statt „An Seite anpassen“.', { s: 3.4, c: ink });
            const ruler = (x0, y0, vertical) => {
                const L = [];
                for (let i = 0; i <= 100; i++) {
                    const t = i % 10 === 0 ? 4 : i % 5 === 0 ? 2.8 : 1.6;
                    L.push(vertical ? [x0, y0 + i, x0 + t, y0 + i] : [x0 + i, y0, x0 + i, y0 + t]);
                    if (i % 10 === 0) vertical ? P.text(x0 + 5.5, y0 + i + 1.1, String(i / 10), { s: 2.8 }) : P.text(x0 + i, y0 + 7.8, String(i / 10), { s: 2.8, al: 'c' });
                }
                P.lines(L, { w: .2, c: ink });
                vertical ? P.line(x0, y0, x0, y0 + 100, { w: .5, c: ink }) : P.line(x0, y0, x0 + 100, y0, { w: .5, c: ink });
            };
            ruler(x, y, false);
            P.text(x + 104, y + 3, '10 cm waagerecht', { s: 3, c: '#555555' });
            ruler(x, y + 20, true);
            P.text(x + 12, y + 120, '10 cm senkrecht', { s: 3, c: '#555555' });
            P.rect(x + 40, y + 30, 50, 50, { w: .4, c: ink });
            P.text(x + 65, y + 57, 'Quadrat 5 × 5 cm', { s: 3, al: 'c', c: '#555555' });
            // Wie weit kommt der Drucker an den Rand?
            const pw = P.w, ph = P.h;
            [3, 5, 8].forEach((m, i) => {
                const c = ['#e03131', '#f08c00', '#2f9e44'][i];
                P.rect(m, m, pw - 2 * m, ph - 2 * m, { w: .3, c, dash: [2, 1.5] });
                P.text(pw - m - 2, ph * .62 + i * 5, m + ' mm vom Rand', { s: 2.8, c, al: 'r' });
            });
            P.text(x, y + 135, 'Die farbigen Rahmen zeigen, wie nah dein Drucker an die Blattkante kommt: was fehlt, kann er nicht drucken.', { s: 3, c: '#555555' });
        },
    };

    /* ---------- Tabelle: Stundenplan, Vokabeln, Hausaufgaben, eigene Tabellen ---------- */
    const HEAD_COLORS = [['#dcefd6', 'Grün'], ['#d8e8f8', 'Blau'], ['#fdf1b8', 'Gelb'], ['#fbe0d4', 'Rosa'], ['#e9e3f5', 'Lila'], ['#e6e6e6', 'Grau']];
    const splitList = s => String(s || '').split(/[,;]/).map(x => x.trim());
    G.table = {
        group: 'Tabelle',
        def: { cols: 3, widths: '', rows: 0, rowH: 9, thead: true, heads: '', headScheme: 'one', headC: '#dcefd6', rowLabels: '', num: false, zebra: false, lc: '#666666' },
        schema: [
            { k: 'cols', t: 'num', l: 'Spalten', min: 1, max: 20, step: 1 },
            { k: 'widths', t: 'text', l: 'Spaltenbreiten', ph: 'z. B. 1, 3, 3', hint: 'als Verhältnis, durch Komma getrennt. Leer = alle gleich breit' },
            { k: 'rows', t: 'num', l: 'Zeilen', min: 0, max: 80, step: 1, hint: '0 = so viele, wie aufs Blatt passen' },
            { k: 'rowH', t: 'num', l: 'Zeilenhöhe', u: 'mm', min: 4, max: 60, step: .5, show: o => !(+o.rows > 0) },
            { k: 'thead', t: 'chk', l: 'Kopfzeile mit Spaltentiteln' },
            { k: 'heads', t: 'text', l: 'Spaltentitel', ph: 'z. B. Deutsch, Englisch', hint: 'durch Komma getrennt', show: o => !!o.thead },
            { k: 'headScheme', t: 'seg', l: 'Farbe der Kopfzeile', show: o => !!o.thead, opts: [['one', 'eine Farbe'], ['rainbow', 'bunt'], ['none', 'ohne']] },
            { k: 'headC', t: 'color', l: 'Kopffarbe', show: o => !!o.thead && o.headScheme === 'one', opts: HEAD_COLORS },
            { k: 'rowLabels', t: 'text', l: 'Text in der ersten Spalte', ph: 'z. B. Montag, Dienstag', hint: 'durch Komma getrennt, eine Angabe pro Zeile' },
            { k: 'num', t: 'chk', l: 'Zeilen nummerieren' },
            { k: 'zebra', t: 'chk', l: 'Jede zweite Zeile leicht grau' },
        ],
        draw(P, A, o) {
            const cols = clamp(Math.round(num(o.cols, 3)), 1, 30);
            const ws = splitList(o.widths).map(Number).filter(v => v > 0);
            while (ws.length < cols) ws.push(1);
            const wsum = ws.slice(0, cols).reduce((a, b) => a + b, 0);
            const xs = [A.x0];
            for (let c = 0; c < cols; c++) xs.push(xs[c] + A.w * ws[c] / wsum);
            const heads = splitList(o.heads);
            const headH = o.thead ? clamp(num(o.rowH, 9) * 1.15, 8, 16) : 0;
            let rows = Math.round(num(o.rows, 0)), rowH = clamp(num(o.rowH, 9), 2, 100);
            if (rows > 0) rowH = (A.h - headH) / rows;
            else rows = Math.max(1, Math.floor((A.h - headH) / rowH + 1e-6));
            const y1 = A.y0 + headH + rows * rowH;
            if (o.thead && o.headScheme !== 'none') {
                for (let c = 0; c < cols; c++) {
                    const fill = o.headScheme === 'rainbow' ? light(RAINBOW[c % 10], .55) : (o.headC || '#dcefd6');
                    P.rect(xs[c], A.y0, xs[c + 1] - xs[c], headH, { fill });
                }
            }
            if (o.zebra) for (let r = 1; r < rows; r += 2) P.rect(A.x0, A.y0 + headH + r * rowH, A.w, rowH, { fill: '#f1f2f4' });
            const st = { w: Math.max(.2, num(o.lw, .2)), c: o.lc };
            const L = [];
            for (const x of xs) L.push([x, A.y0, x, y1]);
            for (let r = 0; r <= rows; r++) L.push([A.x0, A.y0 + headH + r * rowH, A.x1, A.y0 + headH + r * rowH]);
            if (o.thead) L.push([A.x0, A.y0, A.x1, A.y0]);
            P.lines(L, st);
            if (o.thead) P.line(A.x0, A.y0 + headH, A.x1, A.y0 + headH, { w: st.w * 2.2, c: o.lc });
            const hs = Math.min(4.2, headH * .42);
            const fitS = (t, size, w, bold) => { const tw = P.textWidth(t, size, bold); return tw > w ? Math.max(1.2, size * w / tw) : size; };
            if (o.thead) for (let c = 0; c < cols; c++) if (heads[c]) { const fs = fitS(heads[c], hs, xs[c + 1] - xs[c] - 2, true); P.text((xs[c] + xs[c + 1]) / 2, A.y0 + headH / 2 + fs * .36, heads[c], { s: fs, b: true, al: 'c', c: '#222222' }); }
            const labels = splitList(o.rowLabels).filter((v, i, a) => a.length > 1 || v);
            const ls = Math.min(3.8, rowH * .42);
            for (let r = 0; r < rows; r++) {
                const t = o.num ? (r + 1) + '.' : labels[r] || '';
                if (t) { const fs = fitS(t, ls, xs[1] - xs[0] - 3); P.text(xs[0] + 1.8, A.y0 + headH + r * rowH + rowH / 2 + fs * .36, t, { s: fs, c: '#333333' }); }
            }
        },
    };

    /* ---------- Kasten zum Malen (für Bild und Text auf einem Blatt) ---------- */
    G.box = {
        group: 'Kasten',
        def: { boxR: 3, boxLabel: '' },
        schema: [
            { k: 'boxLabel', t: 'text', l: 'Beschriftung im Kasten', ph: 'z. B. Mein Bild' },
            { k: 'boxR', t: 'num', l: 'Runde Ecken', u: 'mm', min: 0, max: 15, step: 1 },
        ],
        draw(P, A, o) {
            P.rect(A.x0, A.y0, A.w, A.h, { w: Math.max(.4, num(o.lw, .2) * 2.2), c: o.lc, r: num(o.boxR, 3) });
            if (o.boxLabel) P.text(A.x0 + 3, A.y0 + 6, o.boxLabel, { s: 3.6, c: '#777777' });
        },
    };

    /* ---------- Baukasten: bis zu drei Bereiche übereinander, jeder mit eigener Art ---------- */
    const ZONE_TYPES = [['lines', 'Liniert / Lineatur'], ['grid', 'Kariert / Rautiert'], ['dots', 'Punkte / Kreuze'], ['mm', 'Millimeter'],
        ['iso', 'Isometrie / Dreiecke'], ['hex', 'Sechsecke'], ['staff', 'Notenlinien / Tabulatur'], ['table', 'Tabelle'], ['box', 'Kasten zum Malen'], ['blank', 'Leer']];
    const SKIP = ['lc', 'title', 'head'];   // gelten fürs ganze Blatt, nicht pro Bereich
    const zk = (n, t, k) => 'z' + n + '_' + t + '_' + k;
    /** Schnellwahl: die Papiere, die man immer braucht, mit einem Tipp */
    const QUICK = [
        ['Lineatur 1 (4 Linien, 5 mm)', 'lines', { sys: 'four', band: 5, ratio: '1:1:1', gap: 5, band2: 0, kon: 'gaps' }],
        ['Lineatur 2 (4 Linien, 4 mm)', 'lines', { sys: 'four', band: 4, ratio: '1:1:1', gap: 5, band2: 0, kon: 'gaps' }],
        ['Lineatur 3 (2 Linien, 3,5 mm)', 'lines', { sys: 'double', band: 3.5, pitch: 12, kon: 'none' }],
        ['Lineatur 4 (liniert 10 mm)', 'lines', { sys: 'single', pitch: 10 }],
        ['Liniert 9 mm (ab Klasse 5)', 'lines', { sys: 'single', pitch: 9 }],
        ['Liniert 8 mm', 'lines', { sys: 'single', pitch: 8 }],
        ['Kariert 5 mm', 'grid', { cw: 5, ch: 5, shrink: 0 }],
        ['Kariert 7 mm', 'grid', { cw: 7, ch: 7, shrink: 0 }],
        ['Kariert 10 mm', 'grid', { cw: 10, ch: 10, shrink: 0 }],
        ['Rautiert 5 × 9 mm', 'grid', { cw: 5, ch: 9, shrink: 0 }],
        ['Punkte 5 mm', 'dots', { sp: 5, style: 'dot' }],
        ['Millimeterpapier', 'mm', {}],
        ['Isometrie', 'iso', { style: 'dots' }],
        ['Notenlinien', 'staff', { n: 5, lg: 2.3, sgap: 22, tab: false }],
        ['Tabelle', 'table', {}],
        ['Kasten zum Malen', 'box', {}],
        ['Leer', 'blank', {}],
    ];
    function zoneView(o, n) {
        const t = G[o['z' + n + '_type']] ? o['z' + n + '_type'] : 'blank', g = G[t];
        const v = { ...o };
        for (const k in g.def) if (!SKIP.includes(k)) v[k] = o[zk(n, t, k)] !== undefined ? o[zk(n, t, k)] : g.def[k];
        return { t, g, v };
    }
    G.build = {
        group: 'Aufteilung',
        def: (() => {
            const d = { zones: 1, z1_h: 50, z2_h: 30, zgap: 8, z1_type: 'grid', z2_type: 'lines', z3_type: 'lines', z1_preset: '', z2_preset: '', z3_preset: '' };
            for (let n = 1; n <= 3; n++) for (const [t] of ZONE_TYPES) for (const k in G[t].def) if (!SKIP.includes(k)) d[zk(n, t, k)] = G[t].def[k];
            return d;
        })(),
        schema: (() => {
            const S = [
                { g: 'Aufteilung', k: 'zones', t: 'seg', l: 'Bereiche auf dem Blatt', opts: [['1', 'ganzes Blatt'], ['2', '2 Bereiche'], ['3', '3 Bereiche']], hint: 'z. B. oben ein Kasten zum Malen, unten Linien zum Schreiben' },
                { g: 'Aufteilung', k: 'z1_h', t: 'num', l: 'Höhe Bereich 1', u: '%', min: 10, max: 90, step: 5, show: o => +o.zones >= 2 },
                { g: 'Aufteilung', k: 'z2_h', t: 'num', l: 'Höhe Bereich 2', u: '%', min: 10, max: 80, step: 5, show: o => +o.zones >= 3 },
                { g: 'Aufteilung', k: 'zgap', t: 'num', l: 'Abstand zwischen den Bereichen', u: 'mm', min: 0, max: 40, step: 1, show: o => +o.zones >= 2 },
            ];
            for (let n = 1; n <= 3; n++) {
                const g = 'Bereich ' + n, on = o => +o.zones >= n;
                S.push({ g, k: 'z' + n + '_preset', t: 'preset', l: 'Schnellwahl', show: on,
                    opts: QUICK.map(([label, t, patch]) => [label, Object.fromEntries([['z' + n + '_type', t], ...Object.entries(patch).map(([k, v]) => [zk(n, t, k), v])])]) });
                S.push({ g, k: 'z' + n + '_type', t: 'sel', l: 'Art', show: on, opts: ZONE_TYPES });
                for (const [t] of ZONE_TYPES) {
                    for (const s of G[t].schema || []) {
                        if (SKIP.includes(s.k)) continue;
                        const inner = s.show;
                        S.push({ ...s, g, k: zk(n, t, s.k), norm: false,
                            show: o => +o.zones >= n && o['z' + n + '_type'] === t && (!inner || inner(zoneView(o, n).v)) });
                    }
                }
            }
            return S;
        })(),
        draw(P, A, o, pi) {
            const n = clamp(Math.round(num(o.zones, 1)), 1, 3), gap = n > 1 ? clamp(num(o.zgap, 8), 0, 60) : 0;
            const H = A.h - gap * (n - 1);
            const hs = n === 1 ? [H] : n === 2 ? [H * clamp(num(o.z1_h, 50), 5, 95) / 100] : [H * clamp(num(o.z1_h, 50), 5, 90) / 100, H * clamp(num(o.z2_h, 30), 5, 90) / 100];
            if (n > 1) hs.push(Math.max(5, H - hs.reduce((a, b) => a + b, 0)));
            let y = A.y0;
            for (let i = 1; i <= n; i++) {
                const h = hs[i - 1], Z = { x0: A.x0, x1: A.x1, w: A.w, y0: y, y1: y + h, h };
                const { g, v } = zoneView(o, i);
                if (h > 4) g.draw(P, Z, v, pi);
                y += h + gap;
            }
        },
    };

    /** Ein Papier im Baukasten weiterbearbeiten: seine Einstellungen als Bereich 1 */
    const BUILD_TYPES = ZONE_TYPES.map(z => z[0]);
    function toBuild(paper, o) {
        const t = paper.gen;
        if (!BUILD_TYPES.includes(t)) return null;
        const out = { zones: 1, z1_type: t };
        for (const k in COMMON) out[k] = o[k];
        for (const k in G[t].def) if (!SKIP.includes(k)) out[zk(1, t, k)] = o[k];
        if (G[t].def.lc && o.lc) out.lc = o.lc;
        return out;
    }

    /* =====================================================================================================
       Zusammenbauen
       ===================================================================================================== */
    function genOf(paper) { return G[paper.gen] || G.blank; }

    function options(paper) {
        const g = genOf(paper);
        const o = { ...COMMON, ...g.def, ...(paper.def || {}) };
        return g.fix ? g.fix(o) : o;   // z. B. Kalender: Jahr passend zum heutigen Datum
    }

    /** Regler in Gruppen: erst die eigenen des Papiers, dann die gemeinsamen */
    function schema(paper) {
        const g = genOf(paper);
        const own = (g.schema || []).map(s => ({ ...s, g: s.g || g.group }));
        // Papiere, die ihre Seitenzahl selbst bestimmen (Kalender), brauchen den Regler „Seiten“ nicht
        return own.concat(g.pages ? COMMON_SCHEMA.filter(s => s.k !== 'pages') : COMMON_SCHEMA);
    }

    /** Genormte Werte, die vom Original abweichen */
    function changed(paper, o) {
        const base = options(paper), out = [];
        for (const s of schema(paper)) {
            if (!s.norm) continue;
            if (s.show && !s.show(o)) continue;
            if (String(o[s.k]) !== String(base[s.k])) out.push(s);
        }
        return out;
    }

    /** Eingaben säubern: Zahlen bleiben in ihren Grenzen */
    function clean(paper, o) {
        const base = options(paper), out = { ...base, ...o };
        for (const s of schema(paper)) {
            if (s.t === 'num') out[s.k] = clamp(num(out[s.k], base[s.k]), s.min, s.max);
            else if (s.t === 'chk') out[s.k] = !!out[s.k];
            else if (s.t === 'color' && !/^#[0-9a-f]{6}$/i.test(out[s.k])) out[s.k] = base[s.k];
            else if (s.t === 'text') out[s.k] = String(out[s.k] == null ? '' : out[s.k]).slice(0, 2000);
        }
        return out;
    }

    function build(paper, o, opt) {
        opt = opt || {};
        o = clean(paper, o);
        const g = genOf(paper), doc = BLPdf.doc();
        const two = o.fmt === 'A5x2';
        const [fw, fh] = FORMATS[two ? 'A5' : o.fmt] || FORMATS.A4;
        const q = o.ori === 'q';
        const sw = q ? fh : fw, sh = q ? fw : fh;              // Größe eines Blatts
        let pw = sw, ph = sh, frames = [{ x: 0, y: 0, w: sw, h: sh }];
        if (two) {
            if (q) { pw = 210; ph = 297; frames = [{ x: 0, y: 0, w: 210, h: 148.5 }, { x: 0, y: 148.5, w: 210, h: 148.5 }]; }
            else { pw = 297; ph = 210; frames = [{ x: 0, y: 0, w: 148.5, h: 210 }, { x: 148.5, y: 0, w: 148.5, h: 210 }]; }
        }
        const total = g.pages ? clamp(g.pages(o), 1, 400) : null;   // Kalender: so viele Blätter wie Monate, Wochen oder Tage
        const pages = opt.thumb ? 1 : total ? Math.ceil(total / frames.length) : clamp(Math.round(num(o.pages, 1)), 1, 50);
        let k = 0;
        for (let p = 0; p < pages; p++) {
            const P = doc.page(pw, ph);
            for (const fr of frames) {
                if (total && k >= total && !opt.thumb) break;
                const A = area(P, fr, o, k);
                if (A.w > 5 && A.h > 5) g.draw(P, A, o, k);
                k++;
            }
            if (two) {
                // Schnittlinie mit Schere
                const cut = { w: .2, c: '#b0b0b0', dash: [2, 2] };
                if (q) P.line(4, 148.5, 206, 148.5, cut).text(6, 147.3, 'hier schneiden', { s: 2.2, c: '#999999' });
                else P.line(148.5, 4, 148.5, 206, cut).text(150, 8, 'hier schneiden', { s: 2.2, c: '#999999' });
            }
        }
        return doc;
    }

    self.BLPapers = { options, schema, changed, clean, build, toBuild, gens: G, COMMON, LINE_COLORS, numColor,
        helpers: { clamp, num, mix, light, darkC, rng, RAINBOW, writer, area, rectPath, cells } };
})();
