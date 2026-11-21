/* blanko – Druck-Engine. Ohne fremde Bibliothek, läuft auch ohne Netz.

   Ein Papier wird einmal als Liste von Zeichenbefehlen beschrieben, alle Maße in Millimetern, y zählt von oben.
   Aus derselben Liste entstehen die Vorschau (Canvas) und das PDF. Die Vorschau zeigt also genau, was aus dem Drucker kommt.

   const doc = BLPdf.doc();
   const P = doc.page(210, 297);              // neue Seite, Breite und Höhe in mm
   P.line(x1, y1, x2, y2, st)                 // st = { w: Strichstärke mm, c: '#rrggbb', dash: [an, aus] mm, cap: 'round' }
   P.lines([[x1, y1, x2, y2], …], st)         // viele Linien gleicher Art in einem Befehl (kleines PDF)
   P.rect(x, y, w, h, st)                     // st = { fill, c (Rand), w, r (Eckenradius) }
   P.circle(cx, cy, r, st), P.dots([[x, y], …], r, c)
   P.path(segs, st)                           // segs = [['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y], ['Z']]
   P.text(x, y, s, st)                        // y = Grundlinie, st = { s: Schriftgröße mm, b: fett, c, al: 'l'|'c'|'r' }
   P.digits(x, y, s, st)                      // Ziffern in Schulschrift (Strichschrift), st = { h: Ziffernhöhe mm, w, c, al }
   P.clip(segs) … P.unclip()                  // Zeichnen auf eine Fläche begrenzen
   doc.pages, doc.size(i), doc.draw(ctx, i), doc.bytes(titel)

   Fest eingebaut und nicht abschaltbar: unten auf jeder Seite links „Kostenlos erstellt mit blanko.burnersen.de“
   und rechts „Noch mehr cooles Zeugs auf burnersen.de“. */
