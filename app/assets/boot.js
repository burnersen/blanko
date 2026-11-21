/* blanko – läuft vor dem ersten Bild: hell oder dunkel und die Akzentfarbe so, wie zuletzt eingestellt, damit nichts aufblitzt. */
(() => {
    try {
        const s = JSON.parse(localStorage.getItem('bl_set')) || {};
        const dark = s.theme === 'dark' || (s.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        if (s.accent) document.documentElement.dataset.accent = s.accent;
    } catch (e) {}
})();
