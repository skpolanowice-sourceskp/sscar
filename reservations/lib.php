<?php
/**
 * SSCAR – rezerwacje: wspólna logika (reguły biznesowe, walidacja, sloty, DB).
 * Reguły MUSZĄ odpowiadać tym z rezerwacja.js (serwer jest źródłem prawdy).
 */

if (!defined('REZ_INTERNAL')) { http_response_code(403); exit('Forbidden'); }

/* ---------- Konfiguracja ładowana z config.php ---------- */
function rez_config() {
    static $cfg = null;
    if ($cfg === null) {
        $path = __DIR__ . '/config.php';
        if (!is_file($path)) { rez_fail(500, 'Brak config.php – skopiuj config.sample.php.'); }
        $cfg = require $path;
        date_default_timezone_set($cfg['timezone'] ?? 'Europe/Warsaw');
    }
    return $cfg;
}

/* ---------- Reguły biznesowe (lustro rezerwacja.js) ---------- */

// Godziny pracy: dzień tygodnia (0=niedz..6=sob) => [otwarcie, zamknięcie] | null
const REZ_HOURS = [
    0 => null,
    1 => [7, 18],
    2 => [7, 18],
    3 => [7, 20],
    4 => [7, 20],
    5 => [7, 20],
    6 => [8, 14],
];
const REZ_MIN_LEAD_DAYS = 0;       // najwcześniejszy dzień = dziś
const REZ_MIN_LEAD_MINUTES = 60;   // slot musi być min. 60 min od teraz
const REZ_DAYS_AHEAD = 21;

function rez_services() {
    return [
        'techniczne' => [
            'label' => 'Badanie techniczne',
            'subtypes' => [
                'osobowy'     => ['label' => 'Osobowy',           'duration' => 20],
                'gaz'         => ['label' => 'Osobowy z LPG/CNG', 'duration' => 30],
                'taxi'        => ['label' => 'Taxi',              'duration' => 20],
                'motocykl'    => ['label' => 'Motocykl',          'duration' => 10],
                'powypadkowe' => ['label' => 'Powypadkowe',       'duration' => 30],
                'pierwszarej' => ['label' => 'Pierwsza rejestracja w kraju', 'duration' => 30],
            ],
        ],
        'przedzakupem' => [
            'label' => 'Sprawdzenie przed zakupem',
            'subtypes' => [
                'baza' => ['label' => 'Podstawowe', 'duration' => 20],
                'full' => ['label' => 'Pełne',      'duration' => 60],
            ],
        ],
        'klimatyzacja' => [
            'label' => 'Serwis klimatyzacji',
            'subtypes' => [
                // Jeden wariant – bez wyboru czynnika (musi pasować do rezerwacja.js).
                'klima' => ['label' => 'Serwis klimatyzacji', 'duration' => 10],
            ],
        ],
    ];
}

/** Zwraca [service, subtype] z konfiguracji albo null gdy nieprawidłowe. */
function rez_resolve($serviceKey, $subtypeKey) {
    $s = rez_services();
    if (!isset($s[$serviceKey])) return null;
    if (!isset($s[$serviceKey]['subtypes'][$subtypeKey])) return null;
    return [$s[$serviceKey], $s[$serviceKey]['subtypes'][$subtypeKey]];
}

/** Lista slotów 'H:i' dla danej daty i czasu trwania (identycznie jak w JS). */
function rez_slots_for_day($dateISO, $duration) {
    $d = DateTime::createFromFormat('Y-m-d', $dateISO);
    if (!$d) return [];
    $dow = (int)$d->format('w');
    $h = REZ_HOURS[$dow] ?? null;
    if (!$h) return [];
    $open = $h[0] * 60;
    $close = $h[1] * 60;
    // Dla dnia dzisiejszego odetnij godziny wcześniejsze niż teraz + wyprzedzenie.
    $minStart = -1;
    $now = new DateTime('now'); // strefa ustawiona w rez_config()
    if ($now->format('Y-m-d') === $dateISO) {
        $minStart = (int)$now->format('G') * 60 + (int)$now->format('i') + REZ_MIN_LEAD_MINUTES;
    }
    $out = [];
    for ($t = $open; $t + $duration <= $close; $t += $duration) {
        if ($t < $minStart) continue;
        $out[] = sprintf('%02d:%02d', intdiv($t, 60), $t % 60);
    }
    return $out;
}

/** Niedziela Wielkanocna danego roku (algorytm computus, bez ext/calendar). */
function rez_easter($year) {
    $a = $year % 19;
    $b = intdiv($year, 100);
    $c = $year % 100;
    $d = intdiv($b, 4);
    $e = $b % 4;
    $f = intdiv($b + 8, 25);
    $g = intdiv($b - $f + 1, 3);
    $h = (19 * $a + $b - $d - $g + 15) % 30;
    $i = intdiv($c, 4);
    $k = $c % 4;
    $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
    $m = intdiv($a + 11 * $h + 22 * $l, 451);
    $month = intdiv($h + $l - 7 * $m + 114, 31);
    $day = (($h + $l - 7 * $m + 114) % 31) + 1;
    return new DateTime(sprintf('%04d-%02d-%02d', $year, $month, $day));
}

