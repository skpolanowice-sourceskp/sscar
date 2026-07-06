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

// Akcja może iść metodą HTTP (PATCH/DELETE) albo polem op (POST) – dla hostów,
// które ograniczają metody. rez_fail wewnątrz funkcji robi exit (nie złapie go catch).
$op = (string)($in['op'] ?? '');
try {
    if ($op === 'update' || $method === 'PATCH')      ev_update($in, $cfg, $tz, $calendarId);
    elseif ($op === 'delete' || $method === 'DELETE') ev_delete($in, $cfg, $calendarId);
    elseif ($op === 'create' || $method === 'POST')   ev_create($in, $cfg, $tz, $calendarId);
    else rez_fail(405, 'Metoda niedozwolona.');
} catch (Throwable $e) {
    rez_fail(500, 'Błąd serwera: ' . $e->getMessage());
}

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
    // Dane klienta są OPCJONALNE – admin może wstawić sam termin / szybką blokadę.
    // Telefon wymagamy tylko, gdy zaznaczono dopisanie klienta do bazy (to klucz profilu).
    $addClient = array_key_exists('addClient', $in) ? !empty($in['addClient']) : true;
    $phoneDigits = preg_replace('/\D/', '', $phone);
    if ($addClient && strlen($phoneDigits) < 9) rez_fail(422, 'Aby dopisać klienta do bazy, podaj telefon (lub wyłącz dodawanie do bazy).');
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

    // Profil klienta tylko, gdy zaznaczono „Dodaj klienta do bazy" i mamy telefon (klucz profilu).
    // Bez tego szybkie blokady slota nie zaśmiecają bazy klientów (best-effort, bez czarnej listy).
    if ($addClient && strlen($phoneDigits) >= 9) {
        $clientId = rez_upsert_client($pdo, rez_phone_norm($phone), $phone, $name, $email, $plate, $vehicle);
        if ($clientId) {
            try { $pdo->prepare('UPDATE rez_bookings SET client_id=? WHERE id=?')->execute([$clientId, $id]); }
            catch (Throwable $e) { /* przed migracją – pomiń */ }
        }
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
    // Czas bieżący liczymy LENIWIE. Gałąź przesunięcia/rozciągania (1) ustawia go
    // wprost z żądania, więc nie odczytujemy tu start_dt z bazy – stare wpisy mogły
    // mieć uszkodzoną wartość (np. tekst zamiast daty), co wywracało całą operację.
    // Z bazy liczymy dopiero w gałęzi 3 i tylko gdy naprawdę potrzebne.
    $curStart = null;
    $curEnd   = null;

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
        if ($row) {
            try {
                $pdo->prepare('UPDATE rez_bookings SET start_dt=?, end_dt=? WHERE id=?')->execute([$startDb, $endDb, $row['id']]);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') rez_fail(409, 'Termin koliduje z inną rezerwacją (ten sam początek).');
                throw $e;
            }
        }
        $curStart = $startD; $curEnd = $endD;
        $did = true;
    }

    // 2) Tytuł blokady lub ręcznego wpisu Google (wpis spoza bazy).
    //    kind=blok → dokładamy prefiks „Blokada:"; kind=inne → tytuł surowy.
    if (isset($in['title']) && !$row) {
        $title = trim((string)$in['title']);
        if (mb_strlen($title) > 120) rez_fail(422, 'Tytuł zbyt długi.');
        $kind = (string)($in['kind'] ?? 'blok');
        if ($kind === 'blok') {
            if ($title === '') $title = 'Blokada';
            $summary = 'Blokada: ' . $title;
        } else {
            if ($title === '') $title = '(bez tytułu)';
            $summary = $title;
        }
        try { gcal_update_event($calendarId, $id, ['summary' => $summary]); }
        catch (Throwable $e) { rez_fail(502, 'Nie udało się zaktualizować wpisu.'); }
        $did = true;
    }

    // 3) Dane rezerwacji (klient / usługa).
    if ($row && is_array($in['customer'] ?? null)) {
        $cust = $in['customer'];
        // Operator ?? nie wyłapuje pustego stringa – front zawsze wysyła wszystkie pola
        // (nawet puste), więc fallback musi działać też dla ''. Zachowujemy istniejące
        // dane z bazy gdy formularz prześle pusty string – chroni to przed przypadkowym
        // nadpisaniem uzupełnionych pól przez niezmodyfikowany formularz.
        $pick = function($new, $old) { $v = trim((string)$new); return $v !== '' ? $v : trim((string)$old); };
        $name  = $pick($cust['name']  ?? '', $row['cust_name']  ?? '');
        $phone = $pick($cust['phone'] ?? '', $row['cust_phone'] ?? '');
        $plate = strtoupper($pick($cust['plate'] ?? '', $row['cust_plate'] ?? ''));
        $email = $pick($cust['email'] ?? '', $row['cust_email'] ?? '');
        $notes = $pick($cust['notes'] ?? '', $row['notes']      ?? '');
        $vehicle = trim((string)($cust['vehicle'] ?? ''));
        $serviceKey = (string)($in['service'] ?? $row['service']);
        $subtypeKey = (string)($in['subtype'] ?? $row['subtype']);
        $resolved = rez_resolve($serviceKey, $subtypeKey);
        if (!$resolved) rez_fail(422, 'Nieprawidłowa usługa.');

        // Czas do odświeżenia wpisu w Google. Zwykle ustawiła go już gałąź 1
        // (formularz edycji wysyła start+end); z bazy bierzemy tylko awaryjnie.
        if (!$curStart || !$curEnd) {
            try {
                if (!$curStart) $curStart = new DateTime($row['start_dt'], $tz);
                if (!$curEnd)   $curEnd   = new DateTime($row['end_dt'], $tz);
            } catch (Throwable $e) {
                rez_fail(409, 'Najpierw popraw termin tej rezerwacji (przeciągnij na siatce), potem zapisz dane klienta.');
            }
        }

        $pdo->prepare('UPDATE rez_bookings SET service=?,subtype=?,cust_name=?,cust_phone=?,cust_plate=?,cust_email=?,notes=? WHERE id=?')
            ->execute([$serviceKey, $subtypeKey, $name, $phone, $plate, ($email ?: null), ($notes ?: null), $row['id']]);
        try {
            gcal_update_event($calendarId, $id, ev_booking_payload($cfg, $service, $subtype, $curStart, $curEnd, $row['ref'], $name, $phone, $plate, $vehicle, $email, $notes));
        } catch (Throwable $e) { /* baza zaktualizowana – kalendarz dogoni przy kolejnym zapisie */ }
        // Profil klienta w sync: telefon = klient, do niego przypięty pojazd (marka/model + nr rej.).
        rez_upsert_client($pdo, rez_phone_norm($phone), $phone, $name, $email, $plate, $vehicle);
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
    // Dane klienta bywają puste (termin/blokada wbita przez admina) – nie sklejaj pustych
    // fragmentów. Tytuł: „… – NR (Marka)" gdy jest auto, inaczej nazwisko, inaczej sama usługa.
    $vehLabel = $plate !== '' ? ($plate . ($vehicle ? ' (' . $vehicle . ')' : '')) : '';
    $who = $vehLabel !== '' ? $vehLabel : $name;
    $summary = 'Rezerwacja: ' . $titleDetail . ($who !== '' ? ' – ' . $who : '');
    $desc = "Rezerwacja (panel) ({$ref})\n"
        . "Usługa: {$service['label']} / {$subtype['label']}\n"
        . (($plate !== '' || $vehicle !== '') ? 'Pojazd: ' . ($plate !== '' ? $plate : '—') . ($vehicle ? ", {$vehicle}" : '') . "\n" : '')
        . ($name  !== '' ? "Klient: {$name}\n" : '')
        . ($phone !== '' ? "Telefon: {$phone}\n" : '')
        . ($email ? "E-mail: {$email}\n" : '')
        . ($notes ? "Uwagi: {$notes}\n" : '');
    return [
        'summary' => $summary,
        'description' => $desc,
        'start' => ['dateTime' => $start->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
        'end'   => ['dateTime' => $end->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
    ];
}
