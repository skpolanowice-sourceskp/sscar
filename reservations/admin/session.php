<?php
/**
 * GET session.php – stan logowania dla front-endu panelu.
 * Zwraca { authenticated: bool, csrf?: "..." }.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';

rez_guard_origin();

if (admin_is_logged_in()) {
    rez_json(['authenticated' => true, 'csrf' => admin_csrf_token()]);
}
rez_json(['authenticated' => false]);
