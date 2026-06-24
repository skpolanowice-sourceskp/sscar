# Rezerwacje online – wdrożenie backendu (Etap 2)

Łączy stronę `rezerwacja.html` z Google Calendar. Schemat:

```
Obsługa stacji  →  Google Calendar (2 kalendarze)  ←→  backend PHP na vh.pl  ←→  rezerwacja.html
   (wpisy ręczne)        ("Badania", "Klima")            (availability.php / book.php)
```

Obsługa wpisuje terminy w Google Calendar jak w zwykłym kalendarzu. Strona pokazuje wolne sloty i dopisuje rezerwacje klientów do tych samych kalendarzy.

Pliki backendu są w katalogu `reservations/`. **Nie wymagają Composera** – czysty PHP + cURL + OpenSSL (standard na vh.pl).

---

## Krok 1 – Google Cloud (konto usługowe)

1. Wejdź na <https://console.cloud.google.com> (zaloguj kontem stacyjnym Google).
2. U góry utwórz nowy projekt, np. **sscar-rezerwacje**.
3. **APIs & Services → Library** → wyszukaj **Google Calendar API** → **Enable**.
4. **APIs & Services → Credentials → Create credentials → Service account**.
   - Nazwa: `sscar-rez`. Utwórz. Rola nie jest potrzebna (kalendarze udostępnimy ręcznie).
5. Wejdź w utworzone konto usługowe → zakładka **Keys → Add key → Create new key → JSON**.
   - Pobierze się plik `.json`. To **tajny klucz** – nie wrzucaj go na stronę ani do repo.
6. Zapisz adres e-mail konta usługowego (wygląda jak
   `sscar-rez@sscar-rezerwacje.iam.gserviceaccount.com`).

## Krok 2 – Jeden kalendarz Google

Jeden pracownik obsługuje obie usługi, więc jest **jeden wspólny grafik** –
przegląd i klimatyzacja blokują się nawzajem w czasie.

1. W <https://calendar.google.com> (konto stacyjne) utwórz kalendarz
   **Ustawienia → Dodaj kalendarz → Utwórz nowy kalendarz**, np. „SSCAR – Grafik".
2. **Ustawienia kalendarza → Udostępnij konkretnym osobom** → dodaj adres konta
   usługowego z Kroku 1 → uprawnienie **„Wprowadzanie zmian w wydarzeniach"**.
