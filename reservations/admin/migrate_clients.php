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

$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];

/* ---------- Tryb podglądu: pokaż surowe dane, NIE importuj ---------- */
if (!empty($in['preview'])) {
    $bk = [];
    try {
        $rows = $pdo->query('SELECT id, cust_name, cust_phone, cust_plate, cust_email, notes FROM rez_bookings ORDER BY id DESC LIMIT 8')->fetchAll();
        foreach ($rows as $r) {
            $hay = implode(' | ', [$r['cust_name'], $r['cust_phone'], $r['cust_plate'], $r['cust_email'], $r['notes']]);
            $bk[] = [
                'id'       => (int)$r['id'],
                'name'     => mb_substr(mig_utf8($r['cust_name']), 0, 40),
                'phone'    => mb_substr(mig_utf8($r['cust_phone']), 0, 40),
                'plate'    => mb_substr(mig_utf8($r['cust_plate']), 0, 40),
                'email'    => mb_substr(mig_utf8($r['cust_email']), 0, 40),
                'notes'    => mb_substr(mig_utf8($r['notes']), 0, 60),
                'detected' => rez_extract_phone(mig_utf8($hay)),
            ];
        }
    } catch (Throwable $e) { /* ignoruj */ }

    $ev = [];
    $evErr = null;
    try {
        $cfg = rez_config();
        $cid = $cfg['calendar_id'] ?? '';
        $kp  = $cfg['service_account_key'] ?? '';
        if ($cid !== '' && is_file($kp)) {
            $tz = new DateTimeZone($cfg['timezone'] ?? 'Europe/Warsaw');
            $items = gcal_list_events($cid, (new DateTime('-2 years', $tz))->format(DateTime::RFC3339), (new DateTime('+6 months', $tz))->format(DateTime::RFC3339));
            $n = 0;
            foreach ($items as $e) {
                if ($n++ >= 12) break;
                $sum = (string)($e['summary'] ?? ''); $desc = (string)($e['description'] ?? ''); $loc = (string)($e['location'] ?? '');
                $ev[] = [
                    'summary'     => mb_substr($sum, 0, 70),
                    'description' => mb_substr($desc, 0, 90),
                    'location'    => mb_substr($loc, 0, 40),
                    'detected'    => rez_extract_phone($sum . "\n" . $desc . "\n" . $loc),
                ];
            }
        } else {
            $evErr = 'brak konfiguracji kalendarza';
        }
    } catch (Throwable $e) { $evErr = $e->getMessage(); }

    rez_json(['preview' => true, 'bookings' => $bk, 'events' => $ev, 'google_error' => $evErr]);
}

// UWAGA: świadomie BEZ transakcji i BEZ przebudowy tabel.
// Diagnostyka wykazała, że zapisy PERSYSTUJĄ (ponowny INSERT trafiał w istniejący
// wiersz → ON DUPLICATE KEY UPDATE), więc autocommit per-wiersz jest bezpieczny i pewny.
// Transakcja na tym hostingu potrafiła nie zatwierdzić zmian (proxy), a blok DROP/CREATE
// był groźny (kasował tabelę, gdy odczyt COUNT zwracał 0). Oba usunięte.
$before = 0;
try { $before = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn(); } catch (Throwable $e) {}

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
$dbError = null;            // pierwszy realny błąd zapisu klienta (diagnostyka)
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
    $cid = mig_upsert($pdo, $norm, rez_phone_format($norm), $name, $email, '', $dbError);
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

            $hay = mig_utf8($summary . "\n" . (string)($ev['description'] ?? '') . "\n" . (string)($ev['location'] ?? ''));
            $norm = rez_extract_phone($hay);
            if ($norm === '') continue;

            $name = clean_name(mig_utf8($summary));
            $email = mig_extract_email($hay);
            $cid = mig_upsert($pdo, $norm, rez_phone_format($norm), $name, $email, '', $dbError);
            if ($cid) $evFound++;
        }
    }
} catch (Throwable $e) {
    $evError = 'Google Calendar: ' . $e->getMessage(); // część A i tak się zapisała
}

