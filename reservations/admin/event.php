<?php
/**
 * Zarządzanie wydarzeniami z panelu (wymaga logowania + CSRF).
 *   POST   – utwórz rezerwację albo blokadę
 *   PATCH  – przesuń/skróć (start+end), edytuj dane rezerwacji lub tytuł blokady
 *   DELETE – usuń wydarzenie (i powiązaną rezerwację)
 *
 * Google Calendar = źródło prawdy grafiku. Rezerwacje trzymamy też w rez_bookings
 * (struktura danych + przyszłe profile klientów); blokady tylko w Google.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/../google.php';

rez_guard_origin();
admin_require();
admin_require_csrf();

$cfg = rez_config();
$tz  = new DateTimeZone($cfg['timezone']);
$calendarId = $cfg['calendar_id'] ?? '';
if (!$calendarId) rez_fail(500, 'Brak skonfigurowanego kalendarza.');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];

if ($method === 'POST')        ev_create($in, $cfg, $tz, $calendarId);
elseif ($method === 'PATCH')   ev_update($in, $cfg, $tz, $calendarId);
elseif ($method === 'DELETE')  ev_delete($in, $cfg, $calendarId);
else rez_fail(405, 'Metoda niedozwolona.');

/* ---------- Tworzenie ---------- */
function ev_create($in, $cfg, $tz, $calendarId) {
    $kind = (string)($in['kind'] ?? 'rezerwacja');
    $date = (string)($in['date'] ?? '');
    $time = (string)($in['time'] ?? '');
    $d = DateTime::createFromFormat('Y-m-d', $date);
    if (!$d || $d->format('Y-m-d') !== $date) rez_fail(422, 'Nieprawidłowa data.');

    /* --- Blokada (tylko Google) --- */
    if ($kind === 'blok') {
        $title = trim((string)($in['title'] ?? ''));
        if ($title === '') $title = 'Blokada';
        if (mb_strlen($title) > 120) rez_fail(422, 'Tytuł zbyt długi.');

        if (!empty($in['allDay'])) {
            $startD = new DateTime($date . ' 00:00:00', $tz);
            $endD   = (clone $startD)->modify('+1 day');
            $event = ['summary' => 'Blokada: ' . $title,
                'start' => ['date' => $startD->format('Y-m-d')],
                'end'   => ['date' => $endD->format('Y-m-d')]];
        } else {
            if (!preg_match('/^\d{2}:\d{2}$/', $time)) rez_fail(422, 'Nieprawidłowa godzina.');
            $dur = (int)($in['durationMin'] ?? 0);
            if ($dur < 10 || $dur > 1440) rez_fail(422, 'Nieprawidłowy czas trwania.');
            $startD = new DateTime($date . ' ' . $time, $tz);
            $endD   = (clone $startD)->modify('+' . $dur . ' minutes');
            $event = ['summary' => 'Blokada: ' . $title,
                'start' => ['dateTime' => $startD->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
                'end'   => ['dateTime' => $endD->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']]];
        }
        try { $ev = gcal_insert_event($calendarId, $event); }
        catch (Throwable $e) { rez_fail(502, 'Nie udało się utworzyć blokady.'); }
        rez_json(['ok' => true, 'id' => $ev['id']]);
    }

    /* --- Rezerwacja (Google + baza) --- */
    if (!preg_match('/^\d{2}:\d{2}$/', $time)) rez_fail(422, 'Nieprawidłowa godzina.');
    $resolved = rez_resolve((string)($in['service'] ?? ''), (string)($in['subtype'] ?? ''));
    if (!$resolved) rez_fail(422, 'Nieprawidłowa usługa.');
    list($service, $subtype) = $resolved;
    $serviceKey = (string)$in['service'];
    $subtypeKey = (string)$in['subtype'];

    $cust = is_array($in['customer'] ?? null) ? $in['customer'] : [];
    $name  = trim((string)($cust['name'] ?? ''));
    $phone = trim((string)($cust['phone'] ?? ''));
    $plate = strtoupper(trim((string)($cust['plate'] ?? '')));
    $vehicle = trim((string)($cust['vehicle'] ?? ''));
    $email = trim((string)($cust['email'] ?? ''));
    $notes = trim((string)($cust['notes'] ?? ''));
    if (mb_strlen($name) < 2) rez_fail(422, 'Podaj imię i nazwisko klienta.');
    if (strlen(preg_replace('/\D/', '', $phone)) < 9) rez_fail(422, 'Podaj poprawny telefon.');
    if (mb_strlen($plate) < 2) rez_fail(422, 'Podaj numer rejestracyjny.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) rez_fail(422, 'Niepoprawny e-mail.');

    $dur = (int)($in['durationMin'] ?? $subtype['duration']);
    if ($dur < 5 || $dur > 480) $dur = (int)$subtype['duration'];

    $start = new DateTime($date . ' ' . $time, $tz);
    $end   = (clone $start)->modify('+' . $dur . ' minutes');
    $startDb = $start->format('Y-m-d H:i:s');
    $endDb   = $end->format('Y-m-d H:i:s');

    $pdo = rez_db();
    try {
        $pdo->beginTransaction();
        $chk = $pdo->prepare('SELECT id FROM rez_bookings WHERE start_dt < ? AND end_dt > ? FOR UPDATE');
        $chk->execute([$endDb, $startDb]);
        if ($chk->fetch()) { $pdo->rollBack(); rez_fail(409, 'Termin koliduje z inną rezerwacją.'); }
        $stmt = $pdo->prepare(
            'INSERT INTO rez_bookings (resource,start_dt,end_dt,service,subtype,cust_name,cust_phone,cust_plate,cust_email,notes)
             VALUES (?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute(['stacja', $startDb, $endDb, $serviceKey, $subtypeKey, $name, $phone, $plate, ($email ?: null), ($notes ?: null)]);
        $id = (int)$pdo->lastInsertId();
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') rez_fail(409, 'Ten termin został właśnie zajęty.');
        rez_fail(500, 'Błąd zapisu rezerwacji.');
    }
    $ref = 'SSC-' . $start->format('ymd') . '-' . str_pad((string)$id, 3, '0', STR_PAD_LEFT);

    try {
        $event = gcal_insert_event($calendarId, ev_booking_payload($cfg, $service, $subtype, $start, $end, $ref, $name, $phone, $plate, $vehicle, $email, $notes));
    } catch (Throwable $e) {
        $pdo->prepare('DELETE FROM rez_bookings WHERE id=?')->execute([$id]);
        rez_fail(502, 'Nie udało się zapisać terminu w kalendarzu.');
    }
    $pdo->prepare('UPDATE rez_bookings SET google_event_id=?, ref=? WHERE id=?')->execute([$event['id'], $ref, $id]);

    // Profil klienta (best-effort; bez blokady – panel może nadpisać czarną listę).
    $clientId = rez_upsert_client($pdo, rez_phone_norm($phone), $phone, $name, $email, $plate, $vehicle);
    if ($clientId) {
        try { $pdo->prepare('UPDATE rez_bookings SET client_id=? WHERE id=?')->execute([$clientId, $id]); }
        catch (Throwable $e) { /* przed migracją – pomiń */ }
    }
    rez_json(['ok' => true, 'id' => $event['id'], 'ref' => $ref]);
}

/* ---------- Edycja / przesunięcie ---------- */
function ev_update($in, $cfg, $tz, $calendarId) {
    $id = (string)($in['id'] ?? '');
    if ($id === '') rez_fail(422, 'Brak identyfikatora wydarzenia.');

    $pdo = rez_db();
    $stmt = $pdo->prepare('SELECT * FROM rez_bookings WHERE google_event_id=?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    $did = false;
    $curStart = $row ? new DateTime($row['start_dt'], $tz) : null;
    $curEnd   = $row ? new DateTime($row['end_dt'], $tz) : null;

    // 1) Przesunięcie / zmiana długości (start + end).
    if (isset($in['start'], $in['end'])) {
        $startD = ev_parse_dt((string)$in['start'], $tz);
        $endD   = ev_parse_dt((string)$in['end'], $tz);
        if (!$startD || !$endD || $endD <= $startD) rez_fail(422, 'Nieprawidłowy zakres czasu.');
        $startDb = $startD->format('Y-m-d H:i:s');
        $endDb   = $endD->format('Y-m-d H:i:s');
        if ($row) {
            $chk = $pdo->prepare('SELECT id FROM rez_bookings WHERE start_dt < ? AND end_dt > ? AND id<>?');
            $chk->execute([$endDb, $startDb, $row['id']]);
            if ($chk->fetch()) rez_fail(409, 'Termin koliduje z inną rezerwacją.');
        }
        try {
            gcal_update_event($calendarId, $id, [
                'start' => ['dateTime' => $startD->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
                'end'   => ['dateTime' => $endD->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
            ]);
        } catch (Throwable $e) { rez_fail(502, 'Nie udało się zaktualizować kalendarza.'); }
        if ($row) $pdo->prepare('UPDATE rez_bookings SET start_dt=?, end_dt=? WHERE id=?')->execute([$startDb, $endDb, $row['id']]);
        $curStart = $startD; $curEnd = $endD;
        $did = true;
    }

    // 2) Tytuł blokady (wpis spoza bazy).
    if (isset($in['title']) && !$row) {
        $title = trim((string)$in['title']);
        if ($title === '') $title = 'Blokada';
        if (mb_strlen($title) > 120) rez_fail(422, 'Tytuł zbyt długi.');
        try { gcal_update_event($calendarId, $id, ['summary' => 'Blokada: ' . $title]); }
        catch (Throwable $e) { rez_fail(502, 'Nie udało się zaktualizować wpisu.'); }
        $did = true;
    }

    // 3) Dane rezerwacji (klient / usługa).
    if ($row && is_array($in['customer'] ?? null)) {
        $cust = $in['customer'];
        $name  = trim((string)($cust['name']  ?? $row['cust_name']));
        $phone = trim((string)($cust['phone'] ?? $row['cust_phone']));
        $plate = strtoupper(trim((string)($cust['plate'] ?? $row['cust_plate'])));
        $email = trim((string)($cust['email'] ?? (string)$row['cust_email']));
        $notes = trim((string)($cust['notes'] ?? (string)$row['notes']));
        $vehicle = trim((string)($cust['vehicle'] ?? ''));
        $serviceKey = (string)($in['service'] ?? $row['service']);
        $subtypeKey = (string)($in['subtype'] ?? $row['subtype']);
        $resolved = rez_resolve($serviceKey, $subtypeKey);
        if (!$resolved) rez_fail(422, 'Nieprawidłowa usługa.');
        list($service, $subtype) = $resolved;
        if (mb_strlen($name) < 2) rez_fail(422, 'Podaj imię i nazwisko klienta.');

        $pdo->prepare('UPDATE rez_bookings SET service=?,subtype=?,cust_name=?,cust_phone=?,cust_plate=?,cust_email=?,notes=? WHERE id=?')
            ->execute([$serviceKey, $subtypeKey, $name, $phone, $plate, ($email ?: null), ($notes ?: null), $row['id']]);
        try {
            gcal_update_event($calendarId, $id, ev_booking_payload($cfg, $service, $subtype, $curStart, $curEnd, $row['ref'], $name, $phone, $plate, $vehicle, $email, $notes));
        } catch (Throwable $e) { /* baza zaktualizowana – kalendarz dogoni przy kolejnym zapisie */ }
        $did = true;
    }

    if (!$did) rez_fail(422, 'Brak danych do aktualizacji.');
    rez_json(['ok' => true]);
}

/* ---------- Usunięcie ---------- */
function ev_delete($in, $cfg, $calendarId) {
    $id = (string)($in['id'] ?? '');
    if ($id === '') rez_fail(422, 'Brak identyfikatora wydarzenia.');
    try { gcal_delete_event($calendarId, $id); }
    catch (Throwable $e) { rez_fail(502, 'Nie udało się usunąć wydarzenia z kalendarza.'); }
    rez_db()->prepare('DELETE FROM rez_bookings WHERE google_event_id=?')->execute([$id]);
    rez_json(['ok' => true]);
}

/* ---------- Pomocnicze ---------- */
function ev_parse_dt($s, $tz) {
    if (preg_match('/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/', $s, $m)) {
        return new DateTime($m[1] . ' ' . $m[2] . ':' . $m[3] . ':00', $tz);
    }
    return null;
}

function ev_booking_payload($cfg, $service, $subtype, $start, $end, $ref, $name, $phone, $plate, $vehicle, $email, $notes) {
    $titleDetail = ($subtype['label'] === $service['label'])
        ? $service['label'] : $service['label'] . ' – ' . $subtype['label'];
    $summary = 'Rezerwacja: ' . $titleDetail . ' – ' . $plate . ($vehicle ? ' (' . $vehicle . ')' : '');
    $desc = "Rezerwacja (panel) ({$ref})\n"
        . "Usługa: {$service['label']} / {$subtype['label']}\n"
        . 'Pojazd: ' . $plate . ($vehicle ? ", {$vehicle}" : '') . "\n"
        . "Klient: {$name}\n"
        . "Telefon: {$phone}\n"
        . ($email ? "E-mail: {$email}\n" : '')
        . ($notes ? "Uwagi: {$notes}\n" : '');
    return [
        'summary' => $summary,
        'description' => $desc,
        'start' => ['dateTime' => $start->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
        'end'   => ['dateTime' => $end->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
    ];
}