3. W tych samych ustawieniach skopiuj **Identyfikator kalendarza**
   (sekcja „Integracja kalendarza", postać `...@group.calendar.google.com`).

## Krok 3 – Baza MySQL na vh.pl

1. Panel vh.pl → utwórz bazę MySQL (zanotuj: host, nazwa, użytkownik, hasło).
2. W phpMyAdmin wybierz tę bazę → zakładka **Import** → wgraj `reservations/schema.sql`
   (utworzy tabelę `rez_bookings`).

## Krok 4 – Wgranie plików (SFTP)

1. Wgraj cały katalog `reservations/` do katalogu strony (tam gdzie `rezerwacja.html`).
2. Plik **klucza JSON** z Kroku 1 wgraj **POZA** katalog WWW, np. do
   `/home/UŻYTKOWNIK/sscar-secrets/service-account.json`
   (czyli obok, a nie wewnątrz `public_html`). Dzięki temu nikt nie pobierze go z internetu.
3. Skopiuj `reservations/config.sample.php` jako `reservations/config.php` i uzupełnij:
   - dane bazy z Kroku 3,
   - `service_account_key` = pełna ścieżka do pliku JSON z pkt. 2,
   - `calendar_id` = identyfikator z Kroku 2,
   - `notify_email` = adres, na który mają przychodzić powiadomienia o rezerwacji.

   `config.php` jest w `.gitignore` – nie trafi do repo.

## Krok 5 – Włączenie trybu produkcyjnego

W pliku `rezerwacja.js`, u góry, zmień:

```js
var USE_MOCK = true;   //  ←  zmień na  false
```

Od tej chwili strona pobiera prawdziwe terminy z Google i zapisuje rezerwacje.

## Krok 6 – Test

1. Otwórz `https://www.sscar.pl/reservations/availability.php?service=techniczne&subtype=osobowy&date=RRRR-MM-DD`
   (wstaw przyszłą datę roboczą). Powinien zwrócić JSON, np. `{"busy":[],"slots":["07:20", ...]}`.
2. Na stronie `rezerwacja.html` zrób próbną rezerwację – sprawdź, czy:
   - wydarzenie pojawiło się w odpowiednim kalendarzu Google,
   - przyszło powiadomienie e-mail,
   - rekord jest w tabeli `rez_bookings`.
3. Wpisz ręcznie wydarzenie w Google Calendar na jakąś godzinę i odśwież stronę –
   ta godzina powinna zniknąć z wolnych slotów.

---

## Jak to działa na co dzień

- **Klient:** rezerwuje przez stronę przegląd lub klimatyzację – wpis ląduje w kalendarzu.
- **Wy:** widzicie wszystko (rezerwacje ze strony + własne wpisy) w jednym Kalendarzu Google.
- Nakładające się terminy są blokowane: strona pokazuje zajętą godzinę jako niedostępną,
  a `book.php` dodatkowo sprawdza kolizje transakcyjnie i w Google.

## Ręczne blokowanie terminów (geometria, przerwy itp.) – zamiast panelu admina

**Nie potrzebujesz osobnego panelu.** Kalendarz Google JEST Waszym panelem, bo strona
czyta z niego zajętość (freeBusy). Cokolwiek wpiszecie w kalendarz „SSCAR – Grafik",
automatycznie znika z wolnych slotów na stronie.

Dlatego rzeczy elastyczne (geometria, naprawa, przerwa, dostawa) blokujecie tak:
1. Otwórz Kalendarz Google (komputer lub apka w telefonie).
2. Kliknij/przeciągnij na grafiku godzinę i ustaw **długość, jaką sam oceniasz**
   (np. geometria 1,5h) – tytuł np. „Geometria – Kowalski".
3. Zapisz. Ten czas natychmiast staje się niedostępny na stronie.

Na komputerze to ~5 sekund (przeciągnięcie myszą), w telefonie ~15 sekund. Ważne:
wpisuj w kalendarz **„SSCAR – Grafik"** (ten udostępniony koncie usługowemu), a nie
w swój prywatny – tylko ten jest czytany przez stronę.

> Ręczne blokowanie w Kalendarzu Google nadal działa, ale jest też **panel obsługi**
> (`/panel.html`) z wygodniejszym kalendarzem (podziałka 10 min, motyw strony) i bazą
> klientów – patrz sekcja „Panel obsługi” na końcu tego pliku.

## Zmiana reguł (godziny, czasy, usługi)

Reguły są w **dwóch** miejscach i muszą być zgodne:
- front: `rezerwacja.js` (`HOURS`, `SERVICES`),
- serwer: `reservations/lib.php` (`REZ_HOURS`, `rez_services()`).

Zmieniając np. godziny pracy, popraw oba pliki.

## Bezpieczeństwo (już zadbane)

- Klucz Google poza katalogiem WWW; `config.php` i klucze w `.gitignore`.
- `reservations/.htaccess` blokuje bezpośredni dostęp do plików pomocniczych
  (dostępne tylko `availability.php` i `book.php`).
- Walidacja po stronie serwera (nie ufa danym z przeglądarki), limit zapytań na IP.

## Najczęstsze problemy

- **403 / „Niedozwolone źródło"** – `allowed_origin` w `config.php` musi pasować do
  adresu, pod którym działa strona (np. `https://www.sscar.pl`).
- **502 / błąd autoryzacji Google** – sprawdź ścieżkę do klucza JSON i czy kalendarz
  jest udostępniony koncie usługowemu z prawem „Wprowadzanie zmian".
- **Złe godziny w kalendarzu** – sprawdź `timezone` (`Europe/Warsaw`) w `config.php`.
- **Brak e-maili** – `mail()` bywa ograniczony; użyj adresu nadawcy w domenie sscar.pl,
  ewentualnie skonfiguruj SMTP w panelu vh.pl.

---

# Panel obsługi (`/panel.html`)

Wewnętrzny panel: kalendarz (reskin Google Calendar, podziałka co 10 min, pełne
zarządzanie terminami) oraz baza klientów (profile pod nr telefonu, notatki, blokada
rezerwacji online dla wybranego numeru). Logowanie jednym wspólnym hasłem.

## Wdrożenie panelu (jednorazowo)

1. **Hasło panelu.** Wygeneruj hash (lokalnie lub na serwerze – NIE wpisuj hasła w repo):
   ```
   php -r "echo password_hash('TWOJE-HASLO', PASSWORD_DEFAULT), PHP_EOL;"
   ```
   Wynik wklej do `config.php` jako `'admin_pass_hash' => '...'` (wzór w `config.sample.php`).

2. **Wgraj pliki** (FTP vh.pl, jak resztę):
   - `panel.html`, `panel.css`, `panel.js`, `panel-calendar.js`, `panel-calendar-edit.js`, `panel-clients.js` (katalog strony),
   - `reservations/admin/` (cały katalog z `.htaccess`),
   - zaktualizowane `reservations/lib.php`, `reservations/google.php`, `reservations/book.php`.

3. **Baza klientów – automatycznie.** Tabele (`rez_clients`, `rez_client_vehicles`, kolumna
   `rez_bookings.client_id`) tworzą się **same** przy pierwszym wejściu w zakładkę **Klienci**,
   a profile z dotychczasowych rezerwacji **importują się automatycznie** (jednorazowo).
   Nic nie trzeba klikać w phpMyAdmin.
   - *Awaryjnie* (gdyby użytkownik MySQL nie miał praw do tworzenia tabel): zaimportuj ręcznie
     `reservations/schema_admin.sql` w phpMyAdmin, potem w panelu kliknij „Zaimportuj z rezerwacji”.
   - Plik `reservations/admin/migrate_clients.php` można usunąć po pierwszym imporcie (opcjonalnie).

4. **Sprawdź dostęp.** `/panel.html` ma prosić o hasło; bezpośrednie wejście na
   `reservations/admin/events.php` bez logowania ma zwracać `401`, a na `auth.php` – `403`.
   Jeśli zamiast tego pojawia się `403` na endpointach po zalogowaniu, hosting może mieć
   nietypowy `AuthMerging` – wtedy przenieś allow-listę z `reservations/admin/.htaccess`
   do reguł nadrzędnego `reservations/.htaccess`.

## Jak działa

- **Kalendarz = Google Calendar.** Panel czyta wydarzenia przez `events.list` i zapisuje
  przez `events.insert/patch/delete`. Wpisy dodane ręcznie w Google też się pokazują.
  Rezerwacje online trzymane są dodatkowo w `rez_bookings` (struktura danych + profile);
  „Blokady” żyją tylko w Google.
- **Tworzenie:** „+ Termin” lub klik w pusty obszar dnia. **Edycja/przeniesienie:** klik w
  termin → szuflada, albo przeciągnij blok (zmiana godziny) / dolną krawędź (czas trwania).
- **Klienci:** profil powstaje automatycznie przy każdej rezerwacji (online i z panelu),
  kluczem jest znormalizowany telefon (ostatnie 9 cyfr). Blokada numeru = `book.php`
  odrzuca rezerwację online z tego numeru (panel może nadal umówić ręcznie).

## Bezpieczeństwo panelu

- Sesja PHP w cookie `HttpOnly`+`SameSite=Lax` (`Secure` pod HTTPS); token CSRF na zapisach.
- `reservations/admin/.htaccess` wpuszcza tylko wyznaczone endpointy; `auth.php` (include) i
  konfiguracja są zablokowane. `panel.html` ma `noindex`.
- Throttling logowania (10 prób / 5 min na IP).
