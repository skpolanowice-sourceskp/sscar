<?php
/**
 * migrate_clients.php – import / backfill profili klientów.
 * POST (zalogowany + CSRF). Idempotentny (upsert po znormalizowanym telefonie).
 *
 * Źródła (oba przeszukiwane pod kątem numeru telefonu — patrz rez_extract_phone):
 *   A) tabela rez_bookings — WSZYSTKIE pola tekstowe wiersza (dane bywają „rozjechane"
 *      i w złym kodowaniu — patrz mig_utf8),
 *   B) Google Calendar — opis/tytuł/lokalizacja wydarzeń (rezerwacje robione ręcznie w panelu).
 * Wydarzenia już powiązane z rez_bookings (po google_event_id) pomijamy w części B.
 *
 * Odczyt po zapisie działa TYLKO dzięki emulowanym prepared statements w rez_db()
 * (proxy MySQL na vh.pl psuje protokół binarny) — patrz komentarz w lib.php / CLAUDE.md.
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

$before = 0;
try { $before = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn(); } catch (Throwable $e) {}

/* ---------- A) rez_bookings ---------- */
try {
    $rows = $pdo->query(
        'SELECT id, cust_name, cust_phone, cust_plate, cust_email, notes, google_event_id
         FROM rez_bookings ORDER BY id ASC'
    )->fetchAll();
} catch (Throwable $e) {
    rez_fail(500, 'Brak tabeli rez_bookings.');
}

/* Wydarzenia Google pobieramy RAZ z góry i wykorzystujemy dwojako:
 *   (1) mapa google_event_id → marka/model z tytułu („… – NR (Marka Model)") — do BACKFILLU
 *       pojazdów rezerwacji z bazy (część A), bo modelu nie ma w kolumnach rez_bookings,
 *   (2) źródło części B (wydarzenia bez rezerwacji w bazie). */
$items = [];
$evError = null;
$eventVehicle = [];   // google_event_id => marka/model
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
            if (empty($ev['id'])) continue;
            $veh = mig_vehicle_from_title((string)($ev['summary'] ?? ''));
            if ($veh !== '') $eventVehicle[$ev['id']] = $veh;
        }
    }
} catch (Throwable $e) {
    $evError = 'Google Calendar: ' . $e->getMessage(); // część A i tak się zapisze (bez modeli)
}

$bkProcessed = count($rows);
$bkFound = 0;
$linked = 0;
$dbError = null;            // pierwszy realny błąd zapisu klienta (gdyby import padł)
$knownEventIds = [];
foreach ($rows as $r) {
    if (!empty($r['google_event_id'])) $knownEventIds[$r['google_event_id']] = true;

    // Dane bywają w złym kodowaniu i poprzesuwane między kolumnami — najpierw napraw bajty,
    // potem przeszukaj CAŁOŚĆ wiersza w poszukiwaniu telefonu i e-maila.
    $hay = mig_utf8(implode("\n", [
        $r['cust_phone'], $r['cust_name'], $r['cust_plate'], $r['cust_email'], $r['notes'],
    ]));
    $norm = rez_extract_phone($hay);
    if ($norm === '') continue;

    $name  = clean_name(mig_utf8((string)$r['cust_name']));
    $email = mig_extract_email($hay);
    // Backfill pojazdu: nr rej. z rezerwacji + marka/model z tytułu powiązanego eventu Google.
    $plate = strtoupper(trim(mig_utf8((string)$r['cust_plate'])));
    $veh   = (!empty($r['google_event_id']) && isset($eventVehicle[$r['google_event_id']]))
        ? $eventVehicle[$r['google_event_id']] : '';
    $cid = mig_upsert($pdo, $norm, rez_phone_format($norm), $name, $email, $plate, $veh, $dbError);
    if ($cid) {
        $bkFound++;
        try { $pdo->prepare('UPDATE rez_bookings SET client_id=? WHERE id=?')->execute([$cid, $r['id']]); $linked++; }
        catch (Throwable $e) { /* brak kolumny client_id – uruchom schema_admin.sql */ }
    }
}

/* ---------- B) Google Calendar (wydarzenia bez rezerwacji w bazie) ---------- */
$evProcessed = 0;
$evFound = 0;
foreach ($items as $ev) {
    $evProcessed++;
    if (!empty($ev['id']) && isset($knownEventIds[$ev['id']])) continue; // już jest w bazie (część A)
    $summary = (string)($ev['summary'] ?? '');
    // Pomiń blokady/urlopy/przerwy – to nie klienci.
    if (preg_match('/\b(blok|blokada|urlop|przerw|niedost|zamkni|wolne)\b/iu', $summary)) continue;

    $hay = mig_utf8($summary . "\n" . (string)($ev['description'] ?? '') . "\n" . (string)($ev['location'] ?? ''));
    $norm = rez_extract_phone($hay);
    if ($norm === '') continue;

    $name = clean_name(mig_utf8($summary));
    $email = mig_extract_email($hay);
    $cid = mig_upsert($pdo, $norm, rez_phone_format($norm), $name, $email, '', '', $dbError);
    if ($cid) $evFound++;
}

$total = 0;
try { $total = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn(); } catch (Throwable $e) {}
$vehTotal = 0;
try { $vehTotal = (int)$pdo->query('SELECT COUNT(*) FROM rez_client_vehicles')->fetchColumn(); } catch (Throwable $e) {}

