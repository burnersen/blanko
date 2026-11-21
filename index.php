<?php
/**
 * blanko – Papier zum Ausdrucken: alle Lineaturen für die Schule, Karo, Punkte, Einmaleins und vieles mehr
 * https://blanko.burnersen.de
 *
 * Diese Datei ist nur der Einstieg. Der eigentliche Code liegt in app/:
 *   app/lib/     Funktionen (Grundlagen, Update von allein)
 *   app/views/   die Hauptseite
 *   app/assets/  CSS, JavaScript, Symbole, der Papier-Katalog (werden über diese Datei ausgeliefert)
 *
 * Alles Papier entsteht im Browser, auch ohne Netz. Der Server liefert nur die App aus und
 * holt sich neue Versionen selbst aus dem GitHub-Release. Nichts wird von fremden Servern nachgeladen,
 * es gibt keine Datenbank, keine Konten und kein Tracking.
 * Der Ordner data/ entsteht beim ersten Aufruf und hält nur den Stand der Updates.
 *
 * Lizenz: GNU Affero General Public License v3.0, siehe Datei LICENSE.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');
date_default_timezone_set('Europe/Berlin');

define('BL_VERSION', '1.1.0');
define('BL_ROOT', __DIR__);
define('BL_APP', BL_ROOT . '/app');
define('BL_DATA_DIR', BL_ROOT . '/data');

require BL_APP . '/lib/core.php';
require BL_APP . '/lib/update.php';

$action = isset($_GET['action']) && is_string($_GET['action']) ? $_GET['action'] : '';

/* ---------- Dateien: CSS, JavaScript, Symbole, Katalog ---------- */
if ($action === 'asset') {
    $f = isset($_GET['f']) && is_string($_GET['f']) ? $_GET['f'] : '';
    $types = blAssetTypes();
    $ext = strtolower((string)pathinfo($f, PATHINFO_EXTENSION));
    if (!preg_match('~^[a-z0-9][a-z0-9\-]*\.[a-z]+$~', $f) || !isset($types[$ext]) || !is_file(BL_APP . '/assets/' . $f)) blNotFound();
    blHeaders();
    header('Content-Type: ' . $types[$ext]);
    header('Cache-Control: ' . (isset($_GET['v']) ? 'public, max-age=31536000, immutable' : 'no-cache'));
    readfile(BL_APP . '/assets/' . $f);
    exit;
}

/* ---------- Service Worker: hält die ganze App vor, danach läuft sie ohne Netz ---------- */
if ($action === 'sw') {
    blHeaders();
    header("Content-Security-Policy: default-src 'none'; connect-src 'self'; frame-ancestors 'none'");
    header('Content-Type: text/javascript; charset=utf-8');
    header('Cache-Control: no-cache');
    echo 'const BL_V = ' . json_encode(BL_VERSION . '-' . blAssetStamp()) . ";\n";
    echo 'const BL_FILES = ' . json_encode(blPrecacheList(), JSON_UNESCAPED_SLASHES) . ";\n";
    readfile(BL_APP . '/assets/sw.js');
    exit;
}

if ($action === 'manifest') {
    blHeaders();
    header('Content-Type: application/manifest+json; charset=utf-8');
    header('Cache-Control: no-cache');
    $icon = function (string $f): string { return '?action=asset&f=' . $f . '&v=' . blFileVersion('assets/' . $f); };
    echo json_encode([
        'name' => 'blanko: Papier zum Ausdrucken', 'short_name' => 'blanko', 'id' => './',
        'description' => 'Alle Lineaturen für die Schule, Karopapier, Punkte, Einmaleins und Spezialpapiere. Kostenlos, ohne Werbung, auch offline.',
        'start_url' => './', 'scope' => './', 'display' => 'standalone', 'orientation' => 'any', 'lang' => 'de',
        'background_color' => '#f6f7f4', 'theme_color' => '#22262f', 'categories' => ['education', 'productivity', 'utilities'],
        'icons' => [
            ['src' => $icon('icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => $icon('icon-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => $icon('icon-maskable.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------- Sitemap für Suchmaschinen: jedes Papier hat seine eigene Adresse (?p=…) ---------- */
if ($action === 'sitemap') {
    blHeaders();
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=86400');
    $base = blBaseUrl();
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo '<url><loc>' . h($base) . '</loc></url>' . "\n";
    foreach (blCatalog()['papers'] as $p) echo '<url><loc>' . h($base . '?p=' . $p['id']) . '</loc></url>' . "\n";
    echo "</urlset>\n";
    exit;
}

if ($action !== '') blNotFound();

/* ---------- Die App. Mit ?p=… gleich ein bestimmtes Papier (Titel und Beschreibung für Suchmaschinen passend dazu). ---------- */
$blPaper = null;
if (isset($_GET['p']) && is_string($_GET['p'])) {
    foreach (blCatalog()['papers'] as $p) if ($p['id'] === $_GET['p']) { $blPaper = $p; break; }
}
blHeaders(true);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
ob_start();
require BL_APP . '/views/app.php';
$html = (string)ob_get_clean();
if (!filter_var(ini_get('zlib.output_compression'), FILTER_VALIDATE_BOOLEAN)) header('Content-Length: ' . strlen($html));
echo $html;
blAutoUpdate();   // höchstens alle 15 Minuten, erst nachdem die Seite ausgeliefert ist