(function () {
    'use strict';
    const K = 72 / 25.4;   // Punkt pro Millimeter
    const BRAND_L = 'Kostenlos erstellt mit blanko.burnersen.de';
    const BRAND_R = 'Noch mehr cooles Zeugs auf burnersen.de';

    // Breiten der Zeichen 32 bis 255 in Tausendsteln der Schriftgröße (Adobe-Metriken Helvetica, WinAnsi)
    const W = {
        r: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
        b: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
    };
    const CSS_FONT = 'Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif';
    // Zeichen, die WinAnsi zwischen 128 und 159 anders belegt als Unicode
    const WIN = { '€': 128, '‚': 130, '„': 132, '…': 133, '‰': 137, '‹': 139, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '™': 153, '›': 155 };
    const UNWIN = {};
    for (const ch in WIN) UNWIN[WIN[ch]] = ch;

    /** Text in WinAnsi-Bytes. Unbekanntes ohne Akzent, sonst weg. */
    function enc(s) {
        let out = '';
        for (const ch of String(s == null ? '' : s).replace(/\s+/g, ' ')) {
            const c = ch.codePointAt(0);
            if ((c >= 32 && c < 127) || (c >= 160 && c < 256)) out += ch;
            else if (WIN[ch]) out += String.fromCharCode(WIN[ch]);
            else {
                const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
                if (base && base !== ch && base.codePointAt(0) < 256) out += enc(base);
            }
        }
        return out;
    }
    const dec = s => s.replace(/[\x80-\x9f]/g, ch => UNWIN[ch.charCodeAt(0)] || '');
    const esc = s => s.replace(/[\\()]/g, '\\$&');
    const f = n => { const v = Math.round(n * 100) / 100; return (Object.is(v, -0) ? 0 : v).toString(); };

    /** Breite eines kodierten Texts in mm */
    function textWidth(s, size, bold) {
        const t = W[bold ? 'b' : 'r'];
        let w = 0;
        for (let i = 0; i < s.length; i++) w += t[s.charCodeAt(i) - 32] || 556;
        return w * size / 1000;
    }

    /* ---------- Farben ---------- */
    function rgb(c) {
        if (Array.isArray(c)) return c;
        const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '#000000'));
        const n = m ? parseInt(m[1], 16) : 0;
        return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    }
    const css = c => { const [r, g, b] = rgb(c); return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')'; };
    const pdfCol = c => rgb(c).map(v => f(v)).join(' ');

    /* ---------- Formen als Pfade ---------- */
    const KAPPA = 0.5522847498;
    function ellipse(cx, cy, rx, ry) {
        const kx = rx * KAPPA, ky = ry * KAPPA;
        return [['M', cx + rx, cy], ['C', cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry], ['C', cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
            ['C', cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry], ['C', cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy], ['Z']];
    }
    /** Kreisbogen von Winkel a0 nach a1 (Bogenmaß, im Uhrzeigersinn bei y nach unten), als Bézierstücke */
    function arc(cx, cy, r, a0, a1, move) {
        const segs = [];
        const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2)));
        const da = (a1 - a0) / n, k = 4 / 3 * Math.tan(da / 4) * r;
        if (move !== false) segs.push(['M', cx + r * Math.cos(a0), cy + r * Math.sin(a0)]);
        for (let i = 0; i < n; i++) {
            const t0 = a0 + i * da, t1 = t0 + da;
            const x0 = cx + r * Math.cos(t0), y0 = cy + r * Math.sin(t0), x1 = cx + r * Math.cos(t1), y1 = cy + r * Math.sin(t1);
            segs.push(['C', x0 - k * Math.sin(t0), y0 + k * Math.cos(t0), x1 + k * Math.sin(t1), y1 - k * Math.cos(t1), x1, y1]);
        }
        return segs;
    }
    function roundRect(x, y, w, h, r) {
        r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
        if (!r) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
        const k = r * (1 - KAPPA);
        return [['M', x + r, y], ['L', x + w - r, y], ['C', x + w - k, y, x + w, y + k, x + w, y + r], ['L', x + w, y + h - r],
            ['C', x + w, y + h - k, x + w - k, y + h, x + w - r, y + h], ['L', x + r, y + h], ['C', x + k, y + h, x, y + h - k, x, y + h - r],
            ['L', x, y + r], ['C', x, y + k, x + k, y, x + r, y], ['Z']];
    }

    /* ---------- Schulschrift: Ziffern und Rechenzeichen als Striche, wie Kinder sie lernen (offene 4, 7 mit Querstrich).
       Einheit: 1 = Ziffernhöhe, y von oben (0) bis zur Grundlinie (1). a = Breite. E = Ellipse (cx cy rx ry). ---------- */
    const GLYPHS = {
        '0': { a: .56, d: 'E .28 .5 .25 .5' },
        '1': { a: .4, d: 'M .04 .28 L .3 0 L .3 1' },
        '2': { a: .56, d: 'M .05 .24 C .08 .06 .22 0 .3 0 C .45 0 .53 .1 .53 .24 C .53 .38 .44 .48 .05 1 L .55 1' },
        '3': { a: .56, d: 'M .06 .12 C .14 .03 .24 0 .3 0 C .44 0 .51 .1 .51 .22 C .51 .36 .4 .46 .22 .46 M .22 .46 C .44 .46 .54 .58 .54 .72 C .54 .9 .42 1 .27 1 C .17 1 .09 .97 .03 .9' },
        '4': { a: .58, d: 'M .1 0 L .05 .64 L .56 .64 M .43 .2 L .43 1' },
        '5': { a: .56, d: 'M .52 0 L .13 0 L .08 .43 C .16 .37 .24 .35 .3 .35 C .46 .35 .54 .48 .54 .66 C .54 .86 .43 1 .26 1 C .17 1 .09 .97 .03 .9' },
        '6': { a: .56, d: 'M .47 .05 C .41 .02 .36 0 .31 0 C .13 0 .05 .2 .05 .55 C .05 .86 .15 1 .3 1 C .45 1 .54 .88 .54 .72 C .54 .56 .44 .45 .3 .45 C .17 .45 .08 .54 .05 .64' },
        '7': { a: .56, d: 'M .04 0 L .54 0 L .2 1 M .14 .52 L .46 .52' },
        '8': { a: .56, d: 'E .28 .24 .2 .24 E .28 .72 .25 .28' },
        '9': { a: .56, d: 'M .51 .28 C .51 .12 .42 0 .28 0 C .13 0 .05 .12 .05 .28 C .05 .44 .15 .55 .28 .55 C .41 .55 .51 .45 .51 .28 C .51 .62 .49 .82 .42 1' },
        '+': { a: .6, d: 'M .06 .55 L .54 .55 M .3 .31 L .3 .79' },
        '-': { a: .5, d: 'M .07 .55 L .43 .55' },
        '−': { a: .5, d: 'M .07 .55 L .43 .55' },
        '=': { a: .6, d: 'M .07 .44 L .53 .44 M .07 .66 L .53 .66' },
        '×': { a: .56, d: 'M .1 .35 L .46 .75 M .46 .35 L .1 .75' },
        '·': { a: .3, d: 'D .15 .55' },
        ':': { a: .3, d: 'D .15 .36 D .15 .76' },
        ',': { a: .26, d: 'M .15 .9 L .08 1.12' },
        '.': { a: .26, d: 'D .13 .95' },
        '?': { a: .5, d: 'M .06 .18 C .1 .05 .2 0 .27 0 C .4 0 .47 .1 .47 .21 C .47 .38 .26 .44 .26 .66 D .26 .95' },
        ' ': { a: .4, d: '' },
        '_': { a: .8, d: 'M .04 1 L .76 1' },
    };
    const glyphCache = {};
    function glyph(ch) {
        if (glyphCache[ch]) return glyphCache[ch];
        const g = GLYPHS[ch];
        if (!g) return null;
        const t = g.d.trim().split(/\s+/).filter(Boolean);
        const segs = [], dots = [];
        for (let i = 0; i < t.length;) {
            const c = t[i++], n = () => +t[i++];
            if (c === 'M' || c === 'L') segs.push([c, n(), n()]);
            else if (c === 'C') segs.push(['C', n(), n(), n(), n(), n(), n()]);
            else if (c === 'E') { const cx = n(), cy = n(), rx = n(), ry = n(); segs.push(...ellipse(cx, cy, rx, ry)); }
            else if (c === 'D') dots.push([n(), n()]);
        }
        return glyphCache[ch] = { a: g.a, segs, dots };
    }
    const digitsWidth = (s, h) => [...String(s)].reduce((w, ch) => w + ((glyph(ch) || glyph('?')).a + .1) * h, 0) - .1 * h;

    /* ---------- Dokument ---------- */
    function doc() {
        const pages = [];
        function page(w, h) {
            const ops = [];
            const pg = { w, h, ops, branded: false };
            pages.push(pg);
            const st = s => s || {};
            const P = {
                w, h,
                path(d, s) { s = st(s); if (d.length) ops.push({ k: 'p', d, fill: s.fill || null, c: s.fill && !s.c ? null : (s.c || '#000000'), w: s.w == null ? .2 : s.w, dash: s.dash || null, cap: s.cap || 'butt', join: s.join || 'miter', stroke: s.c != null || !s.fill }); return P; },
                line(x1, y1, x2, y2, s) { return P.path([['M', x1, y1], ['L', x2, y2]], s); },
                lines(list, s) { const d = []; for (const l of list) d.push(['M', l[0], l[1]], ['L', l[2], l[3]]); return P.path(d, s); },
                polyline(pts, s, close) { const d = pts.map((p, i) => [i ? 'L' : 'M', p[0], p[1]]); if (close) d.push(['Z']); return P.path(d, s); },
                rect(x, y, rw, rh, s) { s = st(s); return P.path(roundRect(x, y, rw, rh, s.r), s); },
                circle(cx, cy, r, s) { return P.path(ellipse(cx, cy, r, r), s); },
                ellipse(cx, cy, rx, ry, s) { return P.path(ellipse(cx, cy, rx, ry), s); },
                arc(cx, cy, r, a0, a1, s) { return P.path(arc(cx, cy, r, a0, a1), s); },
                dots(list, r, c) { const d = []; for (const p of list) d.push(...ellipse(p[0], p[1], r, r)); return P.path(d, { fill: c || '#000000' }); },
                text(x, y, s, o) {
                    o = st(o);
                    const t = enc(s);
                    if (!t) return P;
                    const size = o.s || 4, bold = !!o.b, tw = textWidth(t, size, bold);
                    const xx = o.al === 'r' ? x - tw : o.al === 'c' ? x - tw / 2 : x;
                    ops.push({ k: 't', x: xx, y, s: t, size, b: bold, c: o.c || '#000000' });
                    return P;
                },
                textWidth: (s, size, bold) => textWidth(enc(s), size, bold),
                digits(x, y, s, o) {
                    o = st(o);
                    const hh = o.h || 6, chars = [...String(s)];
                    let xx = o.al === 'r' ? x - digitsWidth(s, hh) : o.al === 'c' ? x - digitsWidth(s, hh) / 2 : x;
                    const d = [], dots = [];
                    for (const ch of chars) {
                        const g = glyph(ch) || glyph('?');
                        for (const sg of g.segs) {
                            const out = [sg[0]];
                            for (let i = 1; i < sg.length; i += 2) out.push(xx + sg[i] * hh, y - hh + sg[i + 1] * hh);
                            d.push(out);
                        }
                        for (const p of g.dots) dots.push([xx + p[0] * hh, y - hh + p[1] * hh]);
                        xx += (g.a + .1) * hh;
                    }
                    const lw = o.w || hh * .1;
                    // dash: gepunktete Ziffern zum Nachspuren (runde Enden machen aus kurzen Strichen Punkte)
                    if (d.length) P.path(d, { c: o.c || '#000000', w: lw, cap: 'round', join: 'round', dash: o.dash ? [.01, lw * 2.4] : null });
                    if (dots.length) P.dots(dots, lw * .75, o.c || '#000000');
                    return P;
                },
                digitsWidth,
                clip(d) { ops.push({ k: 'clip', d }); return P; },
                unclip() { ops.push({ k: 'unclip' }); return P; },
            };
            return P;
        }

        /** Das feste Branding unten auf jeder Seite, einmal pro Seite, ganz zuletzt (liegt also immer oben) */
        function brand(pg) {
            if (pg.branded) return;
            pg.branded = true;
            const size = 2.5, y = pg.h - 5.6, x0 = 8, x1 = pg.w - 8;
            const l = enc(BRAND_L), r = enc(BRAND_R);
            const lw = textWidth(l, size, false), rw = textWidth(r, size, false);
            // weißer Grund hinter der Schrift, damit sie auf jedem Papier lesbar bleibt
            pg.ops.push({ k: 'p', d: roundRect(x0 - 1, y - size * .85, lw + 2, size * 1.25, .6), fill: '#ffffff', c: null, w: 0, stroke: false });
            pg.ops.push({ k: 'p', d: roundRect(x1 - rw - 1, y - size * .85, rw + 2, size * 1.25, .6), fill: '#ffffff', c: null, w: 0, stroke: false });
            pg.ops.push({ k: 't', x: x0, y, s: l, size, b: false, c: '#6b6b6b' });
            pg.ops.push({ k: 't', x: x1 - rw, y, s: r, size, b: false, c: '#6b6b6b' });
        }

        /* ---------- Vorschau: Seite i auf ein Canvas zeichnen. Der Kontext muss vorher so skaliert sein, dass 1 Einheit 1 mm ist. ---------- */
        function draw(ctx, i) {
            const pg = pages[i];
            if (!pg) return;
            brand(pg);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, pg.w, pg.h);
            ctx.textBaseline = 'alphabetic';
            let clipDepth = 0;
            const trace = d => {
                ctx.beginPath();
                for (const s of d) {
                    if (s[0] === 'M') ctx.moveTo(s[1], s[2]);
                    else if (s[0] === 'L') ctx.lineTo(s[1], s[2]);
                    else if (s[0] === 'C') ctx.bezierCurveTo(s[1], s[2], s[3], s[4], s[5], s[6]);
                    else if (s[0] === 'Z') ctx.closePath();
                }
            };
            for (const op of pg.ops) {
                if (op.k === 'p') {
                    trace(op.d);
                    if (op.fill) { ctx.fillStyle = css(op.fill); ctx.fill(); }
                    if (op.stroke && op.c) {
                        ctx.strokeStyle = css(op.c);
                        // Haarlinien bleiben in der verkleinerten Vorschau sichtbar
                        const px = ctx.getTransform ? Math.abs(ctx.getTransform().a) : 4;
                        ctx.lineWidth = Math.max(op.w, .7 / px);
                        ctx.lineCap = op.cap;
                        ctx.lineJoin = op.join;
                        ctx.setLineDash(op.dash || []);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                } else if (op.k === 't') {
                    ctx.font = (op.b ? 'bold ' : '') + op.size + 'px ' + CSS_FONT;
                    ctx.fillStyle = css(op.c);
                    // Buchstabe für Buchstabe mit den Breiten aus dem PDF, so stimmt die Vorschau auch ohne Helvetica
                    let x = op.x;
                    const s = op.s;
                    if (s.length < 3) ctx.fillText(dec(s), x, op.y);
                    else for (const ch of s) { ctx.fillText(dec(ch), x, op.y); x += textWidth(ch, op.size, op.b); }
                } else if (op.k === 'clip') {
                    ctx.save(); clipDepth++;
                    trace(op.d);
                    ctx.clip();
                } else if (op.k === 'unclip' && clipDepth) {
                    ctx.restore(); clipDepth--;
                }
            }
            while (clipDepth--) ctx.restore();
        }

        /* ---------- Als PDF-Datei ---------- */
        function bytes(title) {
            const streams = pages.map(pg => {
                brand(pg);
                const H = pg.h, out = [];
                const X = x => f(x * K), Y = y => f((H - y) * K);
                const pathStr = d => d.map(s => s[0] === 'M' ? X(s[1]) + ' ' + Y(s[2]) + ' m' : s[0] === 'L' ? X(s[1]) + ' ' + Y(s[2]) + ' l'
                    : s[0] === 'C' ? X(s[1]) + ' ' + Y(s[2]) + ' ' + X(s[3]) + ' ' + Y(s[4]) + ' ' + X(s[5]) + ' ' + Y(s[6]) + ' c' : 'h').join(' ');
                for (const op of pg.ops) {
                    if (op.k === 'p') {
                        let s = 'q ';
                        if (op.fill) s += pdfCol(op.fill) + ' rg ';
                        const stroke = op.stroke && op.c;
                        if (stroke) {
                            s += pdfCol(op.c) + ' RG ' + f(op.w * K) + ' w ' + (op.cap === 'round' ? 1 : op.cap === 'square' ? 2 : 0) + ' J '
                                + (op.join === 'round' ? 1 : op.join === 'bevel' ? 2 : 0) + ' j ';
                            if (op.dash) s += '[' + op.dash.map(v => f(v * K)).join(' ') + '] 0 d ';
                        }
                        s += pathStr(op.d) + ' ' + (op.fill && stroke ? 'B' : op.fill ? 'f' : 'S') + ' Q';
                        out.push(s);
                    } else if (op.k === 't') {
                        out.push(pdfCol(op.c) + ' rg BT /' + (op.b ? 'F2 ' : 'F1 ') + f(op.size * K) + ' Tf ' + X(op.x) + ' ' + Y(op.y) + ' Td (' + esc(op.s) + ') Tj ET 0 g');
                    } else if (op.k === 'clip') {
                        out.push('q ' + pathStr(op.d) + ' W n');
                    } else if (op.k === 'unclip') {
                        out.push('Q');
                    }
                }
                const opens = pg.ops.filter(o => o.k === 'clip').length - pg.ops.filter(o => o.k === 'unclip').length;
                for (let i = 0; i < opens; i++) out.push('Q');
                return out.join('\n');
            });
            const objs = [];
            const add = s => { objs.push(s); return objs.length; };
            const cat = add(''), pagesId = add('');
            const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
            const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
            const kids = streams.map((s, i) => {
                const c = add('<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream');
                return add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + f(pages[i].w * K) + ' ' + f(pages[i].h * K)
                    + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>');
            });
            objs[cat - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R /ViewerPreferences << /PrintScaling /None >> >>';
            objs[pagesId - 1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
            const info = add('<< /Title (' + esc(enc(title || 'blanko')) + ') /Creator (blanko.burnersen.de) /Producer (blanko.burnersen.de) /Author (blanko.burnersen.de) >>');
            let out = '%PDF-1.6\n%\xe2\xe3\xcf\xd3\n';
            const offs = objs.map((s, i) => { const at = out.length; out += (i + 1) + ' 0 obj\n' + s + '\nendobj\n'; return at; });
            const xref = out.length;
            out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
            out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
            const res = new Uint8Array(out.length);
            for (let i = 0; i < out.length; i++) res[i] = out.charCodeAt(i) & 255;
            return res;
        }

        return { page, pages, size: i => pages[i] ? { w: pages[i].w, h: pages[i].h } : null, draw, bytes, get count() { return pages.length; } };
    }

    self.BLPdf = { doc, ellipse, arc, roundRect, BRAND_L, BRAND_R };
})();
