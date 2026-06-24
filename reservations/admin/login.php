<?php
/**
 * POST login.php  (JSON: { "password": "..." })
 * Sukces → { ok: true, csrf: "..." } i ustawiona sesja. Błąd → { error } + kod.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';

rez_guard_origin();
rez_config();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    rez_fail(405, 'Metoda niedozwolona.');
}
// Anty-brute-force: maks. 10 prób / 5 min na IP.
if (!rez_throttle('admin_login', 10, 300)) {
    rez_fail(429, 'Za dużo prób logowania. Spróbuj za kilka minut.');
}

$in = json_decode((string)file_get_contents('php://input'), true);
$pass = is_array($in) ? (string)($in['password'] ?? '') : '';

$cfg = rez_config();
$hash = (string)($cfg['admin_pass_hash'] ?? '');
if ($hash === '') {
    rez_fail(500, 'Panel nie został skonfigurowany (brak admin_pass_hash w config.php).');
}

if ($pass === '' || !password_verify($pass, $hash)) {
    rez_fail(401, 'Nieprawidłowe hasło.');
}

admin_session_start();
session_regenerate_id(true);
$_SESSION['admin_ok'] = true;
$_SESSION['login_at'] = time();

rez_json(['ok' => true, 'csrf' => admin_csrf_token()]);
