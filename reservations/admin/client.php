<?php
/**
 * client.php – profil pojedynczego klienta.
 *   GET    ?id=...  → { client, vehicles, history }
 *   PATCH  (JSON)   → aktualizacja profilu i pojazdów. Pola opcjonalne:
 *                     { id, name?, email?, phone?, notes?, blocked?, blocked_reason?,
 *                       vehicle_add?:{plate,vehicle}, vehicle_edit?:{id,plate,vehicle}, vehicle_del?:id }
 *   DELETE (JSON)   → usunięcie profilu ({ id }). Rezerwacje zostają w grafiku (client_id→NULL).
 * Wymaga logowania (PATCH/DELETE dodatkowo CSRF).
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

        $v = $pdo->prepare('SELECT id, plate, vehicle, last_seen FROM rez_client_vehicles WHERE client_id=? ORDER BY last_seen DESC');
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

    $did = false; // czy cokolwiek zmieniono (do komunikatu „brak zmian")

    /* --- Operacje na pojazdach (niezależne od kolumn profilu) --- */
    if (isset($in['vehicle_add']) && is_array($in['vehicle_add'])) {
        $plate = strtoupper(trim((string)($in['vehicle_add']['plate'] ?? '')));
        $veh   = trim((string)($in['vehicle_add']['vehicle'] ?? ''));
        if ($plate === '') rez_fail(422, 'Podaj numer rejestracyjny pojazdu.');
        try {
            $pdo->prepare(
                'INSERT INTO rez_client_vehicles (client_id, plate, vehicle, last_seen)
                 VALUES (?,?,?,NOW())
                 ON DUPLICATE KEY UPDATE vehicle=VALUES(vehicle), last_seen=NOW()'
            )->execute([$id, $plate, ($veh !== '' ? $veh : null)]);
        } catch (Throwable $e) { rez_fail(500, 'Nie udało się dodać pojazdu.'); }
        $did = true;
    }
    if (isset($in['vehicle_edit']) && is_array($in['vehicle_edit'])) {
        $vid   = (int)($in['vehicle_edit']['id'] ?? 0);
        $plate = strtoupper(trim((string)($in['vehicle_edit']['plate'] ?? '')));
        $veh   = trim((string)($in['vehicle_edit']['vehicle'] ?? ''));
        if (!$vid) rez_fail(400, 'Brak identyfikatora pojazdu.');
        if ($plate === '') rez_fail(422, 'Podaj numer rejestracyjny pojazdu.');
        $col = $pdo->prepare('SELECT id FROM rez_client_vehicles WHERE client_id=? AND plate=? AND id<>?');
        $col->execute([$id, $plate, $vid]);
        if ($col->fetch()) rez_fail(409, 'Ten numer rejestracyjny jest już przypisany do tego klienta.');
        try {
            $pdo->prepare('UPDATE rez_client_vehicles SET plate=?, vehicle=? WHERE id=? AND client_id=?')
                ->execute([$plate, ($veh !== '' ? $veh : null), $vid, $id]);
        } catch (Throwable $e) { rez_fail(500, 'Nie udało się zapisać pojazdu.'); }
        $did = true;
    }
    if (isset($in['vehicle_del'])) {
        $vid = (int)$in['vehicle_del'];
        if (!$vid) rez_fail(400, 'Brak identyfikatora pojazdu.');
        try {
            $pdo->prepare('DELETE FROM rez_client_vehicles WHERE id=? AND client_id=?')->execute([$vid, $id]);
        } catch (Throwable $e) { rez_fail(500, 'Nie udało się usunąć pojazdu.'); }
        $did = true;
    }

    /* --- Kolumny profilu --- */
    $fields = [];
    $params = [];
    if (array_key_exists('name', $in)) {
        $n = trim((string)$in['name']);
        if (mb_strlen($n) > 120) rez_fail(422, 'Nazwa zbyt długa.');
        $fields[] = 'name=?'; $params[] = ($n !== '' ? $n : null);
    }
    if (array_key_exists('email', $in)) {
        $e = trim((string)$in['email']);
        if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) rez_fail(422, 'Nieprawidłowy adres e-mail.');
        $fields[] = 'email=?'; $params[] = ($e !== '' ? $e : null);
    }
    if (array_key_exists('phone', $in)) {
        $newNorm = rez_phone_norm((string)$in['phone']);
        if (strlen($newNorm) < 9) rez_fail(422, 'Podaj poprawny numer telefonu (min. 9 cyfr).');
        $chk = $pdo->prepare('SELECT id FROM rez_clients WHERE phone_norm=? AND id<>?');
        $chk->execute([$newNorm, $id]);
        if ($chk->fetch()) rez_fail(409, 'Inny klient ma już ten numer telefonu.');
        $fields[] = 'phone_norm=?';    $params[] = $newNorm;
        $fields[] = 'phone_display=?'; $params[] = trim((string)$in['phone']);
    }
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
    if ($fields) {
        $params[] = $id;
        try {
            $pdo->prepare('UPDATE rez_clients SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
        } catch (Throwable $e) {
            rez_fail(500, 'Nie udało się zapisać zmian.');
        }
        $did = true;
    }

    if (!$did) rez_fail(422, 'Brak zmian do zapisania.');
    rez_json(['ok' => true]);
}

if ($method === 'DELETE') {
    admin_require_csrf();
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];
    $id = (int)($in['id'] ?? ($_GET['id'] ?? 0));
    if (!$id) rez_fail(400, 'Brak identyfikatora klienta.');
    try {
        // Rezerwacje zostają w grafiku — zrywamy tylko powiązanie z profilem.
        $pdo->prepare('UPDATE rez_bookings SET client_id=NULL WHERE client_id=?')->execute([$id]);
        // Pojazdy znikają kaskadowo (FK ON DELETE CASCADE).
        $pdo->prepare('DELETE FROM rez_clients WHERE id=?')->execute([$id]);
    } catch (Throwable $e) {
        rez_fail(500, 'Nie udało się usunąć klienta.');
    }
    rez_json(['ok' => true]);
}

rez_fail(405, 'Metoda niedozwolona.');
