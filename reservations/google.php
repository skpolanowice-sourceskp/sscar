<?php
/**
 * SSCAR – rezerwacje: integracja z Google Calendar API.
 * Autoryzacja przez konto usługowe (service account, JWT RS256) – bez Composera.
 * Wymaga rozszerzeń PHP: openssl, curl, json (standard na vh.pl).
 */

if (!defined('REZ_INTERNAL')) { http_response_code(403); exit('Forbidden'); }

function gcal_b64url($d) {
    return rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
}

/** Pobiera (i cache'uje) token dostępu dla konta usługowego. */
function gcal_token() {
    static $cached = null;
    if ($cached !== null) return $cached;

    $cfg = rez_config();
    $keyPath = $cfg['service_account_key'] ?? '';
    if (!is_file($keyPath)) rez_fail(500, 'Brak pliku klucza konta usługowego Google.');
    $key = json_decode((string)file_get_contents($keyPath), true);
    if (!$key || empty($key['client_email']) || empty($key['private_key'])) {
        rez_fail(500, 'Nieprawidłowy plik klucza Google.');
    }

    // cache na dysku (token ważny ~1h)
    $cacheFile = sys_get_temp_dir() . '/sscar_gcal_token_' . md5($key['client_email']) . '.json';
    if (is_file($cacheFile)) {
        $c = json_decode((string)@file_get_contents($cacheFile), true);
        if ($c && ($c['expires_at'] ?? 0) > time() + 30) {
            return $cached = $c['access_token'];
        }
    }

    $now = time();
    $header = gcal_b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claim = gcal_b64url(json_encode([
        'iss'   => $key['client_email'],
        'scope' => 'https://www.googleapis.com/auth/calendar',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
    ]));
    $input = $header . '.' . $claim;
    $sig = '';
    if (!openssl_sign($input, $sig, $key['private_key'], OPENSSL_ALGO_SHA256)) {
        rez_fail(500, 'Nie udało się podpisać żądania Google (OpenSSL).');
    }
    $jwt = $input . '.' . gcal_b64url($sig);

    list($status, $body) = gcal_http(
        'POST',
        'https://oauth2.googleapis.com/token',
        null,
        http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        'application/x-www-form-urlencoded'
    );
    $data = json_decode($body, true);
    if ($status !== 200 || empty($data['access_token'])) {
        rez_fail(502, 'Autoryzacja Google nie powiodła się.');
    }

    @file_put_contents($cacheFile, json_encode([
        'access_token' => $data['access_token'],
        'expires_at'   => $now + (int)($data['expires_in'] ?? 3600),
    ]), LOCK_EX);

    return $cached = $data['access_token'];
}

/** Zajęte przedziały [['start'=>RFC3339,'end'=>RFC3339], ...] dla kalendarza w danym dniu. */
function gcal_busy_intervals($calendarId, $dateISO) {
    $tz = rez_config()['timezone'];
    $min = (new DateTime($dateISO . ' 00:00:00', new DateTimeZone($tz)))->format(DateTime::RFC3339);
    $max = (new DateTime($dateISO . ' 23:59:59', new DateTimeZone($tz)))->format(DateTime::RFC3339);

    list($status, $body) = gcal_http(
        'POST',
        'https://www.googleapis.com/calendar/v3/freeBusy',
        gcal_token(),
        json_encode([
            'timeMin' => $min,
            'timeMax' => $max,
            'timeZone' => $tz,
            'items' => [['id' => $calendarId]],
        ]),
        'application/json'
    );
    $data = json_decode($body, true);
    if ($status !== 200 || !isset($data['calendars'][$calendarId])) {
        throw new RuntimeException('freeBusy error');
    }
    $cal = $data['calendars'][$calendarId];
    if (!empty($cal['errors'])) throw new RuntimeException('kalendarz niedostępny dla konta usługowego');
    return $cal['busy'] ?? [];
}

/** Czy slot [start,end) koliduje z którymś zajętym przedziałem. */
function gcal_slot_busy($startISO, $endISO, $intervals) {
    $s = strtotime($startISO);
    $e = strtotime($endISO);
    foreach ($intervals as $iv) {
        $bs = strtotime($iv['start']);
        $be = strtotime($iv['end']);
        if ($s < $be && $e > $bs) return true;
    }
    return false;
}

/** Lista wydarzeń kalendarza w zakresie [timeMin, timeMax] (RFC3339). */
function gcal_list_events($calendarId, $timeMinISO, $timeMaxISO) {
    $params = http_build_query([
        'timeMin'      => $timeMinISO,
        'timeMax'      => $timeMaxISO,
        'singleEvents' => 'true',     // rozwiń serie cykliczne na pojedyncze wystąpienia
        'orderBy'      => 'startTime',
        'maxResults'   => 250,
        'showDeleted'  => 'false',
        'timeZone'     => rez_config()['timezone'],
    ]);
    $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events?' . $params;
    list($status, $body) = gcal_http('GET', $url, gcal_token(), null, 'application/json');
    $data = json_decode($body, true);
    if ($status !== 200 || !isset($data['items'])) {
        throw new RuntimeException('events.list error');
    }
    return $data['items'];
}

/** Aktualizuje (PATCH) wydarzenie. $patch = pola do zmiany. Zwraca dane wydarzenia. */
function gcal_update_event($calendarId, $eventId, $patch) {
    list($status, $body) = gcal_http(
        'PATCH',
        'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events/' . rawurlencode($eventId),
        gcal_token(),
        json_encode($patch),
        'application/json'
    );
    $data = json_decode($body, true);
    if ($status < 200 || $status >= 300 || empty($data['id'])) {
        throw new RuntimeException('update event error');
    }
    return $data;
}

/** Usuwa wydarzenie z kalendarza. Zwraca true przy sukcesie (200/204/410). */
function gcal_delete_event($calendarId, $eventId) {
    list($status, ) = gcal_http(
        'DELETE',
        'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events/' . rawurlencode($eventId),
        gcal_token(),
        null,
        'application/json'
    );
    // 410 Gone = już usunięte – traktujemy jak sukces.
    if ($status === 200 || $status === 204 || $status === 410) return true;
    throw new RuntimeException('delete event error (' . $status . ')');
}

/** Tworzy wydarzenie w kalendarzu. Zwraca dane wydarzenia (z 'id'). */
function gcal_insert_event($calendarId, $event) {
    list($status, $body) = gcal_http(
        'POST',
        'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events',
        gcal_token(),
        json_encode($event),
        'application/json'
    );
    $data = json_decode($body, true);
    if ($status < 200 || $status >= 300 || empty($data['id'])) {
        throw new RuntimeException('insert event error');
    }
    return $data;
}

/** Minimalny klient HTTP (cURL). Zwraca [status, body]. */
function gcal_http($method, $url, $bearer, $payload, $contentType) {
    $ch = curl_init($url);
    $headers = ['Content-Type: ' . $contentType];
    if ($bearer) $headers[] = 'Authorization: Bearer ' . $bearer;
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $body = curl_exec($ch);
    if ($body === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('HTTP error: ' . $err);
    }
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, $body];
}
