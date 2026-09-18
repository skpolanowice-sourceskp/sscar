# Blog SSCAR — jak dodać wpis

> Stan na: **2026-09-17**. Blog prowadzimy **ręcznie**, świadomie — patrz „Dlaczego nie automat".

---

## 1. Dlaczego ręcznie, a nie automatem z Facebooka

Rozważaliśmy automatyczny import postów przez Graph API (konto systemowe w Meta Business,
cron na vh.pl, `fb_sync.php`). **Odrzucone świadomie**, z dwóch powodów:

1. **Skala.** Przy 2–3 postach miesięcznie automat (~1 dzień kodu + setup w Meta + stałe
   doglądanie tokenu, który potrafi paść po cichu) zwraca się po latach.
2. **Ważniejsze: SEO.** Post z FB to zwykle dwa zdania i zdjęcie. Przeniesiony 1:1 jest
   **thin contentem** — Google go zindeksuje i zignoruje. Wartość powstaje dopiero przy
   **przepisaniu** posta na tekst pod wyszukiwarkę. Tego automat nie zrobi.

Wniosek: surowy post z FB to **materiał źródłowy**, nie gotowa treść.

---

## 2. Konwencja plików i URL-i

| Co | Gdzie |
|---|---|
| Hub (lista wpisów) | `blog.html` **w korzeniu** |
| Wpis | `blog/<slug>.html` |
| Zaślepka katalogu | `blog/index.html` (przekierowanie na huba) |
| Zdjęcia wpisu | `img/blog/<slug>-800.webp`, `-1400.webp`, `-1400.jpg` |
| Oryginał zdjęcia | `img/_src/blog/<slug>.png` (nie trafia na FTP) |
| Szablon wpisu | `docs/blog-post-template.html` (nie trafia na FTP) |

**Wpisy siedzą w katalogu `blog/` (od 2026-09-17).** Wcześniej leżały płasko w korzeniu
z prefiksem `blog-`, bo na serwerze nie ma `.htaccess` i baliśmy się listingu plików.
Właściciel potwierdził, że na innym serwisie na tym samym hostingu katalogi działają, więc
konwencja została zmieniona — i **sprawdziło się to na produkcji 2026-09-17**:
`http://www.sscar.pl/blog/` zwraca `blog/index.html`, a nie „Index of /blog".
Listing katalogu blokuje właśnie **`blog/index.html`** — zaślepka z `meta refresh` na huba
i `canonical` na `blog.html`, żeby `/blog/` nie konkurowało z hubem w wynikach wyszukiwania.
**Nie usuwaj tego pliku.**

**⚠️ To NIE znaczy, że można przenosić dowolne strony do katalogów.** Listing okazał się
niegroźny, ale drugi powód nadal obowiązuje: bez `.htaccess` nie ma jak wystawić **301**.
Przenosimy więc tylko adresy świeże albo niezaindeksowane, a zaindeksowane zostawiają
po sobie zaślepkę z `meta refresh` + `canonical`. Podstrony usługowe z korzenia
(`geometria-3d.html`, `cennik.html`, …) siedzą w indeksie od sierpnia — **tych nie ruszamy**.

**Hub zostaje w korzeniu** (`blog.html`) — jest zaindeksowany i linkowany z nagłówka oraz
stopki na każdej podstronie. Przeniesienie go do `blog/index.html` zerwałoby te linki
bez żadnego zysku.

> **⚠️ Plik wpisu leży o poziom niżej, więc KAŻDA ścieżka względna potrzebuje `../`.**
> Dotyczy `css/styles.css`, `js/nav.js`, `favicon.png`, `Logo-SSCAR.png`, zdjęć oraz
> wszystkich linków do podstron (menu, breadcrumb, stopka, treść). Szablon
> `docs/blog-post-template.html` ma to już wpisane — jeśli kopiujesz istniejący wpis
> zamiast szablonu, sprawdź to jako pierwsze. Kontrola (nie powinna nic wypisać):
> ```bash
> grep -oh '\(href\|src\)="[^"]*"' blog/*.html | grep -v '="\(\.\./\|https\?:\|tel:\|mailto:\|#\)'
> ```

**Stary adres wpisu z września:** `blog-geometria-kol-na-golej-ramie.html` został w korzeniu
jako przekierowanie (`meta refresh` + `canonical`), bo zdążył pójść do GSC z prośbą
o zaindeksowanie. Bez `.htaccess` nie ma jak wystawić prawdziwego 301. Plik można skasować,
gdy GSC potwierdzi zaindeksowanie nowego adresu.

W Google Search Console filtruj raporty po URL zawierającym `/blog/`.

