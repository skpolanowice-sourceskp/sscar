<?php
/**
 * client.php – profil pojedynczego klienta.
 *   GET   ?id=...  → { client, vehicles, history }
 *   PATCH (JSON)   → aktualizacja notatek / blokady ({ id, notes?, blocked?, blocked_reason? })
 * Wymaga logowania (PATCH dodatkowo CSRF).
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';

rez_guard_origin();
admin_require();

$pdo = rez_db();
rez_ensure_client_schema($pdo);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) rez_fail(400, 'Brak identyfikatora klienta.');
    try {
        $c = $pdo->prepare('SELECT * FROM rez_clients WHERE id=?');
        $c->execute([$id]);
        $client = $c->fetch();
        if (!$client) rez_fail(404, 'Nie znaleziono klienta.');

        $v = $pdo->prepare('SELECT plate, vehicle, last_seen FROM rez_client_vehicles WHERE client_id=? ORDER BY last_seen DESC');
        $v->execute([$id]);
        $vehicles = $v->fetchAll();

        $h = $pdo->prepare('SELECT start_dt, service, subtype, cust_plate, ref FROM rez_bookings WHERE client_id=? ORDER BY start_dt DESC LIMIT 50');
        $h->execute([$id]);
        $history = $h->fetchAll();

        $services = rez_services();
        foreach ($history as &$row) {
            $svc = $services[$row['service']] ?? null;
            $row['serviceLabel'] = $svc ? $svc['label'] : $row['service'];
            $row['subtypeLabel'] = ($svc && isset($svc['subtypes'][$row['subtype']])) ? $svc['subtypes'][$row['subtype']]['label'] : $row['subtype'];
        }
        unset($row);
    } catch (Throwable $e) {
        rez_fail(500, 'Błąd odczytu profilu klienta.');
    }
    rez_json(['client' => $client, 'vehicles' => $vehicles, 'history' => $history]);
}

if ($method === 'PATCH') {
    admin_require_csrf();
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];
    $id = (int)($in['id'] ?? 0);
    if (!$id) rez_fail(400, 'Brak identyfikatora klienta.');

    $fields = [];
    $params = [];
    if (array_key_exists('notes', $in)) {
        $fields[] = 'notes=?';
        $params[] = (trim((string)$in['notes']) !== '') ? trim((string)$in['notes']) : null;
    }
    if (array_key_exists('blocked', $in)) {
        $blk = !empty($in['blocked']);
        $fields[] = 'blocked=?';        $params[] = $blk ? 1 : 0;
        $fields[] = 'blocked_reason=?'; $params[] = $blk ? ((trim((string)($in['blocked_reason'] ?? '')) !== '') ? trim((string)$in['blocked_reason']) : null) : null;
        $fields[] = 'blocked_at=?';     $params[] = $blk ? date('Y-m-d H:i:s') : null;
    }
    if (!$fields) rez_fail(422, 'Brak zmian do zapisania.');
    $params[] = $id;
    try {
        $pdo->prepare('UPDATE rez_clients SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
    } catch (Throwable $e) {
        rez_fail(500, 'Nie udało się zapisać zmian.');
    }
    rez_json(['ok' => true]);
}

rez_fail(405, 'Metoda niedozwolona.');
