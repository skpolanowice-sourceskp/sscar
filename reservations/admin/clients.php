<?php
/**
 * GET clients.php?q=...  – lista / wyszukiwanie klientów (telefon, nazwisko, rejestracja).
 * Wymaga logowania.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';

rez_guard_origin();
admin_require();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') rez_fail(405, 'Metoda niedozwolona.');

$q = trim((string)($_GET['q'] ?? ''));
$pdo = rez_db();
rez_ensure_client_schema($pdo);

$cols = 'c.id, c.phone_display, c.name, c.blocked,
    (SELECT COUNT(*) FROM rez_bookings b WHERE b.client_id = c.id) AS visits,
    (SELECT GROUP_CONCAT(DISTINCT v.plate SEPARATOR ", ") FROM rez_client_vehicles v WHERE v.client_id = c.id) AS plates';

try {
    if ($q === '') {
        $stmt = $pdo->prepare("SELECT $cols FROM rez_clients c ORDER BY c.updated_at DESC LIMIT 100");
        $stmt->execute();
    } else {
        $like = '%' . $q . '%';
        $digits = preg_replace('/\D/', '', $q);
        $sql = "SELECT $cols FROM rez_clients c
                WHERE c.name LIKE ? OR c.phone_display LIKE ? "
                . ($digits !== '' ? 'OR c.phone_norm LIKE ? ' : '')
                . "OR EXISTS (SELECT 1 FROM rez_client_vehicles v WHERE v.client_id = c.id AND v.plate LIKE ?)
                ORDER BY c.blocked DESC, c.name ASC LIMIT 100";
        $params = [$like, $like];
        if ($digits !== '') $params[] = '%' . $digits . '%';
        $params[] = strtoupper($like);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    $rows = $stmt->fetchAll();
} catch (Throwable $e) {
    rez_fail(500, 'Baza klientów nie jest gotowa. Uruchom schema_admin.sql w phpMyAdmin.');
}

rez_json(['clients' => $rows]);
