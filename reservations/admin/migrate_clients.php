<?php
/**
 * migrate_clients.php – import / backfill profili klientów.
 * POST (zalogowany + CSRF). Idempotentny (upsert po znormalizowanym telefonie).
 *
 * Źródła (oba przeszukiwane pod kątem numeru telefonu — patrz rez_extract_phone):
 *   A) tabela rez_bookings — WSZYSTKIE pola tekstowe wiersza (dane bywają „rozjechane"),
 *   B) Google Calendar — opis/tytuł/lokalizacja wydarzeń (rezerwacje robione ręcznie w panelu).
 * Wydarzenia już powiązane z rez_bookings (po google_event_id) pomijamy w części B.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/../google.php';
require __DIR__ . '/auth.php';

rez_guard_origin();
admin_require();
admin_require_csrf();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') rez_fail(405, 'Metoda niedozwolona.');

$pdo = rez_db();
rez_ensure_client_schema($pdo);

$before = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn();

/* ---------- A) rez_bookings ---------- */
try {
    $rows = $pdo->query(
        'SELECT id, resource, service, subtype, cust_name, cust_phone, cust_plate, cust_email, notes, ref, google_event_id
         FROM rez_bookings ORDER BY id ASC'
    )->fetchAll();
} catch (Throwable $e) {
    rez_fail(500, 'Brak tabeli rez_bookings.');
}

$bkProcessed = count($rows);
$bkFound = 0;
$linked = 0;
$knownEventIds = [];
foreach ($rows as $r) {
    if (!empty($r['google_event_id'])) $knownEventIds[$r['google_event_id']] = true;

    // Przeszukaj pola wpisywane przez człowieka (tam trafia telefon, też gdy dane „rozjechane").
    // Pomijamy daty i kody (ref/service/subtype) — ryzyko fałszywych trafień.
    $hay = implode("\n", [
        $r['cust_phone'], $r['cust_name'], $r['cust_plate'], $r['cust_email'], $r['notes'],
    ]);
    $norm = rez_extract_phone($hay);
    if ($norm === '') continue;

    $name  = clean_name((string)$r['cust_name']);
    $plate = strtoupper(trim((string)$r['cust_plate']));
    if ($plate !== '' && !preg_match('/[A-Z]/', $plate)) $plate = ''; // odrzuć „tablicę" bez liter
    $email = trim((string)$r['cust_email']);

    $cid = rez_upsert_client($pdo, $norm, rez_phone_format($norm), $name, $email, $plate, '');
    if ($cid) {
        $bkFound++;
        try { $pdo->prepare('UPDATE rez_bookings SET client_id=? WHERE id=?')->execute([$cid, $r['id']]); $linked++; }
        catch (Throwable $e) { /* brak kolumny client_id – uruchom schema_admin.sql */ }
    }
}

/* ---------- B) Google Calendar ---------- */
$evProcessed = 0;
$evFound = 0;
$evError = null;
try {
    $cfg = rez_config();
    $calendarId = $cfg['calendar_id'] ?? '';
    $keyPath = $cfg['service_account_key'] ?? '';
    $tz = new DateTimeZone($cfg['timezone'] ?? 'Europe/Warsaw');
    // is_file: gcal_token() przy braku klucza robi rez_fail()→exit, co ubiłoby cały import.
    if ($calendarId !== '' && is_file($keyPath)) {
        $timeMin = (new DateTime('-2 years', $tz))->format(DateTime::RFC3339);
        $timeMax = (new DateTime('+6 months', $tz))->format(DateTime::RFC3339);
        $items = gcal_list_events($calendarId, $timeMin, $timeMax); // do 250 wydarzeń
        foreach ($items as $ev) {
            $evProcessed++;
            if (!empty($ev['id']) && isset($knownEventIds[$ev['id']])) continue; // już jest w bazie (część A)
            $summary = (string)($ev['summary'] ?? '');
            // Pomiń blokady/urlopy/przerwy – to nie klienci.
            if (preg_match('/\b(blok|blokada|urlop|przerw|niedost|zamkni|wolne)\b/iu', $summary)) continue;

            $hay = $summary . "\n" . (string)($ev['description'] ?? '') . "\n" . (string)($ev['location'] ?? '');
            $norm = rez_extract_phone($hay);
            if ($norm === '') continue;

            $name = clean_name($summary);
            $cid = rez_upsert_client($pdo, $norm, rez_phone_format($norm), $name, '', '', '');
            if ($cid) $evFound++;
        }
    }
} catch (Throwable $e) {
    $evError = 'Google Calendar: ' . $e->getMessage(); // część A i tak się zapisała
}

$total = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn();

rez_json([
    'ok'              => true,
    'processed'       => $bkProcessed,        // (zgodność wstecz) ile rezerwacji przejrzano
    'linked'          => $linked,             // (zgodność wstecz) ile rezerwacji powiązano
    'events_processed'=> $evProcessed,
    'from_bookings'   => $bkFound,
    'from_events'     => $evFound,
    'created'         => max(0, $total - $before),
    'clients_total'   => $total,
    'google_error'    => $evError,
]);

/** Czyści tekst na nazwę klienta: usuwa numery telefonu i nadmiar spacji, ucina do 120. */
function clean_name($raw) {
    $s = (string)$raw;
    $s = preg_replace('/\+?\d[\d\s\-\.\(\)]{7,}\d/', ' ', $s); // wytnij telefon
    $s = trim(preg_replace('/\s{2,}/', ' ', $s));
    if ($s === '' || !preg_match('/\p{L}/u', $s)) return ''; // brak liter → brak nazwy
    return mb_substr($s, 0, 120);
}
