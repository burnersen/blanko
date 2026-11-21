<?php
/* blanko – Grundlagen: Datenordner, Einstellungen, Kopfzeilen, Dateilisten, Katalog */
defined('BL_VERSION') || exit;

function blNotFound(): void {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    exit("404\n");
}

/**
 * Einstellungen aus data/config.php. Fehlt die Datei, wird sie angelegt, samt data/ und einer .htaccess, die den Ordner sperrt.
 * Darin steht nichts Geheimes, nur Schalter für die Updates. Ohne Schreibrechte läuft blanko trotzdem, nur ohne Update von allein.
 */
function blConfig(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $defaults = ['auto_update' => true, 'ok' => false];
    $file = BL_DATA_DIR . '/config.php';
    if (is_file($file)) {
        $c = @include $file;
        if (is_array($c)) return $cfg = ['ok' => true] + $c + $defaults;
    }
    if (!is_dir(BL_DATA_DIR) && !@mkdir(BL_DATA_DIR, 0700, true) && !is_dir(BL_DATA_DIR)) return $cfg = $defaults;
    if (!is_file(BL_DATA_DIR . '/.htaccess')) {
        @file_put_contents(BL_DATA_DIR . '/.htaccess', "# blanko: interne Dateien, nichts davon darf von außen abrufbar sein.\n"
            . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\nOptions -Indexes\n");
    }
    if (!is_file(BL_DATA_DIR . '/index.html')) @file_put_contents(BL_DATA_DIR . '/index.html', '');
    $php = "<?php\n"
        . "// blanko: automatisch angelegt.\n"
        . "// Einträge, die man hier von Hand ändern kann (Standardwerte in Klammern):\n"
        . "//   'auto_update' => false, keine automatischen Updates aus dem GitHub-Release (true = an).\n"
        . "//   'update_url' => '',     andere Adresse für Updates, '' schaltet sie ganz ab.\n"
        . "return ['auto_update' => true];\n";
    if (@file_put_contents($file . '.tmp', $php, LOCK_EX) === false || !@rename($file . '.tmp', $file)) {
        @unlink($file . '.tmp');
        return $cfg = $defaults;
    }
    @chmod($file, 0600);
    return $cfg = ['ok' => true] + $defaults;
}

function blIsHttps(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/** Adresse der App, z. B. https://blanko.burnersen.de/ */
function blBaseUrl(): string {
    $host = preg_replace('~[^A-Za-z0-9.\-:\[\]]~', '', (string)($_SERVER['HTTP_HOST'] ?? 'blanko.burnersen.de'));
    $dir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/index.php'))), '/');
    return (blIsHttps() ? 'https' : 'http') . '://' . $host . $dir . '/';
}

function blHeaders(bool $html = false): void {
    if (headers_sent()) return;
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    header('Cross-Origin-Resource-Policy: same-origin');
    if (blIsHttps()) header('Strict-Transport-Security: max-age=31536000');
    if ($html) {
        // blob: für das fertige PDF, das zum Drucken in einem unsichtbaren Rahmen geöffnet wird
        header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; "
            . "connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src blob:; object-src blob:; "
            . "frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
    } else {
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

/** Dateitypen, die über ?action=asset ausgeliefert werden */
function blAssetTypes(): array {
    return ['css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml', 'png' => 'image/png'];
}

/** Kennung für den Stand einer Datei: Version plus Änderungszeit, damit der Browser nach jedem Update frisch lädt */
function blFileVersion(string $rel): string {
    return BL_VERSION . '-' . (int)@filemtime(BL_APP . '/' . $rel);
}

/** Jüngste Änderung an Seite und Dateien. Steckt im Service Worker, so merkt jedes Gerät jede Änderung. */
function blAssetStamp(): string {
    $t = 0;
    foreach (array_merge((array)@glob(BL_APP . '/assets/*'), (array)@glob(BL_APP . '/views/*')) as $f) $t = max($t, (int)@filemtime($f));
    return base_convert((string)$t, 10, 36);
}

/** Was der Service Worker beim Installieren vorhält: die Seite und alle Dateien */
function blPrecacheList(): array {
    $out = ['./', '?action=manifest'];
    $types = blAssetTypes();
    foreach ((array)@glob(BL_APP . '/assets/*') as $f) {
        $b = basename($f);
        if ($b === 'sw.js' || !isset($types[strtolower((string)pathinfo($b, PATHINFO_EXTENSION))])) continue;
        $out[] = '?action=asset&f=' . $b . '&v=' . blFileVersion('assets/' . $b);
    }
    return $out;
}

/** Der Papier-Katalog (app/assets/catalog.json): Name, Beschreibung und Grundeinstellungen jedes Papiers */
function blCatalog(): array {
    static $c = null;
    if ($c !== null) return $c;
    $c = json_decode((string)@file_get_contents(BL_APP . '/assets/catalog.json'), true);
    if (!is_array($c) || !isset($c['papers']) || !is_array($c['papers'])) $c = ['papers' => [], 'cats' => []];
    return $c;
}

/** Datei aus dem Netz holen (folgt Weiterleitungen, höchstens $max Bytes). Wirft bei jedem Fehler. */
function blHttpGet(string $url, int $max): string {
    if (!preg_match('~^https?://~i', $url)) throw new RuntimeException('bad url');
    $ua = 'blanko/' . BL_VERSION . ' (self-hosted)';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $buf = '';
        curl_setopt_array($ch, [CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60,
            CURLOPT_USERAGENT => $ua, CURLOPT_HTTPHEADER => ['Accept: application/vnd.github+json, application/octet-stream;q=0.9, */*;q=0.5'],
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$buf, $max) { $buf .= $chunk; return strlen($buf) > $max ? 0 : strlen($chunk); }]);
        $ok = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if (strlen($buf) > $max) throw new RuntimeException('too large');
        if ($ok === false || $code !== 200) throw new RuntimeException('HTTP ' . ($code ?: $err));
        return $buf;
    }
    if (!filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) throw new RuntimeException('no curl, no allow_url_fopen');
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => "User-Agent: $ua\r\nAccept: application/vnd.github+json, */*;q=0.5", 'timeout' => 60,
        'follow_location' => 1, 'max_redirects' => 5, 'ignore_errors' => true]]);
    $buf = @file_get_contents($url, false, $ctx, 0, $max + 1);
    $code = isset($http_response_header) && preg_match_all('~^HTTP/\S+\s+(\d+)~m', implode("\n", $http_response_header), $m) ? (int)end($m[1]) : 0;
    if ($buf === false || $code !== 200) throw new RuntimeException('HTTP ' . $code);
    if (strlen($buf) > $max) throw new RuntimeException('too large');
    return $buf;
}
