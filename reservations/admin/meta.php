<?php
/**
 * GET meta.php – konfiguracja dla formularzy panelu (usługi, warianty, godziny).
 * Wymaga zalogowania.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';

rez_guard_origin();
admin_require();

$services = [];
foreach (rez_services() as $key => $s) {
    $subs = [];
    foreach ($s['subtypes'] as $sk => $sub) {
        $subs[] = ['key' => $sk, 'label' => $sub['label'], 'duration' => $sub['duration']];
    }
    $services[] = ['key' => $key, 'label' => $s['label'], 'subtypes' => $subs];
}

$hours = [];
foreach (REZ_HOURS as $dow => $h) {
    $hours[$dow] = $h ? ['open' => $h[0], 'close' => $h[1]] : null;
}

rez_json(['services' => $services, 'hours' => $hours]);
