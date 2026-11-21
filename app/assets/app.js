/* blanko – die App: Startseite mit Klassen und Kategorien, Suche, Bearbeiten mit Live-Vorschau, Drucken, Teilen,
   Favoriten, eigene Blätter, Hinweis zum Installieren und das Info-Fenster.
   Das Papier selbst erzeugen papers.js (Generatoren) und pdf.js (Druck-Engine). Alles läuft im Browser, auch offline. */
(function () {
    'use strict';
    const root = document.documentElement;
    const VERSION = root.dataset.v || '';
    const CAT = JSON.parse(document.getElementById('catalog').textContent);
    const PAPERS = CAT.papers, BYID = Object.fromEntries(PAPERS.map(p => [p.id, p]));
    const LINKS = {
        suchsel: 'https://suchsel.burnersen.de/', kaufen: 'https://kaufen.burnersen.de/', site: 'https://burnersen.de/',
        kofi: 'https://ko-fi.com/burnersen', github: 'https://github.com/burnersen/blanko',
        impressum: 'https://tech.burnersen.de/impressum/', datenschutz: 'https://tech.burnersen.de/datenschutz/',
    };
    const GRADES = [[1, '1. Klasse'], [2, '2. Klasse'], [3, '3. Klasse'], [4, '4. Klasse'], [5, 'ab Klasse 5']];

    /* ---------- Kleine Helfer ---------- */
    const $ = s => document.querySelector(s);
    function h(tag, attrs, ...kids) {
        const el = document.createElement(tag);
        for (const k in attrs || {}) {
            const v = attrs[k];
            if (v == null || v === false) continue;
            if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
            else el.setAttribute(k, v === true ? '' : v);
        }
        put(el, ...kids);
        return el;
    }
    function put(el, ...kids) {
        for (const k of kids.flat(9)) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
        return el;
    }
    const ICONS = {
        back: 'M15 5l-7 7 7 7', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
        print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z', download: 'M12 3v12M7 10l5 5 5-5M4 20h16', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
        save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7', reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5', check: 'M5 12l5 5 9-10', warn: 'M12 3l9 16H3zM12 10v4M12 17v.5',
        info: 'M12 8v.5M12 11v6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
        globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', play: 'M8 5v14l11-7z', cart: 'M3 4h2l2.5 11h11L21 7H7M9 20a1 1 0 1 0 0-.1M18 20a1 1 0 1 0 0-.1',
        github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.8 5.8 3.1 5.8 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
        sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
        install: 'M12 3v12M7 10l5 5 5-5M5 21h14', ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2', close: 'M6 6l12 12M18 6 6 18',
        help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7v.5M12 17v.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
        share: 'M12 3v13M7 8l5-5 5 5M5 14v6h14v-6', plus: 'M4 4h16v16H4zM12 8v8M8 12h8', tools: 'M4 5h16M4 12h10M4 19h6M17 10l3 3-6 6h-3v-3z',
    };
    const icon = n => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICONS[n] || ''); s.append(p); return s; };
    const LS = {
        get(k, d) { try { const v = JSON.parse(localStorage.getItem('bl_' + k)); return v == null ? d : v; } catch (e) { return d; } },
        set(k, v) { try { v == null ? localStorage.removeItem('bl_' + k) : localStorage.setItem('bl_' + k, JSON.stringify(v)); } catch (e) {} },
    };
    let toastTimer = 0;
    function toast(msg, action) {
        const t = $('#toast');
        t.replaceChildren(h('span', null, msg));
        if (action) t.append(h('button', { class: 'btn', type: 'button', onclick: () => { t.hidden = true; action[1](); } }, action[0]));
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, action ? 12000 : 3200);
    }
    const norm = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
    const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = () => /Android/i.test(navigator.userAgent);
    const isMobile = () => isIOS() || isAndroid();
    const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    /* ---------- Fenster ---------- */
    function sheet(title, body) {
        const shade = h('div', { class: 'shade', onclick: e => { if (e.target === shade) close(); } });
        const close = () => { shade.remove(); document.removeEventListener('keydown', esc); };
        const esc = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', esc);
        shade.append(h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
            h('header', null, h('h2', null, title), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Schließen', onclick: close }, icon('close'))), body));
        $('#layer').append(shade);
        return { close };
    }

    /* ---------- Einstellungen der App (hell/dunkel, Farbe) ---------- */
    const SET = LS.get('set', {});
    function applySet() {
        const dark = SET.theme === 'dark' || (SET.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        root.dataset.theme = dark ? 'dark' : 'light';
        if (SET.accent) root.dataset.accent = SET.accent; else delete root.dataset.accent;
    }
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applySet);

    /* ---------- Vorschaubilder für die Karten, erst wenn sie sichtbar werden ---------- */
    const thumbCache = new Map();
    const ZOOM = ['lines', 'grid', 'dots', 'mm', 'iso', 'hex', 'staff', 'tian', 'genko', 'log', 'prob'];
    const thumbObs = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
        for (const e of es) if (e.isIntersecting) { thumbObs.unobserve(e.target); drawThumb(e.target); }
    }, { rootMargin: '200px' }) : null;
    function drawThumb(box) {
        const p = BYID[box.dataset.id];
        if (!p) return;
        const key = p.id + (box.dataset.o || '');
        const o = box.dataset.o ? JSON.parse(box.dataset.o) : BLPapers.options(p);
        const doc = BLPapers.build(p, o, { thumb: true }), sz = doc.size(0);
        // Linien und Raster als vergrößerter Ausschnitt (sonst sieht man in der kleinen Karte nur Grau), alles andere ganz
        const zoom = ZOOM.includes(p.gen) ? 2.3 : 1;
        const dpr = Math.min(2, devicePixelRatio || 1), W = 150 * dpr, H = W * 297 / 210;
        const c = h('canvas');
        c.width = Math.round(W); c.height = Math.round(H);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        if (zoom > 1) {
            const scale = W / 210 * zoom;
            ctx.scale(scale, scale);
            ctx.translate(-4, -4);
        } else {
            const scale = Math.min(W / sz.w, H / sz.h);
            ctx.translate((W - sz.w * scale) / 2, (H - sz.h * scale) / 2);
            ctx.scale(scale, scale);
        }
        doc.draw(ctx, 0);
        box.replaceChildren(c);
        thumbCache.set(key, c);
    }
    /* ---------- Favoriten: Stern auf jeder Karte, im Kopf der Seite und ganz oben auf der Startseite ---------- */
    const favs = () => LS.get('fav', []).filter(id => BYID[id]);
    function toggleFav(id) {
        let f = LS.get('fav', []);
        const on = !f.includes(id);
        f = on ? [id, ...f.filter(x => x !== id)] : f.filter(x => x !== id);
        LS.set('fav', f);
        updateFavCount();
        toast(on ? 'Bei den Favoriten gemerkt. Du findest sie oben beim Stern.' : 'Aus den Favoriten entfernt');
        return on;
    }
    function updateFavCount() { const b = $('#favBtn'); if (b) b.dataset.n = favs().length || ''; }

    function card(p, extra) {
        const box = h('div', { class: 'thumb', 'data-id': p.id });
        if (extra && extra.o) box.dataset.o = JSON.stringify(extra.o);
        const key = p.id + (box.dataset.o || ''), cached = thumbCache.get(key);
        if (cached && !cached.isConnected) box.replaceChildren(cached);
        else thumbObs ? thumbObs.observe(box) : setTimeout(() => drawThumb(box));
        const href = '?p=' + encodeURIComponent(p.id) + (extra && extra.mine != null ? '&m=' + extra.mine : '');
        const star = extra && extra.mine != null ? null : h('button', { class: 'cstar' + (favs().includes(p.id) ? ' on' : ''), type: 'button', 'aria-label': 'Favorit', title: 'Als Favorit merken',
            onclick: e => {
                e.preventDefault(); e.stopPropagation();
                star.classList.toggle('on', toggleFav(p.id));
                if (!new URLSearchParams(location.search).toString() && !$('#q').value.trim()) { const y = scrollY; showHome(); scrollTo(0, y); }
            } }, icon('star'));
        return h('a', { class: 'card', href, onclick: e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(href); } },
            box, p.nr ? h('span', { class: 'nr' }, p.nr) : null, star,
            h('b', null, extra && extra.name || p.name), h('span', null, extra && extra.sub || p.short));
    }

    /* ---------- Navigation ---------- */
    let navCount = 0;
    function go(url, replace) {
        if (!replace) navCount++;
        history[replace ? 'replaceState' : 'pushState'](null, '', url);
        route();
        scrollTo(0, 0);
    }
    window.addEventListener('popstate', () => { navCount = Math.max(0, navCount - 1); route(); });
    let current = null;   // offenes Papier (für Aufräumen)
    let onPaper = false;  // beim Bearbeiten bleibt der Hinweis zum Installieren weg
    function route() {
        const sp = new URLSearchParams(location.search);
        const id = sp.get('p'), k = sp.get('k'), q = $('#q').value.trim();
        current = null;
        onPaper = !!(id && BYID[id]);
        renderBanner();
        if (id && BYID[id]) return showPaper(BYID[id], sp.get('m'));
        if (k) return showGrade(+k);
        if (q) return showSearch(q);
        showHome();
    }

    /* ---------- Startseite ---------- */
    function showHome() {
        document.title = 'blanko: Lineaturen, Karopapier und Schulpapier kostenlos ausdrucken';
        const v = $('#view');
        const recent = LS.get('recent', []).filter(id => BYID[id]).slice(0, 6);
        const fav = LS.get('fav', []).filter(id => BYID[id]);
        const mine = LS.get('mine', []).filter(m => BYID[m.id]);
        v.replaceChildren();
        const favSec = fav.length ? section('★ Deine Favoriten', 'immer griffbereit', fav.map(id => card(BYID[id]))) : null;
        if (favSec) favSec.classList.add('favs');
        put(v,
            favSec,
            h('section', { class: 'hero' },
                h('h1', null, 'Welches Papier brauchst du?'),
                h('p', null, 'Alle Lineaturen für die Schule, Karopapier, Einmaleins und mehr. In Originalgröße, kostenlos und auch ohne Internet.'),
                h('div', { class: 'grades' }, GRADES.map(([g, label]) => h('button', { class: 'chip', type: 'button', onclick: () => go('?k=' + g) }, label))),
                h('a', { class: 'buildcta', href: '?p=baukasten', onclick: e => { e.preventDefault(); go('?p=baukasten'); } }, icon('tools'),
                    h('span', null, h('b', null, 'Eigenes Papier gestalten'), h('small', null, 'Liniert, kariert, Punkte, Tabelle oder alles zusammen auf einem Blatt'))),
                !fav.length ? h('p', { class: 'favhint' }, 'Tipp: Tippe bei einem Papier auf den Stern ☆, dann steht es hier ganz oben und du musst nicht mehr suchen.') : null),
            mine.length ? section('Meine Blätter', 'selbst eingestellt und gespeichert', mine.map((m, i) => card(BYID[m.id], { o: m.o, name: m.name, sub: BYID[m.id].name, mine: i }))) : null,
            recent.length ? section('Zuletzt benutzt', '', recent.map(id => card(BYID[id]))) : null,
            h('h2', { class: 'areahead' }, 'Für die Schule'),
            CAT.cats.filter(c => c.area !== 'frei').map(catSection),
            h('div', { class: 'area free' },
                h('h2', { class: 'areahead' }, 'Für zu Hause, Hobby und Beruf'),
                h('p', { class: 'muted' }, 'Planen, gestalten und alles, was nicht direkt mit der Schule zu tun hat.'),
                CAT.cats.filter(c => c.area === 'frei').map(catSection)),
            footer());
    }
    function catSection(c) {
        const s = section(c.name, c.sub, PAPERS.filter(p => p.cat === c.id).map(p => card(p)));
        if (c.id === 'spezial') {
            s.classList.add('special');
            s.insertBefore(h('p', null, 'Für Technik, Studium und Sprachen. Für die Grundschule brauchst du die meistens nicht.'), s.children[1]);
        }
        return s;
    }
    function section(title, sub, cards) {
        return h('section', { class: 'sec' }, h('h2', null, title, sub ? h('small', null, sub) : null), h('div', { class: 'grid' }, cards));
    }
    function footer() {
        return h('footer', { class: 'foot' },
            h('div', null, 'blanko ist kostenlos, ohne Werbung und ohne Anmeldung. Gemacht von ', h('a', { href: LINKS.site, target: '_blank', rel: 'noopener' }, 'burnersen.de'), '.'),
            h('div', { class: 'links' },
                h('a', { href: LINKS.suchsel, target: '_blank', rel: 'noopener' }, 'Suchsel: Wortsuchrätsel'),
                h('a', { href: LINKS.kaufen, target: '_blank', rel: 'noopener' }, 'Kaufen: Einkaufslisten'),
                h('a', { href: LINKS.kofi, target: '_blank', rel: 'noopener' }, 'Spendier mir einen Kaffee'),
                h('a', { href: LINKS.impressum, target: '_blank', rel: 'noopener' }, 'Impressum'),
                h('a', { href: LINKS.datenschutz, target: '_blank', rel: 'noopener' }, 'Datenschutz')));
    }
    function listView(title, list, sub) {
        const v = $('#view');
        v.replaceChildren();
        put(v,
            h('div', { class: 'listhead' }, h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Zurück', onclick: () => { $('#q').value = ''; go('./'); } }, icon('back')), h('h1', null, title)),
            sub ? h('p', { class: 'muted' }, sub) : null,
            list.length ? h('div', { class: 'grid' }, list.map(p => card(p))) : h('p', { class: 'empty' }, 'Dazu habe ich leider nichts gefunden. Versuch es mit einem anderen Wort, zum Beispiel „kariert“, „liniert“ oder einer Lineatur-Nummer.'),
            footer());
    }
    function showGrade(g) {
        const label = (GRADES.find(x => x[0] === g) || [0, ''])[1];
        document.title = 'Papier für die ' + label + ' | blanko';
        const list = PAPERS.filter(p => (p.grades || []).includes(g));
        listView('Papier für die ' + label.replace('ab Klasse 5', 'Klassen ab 5'), list, g <= 4 ? 'Die Lineaturen, die in der ' + label + ' üblich sind. Was genau ihr braucht, steht auf der Materialliste der Schule.' : 'Die Lineaturen der weiterführenden Schulen, dazu Mathe-Papiere.');
    }

    /* ---------- Suche: Nummern zuerst („3“ findet Lineatur 3), dann Namen und Stichwörter ---------- */
    function search(q) {
        const nq = norm(q).replace(/\b(lineatur|lin|nr|nummer)\b/g, ' ').trim();
        if (!nq) return [];
        const words = nq.split(/\s+/);
        const gm = norm(q).match(/(\d+)\s*klasse|klasse\s*(\d+)/);
        const out = [];
        for (const p of PAPERS) {
            const nr = norm(p.nr);
            const hay = norm([p.name, p.short, p.desc, (p.tags || []).join(' '), p.nr].join(' '));
            let score = 0;
            if (nr && nr === nq.replace(/\s+/g, '')) score += 100;
            else if (nr && nq.replace(/\s+/g, '').length <= 3 && nr.startsWith(nq.replace(/\s+/g, ''))) score += 40;
            if ((p.tags || []).some(t => norm(t) === nq)) score += 30;
            const short = norm([p.name, p.short, (p.tags || []).join(' '), p.nr].join(' ')).split(' ');
            if (words.every(w => /^\d+$/.test(w) ? short.includes(w) : hay.includes(w))) score += 10 + (norm(p.name).includes(nq) ? 10 : 0);
            if (gm && (p.grades || []).includes(+(gm[1] || gm[2]))) score += 20;
            if (score) out.push([score, p]);
        }
        return out.sort((a, b) => b[0] - a[0]).map(x => x[1]);
    }
    function showSearch(q) {
        document.title = 'Suche: ' + q + ' | blanko';
        listView('Suche: „' + q + '“', search(q));
    }
    let searchTimer = 0;
    function onSearch() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const q = $('#q').value.trim();
            if (q) { history.replaceState(null, '', './'); showSearch(q); }
            else route();
        }, 120);
    }

    /* =====================================================================================================
       Ein Papier: Vorschau, Regler, Drucken
       ===================================================================================================== */
    function encodeOpts(p, o) {
        const base = BLPapers.options(p), diff = {};
        for (const k in o) if (String(o[k]) !== String(base[k])) diff[k] = o[k];
        if (!Object.keys(diff).length) return '';
        return btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function decodeOpts(s) {
        try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))) || {}; } catch (e) { return {}; }
    }
    function addRecent(id) {
        const r = LS.get('recent', []).filter(x => x !== id);
        r.unshift(id);
        LS.set('recent', r.slice(0, 12));
    }

    function showPaper(p, mineIdx) {
        addRecent(p.id);
        document.title = p.name + ' zum Ausdrucken | blanko';
        let o = BLPapers.options(p);
        const mine = LS.get('mine', []);
        const mineEntry = mineIdx != null && mine[+mineIdx] && mine[+mineIdx].id === p.id ? mine[+mineIdx] : null;
        if (mineEntry) o = BLPapers.clean(p, { ...o, ...mineEntry.o });
        const hm = /[#&]o=([A-Za-z0-9_-]+)/.exec(location.hash);
        if (hm) o = BLPapers.clean(p, { ...o, ...decodeOpts(hm[1]) });
        // Kalender: zuletzt gewähltes Bundesland übernehmen
        else if (p.gen === 'cal' && !mineEntry && LS.get('land', '')) o.land = LS.get('land', '');
        const schema = BLPapers.schema(p);
        const me = {};
        current = me;

        /* --- Kopf --- */
        const favBtn = h('button', { class: 'iconbtn' + (favs().includes(p.id) ? ' on' : ''), type: 'button', 'aria-label': 'Favorit', title: 'Als Favorit merken',
            onclick: () => favBtn.classList.toggle('on', toggleFav(p.id)) }, icon('star'));
        const head = h('div', { class: 'edhead' },
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Zurück', onclick: () => { if (navCount > 0) history.back(); else go('./'); } }, icon('back')),
            h('h1', null, mineEntry ? mineEntry.name : p.name, h('small', null, mineEntry ? p.name : p.short)), favBtn);

        /* --- Vorschau --- */
        const pages = h('div', { class: 'pages', title: 'Doppelt tippen zum Vergrößern' });
        const pvInfo = h('span', { class: 'pvinfo' });
        const zLbl = h('button', { class: 'zbtn zlbl', type: 'button', title: 'Ganze Seite zeigen', onclick: () => setZoom(1) }, '100 %');
        const zoomBar = h('div', { class: 'zoombar' },
            h('button', { class: 'zbtn', type: 'button', 'aria-label': 'Verkleinern', onclick: () => setZoom(zoom / 1.5) }, '−'), zLbl,
            h('button', { class: 'zbtn', type: 'button', 'aria-label': 'Vergrößern', onclick: () => setZoom(zoom * 1.5) }, '+'));
        const pv = h('div', { class: 'pv' }, pages, h('div', { class: 'pvbar' }, pvInfo, zoomBar));
        /* Zoomen nur hier in der Vorschau: Doppeltippen, zwei Finger, Knöpfe, am Rechner auch Strg + Mausrad.
           Der Punkt unter dem Finger bleibt dabei stehen. */
        let zoom = 1, keep = null;
        function setZoom(z, cx, cy) {
            z = Math.min(6, Math.max(1, z));
            if (Math.abs(z - zoom) < .01) return;
            if (cx == null) { cx = pages.clientWidth / 2; cy = pages.clientHeight / 2; }
            keep = { rx: (pages.scrollLeft + cx) / Math.max(1, pages.scrollWidth), ry: (pages.scrollTop + cy) / Math.max(1, pages.scrollHeight), cx, cy };
            zoom = z;
            redraw();
        }
        const local = (x, y) => { const r = pages.getBoundingClientRect(); return [x - r.left, y - r.top]; };
        pages.addEventListener('dblclick', e => { e.preventDefault(); const [x, y] = local(e.clientX, e.clientY); setZoom(zoom > 1 ? 1 : 2.5, x, y); });
        let lastTap = 0, pinch = null;
        pages.addEventListener('touchend', e => {
            if (pinch || e.touches.length) return;
            const now = Date.now(), t = e.changedTouches[0];
            if (now - lastTap < 320 && t) { e.preventDefault(); const [x, y] = local(t.clientX, t.clientY); setZoom(zoom > 1 ? 1 : 2.5, x, y); lastTap = 0; }
            else lastTap = now;
        });
        const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        pages.addEventListener('touchstart', e => {
            if (e.touches.length === 2) {
                const [x, y] = local((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
                pinch = { d: dist(e.touches), z: zoom, x, y, s: 1 };
            }
        }, { passive: true });
        pages.addEventListener('touchmove', e => {
            if (!pinch || e.touches.length !== 2) return;
            e.preventDefault();
            pinch.s = Math.min(6 / pinch.z, Math.max(1 / pinch.z, dist(e.touches) / pinch.d));
            for (const c of pages.querySelectorAll('canvas')) c.style.width = Math.round(+c.dataset.bw * pinch.z * pinch.s) + 'px';
        }, { passive: false });
        pages.addEventListener('touchend', e => {
            if (!pinch || e.touches.length) return;
            const pn = pinch;
            pinch = null;
            lastTap = 0;
            for (const c of pages.querySelectorAll('canvas')) c.style.width = Math.round(+c.dataset.bw * zoom) + 'px';
            setZoom(pn.z * pn.s, pn.x, pn.y);
        });
        pages.addEventListener('wheel', e => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const [x, y] = local(e.clientX, e.clientY);
            setZoom(zoom * Math.exp(-e.deltaY * .01), x, y);
        }, { passive: false });
        let raf = 0, doc = null;
        function redraw() {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                if (current !== me) return;
                doc = BLPapers.build(p, o);
                const big = zoom > 1, n = doc.count, show = Math.min(n, big ? 4 : 2);
                pv.classList.toggle('big', big);
                const avail = Math.max(160, pages.clientWidth - 4), dpr = Math.min(3, devicePixelRatio || 1);
                const maxH = Math.max(240, Math.min(innerHeight - 230, innerWidth < 860 ? innerHeight * .5 : 900));
                const cs = [];
                for (let i = 0; i < show; i++) {
                    const sz = doc.size(i);
                    const bw = Math.min(avail / Math.min(show, 2) - (show > 1 ? 8 : 0), maxH * sz.w / sz.h);
                    const w = bw * zoom, hh = w * sz.h / sz.w;
                    // nicht mehr Bildpunkte, als das Gerät sicher schafft
                    const d = Math.min(dpr, Math.sqrt(14e6 / (w * hh)));
                    const c = h('canvas');
                    c.width = Math.round(w * d); c.height = Math.round(hh * d);
                    c.style.width = Math.round(w) + 'px';
                    c.dataset.bw = bw;
                    const ctx = c.getContext('2d');
                    ctx.scale(w * d / sz.w, w * d / sz.w);
                    doc.draw(ctx, i);
                    cs.push(c);
                }
                pages.replaceChildren(...cs);
                if (keep) {
                    pages.scrollLeft = keep.rx * pages.scrollWidth - keep.cx;
                    pages.scrollTop = keep.ry * pages.scrollHeight - keep.cy;
                    keep = null;
                }
                zLbl.textContent = Math.round(zoom * 100) + ' %';
                const sz = doc.size(0);
                pvInfo.textContent = (n === 1 ? '1 Seite' : n + ' Seiten') + ' · ' + fmtName(sz) + (n > show ? ' · Vorschau zeigt ' + show : '');
            });
        }
        const fmtName = sz => {
            const a = Math.round(Math.min(sz.w, sz.h)), b = Math.round(Math.max(sz.w, sz.h));
            const n = a === 210 && b === 297 ? 'A4' : a === 148 && b === 210 ? 'A5' : a === 297 && b === 420 ? 'A3' : a === 105 && b === 148 ? 'A6' : a + ' × ' + b + ' mm';
            return n + (sz.w > sz.h ? ' quer' : ' hoch');
        };

        /* --- Original oder angepasst --- */
        const status = h('div', { class: 'status' });
        function showStatus() {
            const ch = p.nr ? BLPapers.changed(p, o) : [];
            const kids = [];
            if (!p.nr) {
                const diff = !!encodeOpts(p, o);
                kids.push(h('span', { class: 'badge ok' }, icon('check'), diff ? 'Eigene Einstellung' : 'Grundeinstellung'));
                if (diff) kids.push(h('button', { class: 'btn small ghost', type: 'button', onclick: () => { o = BLPapers.options(p); sync(); changed(); } }, icon('reset'), 'Alles zurücksetzen'));
            } else if (!ch.length) kids.push(h('span', { class: 'badge ok', title: p.src || '' }, icon('check'), p.nr ? 'Original Lineatur ' + p.nr : 'Grundeinstellung'));
            else kids.push(h('span', { class: 'badge mod' }, icon('warn'), 'Angepasst'),
                h('button', { class: 'btn small ghost', type: 'button', onclick: () => resetNorm() }, icon('reset'), 'Zurück zum Original'));
            status.replaceChildren(...kids);
            for (const r of rows) r.node.classList.toggle('changed', ch.some(s => s.k === r.s.k));
        }
        function resetNorm() {
            const base = BLPapers.options(p);
            for (const s of schema) if (s.norm) o[s.k] = base[s.k];
            sync(); changed();
        }

        /* --- Regler --- */
        const rows = [];
        const setVal = (k, v) => { o[k] = v; changed(); };
        function control(s) {
            let node, upd;
            const lbl = h('div', { class: 'lbl' }, h('span', null, s.l));
            if (s.t === 'num') {
                const inp = h('input', { type: 'number', inputmode: 'decimal', min: s.min, max: s.max, step: s.step, 'aria-label': s.l,
                    oninput: () => { if (inp.value !== '' && isFinite(+inp.value)) setVal(s.k, Math.min(s.max, Math.max(s.min, +inp.value))); },
                    onblur: () => { inp.value = o[s.k]; } });
                const stepBy = d => { const v = Math.round((+o[s.k] + d * s.step) * 1000) / 1000; o[s.k] = Math.min(s.max, Math.max(s.min, v)); inp.value = o[s.k]; changed(); };
                node = h('div', { class: 'numin' },
                    h('button', { type: 'button', 'aria-label': 'weniger', onclick: () => stepBy(-1) }, '−'), inp,
                    s.u ? h('span', { class: 'u' }, s.u) : null,
                    h('button', { type: 'button', 'aria-label': 'mehr', onclick: () => stepBy(1) }, '+'));
                upd = () => { if (document.activeElement !== inp) inp.value = o[s.k]; };
            } else if (s.t === 'sel') {
                const sel = h('select', { 'aria-label': s.l, onchange: () => setVal(s.k, typeof o[s.k] === 'number' ? +sel.value : sel.value) }, s.opts.map(([v, t]) => h('option', { value: v }, t)));
                node = sel; upd = () => { sel.value = String(o[s.k]); };
            } else if (s.t === 'seg') {
                const bs = s.opts.map(([v, t]) => h('button', { class: 'chip', type: 'button', onclick: () => setVal(s.k, typeof o[s.k] === 'number' ? +v : v) }, t));
                node = h('div', { class: 'seg', role: 'group', 'aria-label': s.l }, bs);
                upd = () => bs.forEach((b, i) => b.setAttribute('aria-pressed', String(String(o[s.k]) === String(s.opts[i][0]))));
            } else if (s.t === 'multi') {
                const bs = s.opts.map(([v, t]) => h('button', { class: 'chip', type: 'button', onclick: () => {
                    const cur = String(o[s.k] || '').split(',').filter(Boolean);
                    const next = cur.includes(v) ? cur.filter(x => x !== v) : cur.concat(v);
                    setVal(s.k, next.sort((a, b) => a - b).join(','));
                } }, t));
                node = h('div', { class: 'seg', role: 'group', 'aria-label': s.l }, bs);
                upd = () => { const cur = String(o[s.k] || '').split(','); bs.forEach((b, i) => b.setAttribute('aria-pressed', String(cur.includes(s.opts[i][0])))); };
            } else if (s.t === 'chk') {
                const cb = h('input', { type: 'checkbox', onchange: () => setVal(s.k, cb.checked) });
                node = h('label', { class: 'switch' }, cb, h('span', null, s.l));
                lbl.hidden = true;
                upd = () => { cb.checked = !!o[s.k]; };
            } else if (s.t === 'color') {
                const opts = s.opts || [];
                const sws = opts.map(([c, name]) => { const b = h('button', { class: 'sw', type: 'button', title: name, 'aria-label': name, onclick: () => setVal(s.k, c) }); b.style.background = c; return b; });
                const pick = h('input', { type: 'color', 'aria-label': 'Eigene Farbe', title: 'Eigene Farbe', oninput: () => setVal(s.k, pick.value) });
                node = h('div', { class: 'swatches' }, sws, pick);
                upd = () => { sws.forEach((b, i) => b.classList.toggle('sel', opts[i][0].toLowerCase() === String(o[s.k]).toLowerCase())); pick.value = o[s.k]; };
            } else if (s.t === 'text') {
                const inp = h('input', { class: 'txt', type: 'text', maxlength: 2000, placeholder: s.ph || '', 'aria-label': s.l, oninput: () => setVal(s.k, inp.value) });
                node = inp; upd = () => { if (document.activeElement !== inp) inp.value = o[s.k] || ''; };
            } else if (s.t === 'preset') {
                const sel = h('select', { class: 'preset', 'aria-label': s.l, onchange: () => {
                    const pt = s.opts[+sel.value];
                    sel.value = '';
                    if (pt) { Object.assign(o, pt[1]); changed(); }
                } }, h('option', { value: '' }, 'Schnellwahl: Lineatur, Karo, Punkte …'), s.opts.map(([t], i) => h('option', { value: String(i) }, t)));
                node = sel; upd = () => {};
            } else if (s.t === 'shuffle') {
                node = h('button', { class: 'btn small', type: 'button', onclick: () => setVal(s.k, 1 + Math.floor(Math.random() * 99999)) }, icon('reset'), s.l);
                lbl.hidden = true;
                upd = () => {};
            }
            const row = h('div', { class: 'row' }, lbl, node, s.hint ? h('div', { class: 'hint' }, s.hint) : null);
            rows.push({ s, node: row, upd });
            return row;
        }
        const groups = [];
        for (const s of schema) {
            let g = groups.find(x => x.name === s.g);
            if (!g) groups.push(g = { name: s.g, items: [] });
            g.items.push(s);
        }
        const OPEN = ['Papier', 'Aufteilung', 'Bereich 1', 'Bereich 2', 'Bereich 3', 'Kalender', 'Einträge', 'Farben und Form'];
        const groupNodes = groups.map((g, i) => {
            const d = h('details', { class: 'grp', open: i === 0 || OPEN.includes(g.name) }, h('summary', null, g.name), h('div', { class: 'rows' }, g.items.map(control)));
            return { d, g };
        });
        function sync() {
            for (const r of rows) { r.node.hidden = !!(r.s.show && !r.s.show(o)); r.upd(); }
            for (const { d, g } of groupNodes) d.hidden = g.items.every(s => s.show && !s.show(o));
        }
        let saveTimer = 0;
        function changed() {
            if (p.gen === 'cal' && o.land) LS.set('land', o.land);
            sync();
            showStatus();
            redraw();
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                if (current !== me) return;
                const enc = encodeOpts(p, o);
                history.replaceState(null, '', '?p=' + encodeURIComponent(p.id) + (mineEntry ? '&m=' + mineIdx : '') + (enc ? '#o=' + enc : ''));
            }, 400);
        }

        /* --- Aktionen --- */
        const fileName = () => (mineEntry ? mineEntry.name : p.name).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + '.pdf';
        const pdfBytes = () => BLPapers.build(p, o).bytes((mineEntry ? mineEntry.name : p.name) + ' | blanko.burnersen.de');
        const actions = h('div', { class: 'actions' },
            status,
            h('div', { class: 'btns' },
                h('button', { class: 'btn primary big', type: 'button', onclick: () => printPdf(pdfBytes(), fileName()) }, icon('print'), 'Drucken'),
                h('button', { class: 'btn big', type: 'button', onclick: () => download(pdfBytes(), fileName()) }, icon('download'), 'PDF speichern')),
            h('div', { class: 'btns' },
                h('button', { class: 'btn small ghost', type: 'button', onclick: () => shareLink(p, o) }, icon('link'), 'Link teilen'),
                h('button', { class: 'btn small ghost', type: 'button', onclick: () => saveMine(p, o, mineEntry, mineIdx) }, icon('save'), mineEntry ? 'Speichern' : 'Als mein Blatt speichern'),
                p.id !== 'baukasten' && BLPapers.toBuild(p, o) && BYID.baukasten ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => {
                    const bp = BYID.baukasten, enc = encodeOpts(bp, BLPapers.clean(bp, { ...BLPapers.options(bp), ...BLPapers.toBuild(p, o) }));
                    go('?p=baukasten' + (enc ? '#o=' + enc : ''));
                } }, icon('tools'), 'Im Baukasten weiterbearbeiten') : null),
            h('p', { class: 'tip' }, h('b', null, 'Wichtig beim Drucken: '), 'Wähle „Tatsächliche Größe“ oder „100 %“, nicht „An Seite anpassen“. Sonst werden die Linien kleiner. ',
                h('a', { href: '?p=druckertest', onclick: e => { e.preventDefault(); go('?p=druckertest'); } }, 'Drucker testen')));
        const src = p.src ? h('p', { class: 'src' }, h('b', null, 'Woher die Maße kommen: '), p.src) : null;

        $('#view').replaceChildren(h('div', { class: 'ed' }, head, pv,
            h('div', { class: 'panel' }, actions, groupNodes.map(x => x.d), src)), footer());
        sync();
        showStatus();
        redraw();
        me.onResize = redraw;
    }
    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => current && current.onResize && current.onResize(), 150); });

    /* ---------- Drucken, Speichern, Teilen ---------- */
    function canShareFiles() {
        try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
    }
    function download(bytes, name) {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const a = h('a', { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    /** Am Handy übers Teilen (dort steht „Drucken“), am Rechner direkt das Druckfenster mit dem PDF */
    async function printPdf(bytes, name) {
        if (isMobile() && canShareFiles()) {
            try { await navigator.share({ files: [new File([bytes], name, { type: 'application/pdf' })], title: name }); return; }
            catch (e) { if (e && e.name === 'AbortError') return; }
        }
        if (isMobile()) { download(bytes, name); toast('PDF geladen. Öffne es und tippe auf Drucken.'); return; }
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const safari = /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(navigator.userAgent);
        if (safari) { window.open(url, '_blank') || download(bytes, name); return; }
        document.querySelectorAll('iframe.printframe').forEach(f => f.remove());
        const fr = h('iframe', { class: 'printframe', title: 'Druck', src: url });
        let done = false;
        fr.addEventListener('load', () => {
            setTimeout(() => {
                try { fr.contentWindow.focus(); fr.contentWindow.print(); done = true; }
                catch (e) { window.open(url, '_blank') || download(bytes, name); }
            }, 250);
        });
        document.body.append(fr);
        setTimeout(() => { if (!done) { window.open(url, '_blank') || download(bytes, name); } }, 4000);
    }
    function linkFor(p, o) {
        const enc = encodeOpts(p, o);
        return location.origin + location.pathname + '?p=' + encodeURIComponent(p.id) + (enc ? '#o=' + enc : '');
    }
    async function shareLink(p, o) {
        const url = linkFor(p, o);
        try {
            if (navigator.share && isMobile()) return await navigator.share({ title: p.name + ' | blanko', url });
            await navigator.clipboard.writeText(url);
            toast('Link kopiert. Wer ihn öffnet, bekommt genau dieses Blatt.');
        } catch (e) {
            if (e && e.name === 'AbortError') return;
            const inp = h('input', { class: 'txt', readonly: true, value: url, onfocus: () => inp.select() });
            sheet('Link zu diesem Blatt', h('div', null, h('p', null, 'Link markieren und kopieren:'), inp));
        }
    }
    function saveMine(p, o, entry, idx) {
        const mine = LS.get('mine', []);
        const base = BLPapers.options(p), diff = {};
        for (const k in o) if (String(o[k]) !== String(base[k])) diff[k] = o[k];
        if (entry) {
            mine[+idx] = { ...entry, o: diff };
            LS.set('mine', mine);
            return toast('Gespeichert');
        }
        const inp = h('input', { class: 'txt', type: 'text', maxlength: 50, value: p.name + (o.title ? ' (' + o.title + ')' : '') });
        const sh = sheet('Als mein Blatt speichern', h('div', null,
            h('p', { class: 'muted' }, 'Unter welchem Namen? Das Blatt erscheint dann auf der Startseite unter „Meine Blätter“, nur auf diesem Gerät.'),
            inp, h('div', { class: 'btns', style: null }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
                mine.unshift({ id: p.id, name: inp.value.trim() || p.name, o: diff });
                LS.set('mine', mine.slice(0, 40));
                sh.close();
                toast('Gespeichert unter „Meine Blätter“');
                go('?p=' + encodeURIComponent(p.id) + '&m=0', true);
            } }, 'Speichern'))));
        setTimeout(() => inp.select(), 50);
    }

    /* =====================================================================================================
       Menü, Info, Darstellung, Hilfe
       ===================================================================================================== */
    const mitem = (ic, label, sub, onclick, href) => h(href ? 'a' : 'button', { class: 'mitem', type: href ? null : 'button', href, target: href ? '_blank' : null, rel: href ? 'noopener' : null, onclick },
        icon(ic), h('span', null, h('b', null, label), sub ? h('small', null, sub) : null));
    function showFavorites() {
        const f = favs(), mine = LS.get('mine', []).filter(m => BYID[m.id]);
        const open = href => () => { document.querySelector('.shade')?.remove(); $('#q').value = ''; go(href); };
        const item = (p, name, sub, href) => h('button', { class: 'mitem', type: 'button', onclick: open(href) },
            p.nr ? h('span', { class: 'nr inline' }, p.nr) : icon('star'), h('span', null, h('b', null, name), sub ? h('small', null, sub) : null));
        sheet('Favoriten', h('div', null,
            f.length ? h('div', { class: 'menu' }, f.map(id => item(BYID[id], BYID[id].name, BYID[id].short, '?p=' + id)))
                : h('p', { class: 'muted' }, 'Noch keine Favoriten. Tippe bei einem Papier auf den Stern ☆, dann findest du es hier mit einem Tipp wieder.'),
            mine.length ? [h('h3', { class: 'sub' }, 'Meine Blätter'), h('div', { class: 'menu' }, mine.map((m, i) => item(BYID[m.id], m.name, BYID[m.id].name, '?p=' + m.id + '&m=' + i)))] : null,
            h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: open('?p=baukasten') }, icon('tools'), 'Eigenes Papier gestalten'))));
    }
    function showMenu() {
        const sh = sheet('Menü', h('div', { class: 'menu' },
            mitem('info', 'Über blanko', 'Wer das gemacht hat, und mehr kostenlose Programme', () => { sh.close(); showAbout(); }),
            mitem('help', 'So druckst du richtig', 'Damit die Linien genau stimmen', () => { sh.close(); showHelp(); }),
            mitem('ruler', 'Druckertest', 'Druckt dein Drucker in Originalgröße?', () => { sh.close(); go('?p=druckertest'); }),
            mitem('sun', 'Darstellung', 'Hell, dunkel und Farbe', () => { sh.close(); showLook(); }),
            !standalone() ? mitem('install', 'Auf den Home-Bildschirm', 'Startet wie eine App, auch ohne Internet', () => { sh.close(); showInstall(); }) : null,
            LS.get('mine', []).length ? mitem('trash', 'Meine Blätter verwalten', '', () => { sh.close(); showMine(); }) : null));
    }
    function showAbout() {
        sheet('Über blanko', h('div', null,
            h('div', { class: 'about' }, h('img', { src: document.querySelector('link[rel=icon]').href, alt: '', width: 72, height: 72 }),
                h('div', null, h('h3', null, 'blanko'), h('p', { class: 'muted' }, 'Version ' + VERSION))),
            h('p', null, 'Papier zum Ausdrucken für Schule, Studium und Freizeit: alle Lineaturen, Karopapier, Einmaleins und vieles mehr. Kostenlos, ohne Werbung, ohne Anmeldung. Alles entsteht direkt auf deinem Gerät, auch ohne Internet.'),
            h('h3', { class: 'sub' }, 'Probier auch meine anderen Programme aus'),
            h('div', { class: 'menu' },
                mitem('play', 'Suchsel', 'Wortsuchrätsel online spielen und drucken: suchsel.burnersen.de', null, LINKS.suchsel),
                mitem('cart', 'Kaufen', 'Einkaufslisten für die ganze Familie: kaufen.burnersen.de', null, LINKS.kaufen),
                mitem('globe', 'burnersen.de', 'Noch mehr cooles Zeugs', null, LINKS.site),
                mitem('heart', 'Spendier mir einen Kaffee', 'Wenn dir blanko hilft, freue ich mich riesig', null, LINKS.kofi),
                mitem('github', 'blanko auf GitHub', 'Freie Software, zum Mitlesen und Selbsthosten', null, LINKS.github)),
            h('div', { class: 'legal' },
                h('a', { href: LINKS.impressum, target: '_blank', rel: 'noopener' }, 'Impressum'),
                h('a', { href: LINKS.datenschutz, target: '_blank', rel: 'noopener' }, 'Datenschutz'),
                h('span', { class: 'muted' }, 'Lizenz: GNU AGPL v3'))));
    }
    function showHelp() {
        sheet('So druckst du richtig', h('div', null,
            h('ol', { class: 'steps' },
                h('li', null, 'Papier aussuchen, zum Beispiel über die Klasse oder die Suche („Lineatur 3“).'),
                h('li', null, 'Auf ', h('b', null, 'Drucken'), ' tippen. Am Handy öffnet sich das Teilen-Menü, dort „Drucken“ wählen.'),
                h('li', null, 'Im Druckfenster ', h('b', null, '„Tatsächliche Größe“'), ' oder ', h('b', null, '„100 %“'), ' einstellen, nicht „An Seite anpassen“. Nur dann stimmen die Millimeter.'),
                h('li', null, 'Unsicher? Druck einmal den ', h('a', { href: '?p=druckertest', onclick: e => { e.preventDefault(); document.querySelector('.shade')?.remove(); go('?p=druckertest'); } }, 'Druckertest'), ' und miss nach.')),
            h('h3', { class: 'sub' }, 'Original oder angepasst?'),
            h('p', null, 'Jede Lineatur startet im Original, so wie sie in den Schulheften üblich ist. Verstellst du Linien oder Kästchen, steht oben „Angepasst“. Mit „Zurück zum Original“ ist alles wieder wie vorher.'),
            h('h3', { class: 'sub' }, 'A5-Hefte'),
            h('p', null, 'Viele Grundschulhefte sind A5. Unter Format → „2 × A5 auf A4“ kommen zwei Blätter auf einen Bogen, zum Durchschneiden. Die Linien bleiben genau gleich groß.')));
    }
    function showLook() {
        const themeBtns = [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, t]) => h('button', { class: 'chip', type: 'button', onclick: () => { SET.theme = v === 'auto' ? undefined : v; LS.set('set', SET); applySet(); upd(); } }, t));
        const ACC = [['', '#2b8a3e', 'Grün'], ['blue', '#1c6fd1', 'Blau'], ['orange', '#d0590b', 'Orange'], ['purple', '#7b45c5', 'Lila'], ['pink', '#c2255c', 'Pink']];
        const accBtns = ACC.map(([v, c, t]) => { const b = h('button', { class: 'sw', type: 'button', title: t, 'aria-label': t, onclick: () => { SET.accent = v || undefined; LS.set('set', SET); applySet(); upd(); } }); b.style.background = c; return b; });
        const upd = () => {
            themeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((SET.theme || 'auto') === ['auto', 'light', 'dark'][i])));
            accBtns.forEach((b, i) => b.classList.toggle('sel', (SET.accent || '') === ACC[i][0]));
        };
        sheet('Darstellung', h('div', { class: 'rows' },
            h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Hell oder dunkel'), h('div', { class: 'seg' }, themeBtns)),
            h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Farbe'), h('div', { class: 'swatches' }, accBtns)),
            h('p', { class: 'muted small' }, 'Das gilt nur für die App. Das Papier selbst bleibt hell.')));
        upd();
    }
    function showMine() {
        const box = h('div', { class: 'menu' });
        const render = () => {
            const mine = LS.get('mine', []);
            box.replaceChildren(...mine.map((m, i) => h('div', { class: 'mitem' }, h('span', null, h('b', null, m.name), h('small', null, BYID[m.id] ? BYID[m.id].name : '')),
                h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Löschen', onclick: () => { mine.splice(i, 1); LS.set('mine', mine); render(); route(); } }, icon('trash')))));
            if (!mine.length) box.append(h('p', { class: 'muted' }, 'Keine eigenen Blätter mehr.'));
        };
        render();
        sheet('Meine Blätter', box);
    }

    /* ---------- Auf den Home-Bildschirm: Schild für alle, die blanko im Browser offen haben ---------- */
    let installEvt = null, bannerLater = false;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderBanner(); });
    window.addEventListener('appinstalled', () => { bannerLater = true; renderBanner(); toast('blanko ist jetzt auf deinem Home-Bildschirm.'); });
    const isMacSafari = () => { const ua = navigator.userAgent; return /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua) && !isIOS(); };
    function installHow() {
        const ua = navigator.userAgent;
        if (installEvt) return null;
        if (isIOS()) return [h('b', null, 'So geht’s: '), 'unten (oder oben) auf ', h('b', null, 'Teilen'), ' tippen, das Kästchen mit dem Pfeil nach oben. Dann „', h('b', null, 'Zum Home-Bildschirm'), '“ wählen. Steht das nicht da, in der Liste etwas nach unten wischen.'];
        if (/SamsungBrowser/.test(ua)) return [h('b', null, 'So geht’s: '), 'unten auf das Menü (☰) tippen, dann „', h('b', null, 'Seite hinzufügen zu'), '“ und „', h('b', null, 'Startbildschirm'), '“.'];
        if (isAndroid() && /Firefox/.test(ua)) return [h('b', null, 'So geht’s: '), 'im Menü (⋮) auf „', h('b', null, 'Installieren'), '“ oder „', h('b', null, 'Zum Startbildschirm hinzufügen'), '“ tippen.'];
        if (isAndroid()) return [h('b', null, 'So geht’s: '), 'oben rechts im Menü (⋮) auf „', h('b', null, 'App installieren'), '“ oder „', h('b', null, 'Zum Startbildschirm hinzufügen'), '“ tippen.'];
        if (isMacSafari()) return [h('b', null, 'So geht’s: '), 'oben im Menü ', h('b', null, 'Ablage → Zum Dock hinzufügen'), ' wählen.'];
        if (/Firefox/.test(ua)) return [h('b', null, 'So geht’s: '), 'Firefox am Rechner kann leider keine Apps installieren. Mit ', h('b', null, 'Chrome'), ' oder ', h('b', null, 'Edge'), ' geht es über das Symbol rechts in der Adresszeile. Oder leg dir einfach ein Lesezeichen an.'];
        return [h('b', null, 'So geht’s: '), 'rechts in der Adresszeile auf das Symbol ', h('b', null, '„Installieren“'), ' klicken oder im Menü „', h('b', null, 'App installieren'), '“ wählen.'];
    }
    async function doInstall() {
        const e = installEvt;
        if (!e) return showInstall();
        installEvt = null;
        e.prompt();
        try { if ((await e.userChoice).outcome === 'accepted') bannerLater = true; } catch (x) {}
        renderBanner();
    }
    function renderBanner() {
        const b = $('#banner');
        if (standalone() || bannerLater || onPaper || LS.get('a2hsNo', 0) > Date.now()) { b.hidden = true; return; }
        const how = installHow();
        const howBox = how ? h('p', { class: 'how', hidden: true }, how) : null;
        b.replaceChildren(h('div', { class: 'a2hs', role: 'region', 'aria-label': 'blanko auf den Home-Bildschirm' },
            h('img', { src: document.querySelector('link[rel=icon]').href, alt: '', width: 56, height: 56 }),
            h('b', null, 'Leg dir blanko auf den Home-Bildschirm!'),
            h('ul', null, h('li', null, 'startet wie eine App'), h('li', null, 'funktioniert ohne Internet'), h('li', { class: 'opt' }, 'kostenlos und ohne Werbung'), h('li', { class: 'opt' }, 'aktualisiert sich von selbst')),
            howBox,
            h('div', { class: 'btns' },
                installEvt ? h('button', { class: 'btn primary', type: 'button', onclick: doInstall }, icon('install'), 'Installieren')
                    : h('button', { class: 'btn primary', type: 'button', onclick: e => { howBox.hidden = !howBox.hidden; e.currentTarget.textContent = howBox.hidden ? 'So geht’s' : 'Verstanden'; if (howBox.hidden) { bannerLater = true; renderBanner(); } } }, 'So geht’s'),
                h('button', { class: 'btn', type: 'button', onclick: () => { bannerLater = true; renderBanner(); } }, 'Später'),
                h('button', { class: 'btn', type: 'button', onclick: () => { LS.set('a2hsNo', Date.now() + 1000 * 60 * 60 * 24 * 60); renderBanner(); } }, 'Nicht mehr zeigen'))));
        b.hidden = false;
    }
    function showInstall() {
        const how = installHow();
        sheet('Auf den Home-Bildschirm', h('div', null,
            h('p', null, 'Dann startet blanko wie eine App, funktioniert auch ohne Internet und holt sich neue Versionen von selbst.'),
            how ? h('p', { class: 'src' }, how) : h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { document.querySelector('.shade')?.remove(); doInstall(); } }, icon('install'), 'Jetzt installieren'))));
    }

    /* ---------- Service Worker: offline und Updates von allein ---------- */
    function registerSW() {
        if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
        const had = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('./?action=sw', { scope: './' }).then(reg => {
            // Beim Zurückkommen in die App nachsehen, ob es eine neue Version gibt
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
        }).catch(() => {});
        let shown = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!had || shown) return;
            shown = true;
            toast('blanko wurde aktualisiert.', ['Neu laden', () => location.reload()]);
        });
        if (standalone() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }

    /* ---------- Kein Zoomen der ganzen Seite (die App passt sich dem Bildschirm an). Zoomen geht nur in der Vorschau. ---------- */
    for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => { if (!e.target.closest || !e.target.closest('.pages')) e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', e => { if (e.touches.length > 1 && !(e.target.closest && e.target.closest('.pages'))) e.preventDefault(); }, { passive: false });
    // Doppeltippen zoomt nicht, dafür sorgt touch-action: manipulation im CSS. So bleiben schnelle Tipps auf + und − möglich.

    /* ---------- Start ---------- */
    function start() {
        if (!self.BLPapers || !self.BLPdf || !self.BLCal) { setTimeout(start, 30); return; }
        applySet();
        $('#menuBtn').addEventListener('click', showMenu);
        $('#favBtn').addEventListener('click', showFavorites);
        updateFavCount();
        $('#home').addEventListener('click', e => { e.preventDefault(); $('#q').value = ''; go('./'); });
        $('#q').addEventListener('input', onSearch);
        $('#q').addEventListener('keydown', e => {
            if (e.key === 'Enter') { const r = search($('#q').value); if (r.length === 1 || (r.length && norm(r[0].nr) === norm($('#q').value).replace(/\b(lineatur|lin)\b/g, '').replace(/\s+/g, ''))) { $('#q').value = ''; $('#q').blur(); go('?p=' + r[0].id); } else $('#q').blur(); }
            if (e.key === 'Escape') { $('#q').value = ''; route(); }
        });
        route();
        registerSW();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
