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
- `clients.php` — **GET** lista/szukaj klientów; **POST** ręczne dodanie klienta (`{name,phone,email?,notes?,plate?,vehicle?}`; duplikat numeru → 409 z `existingId`).
- `client.php` — **GET** profil (`{client, vehicles[id,plate,vehicle,last_seen], history}`); **PATCH** edycja
  (`name/email/phone/notes/blocked` + pojazdy: `vehicle_add/vehicle_edit/vehicle_del`); **DELETE** usunięcie profilu
  (rezerwacje zostają, `client_id→NULL`; pojazdy kaskadowo). Zmiana `phone` przelicza `phone_norm` i pilnuje unikalności.
- `migrate_clients.php` — **import/backfill profili** (POST, idempotentny, stały — to backend przycisku
  „Zaimportuj z rezerwacji"). Skanuje **wszystkie pola tekstowe** `rez_bookings` ORAZ **wydarzenia Google**
  (tytuł/opis/lokalizacja) pod kątem numeru telefonu (`rez_extract_phone`), pomija eventy już powiązane po
  `google_event_id` i blokady. NIE usuwać z serwera.

### Panel admina — frontend (root)
- `panel.html` — szkielet; ładuje 4 skrypty + `panel.css`. **Cache-busting przez `?v=YYYYMMDDx`** — bumpuj po każdej zmianie panelu.
- `panel.js` — powłoka: boot, logowanie, router widoków, `window.PanelAPI.api()` (wstrzykuje CSRF, `credentials: same-origin`, serializuje `json`).
- `panel.css` — self-contained, prefix `pnl-`, tokeny marki (ciemny + czerwień). NIE w `styles.css`.
- `panel-calendar.js` — widok Kalendarz: siatka 10-min, render eventów, szuflada szczegółów. Eksportuje `window.PanelCalendarInternals`.
- `panel-calendar-edit.js` — tworzenie/edycja/przeciąganie/rozciąganie/usuwanie. `window.PanelCalendarEdit`.
- `panel-clients.js` — widok Klienci: lista/szukaj + **ręczne dodawanie** (`+ Nowy`), profil, **edycja danych**
  (inline w nagłówku), **zarządzanie pojazdami** (dodaj/edytuj/usuń), notatki, blokada nr, **usuwanie profilu** (strefa na dole).

---

## 4. Model danych (MySQL)

- **`rez_bookings`** — `id, resource, start_dt DATETIME, end_dt DATETIME, service, subtype,
  cust_name, cust_phone, cust_plate, cust_email, notes, google_event_id, ref, client_id, status`.
  `UNIQUE KEY uniq_start (start_dt)` — dwie rezerwacje nie mogą mieć tego samego początku.
- **`rez_clients`** — klucz `phone_norm` (ostatnie 9 cyfr) + `display, name, email, notes, blocked, blocked_reason, blocked_at`.
- **`rez_client_vehicles`** — `client_id, plate, vehicle` (wiele aut na klienta).

Profile klienta powstają **automatycznie** tylko z rezerwacji **online** (`rez_bookings` przez `book.php`).
Dodatkowo można je tworzyć **ręcznie** („+ Nowy" w panelu) oraz **importem** (`migrate_clients.php`), który skanuje
pola `rez_bookings` i wydarzenia Google w poszukiwaniu numeru telefonu (`rez_extract_phone` w `lib.php`).

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
- **Rozjechane dane rezerwacji**: w `rez_bookings` numer telefonu bywa w innym polu niż `cust_phone`
  (legacy / kolumny przesunięte — patrz „osobowy"). Dlatego import (`migrate_clients.php`) i `rez_extract_phone`
  szukają numeru we **wszystkich** polach człowieka. Heurystyka telefonu: 9 cyfr / grupy 3-3-3 / prefiks +48,
  bierze ostatnie 9 cyfr. Może dawać sporadyczne fałszywe trafienia — profile da się poprawić/usunąć w panelu.

---

## 9. Utrzymanie tego pliku

Po każdej zmianie, która zmienia **architekturę, kontrakt danych, przepływ lub ważną konwencję**,
dopisz krótko tutaj (i w razie potrzeby zaktualizuj odpowiednią sekcję). Nie opisuj drobnych
poprawek CSS ani literówek. Trzymaj datę bezwzględną.

### Changelog
- **2026-06-25 (b)** — Import klientów przebudowany. `lib.php` += `rez_extract_phone()` (szuka telefonu w dowolnym
  tekście: 9 cyfr / 3-3-3 / +48) i `rez_phone_format()`. `migrate_clients.php` skanuje teraz **wszystkie pola
  człowieka** w `rez_bookings` (nie tylko `cust_phone` — dane bywają rozjechane) **oraz wydarzenia Google**
  (`gcal_list_events`, zakres −2 lata…+6 mies., do 250 szt.; pomija eventy znane po `google_event_id` i blokady).
  Zwraca `created/from_bookings/from_events/clients_total/google_error`; front pokazuje jawny wynik importu.
  `migrate_clients.php` to teraz **stały** endpoint (nie kasować). `?v=20260625c`.
- **2026-06-25** — Panel/Klienci: **pełne CRUD bazy klientów**. `clients.php` dostał **POST** (ręczne dodanie,
  duplikat numeru → 409 `existingId`). `client.php` PATCH rozszerzony o `name/email/phone` (zmiana telefonu
  przelicza `phone_norm` + guard unikalności) i operacje na pojazdach `vehicle_add/vehicle_edit/vehicle_del`;
  doszedł **DELETE** (kasuje profil, rezerwacje zostają z `client_id=NULL`, pojazdy kaskadowo; `GET` zwraca teraz
  `vehicles.id`). `panel.js` `api()` dokłada `err.data` (front czyta `existingId`). `panel-clients.js` przepisany:
  `+ Nowy`, edycja danych inline w nagłówku, zarządzanie pojazdami, usuwanie profilu (strefa na dole). Bez nowych
  endpointów (reuse → `.htaccess` bez zmian). Wersja zasobów: `?v=20260625a`. Wdrożone FTP.
- **2026-06-24** — Panel/kalendarz: (a) edycja **bez kasowania dla wszystkich typów** wydarzeń
  (doszedł `inne` przez `openSimpleEdit` + gałąź 2 w `event.php` z polem `kind`); (b) **wyższa siatka**
  `PPM 1.6 → 2.6`; (c) **tworzenie przeciągnięciem od–do** na pustej kolumnie (`startCreateDrag`,
  „duch" `.pnl-cal-ghost`), klik nadal = domyślny czas; (d) uchwyt rozciągania 7→10 px.
  Wersja zasobów panelu: `?v=20260624c`.
- **2026-06-24** — Fix: rozciąganie/przesuwanie eventu rzucało 500 „Failed to parse time string (osobowy)";
  `ev_update` czyta `start_dt` leniwie, przeciągnięcie self-healuje wiersz (patrz sekcja 8).
