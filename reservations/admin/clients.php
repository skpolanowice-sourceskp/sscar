<?php
/**
 * clients.php
 *   GET  ?q=...   – lista / wyszukiwanie klientów (telefon, nazwisko, rejestracja).
 *   POST (JSON)   – ręczne dodanie klienta { name, phone, email?, notes?, plate?, vehicle? }.
 * Wymaga logowania (POST dodatkowo CSRF).
 */

define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';

rez_guard_origin();
admin_require();

$pdo = rez_db();
rez_ensure_client_schema($pdo);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ---------- Lista / wyszukiwanie ---------- */
if ($method === 'GET') {
    $q = trim((string)($_GET['q'] ?? ''));

    $cols = 'c.id, c.phone_display, c.name, c.blocked, c.notes,
        (SELECT COUNT(*) FROM rez_bookings b WHERE b.client_id = c.id) AS visits,
        (SELECT GROUP_CONCAT(DISTINCT v.plate SEPARATOR ", ") FROM rez_client_vehicles v WHERE v.client_id = c.id) AS plates,
        (SELECT GROUP_CONCAT(DISTINCT v.vehicle SEPARATOR ", ") FROM rez_client_vehicles v WHERE v.client_id = c.id AND v.vehicle IS NOT NULL AND v.vehicle <> "") AS vehicles';

    try {
        if ($q === '') {
            $stmt = $pdo->prepare("SELECT $cols FROM rez_clients c ORDER BY c.updated_at DESC LIMIT 100");
            $stmt->execute();
        } else {
            // Inteligentne wyszukiwanie: każdy token (AND) musi pasować do któregokolwiek
            // pola profilu (OR): nazwa, telefon, e-mail, notatki, nr rej., marka/model.
            $tokens = array_slice(preg_split('/\s+/', $q, -1, PREG_SPLIT_NO_EMPTY), 0, 6);
            $where  = [];
            $params = [];
            foreach ($tokens as $token) {
                $like = '%' . $token . '%';
                $cond = '(c.name LIKE ? OR c.phone_display LIKE ? OR c.email LIKE ? OR c.notes LIKE ?';
                array_push($params, $like, $like, $like, $like);
                $digits = preg_replace('/\D/', '', $token);
                if ($digits !== '') {
                    $cond .= ' OR c.phone_norm LIKE ?';
                    $params[] = '%' . $digits . '%';
                }
                $cond .= ' OR EXISTS (SELECT 1 FROM rez_client_vehicles v WHERE v.client_id = c.id
                          AND (v.plate LIKE ? OR v.vehicle LIKE ?)))';
                array_push($params, strtoupper($like), $like);
                $where[] = $cond;
            }
            $sql = "SELECT $cols FROM rez_clients c
                    WHERE " . implode(' AND ', $where) . "
                    ORDER BY c.blocked DESC, c.name ASC LIMIT 100";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        $rows = $stmt->fetchAll();
    } catch (Throwable $e) {
        rez_fail(500, 'Baza klientów nie jest gotowa. Uruchom schema_admin.sql w phpMyAdmin.');
    }

    rez_json(['clients' => $rows]);
}

/* ---------- Ręczne dodanie klienta ---------- */
if ($method === 'POST') {
    admin_require_csrf();
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];

    $name    = trim((string)($in['name'] ?? ''));
    $phone   = trim((string)($in['phone'] ?? ''));
    $email   = trim((string)($in['email'] ?? ''));
    $notes   = trim((string)($in['notes'] ?? ''));
    $plate   = strtoupper(trim((string)($in['plate'] ?? '')));
    $vehicle = trim((string)($in['vehicle'] ?? ''));

    $norm = rez_phone_norm($phone);
    if (strlen($norm) < 9)              rez_fail(422, 'Podaj poprawny numer telefonu (min. 9 cyfr).');
    if (mb_strlen($name) > 120)         rez_fail(422, 'Nazwa zbyt długa.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) rez_fail(422, 'Nieprawidłowy adres e-mail.');

    try {
        // Klucz profilu = znormalizowany numer. Duplikat → wskaż istniejący profil.
        $chk = $pdo->prepare('SELECT id FROM rez_clients WHERE phone_norm=?');
        $chk->execute([$norm]);
        $existing = $chk->fetchColumn();
        if ($existing) rez_json(['error' => 'Klient z tym numerem telefonu już istnieje.', 'existingId' => (int)$existing], 409);

        $pdo->prepare('INSERT INTO rez_clients (phone_norm, phone_display, name, email, notes) VALUES (?,?,?,?,?)')
            ->execute([$norm, $phone, ($name !== '' ? $name : null), ($email !== '' ? $email : null), ($notes !== '' ? $notes : null)]);
        $id = (int)$pdo->lastInsertId();

        if ($plate !== '') {
            $pdo->prepare('INSERT INTO rez_client_vehicles (client_id, plate, vehicle, last_seen) VALUES (?,?,?,NOW())')
                ->execute([$id, $plate, ($vehicle !== '' ? $vehicle : null)]);
        }
    } catch (Throwable $e) {
        rez_fail(500, 'Nie udało się dodać klienta.');
    }

    rez_json(['ok' => true, 'id' => $id], 201);
}

rez_fail(405, 'Metoda niedozwolona.');