**Slug:** małe litery, bez polskich znaków, myślniki, 3–5 słów, ze słowem kluczowym.
Prefiks `blog-` w nazwie pliku jest już niepotrzebny — daje go katalog.
Dobrze: `blog/co-zabrac-na-badanie-techniczne.html`. Źle: `blog/post-1.html`.

---

## 3. Procedura: z Facebooka na stronę

### Krok 1 — materiał
Wklej Claude'owi surowy tekst posta z FB + zdjęcia (pliki). Powiedz, o którą usługę chodzi.

### Krok 2 — przepisanie posta (to tu powstaje wartość)
Post z FB rozwijamy do **minimum 400 słów**. Reguły:

- **Jedno pytanie = jeden wpis.** Wpis ma odpowiadać na konkretne pytanie, które ktoś
  wpisuje w Google („co zabrać na przegląd", „po czym poznać, że trzeba nabić klimę").
- **Odpowiedź w leadzie, nie na końcu.** Pierwsze 2–3 zdania muszą zawierać odpowiedź.
  Google często bierze stamtąd snippet, a czytelnik i tak nie przewinie niżej.
- **Lokalność.** „Wrocław" w tytule lub leadzie, jeśli brzmi naturalnie — to główna przewaga
  stacji w wyszukiwaniu.
- **Bez powtarzania podstron.** Jeśli treść już jest w `badania-techniczne.html`, nie
  przepisuj jej — **zalinkuj**. Dwie strony na to samo zapytanie konkurują ze sobą
  (kanibalizacja) i obie tracą.
- **Konkret zamiast ogólników.** Ceny, czasy, numery uprawnień, nazwy urządzeń. To samo
  podejście, co na `o-nas.html`.

### Krok 3 — zdjęcia
1. Oryginał wrzuć do `img/_src/blog/` pod nazwą `<slug>.jpg` (lub `-2`, `-3` dla kolejnych).
2. Dopisz wpis do `SOURCES` w `tools/optimize_images.py`, ze slugiem **z prefiksem katalogu**:
   `("blog/<slug>.jpg", "blog/<slug>")`. Podkatalog w `img/` powstanie sam.
   **Nie** dopisuj do `HERO_SOURCES` — tamten tryb przycina dolny pas kadru.
   **Zrzut ekranu** (screenshot z przeglądarki) idzie do `SCREEN_SOURCES`, nie do `SOURCES`:
   zrzuty mają ~1200 px szerokości, więc `variants()` pomija wariant 1400 — a fallback `.jpg`
   powstaje **wyłącznie** przy 1400 i wpis zostałby bez żadnego `.jpg` na `og:image`.
   `SCREEN_SOURCES` robi parę 800/1200 z fallbackiem na 1200.
3. Z korzenia repo: `python tools/optimize_images.py`
4. **Zdjęcie pionowe** (3:4) dostaje `<figure class="post-figure is-portrait">` — bez tej klasy
   rozpycha się na ~1000 px wysokości w kolumnie tekstu.
5. **`alt` jest obowiązkowy** i ma opisywać zdjęcie, nie upychać fraz.
6. `width`/`height` w `<img>` zostaw — bez nich strona skacze przy ładowaniu (CLS).

### Krok 4 — plik wpisu
1. Skopiuj `docs/blog-post-template.html` → `blog/<slug>.html`.
2. Podmień wszystkie `{{PLACEHOLDERY}}`.
3. Kontrola: `grep -o "{{[A-Z_]*}}" blog/<slug>.html` — **musi nie zwrócić nic**.
4. Kontrola ścieżek (patrz sekcja 2): żaden `href`/`src` poza `http`, `tel:`, `mailto:`
   i `#` nie może zaczynać się od litery — wszystkie potrzebują `../`.

### Krok 5 — podpięcie wpisu (NAJWAŻNIEJSZE dla indeksacji)
1. W `blog.html` odkomentuj wzorzec kafelka, uzupełnij i wstaw **na górze** listy
   (najnowszy pierwszy). Przy pierwszym wpisie usuń blok `.blog-empty`.
2. W `sitemap.xml` dodaj `<url>` wpisu i odśwież `lastmod` dla `blog.html`.

> **⚠️ Sama sitemapa NIE wystarcza do zaindeksowania.** W sierpniu 2026 jedenaście podstron
> siedziało w sitemapie od maja i Google **ani razu ich nie pobrał** — status „Strona wykryta
> – obecnie niezindeksowana". Odblokowały je dopiero **linki wewnętrzne**. Dlatego kafelek
> w `blog.html` i blok „Zobacz też" nie są ozdobą, tylko warunkiem indeksacji.

