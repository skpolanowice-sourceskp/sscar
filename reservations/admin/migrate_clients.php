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

/* ---------- Samonaprawa uszkodzonego indeksu rez_clients ----------
 * Objaw: INSERT trafia w „ducha" w indeksie unikalnym po skasowanych wierszach
 * (rowCount=2 / brak wiersza), więc nic się nie zapisuje. Bezpieczne TYLKO przy
 * pustej tabeli — przebudowa czyści indeksy. NIE dotyka rez_bookings ani Google. */
$repair = null;
try {
    $cntNow = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn();
    if ($cntNow === 0) {
        // Czyste odtworzenie pustych tabel klientów (kasuje „duchy" z uszkodzonych indeksów).
        // NIE dotyka rez_bookings (rezerwacje) ani Google.
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        $pdo->exec('DROP TABLE IF EXISTS rez_client_vehicles');
        $pdo->exec('DROP TABLE IF EXISTS rez_clients');
        $pdo->exec(
            'CREATE TABLE rez_clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_norm VARCHAR(20) NOT NULL,
                phone_display VARCHAR(40) NOT NULL,
                name VARCHAR(120) DEFAULT NULL,
                email VARCHAR(160) DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                blocked TINYINT(1) NOT NULL DEFAULT 0,
                blocked_reason VARCHAR(255) DEFAULT NULL,
                blocked_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_phone (phone_norm)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $pdo->exec(
            'CREATE TABLE rez_client_vehicles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id INT NOT NULL,
                plate VARCHAR(20) NOT NULL,
                vehicle VARCHAR(80) DEFAULT NULL,
                last_seen DATETIME DEFAULT NULL,
                UNIQUE KEY uniq_client_plate (client_id, plate),
                KEY idx_plate (plate),
                CONSTRAINT fk_vehicle_client FOREIGN KEY (client_id) REFERENCES rez_clients(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        $repair = 'recreated';
    }
} catch (Throwable $e) {
    $repair = 'failed: ' . $e->getMessage();
}

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

$total = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn();

$clientCols = [];
$idExtra = null;
try {
    $clientCols = $pdo->query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rez_clients' ORDER BY ORDINAL_POSITION"
    )->fetchAll(PDO::FETCH_COLUMN);
    $idExtra = $pdo->query(
        "SELECT EXTRA FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rez_clients' AND COLUMN_NAME = 'id'"
    )->fetchColumn();
} catch (Throwable $e) { /* ignoruj */ }

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
    'client_columns'  => $clientCols,         // diagnostyka: kolumny tabeli rez_clients
    'id_extra'        => $idExtra,            // diagnostyka: czy id jest auto_increment
    'repair'          => $repair,             // diagnostyka: czy przebudowano tabelę
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
                name = IF(name IS NULL OR LENGTH(name) = 0, VALUES(name), name),
                email = IF((email IS NULL OR LENGTH(email) = 0) AND VALUES(email) IS NOT NULL, VALUES(email), email),
                phone_display = VALUES(phone_display),
                updated_at = CURRENT_TIMESTAMP'
        );
        $ok = $stmt->execute([$norm, $disp, ($name !== '' ? $name : null), ($email !== '' ? $email : null)]);
        $rc = $stmt->rowCount();

        $sel = $pdo->prepare('SELECT id FROM rez_clients WHERE phone_norm=?');
        $sel->execute([$norm]);
        $cid = (int)$sel->fetchColumn();
        if (!$cid) {
            if ($dbError === null) {
                $cnt = (int)$pdo->query('SELECT COUNT(*) FROM rez_clients')->fetchColumn();
                $dbError = 'INSERT ok=' . var_export($ok, true) . ' rowCount=' . $rc
                    . ' lastId=' . $pdo->lastInsertId() . ' count=' . $cnt . ' (norm=' . $norm . ')';
            }
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
