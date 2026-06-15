<?php
/**
 * POST book.php  (JSON)
 * Body: { service, subtype, date, time, consent, customer:{name,phone,plate,email,notes} }
 * Zwraca: { ref: "SSC-..." } albo { error: "..." } z kodem HTTP.
 *
 * Kolejność zabezpieczeń:
 *  1. Walidacja danych wg reguł serwera (nie ufamy klientowi).
 *  2. Transakcyjna blokada nakładających się terminów w MySQL (jeden pracownik).
 *  3. Ponowne sprawdzenie wolności slotu w Google (chroni przed kolizją z wpisem ręcznym).
 *  4. Utworzenie wydarzenia w Google Calendar.
 *  5. Powiadomienie e-mail (best-effort).
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/lib.php';
require __DIR__ . '/google.php';

rez_guard_origin();
rez_config(); // wczytaj konfigurację i ustaw strefę czasową przed logiką dat

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    rez_fail(405, 'Metoda niedozwolona.');
}
if (!rez_throttle('book', 8, 60)) {
    rez_fail(429, 'Za dużo prób. Spróbuj za chwilę lub zadzwoń.');
}

$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!is_array($in)) rez_fail(400, 'Nieprawidłowe dane.');

$serviceKey = (string)($in['service'] ?? '');
$subtypeKey = (string)($in['subtype'] ?? '');
$dateISO    = (string)($in['date'] ?? '');
$time       = (string)($in['time'] ?? '');
$consent    = !empty($in['consent']);
$cust       = is_array($in['customer'] ?? null) ? $in['customer'] : [];

$name  = trim((string)($cust['name'] ?? ''));
$phone = trim((string)($cust['phone'] ?? ''));
$plate = strtoupper(trim((string)($cust['plate'] ?? '')));
$vehicle = trim((string)($cust['vehicle'] ?? ''));
$email = trim((string)($cust['email'] ?? ''));
$notes = trim((string)($cust['notes'] ?? ''));

/* ---------- Walidacja ---------- */
$resolved = rez_resolve($serviceKey, $subtypeKey);
if (!$resolved) rez_fail(400, 'Nieprawidłowa usługa.');
list($service, $subtype) = $resolved;

if (!rez_date_bookable($dateISO)) rez_fail(400, 'Termin niedostępny.');
if (!in_array($time, rez_slots_for_day($dateISO, $subtype['duration']), true)) {
    rez_fail(400, 'Nieprawidłowa godzina.');
}
if (!$consent) rez_fail(422, 'Wymagana zgoda na przetwarzanie danych.');
if (mb_strlen($name) < 3) rez_fail(422, 'Podaj imię i nazwisko.');
if (strlen(preg_replace('/\D/', '', $phone)) < 9) rez_fail(422, 'Podaj poprawny telefon.');
if (mb_strlen($plate) < 3) rez_fail(422, 'Podaj numer rejestracyjny.');
if (mb_strlen($vehicle) < 2) rez_fail(422, 'Podaj markę i model pojazdu.');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) rez_fail(422, 'Niepoprawny e-mail.');
if (mb_strlen($name) > 120 || mb_strlen($plate) > 20 || mb_strlen($vehicle) > 80 || mb_strlen($notes) > 1000) {
    rez_fail(422, 'Dane są zbyt długie.');
}

$cfg = rez_config();
$tz = new DateTimeZone($cfg['timezone']);
$resource = 'stacja'; // jeden pracownik = jeden wspólny zasób
$calendarId = $cfg['calendar_id'] ?? '';
if (!$calendarId) rez_fail(500, 'Brak skonfigurowanego kalendarza.');

$start = new DateTime($dateISO . ' ' . $time, $tz);
$end = (clone $start)->modify('+' . $subtype['duration'] . ' minutes');
$startDb = $start->format('Y-m-d H:i:s');
$endDb = $end->format('Y-m-d H:i:s');