### Krok 6 — deploy (FTP)
Wgraj, zachowując ścieżki:
- `blog/<slug>.html`
- `blog.html`
- `sitemap.xml`
- `img/blog/<slug>-*` (wszystkie warianty)
- `css/styles.css` + **wszystkie** strony z podbitym `?v=` — **tylko jeśli ruszałeś CSS**

Hasło FTP czytaj ze `sftp.json` do zmiennej, nigdy inline (patrz CLAUDE.md §7).
Po wgraniu zweryfikuj MD5 i odpytaj produkcję **po HTTP** — HTTPS przechodzi przez
challenge antybotowy i zwraca stronę „Weryfikacja" **z kodem 200** (CLAUDE.md, 2026-08-04 b).

### Krok 7 — Google Search Console
„Sprawdzenie adresu URL" → wklej adres wpisu → **„Poproś o zaindeksowanie"**.
Sam deploy nie wymusza crawla.

---

## 4. Checklista SEO przed wysłaniem

- [ ] `<title>` ≤ 60 znaków, ze słowem kluczowym, kończy się `– SSCAR`
- [ ] `meta description` 140–160 znaków, zachęca do kliknięcia
- [ ] `canonical` wskazuje na `https://www.sscar.pl/blog/<slug>.html`
- [ ] Dokładnie **jeden** `<h1>`, dalej hierarchia `h2` → `h3` bez przeskoków
- [ ] Minimum **400 słów** treści
- [ ] Odpowiedź na pytanie w pierwszych 2–3 zdaniach
- [ ] Minimum **2 linki wewnętrzne** do podstron usługowych + 1 do `cennik.html`
      lub `rezerwacja.html`
- [ ] Blok „Zobacz też" wskazuje 2–3 **tematycznie najbliższe** podstrony
- [ ] Każdy `<img>` ma `alt`, `width`, `height`
- [ ] `datePublished` w JSON-LD == `datetime` w `<time>` == data w kafelku na `blog.html`
- [ ] Wpis dodany do `sitemap.xml`
- [ ] Kafelek dodany na górze listy w `blog.html`
- [ ] `grep -o "{{[A-Z_]*}}"` nie zwraca nic
- [ ] Wszystkie ścieżki względne mają `../` (wpis leży w `blog/`)

---

## 5. Pułapki specyficzne dla tego projektu

- **Globalne `h2` psuje nagłówki w treści.** `css/styles.css` daje każdemu `h2`
  `text-align:center`, `margin-bottom:4rem` i **czerwoną kreskę `::after`**. Dlatego blok
  `.blog-*`/`.post-*` siedzi **na końcu** `css/styles.css` i jawnie te trzy rzeczy zdejmuje
  (`.post-body h2::after { content: none }`). Jeśli dopiszesz nowy nagłówek w treści —
  używaj `.post-body h2`/`h3`, nie własnych klas.
- **Media query nie podnosi specyficzności.** Poprawka w `@media` umieszczona **przed**
  regułą bazową jest martwym kodem. Wszystko nowe dopisuj na końcu pliku.
- **Cache.** Ruszasz `css/styles.css` → podbij `?v=` na **wszystkich** stronach, łącznie z nowymi
  wpisami. Nie ruszasz CSS → nie podbijaj niczego.
- **Nie wgrywaj** `docs/`, `tools/`, `img/_src/`, `*.md` — są na liście `ignore` w `sftp.json`.
- **Blog jest w górnym menu I w stopce** (od 2026-09-16 b) — 8 pozycji w `nav ul` mieści się,
  bo doszły breakpointy 769–1200 px i 769–980 px na końcu `css/styles.css`. Kolejna, dziewiąta
  pozycja wymaga sprawdzenia w przeglądarce. Nowa podstrona = link w **obu** miejscach na
  **każdej** stronie (pełna reguła w CLAUDE.md §3).
- **Wpis leży o poziom niżej niż reszta serwisu.** Skopiowanie nagłówka albo stopki z podstrony
  do wpisu bez dopisania `../` daje 404 na każdym linku. To najłatwiejszy błąd do popełnienia
  w tej konwencji — patrz kontrola w sekcji 2.

---

## 6. Pomysły na wpisy (wysokie zapytania lokalne)

Tematy, które ludzie realnie wpisują w Google, a stacja może odpowiedzieć z pierwszej ręki:

- Co zabrać na badanie techniczne i czy właściciel musi być obecny
- Co się dzieje, gdy auto nie przejdzie przeglądu — i ile czasu jest na poprawkę
- Po czym poznać, że klimatyzacja wymaga nabicia (a kiedy to nie pomoże)
- Objawy rozregulowanej geometrii — zjadanie opon, ściąganie kierownicy
- Badanie po szkodzie: kiedy wymagane i co sprawdza diagnosta
- Na co patrzeć przy zakupie używanego auta — checklista z hali
