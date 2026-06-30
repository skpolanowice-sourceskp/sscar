---
name: sscar-baza-klientow
description: Jak zbudować/rozszerzyć bazę danych w projekcie SSCAR na hostingu vh.pl (czysty PHP + PDO/MySQL, bez Composera). Użyj przy tworzeniu nowych tabel, endpointów CRUD, importów/backfillu lub gdy „zapis działa, a odczyt zwraca 0/śmieci". Zawiera gotowy wzorzec schematu, połączenia PDO (z KRYTYCZNĄ pułapką proxy), endpointu i deployu.
---

# Budowa bazy danych w SSCAR (vh.pl, czysty PHP + PDO)

Przewodnik „jak to robimy w tym projekcie". Najpierw przeczytaj `CLAUDE.md` (mapa projektu).
Wszystko tu opisane jest sprawdzone na produkcji vh.pl.

## 0. Reguła #1 — pułapka, która kosztowała najwięcej (czytaj ZANIM zaczniesz debugować odczyt)

**Hosting vh.pl trzyma MySQL za proxy, które PSUJE pakiety wyników protokołu binarnego**
(server-side prepared statements). Dlatego połączenie PDO **MUSI** mieć:

```php
PDO::ATTR_EMULATE_PREPARES => true   // protokół tekstowy — proxy go nie psuje
```

Przy `=> false` **zapisy działają** (INSERT/UPDATE nie zwracają wyników), ale **każdy `SELECT`
zwraca śmieci albo 0**. Kanarek diagnostyczny: `SELECT @@port` wraca jako `↑nazwa_bazy`
(przesunięte kolumny + bajt sterujący) zamiast `3306`.

### Checklista, gdy „dane są w bazie, ale aplikacja czyta 0"
1. **Najpierw** sprawdź `EMULATE_PREPARES` w `rez_db()` (`reservations/lib.php`). To pierwsza hipoteza, nie ostatnia.
2. Szybki test: w osobnym połączeniu odczytaj `SELECT @@port`. Czysty `3306` → protokół OK. `↑…`/śmieci → proxy psuje binarny protokół → ustaw emulację na `true`.
3. Dopiero potem rozważaj inne tropy. NIE zaczynaj od „read/write split / replika / transakcje / DROP tabeli" — w tym projekcie to były **wszystko ślepe uliczki**.

Skutek uboczny emulacji: parametry idą jako stringi → **nie binduj `LIMIT ?` ani `PARAM_INT`**, używaj literałów.
Bezpieczeństwo: `charset=utf8mb4` w DSN zapewnia poprawne escapowanie (brak ryzyka iniekcji).

## 1. Połączenie (wzorzec `rez_db()`)

Jedno połączenie na żądanie (statyczny singleton), sekrety z `config.php` (gitignored):

```php
function rez_db() {
    static $pdo = null;
    if ($pdo === null) {
        $c = rez_config()['db']; // host/name/user/pass/charset z config.php
        $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset={$c['charset']}";
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => true,   // ← OBOWIĄZKOWO (patrz §0)
        ]);
    }
    return $pdo;
}
```

`config.php` żyje TYLKO na serwerze. Wzór: `config.sample.php` (`'host' => 'localhost'`).

## 2. Schemat tabel — konwencje

- `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` (zawsze — dane mają polskie znaki i bywa mojibake).
- Klucz naturalny przez `UNIQUE KEY` + `id INT AUTO_INCREMENT PRIMARY KEY`.
- Tabele tworzymy **idempotentnie z PHP** (`CREATE TABLE IF NOT EXISTS` w `rez_ensure_*_schema()`), bo właściciel bazy na vh.pl ma prawa DDL. `schema*.sql` jest tylko awaryjne.
- Klucz klienta = `phone_norm` (same cyfry, ostatnie 9 — `rez_phone_norm()`). Relacje przez FK z `ON DELETE CASCADE` tam, gdzie dziecko nie ma sensu bez rodzica (pojazdy), albo `client_id → NULL` tam, gdzie ma (rezerwacje zostają po usunięciu profilu).

Wzorzec (z `rez_clients`/`rez_client_vehicles`):

