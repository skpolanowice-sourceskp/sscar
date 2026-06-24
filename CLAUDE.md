# CLAUDE.md — przewodnik po projekcie SSCAR

Ten plik jest mapą projektu dla przyszłych sesji Claude. **Czytaj go najpierw**, zanim
zaczniesz research od zera. **Aktualizuj go** po każdej istotnej zmianie (patrz sekcja
„Utrzymanie tego pliku" na końcu). Szczegóły marki/designu są w `PRODUCT.md` i `DESIGN.md`
— tu ich nie powtarzamy.

> Daty w tym pliku są bezwzględne. Stan na: **2026-06-24**.

---

## 1. Czym jest projekt

Strona stacji kontroli pojazdów **SSCAR** (Sosnowiec) + system **rezerwacji online**
+ **panel obsługi (admin)**. Trzy warstwy w jednym repo:

1. **Witryna statyczna** — landing i podstrony usług (HTML + wspólny `styles.css`).
2. **Rezerwacja online** — publiczny formularz (`rezerwacja.html`) → backend PHP w `reservations/`.
3. **Panel admina** — `panel.html` + `panel*.js/.css` (root) → backend w `reservations/admin/`.

**Źródło prawdy grafiku = Google Calendar.** Dane rezerwacji i profile klientów trzymamy
dodatkowo w **MySQL** (struktura + wyszukiwanie + blokady numerów).

---

## 2. Stack i ograniczenia (WAŻNE)

- **Czysty PHP, bez Composera** (hosting współdzielony vh.pl). Żadnych zależności przez `vendor/`.
- **PHP CLI niedostępne lokalnie** — `php -l` nie zadziała. Poprawność weryfikuj czytając kod.
- **Brak frameworka JS** — wszystkie `panel*.js` to vanilla JS w IIFE, rejestrujące się na `window.*`.
- **Windows + PowerShell** lokalnie. Deploy przez **FTP** (dane w `.vscode/sftp.json`).
- **Sekrety:** `reservations/config.php` jest **gitignored** (jest tylko na serwerze). Wzór: `config.sample.php`.
  Nigdy nie wpisuj hasła FTP/admina wprost w komendę — czytaj je ze `sftp.json` do zmiennej.

---

## 3. Mapa plików

### Witryna statyczna (root)
- `index.html`, `o-nas.html`, `oferta.html`, `cennik.html`, podstrony usług
  (`badania-techniczne.html`, `klimatyzacja.html`, `geometria-3d.html`,
  `sprawdzenie-przed-zakupem.html`, `wulkanizacja.html`, …), `dekoder.html`, `guide.html`.
- `styles.css` — **wspólny, cache 7 dni** (NIE dorzucać tu stylów panelu).
- `nav.js`, `reviews_data.js`, `dane_klima.js` + `dane_klima.json` (dane do klimatyzacji).

### Rezerwacja publiczna
- `rezerwacja.html` + `rezerwacja.js` — formularz rezerwacji (klient).
- `reservations/availability.php` — wolne terminy (freeBusy z Google) dla formularza.
- `reservations/book.php` — zapis rezerwacji: walidacja → blok-check numeru → INSERT `rez_bookings`
  → INSERT eventu Google → upsert profilu klienta.

### Wspólny backend (`reservations/`)
- `lib.php` — rdzeń: `rez_config()`, `rez_db()` (PDO), `rez_json()`, `rez_fail()`,
  `rez_throttle()`, `rez_guard_origin()`, `rez_resolve()`, `rez_services()`,
  `REZ_HOURS` (godziny pracy wg dnia tygodnia), `rez_is_holiday()`,
  `rez_phone_norm()` (same cyfry, ostatnie 9), `rez_phone_blocked()`,
  `rez_upsert_client()`, `rez_ensure_client_schema()`.
- `google.php` — Google Calendar API przez **konto usługowe (JWT)**, scope pełny R/W:
  `gcal_list_events()`, `gcal_insert_event()`, `gcal_update_event()`, `gcal_delete_event()`.
- `config.php` (gitignored) — db, `calendar_id`, `timezone`, dane konta usługowego, `admin_pass_hash` (bcrypt).
- `schema.sql` (rezerwacje), `schema_admin.sql` (klienci — zwykle tworzone automatycznie z PHP).

### Panel admina — backend (`reservations/admin/`)
- `.htaccess` — deny-all + allowlist endpointów; blokuje `.json/.sql/.md/.sample.php` i `auth.php`.
- `auth.php` — wspólny include: sesja + CSRF (`admin_require()`, `admin_require_csrf()`).
- `login.php`, `logout.php`, `session.php` — logowanie wspólnym hasłem + status sesji.
- `meta.php` — konfiguracja usług/wariantów (do formularzy).
- `events.php` — **GET** lista wydarzeń z Google (znormalizowane) + meta dni; dopasowuje do `rez_bookings` po `google_event_id`.
- `event.php` — **POST/PATCH/DELETE** tworzenie/edycja/przesuwanie/usuwanie (Google + baza).
- `clients.php`, `client.php` — baza klientów (lista/szukaj + profil + blokada nr tel).
- `migrate_clients.php` — jednorazowy backfill profili z `rez_bookings` (po użyciu usunąć z serwera).

### Panel admina — frontend (root)
- `panel.html` — szkielet; ładuje 4 skrypty + `panel.css`. **Cache-busting przez `?v=YYYYMMDDx`** — bumpuj po każdej zmianie panelu.
- `panel.js` — powłoka: boot, logowanie, router widoków, `window.PanelAPI.api()` (wstrzykuje CSRF, `credentials: same-origin`, serializuje `json`).
- `panel.css` — self-contained, prefix `pnl-`, tokeny marki (ciemny + czerwień). NIE w `styles.css`.
- `panel-calendar.js` — widok Kalendarz: siatka 10-min, render eventów, szuflada szczegółów. Eksportuje `window.PanelCalendarInternals`.
- `panel-calendar-edit.js` — tworzenie/edycja/przeciąganie/rozciąganie/usuwanie. `window.PanelCalendarEdit`.
- `panel-clients.js` — widok Klienci.

---

## 4. Model danych (MySQL)

- **`rez_bookings`** — `id, resource, start_dt DATETIME, end_dt DATETIME, service, subtype,
  cust_name, cust_phone, cust_plate, cust_email, notes, google_event_id, ref, client_id, status`.
  `UNIQUE KEY uniq_start (start_dt)` — dwie rezerwacje nie mogą mieć tego samego początku.
- **`rez_clients`** — klucz `phone_norm` (ostatnie 9 cyfr) + `display, name, email, notes, blocked, blocked_reason, blocked_at`.
- **`rez_client_vehicles`** — `client_id, plate, vehicle` (wiele aut na klienta).

Profile klienta powstają z rezerwacji **online** (`rez_bookings`). Ręczne wpisy istniejące
tylko w Google **nie** tworzą profili.

---

## 5. Jak działa kalendarz panelu (kluczowe dla edycji UI)

- **Typy wydarzeń** (`events.php`): `rezerwacja` (jest wiersz w bazie po `google_event_id`),
  `blok` (tytuł pasuje do `blok|urlop|przerw|niedost|zamkni|wolne`), `inne` (każdy inny event Google).
  **Wszystkie są edytowalne bez kasowania** (od 2026-06-24).
- **`PPM`** w `panel-calendar.js` = piksele na minutę. Steruje **całą** wysokością siatki
  ORAZ matematyką przeciągania (przekazywane do `enhanceGrid` jako `ctx.ppm`). Zmiana wysokości
  siatki = zmiana tej jednej stałej. Aktualnie **2.6** (10 min ≈ 26 px, godzina ≈ 156 px).
- **Interakcje na siatce** (`panel-calendar-edit.js`):
  - blok eventu: `pointerdown` → `startDrag(...,'move')`; dolny uchwyt `.pnl-ev-resize` → `'resize'`.
  - pusta kolumna dnia: `pointerdown` → `startCreateDrag` — **klik** = domyślny czas, **przeciągnięcie od–do** = od razu zadana długość (jak Google Calendar), rysuje „ducha" `.pnl-cal-ghost`.
- **`event.php` / `ev_update`** — trzy gałęzie: (1) `start`+`end` = przesunięcie/rozciągnięcie,
  (2) `title` (+`kind`) dla wpisów spoza bazy (`blok` dostaje prefiks „Blokada:", `inne` tytuł surowy),
  (3) `customer` = dane rezerwacji. Formularz edycji rezerwacji wysyła (1)+(3) razem.
- **Strefa czasu:** kalendarz w czasie lokalnym stacji; front (`parseLocal`) czyta „ścianę zegara" z ISO, ignorując offset.

---

## 6. Bezpieczeństwo / sesja

- Logowanie: **wspólne hasło** → `password_verify` z `admin_pass_hash` (bcrypt `$2y$`), sesja PHP,
  cookie httponly+secure+samesite=Lax, throttling, panel `noindex`.
- **CSRF**: nagłówek `X-CSRF-Token` na zapisach (wstrzykuje `PanelAPI.api`); `rez_guard_origin()` na każdym endpoincie.
- `admin/.htaccess` wpuszcza tylko nazwane endpointy; `auth.php` to include (nigdy bezpośrednio).

---

## 7. Deploy (vh.pl)

- Zwykłe **FTP**; dane logowania w `.vscode/sftp.json` (host `ftp.vh16333.vh.net.pl`, remotePath `/`).
- Wgrywaj zmienione pliki **zachowując ścieżki** (np. `reservations/admin/event.php`).
- **Hasła nie wpisuj inline** — czytaj ze `sftp.json` do zmiennej PowerShell, np. `WebClient.UploadFile($remote,"STOR",$local)`.
- Po zmianie `panel*.js`/`panel.css` **podbij `?v=` w `panel.html`** (inaczej zostanie stary cache).
- `config.php` żyje tylko na serwerze (gitignored) — nie nadpisuj go deployem.

---

## 8. Znane pułapki / dane historyczne

- **Uszkodzone `start_dt`**: część starych wierszy `rez_bookings` ma w `start_dt` tekst wariantu
  (np. `osobowy`) zamiast daty (legacy/ręczne dane, nieodtwarzalne z bieżącego kodu). `event.php`
  czyta `start_dt` **leniwie** — przesuwanie/rozciąganie nie parsuje go w ogóle, a udane przeciągnięcie
  `UPDATE …SET start_dt=?` SAM naprawia wiersz. Skutek uboczny: historia w profilu klienta może
  pokazywać „Invalid Date" do czasu pierwszego ruszenia eventu na siatce.
- **Brak PHP lokalnie** — nie lintuj przez CLI; czytaj kod.
- **`migrate_clients.php`** — narzędzie jednorazowe; po backfillu skasować z serwera.

---

## 9. Utrzymanie tego pliku

Po każdej zmianie, która zmienia **architekturę, kontrakt danych, przepływ lub ważną konwencję**,
dopisz krótko tutaj (i w razie potrzeby zaktualizuj odpowiednią sekcję). Nie opisuj drobnych
poprawek CSS ani literówek. Trzymaj datę bezwzględną.

### Changelog
- **2026-06-24** — Panel/kalendarz: (a) edycja **bez kasowania dla wszystkich typów** wydarzeń
  (doszedł `inne` przez `openSimpleEdit` + gałąź 2 w `event.php` z polem `kind`); (b) **wyższa siatka**
  `PPM 1.6 → 2.6`; (c) **tworzenie przeciągnięciem od–do** na pustej kolumnie (`startCreateDrag`,
  „duch" `.pnl-cal-ghost`), klik nadal = domyślny czas; (d) uchwyt rozciągania 7→10 px.
  Wersja zasobów panelu: `?v=20260624c`.
- **2026-06-24** — Fix: rozciąganie/przesuwanie eventu rzucało 500 „Failed to parse time string (osobowy)";
  `ev_update` czyta `start_dt` leniwie, przeciągnięcie self-healuje wiersz (patrz sekcja 8).
