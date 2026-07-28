# CLAUDE.md — przewodnik po projekcie SSCAR

Ten plik jest mapą projektu dla przyszłych sesji Claude. **Czytaj go najpierw**, zanim
zaczniesz research od zera. **Aktualizuj go** po każdej istotnej zmianie (patrz sekcja
„Utrzymanie tego pliku" na końcu). Szczegóły marki/designu są w `PRODUCT.md` i `DESIGN.md`
— tu ich nie powtarzamy.

> Daty w tym pliku są bezwzględne. Stan na: **2026-06-24**.

---

## 1. Czym jest projekt

Strona stacji kontroli pojazdów **SSCAR** (Wrocław, ul. Polanowicka 82, stacja **DW/126/P**) + system **rezerwacji online**
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
- **⚠️ MySQL za proxy — PDO MUSI mieć `ATTR_EMULATE_PREPARES => true`** (patrz `rez_db()` w `lib.php`).
  Hosting vh.pl trzyma MySQL za proxy, które **psuje pakiety wyników protokołu binarnego** (server-side
  prepared statements). Przy `false` **każdy `SELECT` zwraca śmieci/0** (a `@@port` wraca jako „↑nazwa_bazy"),
  mimo że **zapisy działają** (INSERT/UPDATE nie zwracają wyników). Objaw, który to demaskuje: dane są w bazie
  (phpMyAdmin je widzi), ale aplikacja czyta 0. NIE diagnozuj tego jako „rozdział odczyt/zapis / replika" —
  to protokół. Bezpieczeństwo emulacji: `charset=utf8mb4` w DSN → poprawne escapowanie (brak ryzyka iniekcji).
  Konsekwencja: NIE binduj `LIMIT ?`/`PARAM_INT` (emulacja wysyła parametry jako stringi) — używaj literałów.

---

## 3. Mapa plików

> **Zasada porządku (od 2026-07-27):** korzeń repo = **web root** — leży w nim tylko to, co ma trafić
> na serwer. Wszystko inne siedzi w `tools/` (skrypty dev), `docs/` (dokumentacja) i `img/_src/`
> (oryginały zdjęć). Te trzy katalogi są na liście `ignore` w `.vscode/sftp.json` — **nie wgrywaj ich**.
> Pliki kontekstowe (`CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`) zostają w korzeniu, bo narzędzia
> szukają ich właśnie tam; z deploya wycina je reguła `*.md`.

### Witryna statyczna (root)
- `index.html`, `o-nas.html`, `oferta.html`, `cennik.html`, podstrony usług
  (`badania-techniczne.html`, `klimatyzacja.html`, `geometria-3d.html`,
  `sprawdzenie-przed-zakupem.html`, `wulkanizacja.html`, …), `dekoder.html`, `guide.html`.
- `styles.css` — **wspólny, cache 7 dni** (NIE dorzucać tu stylów panelu).
- `nav.js`, `reviews_data.js`, `dane_klima.js` (dane do klimatyzacji — **generowany**, patrz `tools/`).
- Zasoby: `Logo-SSCAR.png`, `favicon.png`, `Clean_Smooth_transition.mp4` (hero na `index.html`),
  `img/` — warianty responsywne zdjęć. **`Logo-SSCAR.png` i `favicon.png` muszą zostać w korzeniu:**
  wskazują na nie bezwzględne `og:image` na 13 podstronach (przeniesienie zerwałoby podglądy w social media).
- Pliki obsługi wyszukiwarek: `robots.txt`, `sitemap.xml`, `google79c7a3b6a6e8553f.html` (weryfikacja GSC).
- `htaccess` — kopia `.htaccess` z korzenia serwera (wymuszenie HTTPS). **Celowo bez kropki**, żeby
  przypadkowa synchronizacja FTP nie nadpisała reguł żyjących na serwerze. Zmiany nanoś ręcznie.

### Narzędzia i dokumentacja (poza deployem)
- `tools/optimize_images.py` — warianty responsywne: `img/_src/` → `img/`. Uruchamiaj z korzenia
  (`python tools/optimize_images.py`); skrypt liczy ścieżki od katalogu nadrzędnego. Flaga `--auto`
  przerabia hurtem nowe pliki z `img/_src/`, pomijając te z listy `SOURCES` (po nazwie bez rozszerzenia).
- `tools/fix_encoding.py` + `tools/dane_klima.json` — **źródło** bazy klimatyzacji. Skrypt generuje
  `dane_klima.js` w korzeniu; JSON nie jest wysyłany na serwer (2770 rekordów, ~665 KB oszczędności).
- `img/_src/` — oryginały zdjęć (23,6 MB) + stare, ręczne konwersje `.webp` (nieużywane przez stronę).
- `docs/README-rezerwacja-setup.md` (instrukcja wdrożenia rezerwacji), `docs/IDEA.md`.

### Rezerwacja publiczna
- `rezerwacja.html` + `rezerwacja.js` — formularz rezerwacji (klient).
- `reservations/availability.php` — wolne terminy (freeBusy z Google) dla formularza. Dla usług z polami
  `spacing`+`match` (klimatyzacja) dodatkowo wygasza sloty w oknie ±`spacing` min wokół istniejących klim –
  wykrywanych z **eventów Google** po tytule (`gcal_list_events` + `rez_match_event_starts`), nie z bazy.
- `reservations/book.php` — zapis rezerwacji: walidacja → blok-check numeru → overlap-check → **spacing-check
  tej samej usługi** (krok 2: `rez_spacing_conflict` na bazie, FOR UPDATE, guard online↔online; krok 3:
  `rez_match_event_starts` na eventach Google – łapie klimy ręczne/starsze) → INSERT `rez_bookings` →
  INSERT eventu Google → upsert profilu klienta.

### Wspólny backend (`reservations/`)
- `lib.php` — rdzeń: `rez_config()`, `rez_db()` (PDO), `rez_json()`, `rez_fail()`,
  `rez_throttle()`, `rez_guard_origin()`, `rez_resolve()`, `rez_services()`,
  `REZ_HOURS` (godziny pracy wg dnia tygodnia), `rez_is_holiday()`,
  `rez_phone_norm()` (same cyfry, ostatnie 9), `rez_phone_blocked()`,
  `rez_upsert_client()`, `rez_ensure_client_schema()`,
  `rez_spacing_conflict()` (odstęp w bazie) / `rez_match_event_starts()` (starty klim z eventów Google po tytule).
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
- **⚡ Optymistyczny UI (od 2026-07-01):** każda akcja (przeciągnięcie/rozciągnięcie/tworzenie/edycja/usuwanie)
  nanosi zmianę **od razu na lokalny magazyn `st.events` i przerysowuje siatkę BEZ sieci** (`renderGrid` trzyma
  scroll), a request do `event.php` leci **w tle**. Błąd → **rollback** (przywrócenie snapshotu) + `toast`. NIE
  używamy już `reload()` (pełny refetch z placeholderem „Wczytuję…" + skok scrolla) po zapisie. API magazynu na
  `window.PanelCalendarInternals`: `applyLocal(id,patch)→prev`, `addLocal(ev)`, `removeLocal(id)→ev`,
  `refresh()` (cichy refetch bez flasha), `toast(msg,type)`; `renderGrid(opts)` z `autoScroll` (świeże wczytanie)
  vs `keepScroll` (przerysowanie lokalne). Tworzenie: wpis dodawany jako **`_pending`** (klasa `is-pending`,
  `pointer-events:none` – nieklikalny/nieprzeciągalny), po sukcesie POST podmieniamy tymczasowe `id`→realne z
  odpowiedzi (`{id,ref}`) bez refetchu. `panel-calendar-edit.js`: `createInBackground`/`patchInBackground` +
  optymistyczne kształty wydarzeń (`bookingEventShape`, `labelsFor`). Kontrakt backendu bez zmian.
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
- **NIE wgrywaj** `tools/`, `docs/`, `img/_src/`, `*.md`, `*.py`, `.vscode/`, `.git/` — są na liście
  `ignore` w `sftp.json`. Samo `img/` (warianty) **wgrywaj**, to zasoby produkcyjne.

---

## 8. Znane pułapki / dane historyczne

- **Uszkodzone `start_dt`**: część starych wierszy `rez_bookings` ma w `start_dt` tekst wariantu
  (np. `osobowy`) zamiast daty (legacy/ręczne dane, nieodtwarzalne z bieżącego kodu). `event.php`
  czyta `start_dt` **leniwie** — przesuwanie/rozciąganie nie parsuje go w ogóle, a udane przeciągnięcie
  `UPDATE …SET start_dt=?` SAM naprawia wiersz. Skutek uboczny: historia w profilu klienta może
  pokazywać „Invalid Date" do czasu pierwszego ruszenia eventu na siatce.
- **Brak PHP lokalnie** — nie lintuj przez CLI; czytaj kod.
- **⚠️ „Zapis działa, odczyt zwraca 0" = protokół PDO, NIE replika.** Najdroższy błąd w historii projektu:
  panel zapisywał klientów (phpMyAdmin pokazywał komplet), ale każdy `SELECT` aplikacji zwracał 0. Goniliśmy
  fałszywe tropy (transakcje, DROP/recreate tabeli, „read/write split", host w configu = `localhost` jak phpMyAdmin).
  **Prawdziwa przyczyna:** `rez_db()` miało `PDO::ATTR_EMULATE_PREPARES => false`, a proxy MySQL na vh.pl psuje
  pakiety wyników **protokołu binarnego**. Diagnostyczny strzał w dziesiątkę: `SELECT @@port` wracał jako
  `↑nazwa_bazy` (przesunięte kolumny + bajt sterujący). Fix = **`EMULATE_PREPARES => true`** (protokół tekstowy).
  Jak rozpoznać następnym razem: jeśli dane są w bazie, a PHP czyta 0/śmieci — **najpierw** sprawdź emulację
  prepared statements, dopiero potem cokolwiek innego. (Pełny opis w sekcji 2.)
- **Rozjechane + ŹLE ZAKODOWANE dane rezerwacji**: w `rez_bookings` (legacy) numer telefonu bywa w innym polu niż
  `cust_phone`, kolumny są poprzesuwane, a treść zawiera **mojibake / niepoprawny UTF-8** (np. `\x9B`, `??`,
  e-mail w polu `tel`, nazwisko w `email`). Skutek: surowy `INSERT` do `rez_clients` leciał `SQLSTATE[22007] 1366
  Incorrect string value … email` i **cały** wiersz padał (import dawał 0). Dlatego `migrate_clients.php`:
  (a) `rez_extract_phone` szuka numeru we **wszystkich** polach (9 cyfr / 3-3-3 / +48, ostatnie 9);
  (b) `mig_utf8()` naprawia bajty do poprawnego UTF-8 przed zapisem; (c) `email` zapisywany tylko gdy to
  **prawdziwy** adres (`mig_extract_email` + `filter_var`); (d) nazwa odszumiana (`clean_name`). Heurystyka bywa
  niedoskonała (śmieci w nazwie, sporadyczny zły numer) — profile da się poprawić/usunąć w panelu.

---

## 9. Utrzymanie tego pliku

Po każdej zmianie, która zmienia **architekturę, kontrakt danych, przepływ lub ważną konwencję**,
dopisz krótko tutaj (i w razie potrzeby zaktualizuj odpowiednią sekcję). Nie opisuj drobnych
poprawek CSS ani literówek. Trzymaj datę bezwzględną.

### Changelog
- **2026-07-28** — **Optymalizacja scroll-scrub filmu auta w hero.** `Clean_Smooth_transition.mp4`
  przekodowany do H.264 960×540/24 fps bez audio, z klatką kluczową co 4 klatki (48 zamiast 1) i rozmyciem
  zapisanym w materiale; plik zmalał z 1 003 767 do 774 701 B. Usunięto pełnoekranowy `filter: blur()` z CSS.
  Sterowanie w `index.html` ogranicza seek do 24 fps, scala kolejne żądania, wykonuje tylko jeden seek naraz i
  zatrzymuje pracę poza widocznym hero/ukrytą kartą. `prefers-reduced-motion`, Save-Data i bardzo słabe urządzenia
  dostają statyczny `img/hero-car-poster.webp`. Cache: `styles.css?v=20260728a`, film `?v=20260728a`.
- **2026-07-27 (b)** — **Uporządkowanie struktury repo: korzeń = web root, reszta do `tools/`, `docs/`,
  `img/_src/`.** Powód: w korzeniu (który leci na FTP) leżało **26,7 MB oryginałów zdjęć** i plików
  źródłowych, których strona nigdy nie używa — 6 wielkich JPG-ów, 6 nieużywanych ręcznych konwersji
  `.webp` oraz `dane_klima.json` (665 KB; klient ładuje wyłącznie wygenerowany `dane_klima.js`).
  Przeniesione przez `git mv` (historia zachowana):
  `img/_src/` ← oryginały + stare `.webp`; `tools/` ← `optimize_images.py`, `fix_encoding.py`,
  `dane_klima.json`; `docs/` ← `README-rezerwacja-setup.md`, `IDEA.md`.
  **Skrypty przepisane na ścieżki od korzenia** (`BASE_DIR` = katalog nadrzędny wobec `tools/`), bo po
  przeprowadzce liczyłyby je względem siebie i pisały do `tools/img/`. `fix_encoding.py` dostał przy
  okazji docstring i sensowny komunikat (wcześniej ślepe `open('dane_klima.json')` względem CWD).
  **Pułapka `--auto`:** oryginały leżą teraz w tym samym katalogu, który skanuje `--auto`, a ich slugi
  są ręczne (`BMW-M3-F.jpg` → `m3`), więc bez filtra przerobiłby je drugi raz jako `bmw-m3-f-*`.
  Filtr porównuje **nazwę bez rozszerzenia** — to samo zabezpiecza przed łapaniem starych `.webp`.
  Weryfikacja: oba skrypty uruchomione z nowych lokalizacji dają **bit w bit identyczny** wynik
  (`git status dane_klima.js` pusty, warianty w `img/` przeliczone bez zmian).
  `.vscode/sftp.json` → `ignore` += `img/_src`, `tools`, `docs`. `.gitignore` przepisany (naprawione
  mojibake w komentarzu + `__pycache__/`, `*.pyc`, `Thumbs.db`, `desktop.ini`, `.DS_Store`).
  **Świadomie NIE ruszone:** pliki `.html` (URL-e = SEO), `Logo-SSCAR.png`/`favicon.png` (bezwzględne
  `og:image` na 13 podstronach + cache social media), `panel*` (zakładki obsługi), `htaccess`
  (kopia serwerowa, celowo bez kropki — patrz sekcja 3).
- **2026-07-27** — **`o-nas.html` przepisana od zera + nowe komponenty wielokrotnego użytku w `styles.css`.**
  Stara strona to były 4 akapity ogólników i kafelki ze stylami w atrybucie `style`. Nowa oś: **dowody zamiast
  deklaracji** — rejestr pojazdów z hali + imienni diagności z numerami uprawnień.
  **Struktura (finalna):** hero na zdjęciu z hali → rejestr pojazdów → diagności → co dostajesz przy każdym
  badaniu → pas wyróżnień → opinie → CTA (rezerwacja + dwa telefony).
  **⚠️ Czego tu ŚWIADOMIE NIE MA (nie dodawać z powrotem):** listy usług i sprzętu — jest w `oferta.html`
  i `cennik.html`; etapów sprawdzenia przed zakupem — jest w `sprawdzenie-przed-zakupem.html`; opisowych
  biogramów diagnostów — profile to sama karta danych (nazwisko, uprawnienia, staż, specjalizacja).
  Decyzja właściciela: strona ma nie dublować treści z podstron usługowych.
  **Fakty firmowe (ustalone z właścicielem, używać ich zamiast ogólników):** stacja **DW/126/P**, uruchomiona
  **2024**; **Sebastian Stefanik** (upr. `DWR/D/0046`, w zawodzie od 2017, badania + klimatyzacja) i
  **Michał Jarosiński** (upr. `DW/D/0249`, od 2022, badania + geometria, autor strony); geometria na
  **HANWAY HWAV28**; zakres: badania okresowe, **motocykle, LPG, haki, powypadkowe** (BEZ przyczep i zabytkowych);
  Orły Motoryzacji **2025 i 2026**, Złoty Medal 2025, 4,9/5 z ~258 opinii Google.
  **⚠️ Zasada redakcyjna rejestru pojazdów:** wpis dostaje `.spec-list` **tylko gdy istnieją twarde dane**
  (silnik/moc/napęd — dziś M3, drift BMW, AMG GT 63 S). Żadnych opisów zdjęcia w roli specyfikacji typu
  „Zawieszenie: obniżone" ani „Nadwozie: pickup" — to nic nie wnosi. Eclipse, Maverick i Chevrolet mają
  wyłącznie numer, nazwę i podtytuł; zdjęcie niesie je samo i daje rytm sekcji. Etykiet z wykonaną usługą
  świadomie NIE ma (nie da się ich rzetelnie odtworzyć ze zdjęć).
  **Nowe komponenty (globalne, do użycia na innych podstronach):** `.about-hero` + `.ah-*` (hero na pełnym
  zdjęciu, tekst w lewym dolnym rogu), `.vehicle-register`/`.vr-entry` (numerowany, naprzemienny wpis
  zdjęcie+dane), `.spec-list`/`.spec-row` (`<dl>` jako tabela techniczna), `.person-entry` (profil osoby),
  `.credential-band` (pas wyróżnień, separatory na `box-shadow` jak `.dec-card`), `.cta-meta`.
  **Pipeline obrazów:** `optimize_images.py` przepisany — generuje warianty **800/1400/2200 px** (webp + jpg
  fallback 1400) do **`img/`** ze slugami ASCII (pliki źródłowe mają w nazwach „przód", co psuło FTP i wymagało
  kodowania URL). `HERO_SOURCES` robi osobny kadr hero przycięty do górnych 66% — **dolny pas zdjęć zawiera
  wypalony podpis (marka/rocznik/moc + logo SKP)**, który na pełnoekranowym hero przebijał zza nagłówka.
  Flaga `--auto` przerabia hurtem cokolwiek wrzucisz do `img/_src/`. Efekt: 23,6 MB źródeł → 46–120 KB na
  zdjęcie w wariancie mobilnym.
  **⚠️ Naprawiony błąd globalny (dotyczył 9 podstron):** na mobile `h2` traci `margin-bottom` (4rem→1.5rem),
  a `.section-subtitle` trzyma `margin-top:-2.5rem` — wypadkowa **−16 px** wciągała podtytuł na czerwoną kreskę
  `h2::after`. W pliku istniała już korekta w `@media (max-width:768px)` ok. linii 1066, ale to **martwy kod**:
  bazowa definicja `.section-subtitle` stoi dopiero ok. linii 1162, a media query NIE podnosi specyficzności,
  więc wygrywa późniejsze źródło. Działająca korekta musi być **na końcu pliku** (jest w bloku 768px sekcji
  ABOUT PAGE). Pamiętaj o tym przy każdej „poprawce w media query" w tym pliku.
  Doszedł też globalny guard `@media (prefers-reduced-motion)` na `.animate-on-scroll` (bez niego treść
  zostawała niewidoczna przy wyłączonych animacjach) i `<noscript>` w `o-nas.html` z tego samego powodu.
  **SEO:** schema.org rozszerzone o `foundingDate`, `award[]` i `employee[]` z `hasCredential` (numery uprawnień).
  **Świadomie BEZ `aggregateRating`** — ocena pochodzi z Google, oznaczanie cudzych opinii jako własnych łamie
  wytyczne. `hasOfferCatalog` też usunięty razem z sekcją usług: dane strukturalne mają opisywać treść widoczną
  na stronie, więc katalog usług należy do `oferta.html`/`cennik.html`, nie tutaj.
  `?v=20260727a` na wszystkich 13 podstronach.
- **2026-07-25** — `dekoder.html`: nowa sekcja **„Gdzie sprawdzić datę produkcji"** (`#dekodery-marek`).
  Zamysł: co zrobić, gdy nasz dekoder nic nie pokaże. Style inline w `<style>`, prefiks `dec-` (NIE w
  `styles.css` → brak bumpu `?v=`).
  **⚠️ NAJWAŻNIEJSZE USTALENIE — większość „dekoderów VIN" podaje ROK MODELOWY, nie datę produkcji.**
  Zweryfikowane realnymi VIN-ami w przeglądarce (nie ufać opisom marketingowym ani nazwom pól w JSON-ie!):
  • **7zap** (`/catalog/cars/<marka>/vin-decoder/`) zwraca tylko `Brand, Series, Generation, Model, Year`.
    Dla `YV1RS61T942345678` → `Year: 2004` i nic więcej. **Usunięty ze strony** — dubluje nasz dekoder.
    (Pole „Production date", które widać w schemacie JS strony, należy do katalogu części za logowaniem,
    a NIE do tego dekodera — na tym się przejechaliśmy.)
  • **PartSouq** dla marek **japońskich/koreańskich** zwraca realne pole `Production Date` (rok-miesiąc):
    `JTDKB20U693524325` → `Production Date: 2009-01`, osobno `Year: 2009` (rok modelowy) i
    `Production: 2003-08 » 2005-11` (okres produkcji modelu). **Trzy różne daty — nie mylić.**
  • **PartSouq dla marek europejskich NIE działa** — dla Volvo zwraca listę niejednoznacznych wariantów
    z `Manufactured: 2004`. Dlatego karta „marki europejskie" mówi wprost, że w sieci daty nie ma,
    i kieruje na tabliczkę znamionową / naklejkę PR / daty na szybach.
  • **bimmer.work, mdecoder.com, mbdecoder.com — NIEZWERYFIKOWANE** (reCAPTCHA + okno zgody na dane;
    nie przechodzimy captchy ani nie klikamy zgód za użytkownika). Zostały na stronie z adnotacją o captchy.
    Jeśli kiedyś okaże się, że też dają tylko rok — zdjąć badge `is-day`.
  **Świadomie NIE linkujemy** kalkulatorów ORGA/DAM ani NHTSA vPIC — dubluje to nasz dekoder DAM/ORGA
  oraz dekoder uniwersalny, który odpytuje API vPIC (`api/vehicles/decodevinvalues`).
  **Pułapki CSS:** `.dec-grid` NIE używa trika `gap:1px` + tło (jak `.tool-grid`) — pusta komórka ostatniego
  rzędu świeciłaby kolorem obramowania; tło = `--surface-1`, separatory to `box-shadow` na `.dec-card`
  (przycinane przez `overflow:hidden`). Grupa z jedną kartą → `.dec-grid.is-single` (`1fr`), inaczej
  `auto-fit` otwiera pustą drugą kolumnę. Wiersz nieklikalny w `.dec-links` musi mieć klasę `.dec-fact`
  (własne tło), inaczej prześwituje kolor separatora.
- **2026-07-17** — Panel/Klienci: **inteligentna wyszukiwarka**. `clients.php` (GET) tokenizuje zapytanie
  (do 6 tokenów, AND między tokenami) i każdy token dopasowuje OR-em do: `name`, `phone_display`,
  `phone_norm` (same cyfry tokena), `email`, `notes` oraz pojazdów (`plate` uppercased, `vehicle`) —
  np. „golf jan" znajdzie Jana z Golfem. SELECT zwraca dodatkowo `notes` i `vehicles` (GROUP_CONCAT
  marek/modeli). Front (`panel-clients.js`): nowy placeholder, marka/model w linii meta wiersza, a gdy
  trafienie padło w notatce — jej fragment (~90 znaków) pod wierszem. Parametry nadal wyłącznie jako
  stringi przez `execute()`, `LIMIT 100` literałem (pułapka EMULATE_PREPARES). Wdrożone FTP
  (`reservations/admin/clients.php`, `panel-clients.js`, `panel.html`). `?v=20260717a`.
- **2026-07-02** — Panel/kalendarz: **live-update bez F5 (polling).** Nowe rezerwacje online / zmiany w Google
  Calendar pojawiają się same: `panel-calendar.js` odpala `autoRefresh` na `setInterval` co **30 s** (id w
  `st.pollTimer`) + natychmiast po powrocie do karty (`visibilitychange`). Używa istniejącego `refresh()` (cichy
  refetch, `keepScroll`, bez flasha). Guardy pominięcia cyklu: karta w tle (`document.hidden`), siatka nie
  zamontowana (inny widok), trwa przeciąganie (`.is-dragging`/`.pnl-cal-ghost` w DOM), wpis `_pending`, albo
  **trwa zapis w tle** — nowy licznik `st.saving` + `saveBegin()/saveEnd()` na `PanelCalendarInternals`, wołane
  wokół POST/PATCH/DELETE w `panel-calendar-edit.js` (inaczej refetch mógłby cofnąć optymistyczną zmianę sprzed
  potwierdzenia serwera). Bez zmian backendu. Deploy: `panel-calendar.js`, `panel-calendar-edit.js`, `panel.html`
  → `?v=20260701g`.
- **2026-07-01 (f)** — Panel/kalendarz: **fix jednoliniowego kafelka (is-xs) — telefon uciekał na prawy skraj.**
  Motocykl/klima (10 min) pokazywał tylko markę, bo `.pnl-ev-main` miał `flex:1 1 auto` → rozpychał się na całą
  szerokość szerokiej kolumny „dzień" i spychał `.pnl-ev-phone` na sam prawy skraj (przy otwartej szufladzie —
  pod nią, stąd wrażenie „nic się nie wyświetla"). Fix: `is-xs` = `justify-content:flex-start`, `main` = `flex:0 1 auto`
  → godzina + auto + telefon zbite do lewej, jedno obok drugiego. Tylko CSS (`panel.css`). Deploy → `?v=20260701f`.
- **2026-07-01 (e)** — Panel/kalendarz: **kafelek zawija treść w prawo, gdy nie mieści się na wysokość.** Przy
  krótkich (ale nie is-xs) terminach, np. 20 min = 52 px, pionowa lista linii nadal ucinała się u dołu. Zamiast
  ciąć — `.pnl-ev` dostało `flex-wrap:wrap; align-content:flex-start; column-gap:14px`, więc nadmiarowe linie
  **zawijają się do kolejnej kolumny w prawo** (kolumna dnia jest szeroka → jest miejsce). Linie mają `max-width:190px`
  (kolumny nie rozjeżdżają się na długim nazwisku), a `is-xs` wymusza `flex-wrap:nowrap` (zostaje jednoliniowe).
  Wyższe kafelki bez zmian (wszystko mieści się w jednej kolumnie). Tylko CSS (`panel.css`). Deploy: `panel.css`,
  `panel.html` → `?v=20260701e`.
- **2026-07-01 (d)** — Panel/kalendarz: **kafelek pokazuje więcej informacji + czytelne krótkie terminy.** Objaw:
  10-minutowe terminy (motocykl/klima = 26 px przy `PPM 2.6`) nie mieściły 3 pionowych linii, więc kafelek pokazywał
  samą godzinę (reszta ucinana przez `overflow:hidden`); a wyższe kafelki marnowały miejsce, pokazując tylko
  marka/model + telefon. Fix (front, `panel-calendar.js` – `evBody` zastąpił `evBlockBody`): render zależny od
  **wysokości** kafelka. `renderDayEvents` liczy `tier = hgt < 34 ? ' is-xs' : ''`. (a) **is-xs** (≈10 min –
  motocykl/klima): **jedna linia poziomo** (`flex-direction:row`) = godzina startu + auto/nr rej. (`.pnl-ev-main`,
  kurczy się z `min-width:0` + ellipsis) + telefon (`.pnl-ev-phone`). (b) **Wyższe kafelki:** pionowa **lista
  priorytetowa** — marka/model (`.pnl-ev-title`) → telefon (`.pnl-ev-sub`) → nr rej. (`.pnl-ev-meta`, tylko gdy
  marka jest tytułem) → wariant usługi → nazwisko; nadmiar przycina `overflow`, więc im wyższy blok, tym więcej
  widać (godzinny slot pokazuje komplet). Tylko front: `panel-calendar.js` + nowe klasy CSS w `panel.css`
  (`.pnl-ev-meta`, `.pnl-ev.is-xs …`). Bez zmian backendu. Deploy FTP: `panel-calendar.js`, `panel.css`,
  `panel.html` → `?v=20260701d`.
- **2026-07-01 (c)** — Rezerwacje/klienci: **auto z rezerwacji NIE trafiało do bazy klientów — naprawione + backfill.**
  Objaw: rezerwacje z numerem rejestracyjnym miały `client_id = NULL`, a tabela `rez_client_vehicles` była PUSTA
  (0 pojazdów przy 57 rezerwacjach), mimo że marka/model widniały w tytule eventu Google. Diagnoza (przez tymczasowy,
  token-guarded endpoint na roocie + testy w transakcji z rollback): dokładna korelacja **jest nr rej. ⟺ `client_id`
  NULL**. `rez_upsert_client` wstawia pojazd tylko gdy `plate !== ''`; ta gałąź rzucała wyjątkiem, a **jeden** `try`
  wokół całości zwracał `null` → rezerwacja traciła powiązanie z klientem, a auto nigdy nie wpadało. Źródło
  historycznych porażek: **era `EMULATE_PREPARES=false`** (przed 2026-06-26) — `SELECT id … WHERE phone_norm` zwracał
  0, więc funkcja wychodziła `return null` PRZED wstawieniem pojazdu (`AUTO_INCREMENT` tabeli pojazdów = 1: żaden
  INSERT pojazdu nigdy nie ruszył). Rezerwacje bez nr rej. (panel, szybki slot) pomijają tę gałąź, więc podpinały
  klienta poprawnie. **Fix (`lib.php` `rez_upsert_client`):** (1) woła `rez_ensure_client_schema($pdo)` na starcie
  (`book.php`/`event.php` nie robiły tego same — brak tabeli wywalał cały upsert); (2) wstawienie pojazdu w
  **osobnym `try`** — błąd auta NIE zeruje już powiązania klienta. **Backfill (`migrate_clients.php`):** przycisk
  „Zaimportuj z rezerwacji" tworzy teraz też pojazdy — `mig_upsert` dostał parametr `$vehicle`, część A przekazuje
  `cust_plate` + markę/model z tytułu powiązanego eventu Google (mapa `google_event_id→model`, `mig_vehicle_from_title`),
  odpowiedź zwraca `vehicles_total`. **UI (`panel-clients.js`):** przycisk „Zaimportuj z rezerwacji" był renderowany
  TYLKO w pustym stanie listy (`renderList` gdy `rows.length===0`), więc przy istniejących klientach był nieosiągalny;
  doszedł **trwały przycisk** w pasku widoku Klienci (`#cl-import-top`, pod wyszukiwarką) + komunikat importu pokazuje
  teraz „Pojazdów w bazie". Wdrożone FTP (`reservations/lib.php`, `reservations/admin/migrate_clients.php`,
  `panel-clients.js`, `panel.html` → `?v=20260701c`). **Po wdrożeniu: kliknąć „Zaimportuj z rezerwacji", by podpiąć
  55 historycznych rezerwacji i ich auta.**
- **2026-07-01 (b)** — Panel/kalendarz: **precyzyjny hitbox kratek przy przeciąganiu + linia „teraz" na żywo.**
  (a) *Snapowanie do siatki było „o pół kratki obok".* Tworzenie (`startCreateDrag`) używało `Math.round(px/ppm/10)`
  = zaokrąglenia do najbliższej **linii**, więc kliknięcie w dolną połowę pasma 10-min startowało termin **kratkę
  niżej**. Teraz model „kratki": `slotAt` = `Math.floor(px/cell)` — termin zaczyna się DOKŁADNIE w kratce, w którą
  celujesz, a przeciągnięcie zakreśla zamiatane kratki włącznie (koniec = spód ostatniej). Przeciąganie/rozciąganie
  eventu (`startDrag`) liczone jest teraz **bezwzględnie** od górnej krawędzi kolumny + **offset chwytu** (`grabDy`)
  i snapowane do najbliższej 10-min linii (`snapMin`); commit bierze zsnapowane minuty `curStart/curEnd` (usunięty
  powrót przez `parseFloat(style)`→`/ppm` = koniec błędów float na `2.6`). Efekt uboczny: **stare wpisy z godziną
  spoza siatki (legacy `start_dt`) same się prostują** przy pierwszym ruszeniu. (b) *Linia bieżącej godziny* rysowała
  się tylko w `renderNow` podczas `renderGrid`, więc stała w miejscu do odświeżenia. Doszedł **`tickNow` na `setInterval`
  co 20 s** (id w `st.nowTimer`, czyszczony przy re-mount): przesuwa/tworzy/usuwa `.pnl-now` w kolumnie „dziś" **bez
  przerysowania siatki**. Deploy: `panel.html`, `panel-calendar.js`, `panel-calendar-edit.js`. `?v=20260701b`.
- **2026-07-01** — Panel/kalendarz: **optymistyczny (natychmiastowy) UI zamiast przeładowania.** Wcześniej po
  każdej akcji (przeciągnięcie/rozciągnięcie/tworzenie/edycja/usuwanie) leciał `reload()` = pełny refetch z
  placeholderem „Wczytuję grafik…" + skok scrolla → „przeładowywał cały kalendarz". Teraz zmiana nanoszona jest
  **od razu na `st.events` i siatka przerysowuje się bez sieci** (trzymając pozycję scrolla), a `event.php` leci
  **w tle**; błąd → **rollback** + `toast`. `panel-calendar.js`: nowe API na `window.PanelCalendarInternals` —
  `applyLocal(id,patch)→prev`, `addLocal(ev)`, `removeLocal(id)→ev`, `refresh()` (cichy refetch, bez flasha/skoku),
  `toast(msg,type)`; `renderGrid(opts)` rozróżnia `autoScroll` (świeże wczytanie/nawigacja) od `keepScroll`
  (przerysowanie lokalne). `panel-calendar-edit.js`: `submit()` usunięty, w zamian `createInBackground` /
  `patchInBackground` + optymistyczne kształty (`bookingEventShape`, `labelsFor`, `tempId`); drag/resize, delete
  i formularze idą tą samą ścieżką. Nowo tworzony wpis jest **`_pending`** (klasa `is-pending`,
  `pointer-events:none`) do potwierdzenia POST, potem tymczasowe `id`→realne z odpowiedzi (`{id,ref}`) bez refetchu.
  Doszedł lekki **toast** (`.pnl-toast`) na błędy zapisu w tle. **Kontrakt/kod backendu bez zmian** (deploy tylko
  `panel-calendar.js`, `panel-calendar-edit.js`, `panel.css`, `panel.html`). `?v=20260701a`. (Sekcja 5 uzupełniona.)
- **2026-06-30 (c)** — Panel/kalendarz: (a) **termin admina bez danych klienta** — pola Imię/Telefon/Nr rej.
  są przy tworzeniu **opcjonalne** (admin może wbić sam slot / szybką blokadę). Doszedł checkbox
  **„Dodaj klienta do bazy"** (`ce-addclient`, domyślnie zaznaczony); odznaczenie = NIE tworzymy profilu
  (slot nie zaśmieca bazy klientów). Walidacja: front `validBooking(...,{lenient:true})` w tworzeniu (telefon
  wymagany **tylko** gdy checkbox zaznaczony — to klucz profilu); **edycja bez zmian** (strict). Backend
  `event.php ev_create`: `$addClient` z payloadu (domyślnie true), `rez_upsert_client` woła się tylko gdy
  `$addClient && ≥9 cyfr` telefonu; reszta walidacji zluzowana. `ev_booking_payload` nie skleja pustych pól
  (tytuł Google: „… – NR (Marka)", w braku auta nazwisko, w braku obu sama usługa). `events.php`: tytuł kafelka
  bez wiszącego „· " gdy brak nr rej. (b) **Usunięty podwójny pasek przewijania** — `.pnl-app` `min-height:100vh`
  → `height:100dvh; overflow:hidden`, więc przewija się tylko wewnętrzny kontener widoku (`.pnl-cal-scroll`/
  `.pnl-clients-results`), nie całe okno. `?v=20260630c`.
- **2026-06-30 (b)** — Panel/kalendarz: (a) **domyślny widok = Dzień** (`st.view` `'week'→'day'`) — obsługa pracuje
  „na dziś"; (b) **kafelek w siatce pokazuje marka/model + telefon** zamiast „wariant · nr rej." (`evBlockBody`
  w `panel-calendar.js`: tytuł = `ev.vehicle||ev.plate`, podlinijka `.pnl-ev-sub` = `fmtPhone(ev.phone)` w formacie
  XXX XXX XXX). Reszta szczegółów dalej po rozwinięciu w szufladzie. Tylko front (`panel-calendar.js` + `.pnl-ev-sub`
  w `panel.css`), bez zmian backendu. `?v=20260630b`.
- **2026-06-30** — Panel/kalendarz: **marka/model pojazdu w szczegółach rezerwacji** (jak w tytule Google
  „PLATE (Marka Model)"). Marka/model NIE ma kolumny w `rez_bookings` — żyje w **tytule eventu Google**
  i w `rez_client_vehicles`. `events.php` wyłuskuje ją z tytułu (`ev_vehicle_from_title` = ostatni nawias)
  i zwraca jako `ev.vehicle`; szuflada (`panel-calendar.js`) pokazuje „PLATE (Marka Model)". **Przy okazji
  naprawiony cichy bug:** formularz edycji rezerwacji w panelu miał zahardkodowane `vehicle:''` (bo `events.php`
  nie podawał marki), więc każda edycja **kasowała markę/model z tytułu Google**; teraz prefill = `ev.vehicle`.
  `event.php` (edycja) dokłada `rez_upsert_client` → profil klienta (telefon→auta) zostaje w sync także przy
  edycji w panelu (wcześniej tylko przy tworzeniu). Bez zmian schematu. `?v=20260630a`.
- **2026-06-26** — **Import klientów wreszcie czytelny w panelu + naprawa odczytu w CAŁEJ aplikacji.** Objaw:
  import zapisywał profile (phpMyAdmin: komplet wierszy), ale lista „Klienci" świeciła pustką, a `clients_total`
  z importu = 0. Po długiej diagnostyce (odrzucone błędne tropy: transakcje, DROP/recreate, „read/write split")
  przyczyną okazał się **`PDO::ATTR_EMULATE_PREPARES => false` w `rez_db()`** — proxy MySQL na vh.pl psuje pakiety
  wyników protokołu binarnego, więc każdy `SELECT` zwracał śmieci/0 (kanarek: `@@port = ↑nazwa_bazy`). Fix:
  **`EMULATE_PREPARES => true`** w `lib.php` (jedna linia) — naprawia odczyt nie tylko importu, ale wszystkich
  zapytań MySQL (lista klientów, `rez_spacing_conflict` w `book.php` itd.). `migrate_clients.php` posprzątane
  z rusztowania diagnostycznego (usunięte: tryb `preview`, samotest `diag`, `mig_probe_conn`, `mig_fresh_pdo`) —
  został czysty, idempotentny import (skan `rez_bookings` + Google Calendar → `rez_extract_phone`/`mig_utf8`).
  `panel-clients.js` `runImport` = prosty komunikat wyniku. Nowy lokalny skill: `.claude/skills/sscar-baza-klientow/`.
  `?v=20260626f`. Pułapka opisana w sekcjach 2 i 8 (czytaj NAJPIERW przy „zapis działa, odczyt 0").
- **2026-06-25 (d)** — Rezerwacja: **odstęp między rezerwacjami tej samej usługi**. Klimatyzacja blokuje w grafiku
  tylko 10 min (`duration`), ale realna obsługa trwa ~50 min, więc dwie klimy nie mogą stać 10 min po sobie. Subtyp
  `klima` dostał `spacing => 50` (start-do-startu, w przód i wstecz) oraz `match => '/klima/i'` (wzorzec tytułu eventu).
  **Detekcja istniejących klim idzie z eventów Google Calendar (źródło prawdy grafiku), nie z `rez_bookings`** — dzięki
  temu łapie też rezerwacje ręczne/panelowe i starsze, których nie ma w bazie. `lib.php` += `rez_spacing_conflict()`
  (windowed DB, opcjonalny `FOR UPDATE`) i `rez_match_event_starts($events,$pattern)` (filtr eventów po tytule, pomija
  całodniowe). `availability.php` listuje eventy dnia (`gcal_list_events`) i wygasza sloty w oknie ±`spacing` (fail-open;
  nie woła już bazy). `book.php`: krok 2 = szybki guard na bazie (race online↔online), krok 3 = sprawdzenie na eventach
  Google (komplet) → 409. Front bez zmian (renderuje `busy` z serwera; ma już `displayDuration: 50`).
- **2026-06-25 (b)** — Import klientów przebudowany. `lib.php` += `rez_extract_phone()` (szuka telefonu w dowolnym
  tekście: 9 cyfr / 3-3-3 / +48) i `rez_phone_format()`. `migrate_clients.php` skanuje teraz **wszystkie pola
  człowieka** w `rez_bookings` (nie tylko `cust_phone` — dane bywają rozjechane) **oraz wydarzenia Google**
  (`gcal_list_events`, zakres −2 lata…+6 mies., do 250 szt.; pomija eventy znane po `google_event_id` i blokady).
  Zwraca `created/from_bookings/from_events/clients_total/google_error`; front pokazuje jawny wynik importu.
  `migrate_clients.php` to teraz **stały** endpoint (nie kasować). `?v=20260625c`.
- **2026-06-25 (c)** — Import: naprawa zapisu przy ŹLE ZAKODOWANYCH danych. Surowe `INSERT` padało na
  `SQLSTATE[22007] 1366 Incorrect string value` (niepoprawny UTF-8 w `email`), więc `total=0` mimo wykrytych
  numerów. Dodane: `mig_utf8()` (naprawa bajtów), `mig_extract_email()` (tylko prawdziwy e-mail), twardsze
  `clean_name()`, oraz tryb **preview** + zwracanie `db_error`/`client_columns` do diagnostyki. `?v=20260625e`.
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
