<?php
/**
 * GET availability.php?service=techniczne&subtype=osobowy&date=2026-06-16
 * Zwraca: { "busy": ["07:20","08:00", ...] }  (zajęte godziny wśród siatki slotów)
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/lib.php';
require __DIR__ . '/google.php';

rez_guard_origin();
rez_config(); // wczytaj konfigurację i ustaw strefę czasową przed logiką dat

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    rez_fail(405, 'Metoda niedozwolona.');
}
if (!rez_throttle('avail', 120, 60)) {
    rez_fail(429, 'Za dużo zapytań. Spróbuj za chwilę.');
}

$serviceKey = (string)($_GET['service'] ?? '');
$subtypeKey = (string)($_GET['subtype'] ?? '');
$dateISO    = (string)($_GET['date'] ?? '');

$resolved = rez_resolve($serviceKey, $subtypeKey);
if (!$resolved) rez_fail(400, 'Nieprawidłowa usługa.');
list($service, $subtype) = $resolved;

if (!rez_date_bookable($dateISO)) {
    // Dzień zamknięty / poza zakresem – brak wolnych godzin.
    rez_json(['busy' => [], 'slots' => []]);
}

$cfg = rez_config();
$calendarId = $cfg['calendar_id'] ?? '';
if (!$calendarId) rez_fail(500, 'Brak skonfigurowanego kalendarza.');

$slots = rez_slots_for_day($dateISO, $subtype['duration']);
$tz = $cfg['timezone'];

try {
    $intervals = gcal_busy_intervals($calendarId, $dateISO);
} catch (Throwable $e) {
    rez_fail(502, 'Nie udało się pobrać dostępności z kalendarza.');
}

// Wymagany odstęp od innej rezerwacji tej samej usługi (np. klimatyzacja: realna
// obsługa ~50 min mimo 10-min slotu). Wygaszamy też sloty w oknie ±spacing wokół
// istniejących klim, nie tylko sam termin nakładający się w freeBusy. Źródłem są
// EVENTY Google (po tytule), więc łapie też wpisy ręczne/panelowe i starsze.
$spacing = (int)($subtype['spacing'] ?? 0);
$matchRe = (string)($subtype['match'] ?? '');
$gapSec = $spacing * 60;
$sameStarts = [];
if ($gapSec && $matchRe !== '') {
    try {
        $dayMin = (new DateTime($dateISO . ' 00:00:00', new DateTimeZone($tz)))->format(DateTime::RFC3339);
        $dayMax = (new DateTime($dateISO . ' 23:59:59', new DateTimeZone($tz)))->format(DateTime::RFC3339);
        $sameStarts = rez_match_event_starts(gcal_list_events($calendarId, $dayMin, $dayMax), $matchRe);
    } catch (Throwable $e) {
        $sameStarts = []; // fail-open – dostępność dalej działa (book.php i tak zweryfikuje)
    }
}

$busy = [];
foreach ($slots as $time) {
    $start = (new DateTime($dateISO . ' ' . $time, new DateTimeZone($tz)))->format(DateTime::RFC3339);
    $endMin = (int)substr($time, 0, 2) * 60 + (int)substr($time, 3, 2) + $subtype['duration'];
    $endStr = sprintf('%02d:%02d', intdiv($endMin, 60), $endMin % 60);
    $end = (new DateTime($dateISO . ' ' . $endStr, new DateTimeZone($tz)))->format(DateTime::RFC3339);
    $isBusy = gcal_slot_busy($start, $end, $intervals);
    if (!$isBusy && $gapSec) {
        $slotTs = strtotime($dateISO . ' ' . $time);
        foreach ($sameStarts as $ts) {
            if (abs($ts - $slotTs) < $gapSec) { $isBusy = true; break; }
        }
    }
    if ($isBusy) $busy[] = $time;
}

rez_json(['busy' => $busy, 'slots' => $slots]);