$total = 0;
try { $total = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn(); } catch (Throwable $e) {}

/* ---------- SAMOTEST: która METODA połączenia widzi zapisane wiersze? ----------
 * phpMyAdmin (localhost, socket) widzi komplet, a aplikacja (PDO) widzi 0 → różnica
 * jest w SPOSOBIE połączenia. Próbujemy trzech wariantów i patrzymy, który zwraca
 * pełny COUNT. Ten wariant wpiszemy do config.php. */
$diag = [];
$c = rez_config()['db'];
$dbn = $c['name']; $usr = $c['user']; $pwd = $c['pass'];

$diag['v_localhost'] = mig_try_conn("mysql:host=localhost;dbname={$dbn};charset=utf8mb4", $usr, $pwd);
$diag['v_127']       = mig_try_conn("mysql:host=127.0.0.1;dbname={$dbn};charset=utf8mb4", $usr, $pwd);

// Ścieżka gniazda UNIX (tak łączy się phpMyAdmin) — odczytana z bieżącego połączenia.
$sockPath = '';
try { $sv = $pdo->query("SHOW VARIABLES LIKE 'socket'")->fetch(); $sockPath = (string)($sv['Value'] ?? ''); } catch (Throwable $e) {}
$diag['socket_path'] = $sockPath !== '' ? $sockPath : '(brak)';
if ($sockPath !== '') {
    $diag['v_socket'] = mig_try_conn("mysql:unix_socket={$sockPath};dbname={$dbn};charset=utf8mb4", $usr, $pwd);
}

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
    'db_error'        => $dbError,            // diagnostyka: realny błąd zapisu klienta
    'diag'            => $diag,               // diagnostyka: rozdział odczyt/zapis (samotest)
]);

/**
 * Upsert klienta z PRZECHWYTYWANIEM błędu (do diagnostyki). Logika jak rez_upsert_client,
 * ale pierwszy błąd zapisu trafia do $dbError (przez referencję) zamiast zniknąć w catch.
 */
function mig_upsert($pdo, $norm, $disp, $name, $email, $plate, &$dbError) {
    if ($norm === '') return null;
    // Ostatnia zapora: do bazy wyłącznie poprawny UTF-8 (źródłowe dane bywają w złym kodowaniu).
    $disp = mig_utf8($disp); $name = mig_utf8($name); $email = mig_utf8($email); $plate = mig_utf8($plate);
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
        // id z LAST_INSERT_ID() — działa też przy update i NIE wymaga odczytu po zapisie
        // (kluczowe, gdy hosting rozdziela odczyt/zapis na różne serwery).
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
                     VALUES (?,?,NULL,NOW())
                     ON DUPLICATE KEY UPDATE last_seen=NOW()'
                )->execute([$cid, $plate]);
            } catch (Throwable $e) { if ($dbError === null) $dbError = 'pojazd: ' . $e->getMessage(); }
        }
        return $cid;
    } catch (Throwable $e) {
        if ($dbError === null) $dbError = $e->getMessage();
        return null;
    }
}

/** Próbuje połączyć się danym DSN i zwraca tożsamość serwera + COUNT(*) z rez_clients. */
function mig_try_conn($dsn, $user, $pass) {
    try {
        $p = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $id = $p->query('SELECT @@hostname AS h, @@port AS port, DATABASE() AS db')->fetch();
        $cnt = (int)$p->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn();
        return ['host' => $id['h'] ?? '?', 'port' => $id['port'] ?? '?', 'db' => $id['db'] ?? '?', 'count' => $cnt];
    } catch (Throwable $e) {
        return ['err' => $e->getMessage()];
    }
}

/** Świeże, osobne połączenie PDO (do samotestu odczyt-po-zapisie). */
function mig_fresh_pdo() {
    $c = rez_config()['db'];
    $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset={$c['charset']}";
    return new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
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
