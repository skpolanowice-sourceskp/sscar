<?php
/**
 * SSCAR – panel admina: sesja, autoryzacja, CSRF.
 * Include we wszystkich endpointach panelu (nie wywoływać bezpośrednio).
 *
 * Model: jedno wspólne hasło (hash w config.php → admin_pass_hash),
 * sesja PHP w cookie HttpOnly+SameSite=Lax (+Secure pod HTTPS),
 * token CSRF wymagany przy zapisach (nagłówek X-CSRF-Token).
 */

if (!defined('REZ_INTERNAL')) { http_response_code(403); exit('Forbidden'); }

/** Startuje sesję panelu z bezpiecznymi parametrami cookie (raz na żądanie). */
function admin_session_start() {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    // Sesja trwa 30 dni – panel używany tylko na firmowych komputerach.
    $ttl = 30 * 24 * 3600;

    // Prywatny katalog sesji odizolowany od globalnego GC shared hostingu
    // (inne aplikacje na vh.pl mogłyby wyczyścić nasze pliki sesji przy domyślnym /tmp).
    $sessDir = __DIR__ . DIRECTORY_SEPARATOR . '.sessions';
    if (!is_dir($sessDir)) {
        @mkdir($sessDir, 0700, true);
        // Zablokuj dostęp HTTP do katalogu – PHP i tak czyta przez FS.
        @file_put_contents(
            $sessDir . DIRECTORY_SEPARATOR . '.htaccess',
            "Require all denied\n\n<IfModule !mod_authz_core.c>\nOrder deny,allow\nDeny from all\n</IfModule>\n"
        );
    }
    session_save_path($sessDir);
    ini_set('session.gc_maxlifetime', (string)$ttl);
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '100');

    $https = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => $ttl,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('sscar_admin');
    session_start();
}

/** Czy bieżąca sesja jest zalogowana. */
function admin_is_logged_in() {
    admin_session_start();
    return !empty($_SESSION['admin_ok']);
}

/** Twardy wymóg logowania – 401 dla niezalogowanych (kończy żądanie). */
function admin_require() {
    if (!admin_is_logged_in()) {
        rez_fail(401, 'Wymagane logowanie.');
    }
}

/** Token CSRF związany z sesją (tworzony leniwie). */
function admin_csrf_token() {
    admin_session_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Weryfikacja tokenu CSRF dla żądań zmieniających stan (kończy żądanie przy błędzie). */
function admin_require_csrf() {
    admin_session_start();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$sent || empty($_SESSION['csrf']) || !hash_equals((string)$_SESSION['csrf'], (string)$sent)) {
        rez_fail(403, 'Nieprawidłowy token bezpieczeństwa. Odśwież stronę i zaloguj się ponownie.');
    }
}