```sql
CREATE TABLE IF NOT EXISTS rez_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_norm VARCHAR(20) NOT NULL,
  phone_display VARCHAR(40) NOT NULL,
  name VARCHAR(120) DEFAULT NULL,
  email VARCHAR(160) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  blocked TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_phone (phone_norm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 3. Upsert bez odczytu-po-zapisie

Wzorzec idempotentny, zwraca `id` także przy UPDATE — bez osobnego `SELECT`:

```php
$pdo->prepare(
  'INSERT INTO rez_clients (phone_norm, phone_display, name, email) VALUES (?,?,?,?)
   ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id),
      name = IF(name IS NULL OR LENGTH(name)=0, VALUES(name), name),
      phone_display = VALUES(phone_display),
      updated_at = CURRENT_TIMESTAMP'
)->execute([$norm, $disp, $name, $email]);
$cid = (int)$pdo->lastInsertId();   // działa dla INSERT i dla UPDATE
```

## 4. Endpoint backendu (wzorzec `reservations/admin/*.php`)

Każdy endpoint admina:

```php
define('REZ_INTERNAL', 1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/auth.php';
rez_guard_origin();      // origin/referer
admin_require();         // sesja
admin_require_csrf();    // X-CSRF-Token (przy zapisach)
// ... logika ...
rez_json([...]);         // albo rez_fail($code, 'komunikat')
```

- Dopisz nazwę pliku do **allowlisty w `reservations/admin/.htaccess`** (deny-all + allow named). Jeśli REUSE istniejącego endpointu (np. nowy parametr) — `.htaccess` bez zmian.
- Konwencja metod: `GET` = lista/odczyt, `POST` = utworzenie, `PATCH` = edycja, `DELETE` = usunięcie. Duplikat klucza → `409` z polem pomocniczym (np. `existingId`).
- Front woła przez `window.PanelAPI.api(path, {method, json})` — wstrzykuje CSRF, `credentials:same-origin`, serializuje `json`, rzuca `Error` z `.message/.status/.data`.

## 5. Import / backfill brudnych danych (wzorzec `migrate_clients.php`)

Dane legacy w `rez_bookings` są **rozjechane i w złym kodowaniu** (telefon w innym polu, mojibake, `\x9B`, e-mail w `tel`). Dlatego import:
1. Skanuje **wszystkie** pola tekstowe wiersza ORAZ wydarzenia Google Calendar.
2. `rez_extract_phone()` — telefon z dowolnego tekstu (9 cyfr / 3-3-3 / +48, ostatnie 9).
3. `mig_utf8()` — naprawa bajtów do poprawnego UTF-8 **przed** zapisem (inaczej `SQLSTATE[22007] 1366 Incorrect string value` wywala wiersz).
4. `mig_extract_email()` (tylko `filter_var`-poprawny adres) + `clean_name()` (odszumianie).
5. Idempotentny upsert po `phone_norm` (§3). Endpoint jest **stały** (przycisk „Zaimportuj z rezerwacji") — nie kasować.

## 6. Deploy (vh.pl)

- FTP, dane w `.vscode/sftp.json`. **Hasła nie wpisuj inline** — czytaj do zmiennej:
  ```powershell
  $cfg = Get-Content ".vscode/sftp.json" -Raw | ConvertFrom-Json
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($cfg.username, $cfg.password)
  $wc.UploadFile("ftp://$($cfg.host)/reservations/admin/plik.php", "STOR", (Join-Path (Get-Location) "reservations/admin/plik.php"))
  ```
- Weryfikacja parsowania bez PHP CLI: POST na endpoint i oczekuj `401` (a nie `500`):
  `Invoke-WebRequest -Uri https://www.sscar.pl/reservations/admin/plik.php -Method POST` → `HTTP 401` = OK.
- Po zmianie `panel*.js`/`panel.css` **podbij `?v=YYYYMMDDx`** w `panel.html`.
- **NIE** nadpisuj `config.php` deployem (gitignored, sekrety tylko na serwerze).

## 7. Diagnostyka na produkcji (gdy brak PHP CLI)

Skoro nie ma `php -l`, dorzucaj **tymczasowy** samotest do endpointu (zwracaj surowe wartości w JSON,
np. `SELECT @@port`, `COUNT(*)`, próbki danych), zbieraj wynik z panelu (zrzut ekranu), **a po znalezieniu
przyczyny posprzątaj rusztowanie** (usuń tryb preview/diag/probe). Tak znaleziono pułapkę z §0.
