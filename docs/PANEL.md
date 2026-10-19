# Rezerwacja online + panel admina — backend, dane, kalendarz

Czytaj przy każdej pracy w `reservations/`, `rezerwacja.html`, `panel.html` lub `js/panel*.js`.
Przy nowych tabelach / endpointach / importach użyj też skilla `sscar-baza-klientow`.
Historia zmian: `docs/CHANGELOG.md` (wpisy 2026-06-24 … 2026-07-17). Setup od zera: `docs/README-rezerwacja-setup.md`.

**Źródło prawdy grafiku = Google Calendar.** MySQL trzyma dane rezerwacji, profile klientów i blokady numerów.

---

## 1. Pliki

### Rezerwacja publiczna
- `rezerwacja.html` + `js/rezerwacja.js` — formularz klienta. Bumpuj `?v=` w `rezerwacja.html` po każdej zmianie JS.
- `reservations/availability.php` — wolne terminy (freeBusy z Google). Dla usług z polami `spacing`+`match`
  (klimatyzacja) wygasza sloty w oknie ±`spacing` min wokół istniejących klim — wykrywanych z **eventów Google**
  po tytule (`gcal_list_events` + `rez_match_event_starts`), nie z bazy. Fail-open.
- `reservations/book.php` — zapis: walidacja → blok-check numeru → overlap-check → spacing-check
  (krok 2: `rez_spacing_conflict` na bazie, `FOR UPDATE`, guard online↔online; krok 3: `rez_match_event_starts`
  na eventach Google — łapie klimy ręczne/starsze) → INSERT `rez_bookings` → INSERT eventu Google → upsert klienta.

### Wspólny backend (`reservations/`)
- `lib.php` — `rez_config()`, `rez_db()` (PDO), `rez_json()`, `rez_fail()`, `rez_throttle()`, `rez_guard_origin()`,
  `rez_resolve()`, `rez_services()`, **`REZ_HOURS`** (godziny pracy wg dnia tygodnia), `rez_is_holiday()`,
  `rez_phone_norm()` (ostatnie 9 cyfr), `rez_phone_blocked()`, `rez_upsert_client()`, `rez_ensure_client_schema()`,
  `rez_extract_phone()`, `rez_phone_format()`, `rez_spacing_conflict()`, `rez_match_event_starts()`.
- `google.php` — Calendar API przez konto usługowe (JWT): `gcal_list_events/insert/update/delete_event()`.
- `config.php` (**gitignored**, tylko na serwerze) — db, `calendar_id`, `timezone`, konto usługowe, `admin_pass_hash`.
  Wzór: `config.sample.php`.
- `schema.sql`, `schema_admin.sql` (tabele klientów zwykle tworzy PHP automatycznie).

> **⚠️ Godziny pracy są w DWÓCH miejscach:** `REZ_HOURS` w `lib.php` (backend + panel) i `HOURS` w
> `js/rezerwacja.js` (front liczy sloty sam). Zmieniaj oba naraz, plus teksty/schema.org na
> `index.html`, `o-nas.html`, `oferta.html`. Święta: `rez_is_holiday()` i `isHoliday()` w JS — też para.

### Panel — backend (`reservations/admin/`)
- `.htaccess` — deny-all + allowlist endpointów; blokuje `.json/.sql/.md/.sample.php` i `auth.php`.
  **Nowy endpoint = dopisz go do allowlisty.**
- `auth.php` — include: sesja + CSRF (`admin_require()`, `admin_require_csrf()`). Nigdy wywoływany bezpośrednio.
- `login.php`, `logout.php`, `session.php`, `meta.php` (usługi/warianty do formularzy).
- `events.php` — GET wydarzenia z Google (znormalizowane) + meta dni; dopasowanie do `rez_bookings` po `google_event_id`.
  Wyłuskuje markę/model z tytułu (`ev_vehicle_from_title` = ostatni nawias) → `ev.vehicle`.
- `event.php` — POST/PATCH/DELETE. `ev_update` ma trzy gałęzie: (1) `start`+`end` = przesunięcie/rozciągnięcie,
  (2) `title` (+`kind`) dla wpisów spoza bazy (`blok` → prefiks „Blokada:", `inne` surowy tytuł),
  (3) `customer` = dane rezerwacji. Tworzenie: `addClient` (domyślnie true) decyduje o profilu klienta.
- `clients.php` — GET szukaj (tokeny AND, każdy OR po name/phone/email/notes/plate/vehicle, `LIMIT 100` literałem);
  POST ręczne dodanie (duplikat → 409 + `existingId`).
- `client.php` — GET profil `{client, vehicles, history}`; PATCH dane + `vehicle_add/edit/del`; DELETE profil
  (rezerwacje zostają z `client_id=NULL`).
- `migrate_clients.php` — **stały** endpoint przycisku „Zaimportuj z rezerwacji" (idempotentny; skan pól
  `rez_bookings` + eventów Google, `mig_utf8`, `mig_extract_email`, `clean_name`, tworzy też pojazdy). Nie usuwać.

### Panel — frontend
- `panel.html` (korzeń) ładuje `js/panel.js`, `js/panel-calendar.js`, `js/panel-calendar-edit.js`,
  `js/panel-clients.js` + `css/panel.css`. **Cache-busting `?v=YYYYMMDDx` — bumpuj po każdej zmianie.**