/** Czy data to dzień ustawowo wolny od pracy w Polsce (stacja nieczynna). */
function rez_is_holiday($dateISO) {
    $d = DateTime::createFromFormat('Y-m-d', $dateISO);
    if (!$d || $d->format('Y-m-d') !== $dateISO) return false;
    // Stałe święta (m-d). Wielkanoc i Zielone Świątki to niedziele – i tak zamknięte.
    static $fixed = ['01-01', '01-06', '05-01', '05-03', '08-15', '11-01', '11-11', '12-25', '12-26'];
    if (in_array($d->format('m-d'), $fixed, true)) return true;
    // Ruchome (liczone od Wielkanocy): Poniedziałek Wielkanocny (+1), Boże Ciało (+60).
    $easter = rez_easter((int)$d->format('Y'));
    $movable = [
        (clone $easter)->modify('+1 day')->format('Y-m-d'),
        (clone $easter)->modify('+60 days')->format('Y-m-d'),
    ];
    return in_array($dateISO, $movable, true);
}

/** Sprawdza, czy data jest w dozwolonym oknie i dzień jest otwarty. */
function rez_date_bookable($dateISO) {
    $d = DateTime::createFromFormat('Y-m-d', $dateISO);
    if (!$d || $d->format('Y-m-d') !== $dateISO) return false;
    $d->setTime(0, 0, 0);
    $today = new DateTime('today');
    $earliest = (clone $today)->modify('+' . REZ_MIN_LEAD_DAYS . ' day');
    $latest = (clone $today)->modify('+' . REZ_DAYS_AHEAD . ' day');
    if ($d < $earliest || $d > $latest) return false;
    if (!REZ_HOURS[(int)$d->format('w')]) return false;
    if (rez_is_holiday($dateISO)) return false;
    return true;
}