/* ---------- 2. Atomowa blokada NAKŁADAJĄCYCH SIĘ terminów ---------- */
// Jeden pracownik: żadne dwie rezerwacje nie mogą się pokrywać w czasie
// (także różne usługi startujące o różnych minutach). FOR UPDATE + indeks
// na start_dt blokuje równoległe wstawienie w tym samym zakresie.
$pdo = rez_db();
try {
    $pdo->beginTransaction();
    $chk = $pdo->prepare('SELECT id FROM rez_bookings WHERE start_dt < ? AND end_dt > ? FOR UPDATE');
    $chk->execute([$endDb, $startDb]);
    if ($chk->fetch()) {
        $pdo->rollBack();
        rez_fail(409, 'Ten termin koliduje z innym. Wybierz inną godzinę.');
    }
    $stmt = $pdo->prepare(
        'INSERT INTO rez_bookings
         (resource, start_dt, end_dt, service, subtype, cust_name, cust_phone, cust_plate, cust_email, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([$resource, $startDb, $endDb, $serviceKey, $subtypeKey, $name, $phone, $plate, ($email ?: null), ($notes ?: null)]);
    $id = (int)$pdo->lastInsertId();
    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e->getCode() === '23000') { // wyścig na identyczną godzinę
        rez_fail(409, 'Ten termin został właśnie zajęty. Wybierz inną godzinę.');
    }
    rez_fail(500, 'Błąd zapisu rezerwacji.');
}
$ref = 'SSC-' . $start->format('ymd') . '-' . str_pad((string)$id, 3, '0', STR_PAD_LEFT);

/* ---------- 3. Ponowna kontrola wolności w Google ---------- */
try {
    $intervals = gcal_busy_intervals($calendarId, $dateISO);
    if (gcal_slot_busy($start->format(DateTime::RFC3339), $end->format(DateTime::RFC3339), $intervals)) {
        $pdo->prepare('DELETE FROM rez_bookings WHERE id=?')->execute([$id]);
        rez_fail(409, 'Ten termin jest już zajęty. Wybierz inną godzinę.');
    }
} catch (Throwable $e) {
    $pdo->prepare('DELETE FROM rez_bookings WHERE id=?')->execute([$id]);
    rez_fail(502, 'Nie udało się potwierdzić dostępności. Spróbuj ponownie.');
}

/* ---------- 4. Wydarzenie w Google Calendar ---------- */
$titleDetail = ($subtype['label'] === $service['label'])
    ? $service['label']
    : $service['label'] . ' – ' . $subtype['label'];
$summary = 'Rezerwacja: ' . $titleDetail . ' – ' . $plate . ($vehicle ? ' (' . $vehicle . ')' : '');
$desc = "Rezerwacja online ({$ref})\n"
    . "Usługa: {$service['label']} / {$subtype['label']}\n"
    . 'Pojazd: ' . $plate . ($vehicle ? ", {$vehicle}" : '') . "\n"
    . "Klient: {$name}\n"
    . "Telefon: {$phone}\n"
    . ($email ? "E-mail: {$email}\n" : '')
    . ($notes ? "Uwagi: {$notes}\n" : '');

try {
    $event = gcal_insert_event($calendarId, [
        'summary' => $summary,
        'description' => $desc,
        'start' => ['dateTime' => $start->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
        'end'   => ['dateTime' => $end->format(DateTime::RFC3339), 'timeZone' => $cfg['timezone']],
    ]);
} catch (Throwable $e) {
    $pdo->prepare('DELETE FROM rez_bookings WHERE id=?')->execute([$id]);
    rez_fail(502, 'Nie udało się zapisać terminu w kalendarzu. Spróbuj ponownie.');
}

$pdo->prepare('UPDATE rez_bookings SET google_event_id=?, ref=? WHERE id=?')
    ->execute([$event['id'], $ref, $id]);

/* ---------- 5. Powiadomienia e-mail (best-effort) ---------- */
rez_send_emails($cfg, $service, $subtype, compact('name', 'phone', 'plate', 'email', 'notes', 'ref') + [
    'when' => $start->format('d.m.Y H:i'),
]);

rez_json(['ref' => $ref, 'date' => $dateISO, 'time' => $time]);


/* ---------- Pomocnicze: e-mail ---------- */
function rez_send_emails($cfg, $service, $subtype, $b) {
    $headers = "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . 'From: ' . ($cfg['from_email'] ?? 'no-reply@sscar.pl') . "\r\n";

    if (!empty($cfg['notify_email'])) {
        $body = "Nowa rezerwacja online ({$b['ref']})\n\n"
            . "Termin: {$b['when']}\n"
            . "Usługa: {$service['label']} / {$subtype['label']}\n"
            . "Pojazd: {$b['plate']}\n"
            . "Klient: {$b['name']}\n"
            . "Telefon: {$b['phone']}\n"
            . ($b['email'] ? "E-mail: {$b['email']}\n" : '')
            . ($b['notes'] ? "Uwagi: {$b['notes']}\n" : '');
        @mail($cfg['notify_email'], "Rezerwacja {$b['when']} – {$b['plate']}", $body, $headers);
    }

    if (!empty($cfg['send_customer_confirmation']) && $b['email']) {
        $body = "Dziękujemy za rezerwację w SSCAR.\n\n"
            . "Numer zgłoszenia: {$b['ref']}\n"
            . "Termin: {$b['when']}\n"
            . "Usługa: {$service['label']} / {$subtype['label']}\n"
            . "Pojazd: {$b['plate']}\n\n"
            . "Adres: ul. Polanowicka 82, Wrocław\n"
            . "W razie zmian zadzwonimy. Prosimy o przybycie kilka minut wcześniej z dowodem rejestracyjnym.\n";
        @mail($b['email'], "Potwierdzenie rezerwacji {$b['ref']} – SSCAR", $body, $headers);
    }
}
