<?php
/**
 * migrate_clients.php – jednorazowy backfill profili klientów z istniejących rezerwacji.
 * POST (zalogowany + CSRF). Idempotentny (upsert po znormalizowanym telefonie).
 * Po udanym imporcie plik można usunąć z serwera.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';

rez_guard_origin();
admin_require();
admin_require_csrf();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') rez_fail(405, 'Metoda niedozwolona.');

$pdo = rez_db();
rez_ensure_client_schema($pdo);
try {
    $rows = $pdo->query('SELECT id, cust_name, cust_phone, cust_plate, cust_email FROM rez_bookings ORDER BY id ASC')->fetchAll();
} catch (Throwable $e) {
    rez_fail(500, 'Brak tabeli rez_bookings.');
}

$linked = 0;
foreach ($rows as $r) {
    $norm = rez_phone_norm($r['cust_phone']);
    if ($norm === '') continue;
    $cid = rez_upsert_client($pdo, $norm, $r['cust_phone'], $r['cust_name'], $r['cust_email'], strtoupper((string)$r['cust_plate']), '');
    if ($cid) {
        try { $pdo->prepare('UPDATE rez_bookings SET client_id=? WHERE id=?')->execute([$cid, $r['id']]); $linked++; }
        catch (Throwable $e) { /* brak kolumny client_id – uruchom schema_admin.sql */ }
    }
}

$total = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn();
rez_json(['ok' => true, 'processed' => count($rows), 'linked' => $linked, 'clients_total' => $total]);