- `panel.js` — boot, logowanie, router, `window.PanelAPI.api()` (CSRF, `credentials: same-origin`, `json`, `err.data`).
- `css/panel.css` — self-contained, prefiks `pnl-`. Nigdy w `css/styles.css`.
- `panel-calendar.js` — siatka 10 min, render, szuflada; `window.PanelCalendarInternals`.
- `panel-calendar-edit.js` — tworzenie/edycja/drag/resize/usuwanie; `window.PanelCalendarEdit`.
- `panel-clients.js` — lista/szukaj, `+ Nowy`, profil, edycja inline, pojazdy, blokada, usuwanie, import.

---

## 2. Model danych (MySQL)

- **`rez_bookings`** — `id, resource, start_dt, end_dt, service, subtype, cust_name, cust_phone, cust_plate,
  cust_email, notes, google_event_id, ref, client_id, status`. `UNIQUE uniq_start (start_dt)`.
  Marka/model **nie ma kolumny** — żyje w tytule eventu Google („PLATE (Marka Model)") i w `rez_client_vehicles`.
- **`rez_clients`** — klucz `phone_norm` (ostatnie 9 cyfr) + `display, name, email, notes, blocked, blocked_reason, blocked_at`.
- **`rez_client_vehicles`** — `client_id, plate, vehicle`.

Profile powstają automatycznie z rezerwacji online, ręcznie (`+ Nowy`) i importem. `rez_upsert_client` woła
`rez_ensure_client_schema` i wstawia pojazd w osobnym `try` (błąd auta nie zrywa powiązania klienta).

---

## 3. Kalendarz panelu

- **Typy eventów:** `rezerwacja` (wiersz w bazie po `google_event_id`), `blok` (tytuł pasuje do
  `blok|urlop|przerw|niedost|zamkni|wolne`), `inne`. Wszystkie edytowalne bez kasowania.
- **`PPM`** w `panel-calendar.js` = piksele na minutę (obecnie **2.6**). Steruje wysokością siatki **i** matematyką
  przeciągania (`ctx.ppm`). Zmiana wysokości = zmiana tej jednej stałej.
- **Interakcje:** blok → `startDrag(...,'move')`, uchwyt `.pnl-ev-resize` → `'resize'` (snap do najbliższej linii
  10 min, liczony bezwzględnie + `grabDy`); pusta kolumna → `startCreateDrag` (klik = domyślny czas,
  przeciągnięcie = zakres; `slotAt = floor(px/cell)`), duch `.pnl-cal-ghost`.
- **Optymistyczny UI:** zmiana od razu na `st.events` + `renderGrid({keepScroll})`, request w tle, błąd → rollback
  + `toast`. API: `applyLocal(id,patch)→prev`, `addLocal`, `removeLocal`, `refresh()` (cichy refetch), `toast`,
  `saveBegin()/saveEnd()`. Nowy wpis jest `_pending` (`is-pending`, nieklikalny) do potwierdzenia POST, potem
  tymczasowe `id` → realne. **Nie używać `reload()` po zapisie.**
- **Polling:** `autoRefresh` co 30 s + `visibilitychange`. Pomija cykl, gdy karta ukryta, inny widok, trwa drag,
  jest `_pending` lub `st.saving > 0`. Linia „teraz": `tickNow` co 20 s.
- **Kafelki:** `tier = hgt < 34 ? ' is-xs'` — jednoliniowe (godzina + auto + telefon, do lewej);
  wyższe = pionowa lista priorytetowa z `flex-wrap` do kolejnej kolumny.
- **Domyślny widok: Dzień.** Layout `.pnl-app { height:100dvh; overflow:hidden }` — przewija się tylko wnętrze widoku.
- **Strefa czasu:** czas lokalny stacji; `parseLocal` czyta „ścianę zegara" z ISO, ignorując offset.

---

## 4. Bezpieczeństwo

- Wspólne hasło → `password_verify` z `admin_pass_hash` (bcrypt), sesja PHP (httponly+secure+Lax), throttling, `noindex`.
- CSRF: nagłówek `X-CSRF-Token` na zapisach (wstrzykuje `PanelAPI.api`); `rez_guard_origin()` na każdym endpoincie.

---

## 5. Pułapki backendu

- **⚠️ „Zapis działa, odczyt zwraca 0/śmieci" = `PDO::ATTR_EMULATE_PREPARES` musi być `true`.** Proxy MySQL na vh.pl
  psuje protokół binarny (kanarek: `SELECT @@port` → „↑nazwa_bazy"). NIE diagnozować jako replika/transakcje.
  Konsekwencja: nie bindować `LIMIT ?` — literały. `charset=utf8mb4` w DSN zapewnia poprawne escapowanie.
- **Uszkodzone `start_dt`** w starych wierszach (tekst wariantu np. `osobowy`). `event.php` czyta je leniwie;
  przeciągnięcie eventu samo naprawia wiersz. Historia klienta może pokazywać „Invalid Date".
- **Rozjechane i źle zakodowane dane legacy** (telefon w złym polu, mojibake, e-mail w `tel`). Surowy INSERT pada na
  `SQLSTATE[22007] 1366` — stąd `mig_utf8()` + walidacja e-maila w imporcie.
- **Brak PHP lokalnie** — `php -l` nie działa; weryfikuj czytając kod.
