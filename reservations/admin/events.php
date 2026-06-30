<?php
/**
 * GET events.php?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Zwraca wydarzenia z Google Calendar (znormalizowane) + meta dni (godziny/święta).
 * Wymaga zalogowania. Rezerwacje online dopasowane do rez_bookings po google_event_id.
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/../google.php';

rez_guard_origin();
admin_require();
$cfg = rez_config();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    rez_fail(405, 'Metoda niedozwolona.');
}

$from = (string)($_GET['from'] ?? '');
$to   = (string)($_GET['to'] ?? '');
$fd = DateTime::createFromFormat('Y-m-d', $from);
$td = DateTime::createFromFormat('Y-m-d', $to);
if (!$fd || $fd->format('Y-m-d') !== $from || !$td || $td->format('Y-m-d') !== $to || $from > $to) {
    rez_fail(400, 'Nieprawidłowy zakres dat.');
}

$tz  = new DateTimeZone($cfg['timezone']);
$min = new DateTime($from . ' 00:00:00', $tz);
$max = new DateTime($to . ' 23:59:59', $tz);
if ((int)$min->diff($max)->days > 45) rez_fail(400, 'Zbyt szeroki zakres (maks. 45 dni).');

$calendarId = $cfg['calendar_id'] ?? '';
if (!$calendarId) rez_fail(500, 'Brak skonfigurowanego kalendarza.');

try {
    $items = gcal_list_events($calendarId, $min->format(DateTime::RFC3339), $max->format(DateTime::RFC3339));
} catch (Throwable $e) {
    rez_fail(502, 'Nie udało się pobrać wydarzeń z kalendarza.');
}

/* Dopasuj wydarzenia do rezerwacji online (struktura danych z bazy). */
$ids = [];
foreach ($items as $it) { if (!empty($it['id'])) $ids[] = $it['id']; }
$dbMap = [];
if ($ids) {
    $pdo = rez_db();
    $place = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT id, google_event_id, service, subtype, cust_name, cust_phone, cust_plate, cust_email, notes, ref
         FROM rez_bookings WHERE google_event_id IN ($place)"
    );
    $stmt->execute($ids);
    foreach ($stmt->fetchAll() as $row) { $dbMap[$row['google_event_id']] = $row; }
}

$services = rez_services();
$events = [];
foreach ($items as $it) {
    if (($it['status'] ?? '') === 'cancelled') continue;
    $start = $it['start'] ?? [];
    $end   = $it['end'] ?? [];
    $allDay = isset($start['date']);
    $startISO = $allDay ? (($start['date'] ?? '') . 'T00:00:00') : ($start['dateTime'] ?? null);
    $endISO   = $allDay ? (($end['date'] ?? '') . 'T00:00:00')   : ($end['dateTime'] ?? null);
    if (!$startISO) continue;

    $ev = [
        'id'      => $it['id'] ?? null,
        'start'   => $startISO,
        'end'     => $endISO,
        'allDay'  => $allDay,
        'title'   => $it['summary'] ?? '(bez tytułu)',
        'type'    => 'inne',
        'source'  => 'google',
        'editable'=> true,
    ];

    $eid = $it['id'] ?? '';
    if ($eid && isset($dbMap[$eid])) {
        $row = $dbMap[$eid];
        $svc = $services[$row['service']] ?? null;
        $sub = ($svc && isset($svc['subtypes'][$row['subtype']])) ? $svc['subtypes'][$row['subtype']] : null;
        $ev['type']         = 'rezerwacja';
        $ev['source']       = 'db';
        $ev['bookingId']    = (int)$row['id'];
        $ev['service']      = $row['service'];
        $ev['serviceLabel'] = $svc ? $svc['label'] : $row['service'];
        $ev['subtypeLabel'] = $sub ? $sub['label'] : $row['subtype'];
        $ev['name']         = $row['cust_name'];
        $ev['phone']        = $row['cust_phone'];
        $ev['plate']        = $row['cust_plate'];
        $ev['email']        = $row['cust_email'];
        $ev['notes']        = $row['notes'];
        $ev['ref']          = $row['ref'];
        // Marka/model: nie ma kolumny w rez_bookings — wyłuskaj z tytułu Google
        // („… – PLATE (Marka Model)"). Źródło prawdy grafiku = kalendarz.
        $ev['vehicle']      = ev_vehicle_from_title($it['summary'] ?? '');
        $lbl                = $sub ? $sub['label'] : $row['subtype'];
        $ev['title']        = ($row['cust_plate'] !== '' && $row['cust_plate'] !== null)
            ? ($lbl . ' · ' . $row['cust_plate']) : $lbl;
    } else {
        $sum = mb_strtolower((string)($it['summary'] ?? ''));
        if (preg_match('/blok|urlop|przerw|niedost|zamkni|wolne/u', $sum)) $ev['type'] = 'blok';
        else $ev['type'] = 'inne';
        $ev['description'] = $it['description'] ?? '';
    }
    $events[] = $ev;
}

/* Meta dni z reguł serwera (godziny pracy / święta) – bez duplikacji w JS. */
$days = [];
$cur  = new DateTime($from, $tz);
$last = new DateTime($to, $tz);
while ($cur <= $last) {
    $iso = $cur->format('Y-m-d');
    $dow = (int)$cur->format('w');
    $h = REZ_HOURS[$dow] ?? null;
    $holiday = rez_is_holiday($iso);
    $days[] = [
        'date'    => $iso,
        'dow'     => $dow,
        'open'    => $h ? $h[0] : null,
        'close'   => $h ? $h[1] : null,
        'closed'  => (!$h || $holiday),
        'holiday' => $holiday,
    ];
    $cur->modify('+1 day');
}

rez_json(['events' => $events, 'days' => $days]);

/** Wyłuskuje markę/model z tytułu rezerwacji Google („… – PLATE (Marka Model)") = ostatni nawias. */
function ev_vehicle_from_title($summary) {
    if (preg_match_all('/\(([^()]+)\)/u', (string)$summary, $m) && !empty($m[1])) {
        return trim((string)end($m[1]));
    }
    return '';
}
