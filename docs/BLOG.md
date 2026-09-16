# Blog SSCAR — jak dodać wpis

> Stan na: **2026-09-16**. Blog prowadzimy **ręcznie**, świadomie — patrz „Dlaczego nie automat".

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
| Hub (lista wpisów) | `blog.html` w korzeniu |
| Wpis | `blog-<slug>.html` w korzeniu |
| Zdjęcia wpisu | `img/blog-<slug>-800.webp`, `-1400.webp`, `-1400.jpg` |
| Oryginał zdjęcia | `img/_src/blog-<slug>.jpg` (nie trafia na FTP) |
| Szablon wpisu | `docs/blog-post-template.html` (nie trafia na FTP) |

**Dlaczego płasko w korzeniu, a nie w katalogu `blog/`:** na serwerze **nie ma `.htaccess`**
(patrz CLAUDE.md, wpis 2026-08-04 c), więc katalog `blog/` bez `index.html` mógłby wystawić
listing plików, a dodanie tam `index.html` zdublowałoby hub. Płasko = zero ryzyka.
W Google Search Console filtruj raporty po URL zawierającym `blog-`.

**Slug:** małe litery, bez polskich znaków, myślniki, 3–5 słów, ze słowem kluczowym.
Dobrze: `blog-co-zabrac-na-badanie-techniczne.html`. Źle: `blog-post-1.html`.

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
1. Oryginał wrzuć do `img/_src/` pod nazwą `blog-<slug>.jpg`.
2. Dopisz wpis do `SOURCES` w `tools/optimize_images.py` (**nie** do `HERO_SOURCES` —
   tamten tryb przycina dolny pas kadru).
3. Z korzenia repo: `python tools/optimize_images.py`
4. **Zdjęcie pionowe** (3:4) dostaje `<figure class="post-figure is-portrait">` — bez tej klasy
   rozpycha się na ~1000 px wysokości w kolumnie tekstu.
5. **`alt` jest obowiązkowy** i ma opisywać zdjęcie, nie upychać fraz.
6. `width`/`height` w `<img>` zostaw — bez nich strona skacze przy ładowaniu (CLS).

### Krok 4 — plik wpisu
1. Skopiuj `docs/blog-post-template.html` → `blog-<slug>.html` **do korzenia**.
2. Podmień wszystkie `{{PLACEHOLDERY}}`.
3. Kontrola: `grep -o "{{[A-Z_]*}}" blog-<slug>.html` — **musi nie zwrócić nic**.

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
- `blog-<slug>.html`
- `blog.html`
- `sitemap.xml`
- `img/blog-<slug>-*` (wszystkie warianty)
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
- [ ] `canonical` wskazuje na `https://www.sscar.pl/blog-<slug>.html`
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
- **Górne menu jest pełne.** `nav ul` to `display:flex` bez zawijania; 7 pozycji zajmuje
  ~680 px i między 769 a ~1050 px jest na styk. Dlatego Blog linkujemy **ze stopki**, nie
  z górnego menu. Nie dokładaj tam ósmej pozycji bez sprawdzenia w przeglądarce.

---

## 6. Pomysły na wpisy (wysokie zapytania lokalne)

Tematy, które ludzie realnie wpisują w Google, a stacja może odpowiedzieć z pierwszej ręki:

- Co zabrać na badanie techniczne i czy właściciel musi być obecny
- Co się dzieje, gdy auto nie przejdzie przeglądu — i ile czasu jest na poprawkę
- Po czym poznać, że klimatyzacja wymaga nabicia (a kiedy to nie pomoże)
- Objawy rozregulowanej geometrii — zjadanie opon, ściąganie kierownicy
- Badanie po szkodzie: kiedy wymagane i co sprawdza diagnosta
- Na co patrzeć przy zakupie używanego auta — checklista z hali
