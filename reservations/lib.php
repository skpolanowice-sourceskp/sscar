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