/* ---------- Baza danych (PDO) ---------- */
function rez_db() {
    static $pdo = null;
    if ($pdo === null) {
        $c = rez_config()['db'];
        $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset={$c['charset']}";
        try {
            $pdo = new PDO($dsn, $c['user'], $c['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (Throwable $e) {
            rez_fail(500, 'Błąd połączenia z bazą danych.');
        }
    }
    return $pdo;
}

/* ---------- Klienci (baza profili) ---------- */

/** Normalizuje telefon do klucza profilu: same cyfry, ostatnie 9 (PL). */
function rez_phone_norm($raw) {
    $d = preg_replace('/\D/', '', (string)$raw);
    if (strlen($d) > 9) $d = substr($d, -9);
    return $d;
}

/**
 * Wyłuskuje polski numer telefonu z DOWOLNEGO tekstu (np. z opisu wydarzenia
 * albo rozjechanych pól rezerwacji). Akceptuje 9 cyfr pod rząd lub grupy
 * 3-3-3 ze spacją / myślnikiem, opcjonalny prefiks +48 / 0048 / 48.
 * Zwraca 9 cyfr (klucz phone_norm) albo '' gdy nic sensownego nie znaleziono.
 */
function rez_extract_phone($text) {
    $t = ' ' . (string)$text . ' ';
    // Token telefonopodobny: cyfra…(cyfry/spacje/-/./()/+)…cyfra, min. ~9 znaków.
    if (preg_match_all('/\+?\d[\d\s\-\.\(\)]{7,}\d/', $t, $mm)) {
        foreach ($mm[0] as $cand) {
            $d = preg_replace('/\D/', '', $cand);
            if (strlen($d) === 12 && substr($d, 0, 4) === '0048') $d = substr($d, 4);
            if (strlen($d) === 11 && substr($d, 0, 2) === '48')   $d = substr($d, 2);
            // Odrzuć daty/godziny i inne zbitki spoza zakresu numeru telefonu.
            if (strlen($d) >= 9 && strlen($d) <= 11) return substr($d, -9);
        }
    }
    return '';
}

/** Ładnie formatuje 9 cyfr jako „600 700 800" (do phone_display). */
function rez_phone_format($norm) {
    $d = preg_replace('/\D/', '', (string)$norm);
    return (strlen($d) === 9) ? substr($d, 0, 3) . ' ' . substr($d, 3, 3) . ' ' . substr($d, 6, 3) : $d;
}

/**
 * Zapewnia tabele bazy klientów (idempotentnie, raz na żądanie).
 * Dzięki temu panel działa bez ręcznego importu schema_admin.sql – o ile
 * użytkownik MySQL ma prawa DDL (na vh.pl właściciel bazy zwykle ma).
 */
function rez_ensure_client_schema($pdo) {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS rez_clients (
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
            'CREATE TABLE IF NOT EXISTS rez_client_vehicles (
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
        $col = $pdo->query(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rez_bookings' AND COLUMN_NAME = 'client_id'"
        )->fetchColumn();
        if (!$col) {
            $pdo->exec('ALTER TABLE rez_bookings ADD COLUMN client_id INT DEFAULT NULL');
            $pdo->exec('ALTER TABLE rez_bookings ADD KEY idx_client (client_id)');
        }
    } catch (Throwable $e) {
        // brak uprawnień DDL – pozostaje ręczny import schema_admin.sql
    }
}

/** Czy numer jest zablokowany dla rezerwacji online. Fail-open (błąd/brak tabeli = niezablokowany). */
function rez_phone_blocked($pdo, $phoneNorm) {
    if ($phoneNorm === '') return false;
    try {
        $stmt = $pdo->prepare('SELECT blocked FROM rez_clients WHERE phone_norm=?');
        $stmt->execute([$phoneNorm]);
        $row = $stmt->fetch();
        return $row ? (int)$row['blocked'] === 1 : false;
    } catch (Throwable $e) {
        return false; // tabela jeszcze nie istnieje – nie blokuj zapisu
    }
}

/**
 * Tworzy/aktualizuje profil klienta i jego pojazd. Zwraca client_id albo null.
 * Best-effort: przy braku tabel (przed migracją) zwraca null bez błędu.
 */
function rez_upsert_client($pdo, $phoneNorm, $phoneDisplay, $name, $email, $plate, $vehicle) {
    if ($phoneNorm === '') return null;
    try {
        $pdo->prepare(
            'INSERT INTO rez_clients (phone_norm, phone_display, name, email)
             VALUES (?,?,?,?)
             ON DUPLICATE KEY UPDATE
                name = IF(name IS NULL OR LENGTH(name) = 0, VALUES(name), name),
                email = IF((email IS NULL OR LENGTH(email) = 0) AND VALUES(email) IS NOT NULL, VALUES(email), email),
                phone_display = VALUES(phone_display),
                updated_at = CURRENT_TIMESTAMP'
        )->execute([$phoneNorm, $phoneDisplay, ($name ?: null), ($email ?: null)]);

        $sel = $pdo->prepare('SELECT id FROM rez_clients WHERE phone_norm=?');
        $sel->execute([$phoneNorm]);
        $clientId = (int)$sel->fetchColumn();
        if (!$clientId) return null;

        if ($plate !== '') {
            $pdo->prepare(
                'INSERT INTO rez_client_vehicles (client_id, plate, vehicle, last_seen)
                 VALUES (?,?,?,NOW())
                 ON DUPLICATE KEY UPDATE
                    vehicle = IF(VALUES(vehicle) IS NOT NULL AND LENGTH(VALUES(vehicle)) > 0, VALUES(vehicle), vehicle),
                    last_seen = NOW()'
            )->execute([$clientId, $plate, ($vehicle ?: null)]);
        }
        return $clientId;
    } catch (Throwable $e) {
        return null;
    }
}

/* ---------- Odpowiedzi JSON ---------- */
function rez_json($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function rez_fail($code, $msg) {
    rez_json(['error' => $msg], $code);
}

/* ---------- Bezpieczeństwo / wejście ---------- */
function rez_guard_origin() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!$origin) return; // brak nagłówka Origin (zwykły GET) – w porządku
    // Zapytania same-origin (strona i API na tym samym hoście) – zawsze OK.
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $originHost = parse_url($origin, PHP_URL_HOST);
    if ($originHost && $host && strcasecmp($originHost, $host) === 0) return;
    // Inaczej dopuść tylko jawnie skonfigurowane źródło.
    $allowed = rez_config()['allowed_origin'] ?? '';
    if ($allowed && $origin === $allowed) return;
    rez_fail(403, 'Niedozwolone źródło zapytania.');
}

/** Prosty throttling: maks. liczba zapytań na IP w oknie czasowym. */
function rez_throttle($key, $max, $windowSec) {
    $file = sys_get_temp_dir() . '/sscar_rl_' . md5($key . ($_SERVER['REMOTE_ADDR'] ?? '')) . '.json';
    $now = time();
    $hits = [];
    if (is_file($file)) {
        $hits = json_decode((string)@file_get_contents($file), true) ?: [];
        $hits = array_filter($hits, function ($t) use ($now, $windowSec) { return $t > $now - $windowSec; });
    }
    if (count($hits) >= $max) return false;
    $hits[] = $now;
    @file_put_contents($file, json_encode(array_values($hits)), LOCK_EX);
    return true;
}
