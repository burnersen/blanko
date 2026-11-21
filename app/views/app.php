<?php
/* blanko – Hauptseite. Das Gerüst und, für Suchmaschinen und ohne JavaScript, eine schlichte Liste aller Papiere.
   Alles Weitere baut app.js. Der Katalog steckt als JSON in der Seite, so ist er auch offline sofort da. */
defined('BL_VERSION') || exit;
$blV = function (string $f): string { return h('?action=asset&f=' . $f . '&v=' . blFileVersion('assets/' . $f)); };
$blCat = blCatalog();
$blTitle = $blPaper ? $blPaper['name'] . ' zum Ausdrucken, kostenlos als PDF | blanko' : 'blanko: Lineaturen, Karopapier und Schulpapier kostenlos ausdrucken';
$blDesc = $blPaper ? $blPaper['desc'] . ' Kostenlos als PDF, in Originalgröße, anpassbar und auch offline.'
    : 'Alle Lineaturen für die Grundschule und weiterführende Schulen, Karopapier, Punktraster, Millimeterpapier, Notenpapier, Einmaleins und Spezialpapiere. Kostenlos als PDF zum Ausdrucken, ohne Werbung und auch offline.';
$blCanon = blBaseUrl() . ($blPaper ? '?p=' . $blPaper['id'] : '');
?><!DOCTYPE html>
<html lang="de" data-v="<?= h(BL_VERSION) ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= h($blTitle) ?></title>
<meta name="description" content="<?= h($blDesc) ?>">
<link rel="canonical" href="<?= h($blCanon) ?>">
<meta property="og:title" content="<?= h($blTitle) ?>">
<meta property="og:description" content="<?= h($blDesc) ?>">
<meta property="og:url" content="<?= h($blCanon) ?>">
<meta property="og:type" content="website">
<meta property="og:image" content="<?= h(blBaseUrl()) . $blV('icon-512.png') ?>">
<meta name="theme-color" content="#22262f">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="blanko">
<link rel="manifest" href="?action=manifest">
<link rel="icon" href="<?= $blV('icon.svg') ?>" type="image/svg+xml">
<link rel="apple-touch-icon" href="<?= $blV('apple-touch-icon.png') ?>">
<link rel="stylesheet" href="<?= $blV('app.css') ?>">
<script src="<?= $blV('boot.js') ?>"></script>
<script defer src="<?= $blV('pdf.js') ?>"></script>
<script defer src="<?= $blV('papers.js') ?>"></script>
<script defer src="<?= $blV('app.js') ?>"></script>
<script type="application/json" id="catalog"><?= str_replace('</', '<\/', (string)json_encode($blCat, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) ?></script>
</head>
<body>
<header id="top">
    <a class="brand" href="./" id="home"><img src="<?= $blV('icon.svg') ?>" alt="" width="34" height="34"><span>blanko</span></a>
    <div class="search" id="searchBox">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="q" type="search" placeholder="Suchen, z. B. Lineatur 3, kariert, Einmaleins" autocomplete="off" aria-label="Papier suchen">
    </div>
    <button id="favBtn" class="iconbtn favbtn" type="button" aria-label="Favoriten" title="Favoriten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg></button>
    <button id="menuBtn" class="iconbtn" type="button" aria-label="Menü"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
</header>
<div id="banner" hidden></div>
<main id="view">
<?php if ($blPaper): ?>
    <article class="seo">
        <h1><?= h($blPaper['name']) ?></h1>
        <p><?= h($blPaper['desc']) ?></p>
        <p><a href="./">Alle Papiere ansehen</a></p>
    </article>
<?php else: ?>
    <article class="seo">
        <h1>Papier zum Ausdrucken, kostenlos</h1>
        <p><?= h($blDesc) ?></p>
<?php foreach ($blCat['cats'] as $c): ?>
        <h2><?= h($c['name']) ?></h2>
        <ul>
<?php foreach ($blCat['papers'] as $p): if ($p['cat'] !== $c['id']) continue; ?>
            <li><a href="?p=<?= h($p['id']) ?>"><?= h($p['name']) ?></a>: <?= h($p['short']) ?></li>
<?php endforeach; ?>
        </ul>
<?php endforeach; ?>
    </article>
<?php endif; ?>
    <noscript><p class="noscript">blanko braucht JavaScript, um das Papier zu erzeugen.</p></noscript>
</main>
<div id="layer"></div>
<div id="toast" class="toast" hidden></div>
</body>
</html>