rez_json([
    'ok'              => true,
    'processed'       => $bkProcessed,        // ile rezerwacji przejrzano
    'linked'          => $linked,             // ile rezerwacji powiązano z profilem
    'events_processed'=> $evProcessed,
    'from_bookings'   => $bkFound,
    'from_events'     => $evFound,
    'created'         => max(0, $total - $before),
    'clients_total'   => $total,
    'vehicles_total'  => $vehTotal,           // ile pojazdów w bazie po imporcie (backfill nr rej. + model)
    'google_error'    => $evError,
    'db_error'        => $dbError,            // null gdy OK; komunikat gdy zapis klienta padł
]);

/**
 * Upsert klienta (idempotentny po phone_norm). Zwraca client_id albo null.
 * Pierwszy realny błąd zapisu trafia do $dbError (przez referencję) — żeby NIE zniknął w catch.
 * `id = LAST_INSERT_ID(id)` sprawia, że lastInsertId() zwraca id także przy UPDATE (bez SELECT-a po zapisie).
 */
function mig_upsert($pdo, $norm, $disp, $name, $email, $plate, $vehicle, &$dbError) {
    if ($norm === '') return null;
    // Ostatnia zapora: do bazy wyłącznie poprawny UTF-8 (źródłowe dane bywają w złym kodowaniu).
    $disp = mig_utf8($disp); $name = mig_utf8($name); $email = mig_utf8($email);
    $plate = mig_utf8($plate); $vehicle = mig_utf8($vehicle);
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO rez_clients (phone_norm, phone_display, name, email)
             VALUES (?,?,?,?)
             ON DUPLICATE KEY UPDATE
                id = LAST_INSERT_ID(id),
                name = IF(name IS NULL OR LENGTH(name) = 0, VALUES(name), name),
                email = IF((email IS NULL OR LENGTH(email) = 0) AND VALUES(email) IS NOT NULL, VALUES(email), email),
                phone_display = VALUES(phone_display),
                updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$norm, $disp, ($name !== '' ? $name : null), ($email !== '' ? $email : null)]);
        $cid = (int)$pdo->lastInsertId();
        if ($cid <= 0) {
            $sel = $pdo->prepare('SELECT id FROM rez_clients WHERE phone_norm=?');
            $sel->execute([$norm]);
            $cid = (int)$sel->fetchColumn();
        }
        if ($cid <= 0) {
            if ($dbError === null) $dbError = 'INSERT bez id (norm=' . $norm . ')';
            return null;
        }

        if ($plate !== '') {
            try {
                $pdo->prepare(
                    'INSERT INTO rez_client_vehicles (client_id, plate, vehicle, last_seen)
                     VALUES (?,?,?,NOW())
                     ON DUPLICATE KEY UPDATE
                        vehicle = IF(VALUES(vehicle) IS NOT NULL AND LENGTH(VALUES(vehicle)) > 0, VALUES(vehicle), vehicle),
                        last_seen = NOW()'
                )->execute([$cid, $plate, ($vehicle !== '' ? $vehicle : null)]);
            } catch (Throwable $e) { if ($dbError === null) $dbError = 'pojazd: ' . $e->getMessage(); }
        }
        return $cid;
    } catch (Throwable $e) {
        if ($dbError === null) $dbError = $e->getMessage();
        return null;
    }
}

/** Marka/model z tytułu rezerwacji Google („… – PLATE (Marka Model)") = ostatni nawias. */
function mig_vehicle_from_title($summary) {
    if (preg_match_all('/\(([^()]+)\)/u', (string)$summary, $m) && !empty($m[1])) {
        return trim(mig_utf8((string)end($m[1])));
    }
    return '';
}

/** Naprawia bajty do poprawnego UTF-8 i usuwa znaki sterujące / znak zastępczy. */
function mig_utf8($s) {
    $s = (string)$s;
    if ($s === '') return '';
    $s = function_exists('mb_scrub') ? mb_scrub($s, 'UTF-8') : (string)@iconv('UTF-8', 'UTF-8//IGNORE', $s);
    $s = str_replace("\xEF\xBF\xBD", '', $s);            // U+FFFD (znak zastępczy)
    $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s);     // znaki sterujące
    return $s;
}

/** Wyłuskuje pierwszy POPRAWNY adres e-mail z tekstu (albo '' gdy brak). */
function mig_extract_email($text) {
    if (preg_match('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/u', (string)$text, $m)) {
        $e = rtrim($m[0], '.');
        if (filter_var($e, FILTER_VALIDATE_EMAIL)) return $e;
    }
    return '';
}

/** Czyści tekst na nazwę klienta: usuwa e-mail, telefon i znaki-śmieci; wymaga ≥2 liter. */
function clean_name($raw) {
    $s = mig_utf8((string)$raw);
    $s = preg_replace('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/u', ' ', $s); // wytnij e-mail
    $s = preg_replace('/\+?\d[\d\s\-\.\(\)]{7,}\d/', ' ', $s);                          // wytnij telefon
    $s = preg_replace('/[^\p{L}\p{N}\s\.\-\']/u', ' ', $s);                              // zostaw litery/cyfry/spacje/.-'
    $s = trim(preg_replace('/\s{2,}/', ' ', $s));
    if ($s === '' || !preg_match('/\p{L}{2,}/u', $s)) return '';   // brak sensownej nazwy
    return mb_substr($s, 0, 120);
}
