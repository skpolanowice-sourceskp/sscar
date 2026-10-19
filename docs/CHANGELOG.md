# Changelog projektu SSCAR

Pełna historia zmian (najnowsze na górze). Przeniesione z `CLAUDE.md` 2026-10-19.
Czytaj, gdy potrzebujesz kontekstu „dlaczego tak jest”. Bieżące zasady są w `CLAUDE.md` i tematycznych plikach `docs/`.
Nowe wpisy dopisuj **na górze**, krótko (3–8 linii), z datą bezwzględną i stanem wdrożenia.

- **2026-10-19 (b)** — **Dokumentacja podzielona.** `CLAUDE.md` (było ~1100 linii / 100 KB, ładowane przy każdym
  zapytaniu) skrócony do mapy ~80 linii. Treść przeniesiona do `docs/`: `CHANGELOG.md` (historia), `PANEL.md`,
  `FRONTEND.md`, `DEPLOY.md`, `SEO.md`, `GEOMETRIA-3D.md`. Nowy `tools/ftp_upload.py` — deploy z weryfikacją
  odczytem i blokadą plików spoza web rootu.

- **2026-10-19** — **Godziny otwarcia: pon.–śr. 7:00–19:00** (czw.–pt. bez zmian 7:00–20:00, sob. 8:00–14:00).
  Zmienione w treści i schema.org (`index.html`, `o-nas.html`, `oferta.html`) oraz w grafiku rezerwacji:
  `REZ_HOURS` w `reservations/lib.php` (backend + panel) i `HOURS` w `js/rezerwacja.js`
  (cache `rezerwacja.js?v=20261019a`). **Oba miejsca muszą być zgodne** — front liczy sloty sam, backend je weryfikuje.
  **Stan: WDROŻONE przez FTP 2026-10-19** (6 plików, odczyt z serwera identyczny).
- **2026-10-06** — **Nowy wpis `blog/citroen-xm-hydropneumatyka.html`** ze zdjęciem XM-a
  dostarczonym przez właściciela: historia Bertone, trzynasta szyba i hydropneumatyka,
  z odnośnikami do źródeł Citroëna. Interaktywny schemat obciążenia/poziomowania
  w `js/xm-hydropneumatyka.js`; CSS tylko we wpisie, wspólny `styles.css` bez zmian.
  Model rozdziela korekcję wysokości od sterowania twardością Hydractive, nie podaje
  rzeczywistych ciśnień ani prześwitu. Obsługuje klawiaturę, reduced motion i brak JS.
  Zdjęcia `img/blog/citroen-xm-hydropneumatyka-*`, oryginał `img/_src/blog/`, wpis w
  `SOURCES` generatora; kafelek pierwszy na `blog.html`, URL i data w `sitemap.xml`.
  Źródła, walidacja i pliki do wdrożenia: `docs/blog-citroen-xm.md`.
  **Stan: WDROŻONE przez FTP 2026-10-06** (7/7 plików pobranych z serwera identycznych
  z lokalnymi). Produkcja sprawdzona w Chromium: HTML zgodny, zdjęcie, korekcja wysokości,
  widok 320 px i przejście z kafelka działają; bez błędów JS i odpowiedzi HTTP 4xx/5xx.
- **2026-09-23** — **Stopka: kontakt do autora strony zastąpiony linkiem do `https://www.m-jaro.pl`.**
  Zamiast telefonu 608 078 802 i maila `graf.m.jar@gmail.com` jest `p.footer-credit` „Strona wykonana przez"
  + link w kolorach CMYK (`www.` cyjan, `m-jaro` magenta, `.pl` żółty) z czterema kółkami C/M/Y/K;
  K ma jasną obwódkę, bo czarne na ciemnej stopce znika. Na 17 stronach + szablon wpisu.
  CSS na końcu `styles.css`, cache `styles.css?v=20260923b`. **Stan: WDROŻONE 2026-09-23** (FTP 18 plików, MD5 18/18).
- **2026-09-18** — **`blog.html`: miniatury kwadratowe, karty mniejsze.** Miniatura rozciągała się
  na ~580 px wysokości, bo **atrybut `height="577"` na `<img>` działa jak CSS `height: 577px`**
  i przez to `aspect-ratio` było ignorowane. Fix: `.blog-card-media { height: auto; aspect-ratio: 1/1 }`.
  Pamiętaj o tym przy każdym `<img>` z `width`/`height` + `aspect-ratio`. Kolumna miniatury
  240 → **160 px** (mobile: **88 px obok tekstu**, zamiast pełnej szerokości 16:9), `align-items: center`,
  mniejszy padding. Zrzut symulatora ma w kafelku `object-position: 0% 50%` (w kadrze zostaje koło,
  nie suwaki). Cache: `styles.css?v=20260918a` na 17 stronach + szablon wpisu.
  **Stan: WDROŻONE 2026-09-18** (FTP 18 plików, MD5 18/18, produkcja po HTTP serwuje nowy CSS);
  commit `12745e9` wypchnięty na `origin/main` razem z przeniesieniem bloga z 2026-09-17 (b).
- **2026-09-17 (b)** — **Blog przeniesiony do katalogu `blog/`, zdjęcia do `img/blog/`
  + nowy wpis o symulatorze geometrii.**
  **Zmiana konwencji z 2026-09-15 (b) i 2026-09-16.** Tamte wpisy mówiły „wpisy PŁASKO
  w korzeniu, NIE w katalogu `blog/`", bo bez `.htaccess` katalog mógłby wystawić listing
  plików. **Decyzja właściciela (2026-09-17): katalogi działają na innym serwisie na tym samym
  hostingu**, więc konwencja została zmieniona. Listing blokuje **`blog/index.html`** — zaślepka
  z `meta refresh` na huba i `canonical` na `blog.html` (żeby `/blog/` nie konkurowało z hubem).
  **Hub `blog.html` ZOSTAJE w korzeniu** — jest zaindeksowany i linkowany z nagłówka oraz stopki
  na każdej podstronie; przeniesienie zerwałoby te linki bez zysku.
  **⚠️ Stary adres wpisu z września został w korzeniu jako przekierowanie.**
  `blog-geometria-kol-na-golej-ramie.html` poszedł 2026-09-16 na produkcję i do GSC z prośbą
  o zaindeksowanie, więc samo przeniesienie dałoby 404 na adresie, o którego crawl właśnie
  poprosiliśmy. Bez `.htaccess` nie ma jak wystawić 301 — plik zawiera `meta refresh 0`
  + `canonical` na nowy adres. Do skasowania, gdy GSC potwierdzi indeksację `blog/…`.
  **⚠️ NAJŁATWIEJSZY BŁĄD W TEJ KONWENCJI: wpis leży o poziom niżej, więc każda ścieżka
  względna potrzebuje `../`** — CSS, JS, favicon, logo, zdjęcia i wszystkie linki w menu,
  breadcrumbie, treści i stopce. Kontrola jednym poleceniem (nic nie wypisze):
  `grep -oh '\(href\|src\)="[^"]*"' blog/*.html | grep -v '="\(\.\./\|https\?:\|tel:\|mailto:\|#\)'`.
  **Struktura:** `blog/geometria-kol-na-golej-ramie.html`, `blog/symulator-geometrii-kol-3d.html`,
  `blog/index.html`; zdjęcia `img/blog/<slug>-*`, oryginały `img/_src/blog/<slug>.png`
  (mirror `img/_src/wear/`). Poprawione: `blog.html` (kafelki + wzorzec w komentarzu),
  `sitemap.xml`, `docs/BLOG.md`, `docs/blog-post-template.html` (ma już `../` wpisane).
  **`tools/optimize_images.py`:** slug może teraz zawierać podkatalog (`"blog/<slug>"`) —
  nowy helper `out_path()` robi `makedirs`. Doszła lista **`SCREEN_SOURCES`** (+`screen_variants`,
  `SCREEN_WIDTHS = [800, 1200]`) dla **zrzutów ekranu**: zrzut z przeglądarki ma ~1200 px
  szerokości, więc `variants()` pomija wariant 1400 — a fallback `.jpg` powstaje **wyłącznie**
  przy 1400, czyli wpis zostałby **bez żadnego `.jpg` na `og:image`** (podgląd linku na FB).
  Weryfikacja: regeneracja starych wariantów bloga dała pliki **bit w bit tej samej wielkości**
  co przed zmianą.
  **Nowy wpis: `blog/symulator-geometrii-kol-3d.html`** (984 słowa) — o remasterze laboratorium
  geometrii z 2026-09-17 (a). Dwa zrzuty ekranu: model 3D z suwakami + lista wzorców zużycia.
  **Liczby w tekście nie są przepisane z pamięci** — model zużycia z `geometria-3d.html`
  przeliczony w Pythonie: fabryka ≈44 000 km, camber −2,4° ≈25 000, zbieżność +4,2 mm ≈24 000,
  ciśnienie 1,5 bar ≈19 000. Normy, ceny (pomiar 150 zł, regulacja od 250 zł/oś) i nazwa
  alignera sprawdzone w `geometria-3d.html`/`cennik.html`. Sekcja „dlaczego sprężyna stoi nad
  wahaczem" opisuje zerowy promień zataczania (`KP_OFF = R·tan(SAI)`) — ta sama historia,
  co w pułapce 4 wpisu 2026-09-16 (d), napisana dla klienta.
  **CSS nietknięte** (`.post-*`/`.blog-*` już istniały) → **żadnego bumpu `?v=`**.
  **Przy okazji:** skasowany `fa.css` z korzenia (89 KB, pobrana kopia Font Awesome
  z kontroli ikon 2026-09-16 c — korzeń repo to web root, nie miejsce na artefakty diagnostyczne).
  **Stan: WDROŻONE przez FTP 2026-09-17** (18 plików: `blog.html`, `sitemap.xml`,
  `blog-geometria-kol-na-golej-ramie.html` nadpisany przekierowaniem, `blog/` 3 pliki,
  `img/blog/` 12 plików). Katalogi `blog` i `img/blog` utworzone przez FTP `MKD`.
  MD5 zweryfikowane **18/18** (odczyt z powrotem przez FTP), produkcja odpytana po HTTP.
  **✅ ROZSTRZYGNIĘTE: KATALOGI NA vh.pl DZIAŁAJĄ — i nie wystawiają listingu.**
  To było główne ryzyko tej zmiany i jest zmierzone, nie założone: `http://www.sscar.pl/blog/`
  zwraca **naszą zaślepkę `blog/index.html`** (667 B, `<title>Blog SSCAR</title>`), a nie
  „Index of /blog". Serwer sam podaje `index.html` z katalogu. Oba wpisy otwierają się pod
  `/blog/<slug>.html`, zdjęcia z `/img/blog/` schodzą poprawnie, a zasoby wołane przez `../`
  (`/css/styles.css`, `/js/nav.js`, `/Logo-SSCAR.png`, `/favicon.png`) odpowiadają 200.
  **Konsekwencja na przyszłość:** ostrzeżenie „nie przenoś stron do podkatalogów" z wpisów
  2026-09-15 (b) i 2026-09-16 dotyczyło listingu i braku 301. Listing jest **obalony**
  (wystarczy `index.html` w katalogu). Brak 301 **nadal obowiązuje** — dlatego przenosimy
  wyłącznie adresy świeże lub niezaindeksowane, a zaindeksowane zostawiają po sobie zaślepkę
  z `meta refresh` + `canonical`. **Podstron usługowych z korzenia nadal NIE przenosimy:**
  są w indeksie od sierpnia i nie ma czym wystawić 301.
  **⚠️ Na serwerze zostało 6 osieroconych plików** `img/blog-geometria-kol-na-golej-ramie-*`
  (razem 1 374 191 B) — nic ich już nie linkuje, kopie są lokalnie w `img/blog/`. Do skasowania
  (nazwy ASCII, więc zwykły `FtpWebRequest` wystarczy — pułapka z §7 tu nie zachodzi).
  **Zostało do zrobienia:** GSC → „Poproś o zaindeksowanie" dla
  `https://www.sscar.pl/blog/symulator-geometrii-kol-3d.html` **oraz**
  `https://www.sscar.pl/blog/geometria-kol-na-golej-ramie.html` (nowy adres starego wpisu).
  **Nie oglądane w prawdziwej przeglądarce** — sprawdzić wygląd wpisu i oba zrzuty ekranu.
- **2026-09-17** — Nowy model WebGL w `geometria-3d.html` — pełny opis w `docs/GEOMETRIA-3D.md`.
- **2026-09-16 (d)** — Laboratorium geometrii przepisane na jeden model 3D — pełny opis (układ współrzędnych, model zużycia, pułapki) w `docs/GEOMETRIA-3D.md`.
- **2026-09-16 (c)** — **`geometria-3d.html`: pasek statystyk zastąpiony sticky spisem sekcji + „na górę".
  Przy okazji: DWIE ikony Font Awesome PRO renderowały się jako puste miejsce.**
  **⚠️ PUŁAPKA DO ZAPAMIĘTANIA: strona ładuje Font Awesome 6.0.0 w wersji FREE**
  (`cdnjs.../font-awesome/6.0.0/css/all.min.css`), a w kodzie siedziały dwie ikony **Pro**:
  `fa-steering-wheel` (`geometria-3d.html` „Prowadzenie auta" i `badania-powypadkowe.html`
  „Układ kierowniczy") oraz `fa-tire` (`badania-powypadkowe.html`). Klasa Pro w buildzie Free
  **nie daje żadnego błędu** — po prostu nie ma glifu, więc `<i>` zostaje pustym miejscem
  i w siatce `.feature-item` widać dziurę w kolumnie ikon. Zamienione na Free:
  `fa-road`, `fa-car-side`, `fa-dharmachakra`.
  **Jak sprawdzić CAŁĄ stronę jednym poleceniem** (robić po każdym dodaniu ikony):
  ```bash
  curl -s -o fa.css https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css
  for i in $(grep -rho 'fa-[a-z0-9-]*' *.html | sort -u); do grep -q "\.$i:" fa.css || echo "$i"; done
  ```
  (`fa-lg` i `fa-spin` w wyniku to fałszywe alarmy — klasy narzędziowe, definiowane bez `::before`.)
  **Zmiana główna:** sekcja `.stats-row` (150 zł / 4 koła / 0,01°) na `geometria-3d.html` zastąpiona
  **sticky spisem sekcji** `.secnav` — strona ma ~1600 linii i wielkie interaktywne laboratorium,
  więc ruch „góra↔dół" był bolesny. Pasek klei się pod nagłówkiem (`top:100px`, mobile `80px`;
  `z-index:900` < header 1000), ma 5 pozycji numerowanych `01–05` (Barlow Condensed, numer czerwony —
  ten sam idiom co `.nav-index-item` z `DESIGN.md`) + wyróżniony „Umów termin" → `#umow`.
  Aktywna sekcja podświetlana przez `IntersectionObserver` (`rootMargin: -170px 0px -55%`,
  pierwsza przecinająca w kolejności dokumentu = aktywna). Na mobile lista przewija się poziomo
  i sama wciąga aktywną pozycję w kadr. Doszedł dyskretny `.to-top` (fixed, prawy dolny róg,
  pojawia się po 700 px scrolla). Nowe `id` na sekcjach: `#dlaczego`, `#kiedy`, `#jak-pracujemy`,
  `#cennik` (+ istniejące `#geo-lab`) i `#umow` na `.cta-section`.
  **⚠️ PUŁAPKA `position: sticky` W TYM PROJEKCIE:** `css/styles.css` ma `overflow-x: hidden`
  **na `html` I na `body`** (linie 43 i 55). `overflow-x: hidden` wymusza `overflow-y: auto`,
  co robi z elementu **kontener przewijania** — i `position: sticky` u potomków przestaje działać.
  Dlatego blok inline zaczyna się od `html, body { overflow-x: clip; }` — `clip` przycina tak samo,
  ale **nie tworzy kontenera przewijania**. Pamiętaj o tym przy każdym kolejnym sticky poza
  `.rodo-index`/`.rez-summary` (te siedzą w gridzie i miały szczęście).
  **Druga pułapka (własny błąd, złapany przed końcem):** `.to-top` ma w HTML atrybut `hidden`
  (zdejmowany przez JS), ale autorska reguła `.to-top { display: grid }` **wygrywa z `[hidden]`
  z arkusza UA** — bez JS zostałby niewidoczny, ale klikalny krążek 44 px w rogu. Trzeba jawnego
  `.to-top[hidden] { display: none }`. To samo dotyczy każdego elementu łączącego `hidden` z `display`.
  **CSS i JS są INLINE w `geometria-3d.html`** (precedens `dekoder.html`, prefiks `secnav-`) —
  `css/styles.css` nietknięte, więc **żadnego bumpu `?v=` na 16 stronach**.
  **Odstępstwo od `DESIGN.md`:** udokumentowany tam układ strony usługowej to
  `breadcrumb → service-page-hero → stats-row → sekcje → cta-section → footer`. `geometria-3d.html`
  ma teraz `secnav` zamiast `stats-row`; `.stats-row` dalej żyje na `badania-techniczne.html`,
  `klimatyzacja.html` i `wulkanizacja.html` (CSS w `styles.css` bez zmian).
  **Stan: NIEWDROŻONE** — zmiany tylko lokalnie, do wgrania FTP: `geometria-3d.html`,
  `badania-powypadkowe.html`. Sticky i scroll-spy **nie były sprawdzone w przeglądarce**
  (brak narzędzia headless w środowisku) — obejrzeć po deployu.
- **2026-09-16 (b)** — **Blog w górnym menu na wszystkich stronach + brakujący breakpoint nagłówka.**
  **Błąd do protokołu:** przy dodawaniu bloga (2026-09-15 b) link trafił do stopki na 16 stronach,
  ale do **headera tylko na `o-nas.html`** — czyszczący `awk` dopasowywał `class="nav-link"`, a tam
  link „O nas" ma `class="nav-link active"`, więc go ominął. Dodatkowo ta wstawka **nie miała klasy
  `nav-link`**, przez co `nav.js` nie zamykał menu mobilnego po kliknięciu. Stąd nowa **REGUŁA
  o synchronizacji header↔stopka w sekcji 3** — czytaj ją przed dodaniem jakiejkolwiek podstrony.
  **Zmiana decyzji z 2026-09-15 (b):** wtedy Blog trafił świadomie tylko do stopki, bo menu nie
  mieściło ósmej pozycji. Teraz jest w **obu** miejscach, a problem z szerokością rozwiązany u źródła.
  **⚠️ Odkrycie przy okazji: między 769 a 1200 px NIE BYŁO ŻADNEGO breakpointu nagłówka** (mobilne
  menu wchodzi dopiero ≤768 px), więc menu było tam ciasne **już przy siedmiu pozycjach** — logo ma
  `max-height: 160px` (≈224 px szerokości przy proporcji 1.4:1), co przy ~810 px treści zostawiało
  nawigacji ~560 px na ~680 px potrzebnych. Dwa nowe bloki **na końcu `css/styles.css`**:
  `769–1200 px` (logo 110 px, `margin-left` 1rem, font 0.8rem, `padding: 0 3%`) i `769–980 px`
  (logo 88 px, `margin-left` 0.7rem, font 0.74rem). Media query NIE podnosi specyficzności, więc
  muszą stać PO bazowych `nav ul li a` — stąd koniec pliku.
  Cache: `css/styles.css?v=20260916a` (16 stron + szablon wpisu).
- **2026-09-16** — **Porządki: katalogi `css/` i `js/`, 30 MB śmieci skasowane z serwera.**
  **⚠️ Pliki `.html` ZOSTAJĄ PŁASKO W KORZENIU — nie przenosić ich do podkatalogów.** To zaindeksowane
  URL-e, a na serwerze **nie ma `.htaccess`** (wpis 2026-08-04 c), więc nie da się wystawić przekierowań
  301. Przeniesienie = trwałe 404 na każdej stronie i utrata pracy z 2026-08-04, która dopiero wepchnęła
  11 podstron do indeksu. Assety to inna sprawa — ich URL-e nie są w indeksie, więc je wolno przenosić.
  **Nowa struktura:** `css/` ← `styles.css`, `panel.css`; `js/` ← `nav.js`, `reviews_data.js`,
  `rezerwacja.js`, `dane_klima.js`, `panel*.js` (8 szt.). Odwołania poprawione na 17 stronach.
  `?v=` NIE bumpowane — zmiana ścieżki sama unieważnia cache. `dane_google/` (eksporty z GSC)
  → `docs/dane_google/`, bo **nie było na liście `ignore`** i przy zwykłej synchronizacji FTP
  wylądowałoby na produkcji.
  **Sprawdzone przed przenosinami (i warte sprawdzenia następnym razem):** (a) `url()` w CSS —
  `styles.css` ma tylko absolutny `@import` fontów, więc zejście o poziom niżej nic nie psuje;
  (b) `fetch()` w JS (`js/rezerwacja.js`, `js/panel.js` → `reservations/...`) rozwiązuje się względem
  **dokumentu**, a dokumenty zostały w korzeniu — działa bez zmian.
  **Skasowane z serwera (24 pliki, ~30 MB):** 12 obrazów z maja (6 oryginałów `.jpg` + 6 starych
  ręcznych `.webp`), które zostały po reorganizacji repo z 2026-07-27; `Clean_Smooth_transition.mp4`
  (1,0 MB, osierocony od 2026-08-04 e); `dane_klima.json` (0,68 MB, klient ładuje tylko `.js`);
  10 starych kopii JS/CSS z korzenia. Każdy plik przed usunięciem zweryfikowany jako nieużywany
  (grep po `*.html`, `css/`, `js/`, `reservations/`). Korzeń serwera: **47 MB → 17,4 MB**.
  Lokalnie usunięte 6 starych ręcznych `.webp` z `img/_src/` (2,9 MB); **oryginały `.jpg`/`.png`
  ZOSTAJĄ** — to źródła dla `optimize_images.py`, nigdy nie trafiają na FTP.
  Osierocony `blog-...-2-1400.jpg` NIE został skasowany, tylko **wykorzystany** jako `src` fallback
  przy zdjęciu pionowym (skrypt i tak generuje go przy każdym uruchomieniu).
- **2026-09-15 (b)** — **Blog: `blog.html` + konwencja wpisów, prowadzony RĘCZNIE.**
  **Decyzja: automatyczny import postów z Facebooka ODRZUCONY** (rozważany: Graph API,
  użytkownik systemowy w Meta Business, cron na vh.pl). Powód podwójny: (1) przy 2–3 postach
  miesięcznie ~1 dzień kodu + setup w Meta + doglądanie tokenu zwraca się po latach;
  (2) **ważniejszy — SEO**: post z FB to dwa zdania, przeniesiony 1:1 jest thin contentem.
  Wartość powstaje dopiero przy **przepisaniu** posta na tekst pod wyszukiwarkę, czego automat
  nie zrobi. Surowy post z FB traktujemy jako **materiał źródłowy**. Apka Meta (`sscar`,
  App ID 1555028076421441, tryb *In development*) **została utworzona** — jeśli kiedyś skala
  wzrośnie, wystarczy wygenerować token użytkownika systemowego.
  **Struktura: płasko w korzeniu** — `blog.html` (hub) + `blog-<slug>.html`. NIE katalog `blog/`,
  bo **na serwerze nie ma `.htaccess`** (wpis 2026-08-04 c), więc katalog bez `index.html` mógłby
  wystawić listing plików, a dodanie tam `index.html` zdublowałoby hub. W GSC filtruj po `blog-`.
  **⚠️ Blog linkujemy ze STOPKI (15 stron), NIE z górnego menu.** `nav ul` to `display:flex`
  **bez zawijania**; obecne 7 pozycji zajmuje ~680 px i między 769 a ~1050 px jest już na styk —
  ósma pozycja by je przepełniła. Stopka to zresztą dokładnie ten mechanizm, który w sierpniu
  odblokował crawlowanie 11 podstron. Blog dodany też do `sitemap.xml` (priority 0.7, weekly).
  **CSS:** blok `.blog-*` (hub) + `.post-*` (treść wpisu) **na końcu `styles.css`** — globalne `h2`
  ma `text-align:center`, `margin-bottom:4rem` i czerwoną kreskę `::after`, więc `.post-body h2`
  i `.blog-list h2.blog-card-title` jawnie to zdejmują (`::after { content: none }`).
  **Dokumentacja: `docs/BLOG.md`** — procedura krok po kroku (materiał → przepisanie → zdjęcia →
  plik → podpięcie → FTP → „Poproś o zaindeksowanie" w GSC), checklista SEO i lista pułapek.
  Szablon: `docs/blog-post-template.html` z `{{PLACEHOLDERAMI}}` (kontrola: `grep -o "{{[A-Z_]*}}"`).
  **Stan: WDROŻONE 2026-09-16** razem z pierwszym wpisem (hub celowo nie poszedł na produkcję pusty —
  pusty blog to thin content). Cache: `styles.css?v=20260915c` (16 stron). Pierwszy wpis:
  `blog-geometria-kol-na-golej-ramie.html` — geometria 3D na ramie Land Cruisera bez nadwozia,
  materiałem źródłowym był post z FB z 2026-09-04 (3 zdania → 537 słów). Blok `.blog-empty` w
  `blog.html` został usunięty; wzorzec kafelka został jako komentarz HTML nad listą.
  **Zdjęcia pionowe:** `.post-figure.is-portrait` ogranicza szerokość do 480 px — bez tej klasy
  zdjęcie 3:4 rozpycha się na ~1000 px wysokości w kolumnie tekstu.
  **⚠️ Przy okazji naprawiona stopka — pułapka `min-width` w gridzie.** Element gridu ma domyślnie
  `min-width: auto`, więc długi link (`Ochrona danych (RODO)` przelało czarę) potrafi **rozepchnąć
  kolumnę ponad jej tor i nachodzić na sąsiadkę**. Fix: `.footer-nav-col { min-width: 0 }` +
  `max-width:100%` i `overflow-wrap:break-word` na linkach. Przy okazji `repeat(auto-fit,
  minmax(200px,1fr))` → **`repeat(4, minmax(0,1fr))`** + breakpoint `≤1024px → 2×2` (auto-fit
  robił rozjechany układ 3+1 między ~769 a ~930 px). Pamiętaj o tym przy każdym nowym gridzie.
- **2026-09-15** — **Nowa strona `rodo.html` (obowiazek informacyjny RODO) + poprawiona semantyka zgody w rezerwacji.**
  Formularz rezerwacji zbieral dane bez zadnej informacji o przetwarzaniu — brakowalo realizacji art. 13 RODO.
  **(a) `rodo.html`** — 10 numerowanych sekcji w ukladzie „manual serwisowy": sticky spis tresci (desktop) +
  tresc max 68ch. Dane administratora wziete ze **zrzutu z rejestru SKP** (CEIDG/BIP): Sebastian Stefanik,
  siedziba **ul. Jagodowa 12, 55-003 Nadolice Male**, NIP **8992532559**, stacja DW/126/P, Polanowicka 82.
  **⚠️ Telefon kontaktowy w `rodo.html` to CELOWO `609 995 620` (linia opon), NIE `796 995 620` (SKP).**
  Decyzja wlasciciela z 2026-09-15. To jedyna strona w serwisie z numerem 609 jako glownym kontaktem —
  na pozostalych 13 podstronach 609 wystepuje wylacznie przy wulkanizacji. NIE ujednolicac do 796.
  Tresc opisuje **rzeczywisty** przeplyw danych w aplikacji, nie ogolniki: pola formularza 1:1 z `book.php`,
  Google Calendar jako odbiorca (grafik = zrodlo prawdy), lista numerow zablokowanych (`rez_phone_blocked`)
  ujawniona w sekcji o automatyzacji, brak analityki + mapa Google i CDN-y w sekcji cookies.
  **(b) Checkbox zgody przepisany.** Bylo: „Wyrazam zgode na przetwarzanie moich danych w celu obslugi
  rezerwacji" — **prawnie bledne**: obsluga rezerwacji to art. 6 ust. 1 lit. b (umowa), a nie zgoda;
  zgoda jest odwolywalna, wiec deklarowanie jej jako podstawy tworzy fikcje. Jest: potwierdzenie zapoznania
  sie z informacja + link do `rodo.html`. Komunikat walidacji w `rezerwacja.js` dostosowany.
  **(c) Sitewide:** link „Ochrona danych (RODO)" w kolumnie „Stacja" `.footer-nav` na **13 stronach**,
  wpis w `sitemap.xml` (priority 0.2).
  **⚠️ Pulapka CSS, w ktora wpadlem:** `.rodo-sec` to `<section>` **zagniezdzony** w `<section>`, wiec lapie
  globalne `section { padding: 7rem 5% }`. Nadpisanie samego `padding-top` NIE wystarcza — zostaje 7rem
  na dole i 5% po bokach. Trzeba `padding: 3.25rem 0 0`. To samo dotyczy kazdej przyszlej sekcji w sekcji.
  **⚠️ Druga pulapka:** `.tip-box strong` (czerwien komponentu) ma **identyczna specyficznosc** (0,1,1)
  co `.rodo-sec strong`, a nowy CSS lezy na koncu pliku, wiec wygrywal i zjadal czerwien. Fix:
  jawne `.rodo-sec .tip-box strong`. Przy dopisywaniu `.<blok> strong|a|p` na koncu `styles.css` sprawdz,
  czy nie przykrywasz istniejacego komponentu o tej samej specyficznosci.
  **⚠️ Trzecia pulapka (zlapana dopiero na produkcyjnym renderze):** `.rodo-tldr li` bylo `display: grid`
  z kolumnami `0.9rem | 1fr`, zeby ustawic czerwony myslnik obok tekstu. W grid containerze **kazdy element
  inline staje sie osobnym grid itemem** — `<strong>` wypadal do wlasnego wiersza, a tekst za nim ladowal
  w anonimowym itemie w kolumnie szerokiej na 0.9rem i lamal sie **po jednym slowie w linii**. Regula:
  jesli kontener ma w srodku mieszana tresc inline (tekst + `<strong>`/`<a>`), marker rob przez
  `position: absolute` + `padding-left` (tak jak `.rodo-list li`), NIGDY przez grid/flex.
  Nowy CSS: prefix `.rodo-`, **na koncu `styles.css`** (patrz pulapka specyficznosci). Cache:
  `styles.css?v=20260915a` na 13 stronach + `rezerwacja.js?v=20260915a`.
  **NIEZWERYFIKOWANE — do potwierdzenia przez wlasciciela przed publikacja:** (1) nazwa prawna operatora
  hostingu (w tekscie ogolne „dostawca hostingu i poczty"); (2) czy dziala **biuro rachunkowe** (jesli nie —
  usunac z listy odbiorcow); (3) okres przechowywania **rejestru badan technicznych** (celowo opisany jako
  „przez okres wymagany przepisami", bez liczby). Dokument nie byl konsultowany prawnie.
  **✅ ROZSTRZYGNIETE — diagnostow ma byc DWOCH. NIE dopisywac trzeciego.** Rejestr SKP (zrzut z BIP)
  wymienia 3 nazwiska, w tym **Marcina Klemczynskiego DW/D/0222**, ale **Marcin odchodzi ze stacji**
  (decyzja wlasciciela, 2026-09-15). `o-nas.html` z dwoma profilami (Stefanik + Jarosinski) jest **poprawna**
  i celowa — nie jest nieaktualna. Jesli w przyszlosci rejestr nadal bedzie pokazywal 3 osoby, to zaleglosc
  po stronie urzedu, nie blad strony.
- **2026-08-04 (e)** — **Hero `index.html`: film zastąpiony zdjęciem stacji. Cały scroll-scrub USUNIĘTY.**
  Powód: film `Clean_Smooth_transition.mp4` sterowany scrollem regularnie się zacinał (decyzja właściciela).
  **Co zniknęło:** `Clean_Smooth_transition.mp4` (774 KB), `img/hero-car-poster.webp`, `.hero-video-container`,
  `#hero-video`, klasy `.is-static`/`.is-suspended` oraz **~115 linii inline JS** w `index.html` (`initHeroVideo`:
  throttling 24 fps, `IntersectionObserver`, `visibilitychange`, tryb `staticMode` dla Save-Data/słabych urządzeń).
  Nie ma już żadnego JS-u obsługującego hero — to teraz czysty `<picture>`.
  **⚠️ Konsekwencja dla wpisu 2026-07-28:** opisana tam optymalizacja filmu jest **nieaktualna**; `maxScroll`
  liczony z `querySelector('.nav-cards-section')` też zniknął, więc **kolejność sekcji na `index.html` nie jest
  już związana ze sterowaniem filmem** (dawniej nie wolno było ruszać pozycji sekcji „Nasze usługi").
  **Nowe zasoby:** źródło `img/_src/stacja-sscar.png` (2,54 MB) → `hero-stacja-800.webp` (78 KB),
  `hero-stacja-1400.webp` (185 KB), `hero-stacja-1400.jpg` (272 KB). Wpis dodany do `SOURCES`
  w `tools/optimize_images.py` — **nie do `HERO_SOURCES`**, bo tamten tryb przycina dolny pas z wypalonym
  podpisem (tu nie ma czego przycinać) i wymusza szerokości 1200/1900/2600, co przy oryginale 1537 px
  wyprodukowałoby dwa identyczne pliki. Zwykłe `variants()` samo pomija wariant 2200 (nie powiększamy).
  **⚠️ Sufit rozdzielczości: oryginał ma 1537 px szerokości**, więc największy wariant to 1400. Przy podmianie
  zdjęcia na ostrzejsze warto wrócić do 2200.
  **Art direction (`styles.css`):** `.hero` = `justify-content: flex-end` — blok treści siedzi na dole, na pustej
  kostce; wyśrodkowany przykrywał szyld „PRZEGLĄDY REJESTRACYJNE" i bramę. `.hero-logo-main` **700 → 420 px**:
  plik logo ma proporcję **1.4:1** (2100×1500), więc 700 px szerokości = **500 px wysokości** i sam blok treści
  zjadał cały kadr. `.hero-photo` zachowuje `position: fixed` + `contain: strict` po starym kontenerze wideo
  (darmowy paralaks, kolejne sekcje mają własne tło i je zasłaniają). Dwuwarstwowy scrim na `::after`
  (pion: jasno u góry, `0.94` na dole; poziom: wygaszenie oszronionego świerka po lewej) — kostka ma ~L75%,
  bez tego `#ddd` nie wyrabia kontrastu AA. Wejście: `heroPhotoIn` (opacity + `scale(1.045)→1`, tylko `transform`),
  wyciszone w istniejącym guardzie `prefers-reduced-motion` razem z `fadeInUp` logo/h1/przycisków.
  **⚠️ Kadr `object-position` jest wyliczony, nie „na oko":** desktop `57% 42%`, mobile **`63% 45%`**. Procent
  w `object-position` to NIE „wyśrodkuj na X%" tylko `(szerokość_obrazu − szerokość_boxa) × X`. Przy 500 px
  widać ~37% szerokości zdjęcia, a szyld zajmuje 43,6–74,6% — przy `58%` okno wypadało 36,5–73,6% i ucinało
  „REJESTRACYJNE". Nie zmieniaj tych wartości bez przeliczenia.
  **Decyzja właściciela:** logo w hero **zostaje czerwone i bez zmian**, mimo że ląduje na czerwonej bramie
  (słaby kontrast czerwień-na-czerwieni) i daje trzy znaki SSCAR w jednym kadrze (nagłówek + szyld + hero).
  Odrzucone warianty: usunięcie logo z powiększeniem `h1` do rozmiaru display z `DESIGN.md`, oraz przemalowanie
  logo filtrem na biel. **Nie wracać do tego bez pytania.**
  Cache: `styles.css?v=20260804c` na 13 stronach. Wdrożone FTP (17 plików: 13 HTML + `styles.css`
  + 3 warianty `img/hero-stacja-*`), zweryfikowane MD5 (17/17) i odpytaniem produkcji po HTTP.
  **⚠️ Na serwerze został osierocony `Clean_Smooth_transition.mp4`** — i to w wersji **sprzed** optymalizacji
  z 2026-07-28 (1 003 767 B, nie 774 701 B), czyli tamten przekodowany plik najwyraźniej nigdy nie trafił na
  FTP. Nic go już nie linkuje; do skasowania ręcznie. `img/hero-car-poster.webp` na serwerze nigdy nie było (550).
- **2026-08-04** — **SEO: naprawa linkowania wewnętrznego — 11 podstron nie było crawlowanych przez Google.**
  Diagnoza z Google Search Console (3 mies., dane w `dane_google/`): **71 kliknięć, 816 wyświetleń**, ale
  wyświetlenia generowały **tylko 2 URL-e** (`/` i `rezerwacja.html`). Raport „Indeksowanie stron":
  **zindeksowana 1 strona z 12**, pozostałe 11 ze statusem **„Strona wykryta – obecnie niezindeksowana"**
  — Google znał adresy z sitemapy, ale **nigdy ich nie pobrał**.
  **Przyczyna:** 6 podstron usługowych miało po **1 linku przychodzącym** (wyłącznie z `oferta.html`, która
  sama ma 230 słów) i **nie było w nawigacji**. `index.html` nie linkował do żadnej z nich. Google ocenił je
  jako niewarte crawlowania. Wykluczone jako przyczyny: `meta robots` (wszędzie `index, follow`), `robots.txt`
  (blokuje tylko `guide.html`), `htaccess` (samo przekierowanie HTTPS), `canonical` (poprawne, self-referencing).
  **⚠️ Wniosek do zapamiętania: sitemapa NIE wystarcza do indeksacji.** Wszystkie 11 stron było w `sitemap.xml`
  od maja i to nie pomogło — sitemapa jest sugestią, realnym sygnałem są **linki wewnętrzne**.
  **Zmiany:** (a) nowy komponent **`.footer-nav`** (`styles.css`, na końcu pliku — patrz pułapka specyficzności)
  — sitewide mapa linków w stopce, wstawiona do **13 stron**, 4 kolumny (Badania i diagnostyka / Serwis /
  Stacja / Narzędzia), bieżąca strona oznaczona `aria-current="page"`; (b) nowa sekcja **„Nasze usługi"** na
  `index.html` — 6 kart `.nav-index` z opisowymi anchorami (*„Badania techniczne Wrocław", „Geometria 3D
  i zbieżność kół"*), wstawiona **dokładnie w miejscu** dawnej sekcji „Czego szukasz?", żeby nie ruszyć
  `maxScroll` w scroll-scrubie filmu hero (`querySelector('.nav-cards-section')` bierze pierwszy element);
  (c) blok **„Zobacz też"** (reuse `.nav-index`, zero nowego CSS) na 6 stronach usługowych, przed `.cta-section`;
  (d) `sitemap.xml` — dodany **brakujący `rezerwacja.html`** (2. strona serwisu po wyświetleniach!), `lastmod`
  odświeżony na `2026-08-04`. Efekt: każda podstrona ma teraz **12 linków przychodzących** zamiast 1.
  Cache: `styles.css?v=20260804a` na wszystkich 13 stronach.
  **Po wdrożeniu FTP OBOWIĄZKOWO:** w GSC „Sprawdzenie adresu URL" → **„Poproś o zaindeksowanie"** dla każdego
  z 11 adresów (sam deploy nie wymusi crawla), potem „Zweryfikuj poprawkę" w raporcie indeksowania.
  **Nie robione świadomie (dopiero po zaindeksowaniu):** `FAQPage` (jedyna sekcja FAQ jest w
  `badania-techniczne.html`), nagłówki `h2` w `oferta.html`/`cennik.html`, rozbudowa treści — optymalizacja
  treści, której crawler nie pobrał, jest bezwartościowa.
  **Ustalenie do protokołu:** `meta description` **jest na każdej stronie** — na `index.html`, `dekoder.html`
  i `klima.html` atrybuty `name` i `content` są rozbite na dwie linie, więc jednoliniowy grep daje fałszywy
  negatyw. Nie „naprawiać" tego ponownie.
  **Sekcja „Czego szukasz?" USUNIĘTA z `index.html`** (decyzja właściciela) — dublowała górne menu (te same
  5 pozycji). Bezpieczne dla SEO: wszystkie 5 stron ma linki w nagłówku ORAZ w nowej stopce na każdej stronie.
- **2026-08-04 (b)** — **⚠️⚠️ ODKRYCIE: HTTPS jest za ochroną antybotową, która serwuje stronę „Weryfikacja"
  zamiast treści.** Znalezione przy weryfikacji deployu (patrz wpis wyżej). Stan faktyczny, zmierzony:

  | Zasób | HTTPS | HTTP |
  |---|---|---|
  | `robots.txt` | **przechodzi** (whitelist po ścieżce) | OK |
  | `sitemap.xml` | **CHALLENGE** (HTML „Weryfikacja", kod 200) | OK (13 URL) |
  | `*.html`, `styles.css` | **CHALLENGE** (kod 200) | OK |

  Challenge to strona `<title>Weryfikacja</title>` z JS-em bijącym do **`/__nodea/sentry`**; dostaje ją
  **każdy** User-Agent (także Chrome i spoofowany Googlebot), więc filtr działa na **wykonaniu JS**, nie na UA.
  **✅ ROZSTRZYGNIĘTE — to NIE jest przyczyna problemu z indeksacją. Nie gonić tego tropu.**
  Dowód z GSC („Sprawdzenie adresu URL" dla `geometria-3d.html`): sekcja **Wykrywalność** pokazuje
  „Mapy witryn: `https://www.sscar.pl/sitemap.xml`" **oraz** „Strona odsyłająca: `oferta.html`". Skoro Google
  wskazuje sitemapę jako źródło wykrycia, to **odczytał ją po HTTPS**, a skoro zna link z `oferta.html`, to
  **pobrał też jej treść**. Zweryfikowany Googlebot (po reverse DNS) jest więc z challenge'u **zwolniony** —
  challenge dotyczy tylko klientów nieprzechodzących JS (curl, PowerShell, podszyty UA z obcego IP).
  Potwierdzenie diagnozy właściwej: w tym samym raporcie „Ostatnie skanowanie: **Nie dotyczy**" — strona nigdy
  nie została pobrana, mimo że Google zna ją z **dwóch** źródeł. To problem **priorytetu crawlowania**
  (za słabe linkowanie wewnętrzne), nie dostępu. Naprawiane wpisem 2026-08-04 wyżej.
  **Co z tego zostaje jako realne ryzyko:** challenge blokuje `sitemap.xml`, CSS i HTML dla **narzędzi SEO
  i innych robotów** (Bing, Ahrefs, Screaming Frog, walidatory) — audyty zewnętrzne będą zwracać śmieci.
  **⚠️ Pułapka diagnostyczna:** challenge zwraca **kod 200**, więc „strona odpowiada 200" NIE znaczy, że
  serwuje treść. Przy każdym sprawdzaniu produkcji weryfikuj **zawartość**, nie tylko kod. Sam popełniłem
  ten błąd, biorąc challenge za „stary cache".
- **2026-08-04 (d)** — **SEO, druga tura: `oferta.html` wzmocniona, semantyka nagłówków, `FAQPage`.**
  Kontekst: GSC potwierdziło, że `oferta.html` to **strona odsyłająca**, z której Google odkrywa podstrony
  usługowe — a miała 230 słów i **ani jednego nagłówka** poza `h1` (nazwy usług siedziały w `<span>`).
  (a) **`oferta.html`** — dodany wstęp z twardymi faktami (stacja DW/126/P, zakres badań: motocykle, LPG, haki,
  powypadkowe, **bez przyczep i zabytkowych**, godziny, telefon), usługi pogrupowane pod **2 nagłówki `h2`**
  („Badania techniczne i diagnostyka", „Serwis i obsługa pojazdu"), a nazwy usług `span` → **`h3`**
  (hierarchia h1→h2→h3). 230 → **354 słowa**. Kolejność usług zmieniona tak, by pasowała do grup.
  (b) **`cennik.html`** — `h3.table-title` → **`h2.table-title`** (4 szt.), naprawiony przeskok h1→h3.
  (c) **`badania-techniczne.html`** — dodany **`FAQPage`** do `@graph` (3 pytania, tekst 1:1 z treścią widoczną
  na stronie; schemat musi odpowiadać temu, co widzi użytkownik).
  **⚠️ Pułapka CSS przy zamianie `span`→`h2`/`h3`:** globalne `h2` ma `text-align:center`, `margin-bottom:4rem`
  i **czerwoną kreskę `h2::after`**. W kafelkach usług i tytułach tabel trzeba to zdejmować jawnie —
  dopisane na końcu `styles.css`: `.service-list h3.service-entry-title{margin:0;text-align:left}` +
  `::after{content:none}` oraz `h2.table-title::after{content:none}`. Bez tego pod każdą nazwą usługi
  pojawia się czerwony pasek, a odstępy się rozjeżdżają.
  **⚠️ Pułapka, w którą wpadłem:** hurtowe `replace('</h3>','</h2>')` w `cennik.html` popsuło **6 innych**
  `<h3>` (m.in. kolumny nowej stopki) — otwarcia `<h3>` z zamknięciami `</h2>`. Przy zamianie poziomu nagłówka
  używaj regexa parami (`(<h3[^>]*>)(.*?)</h2>` → `\1\2</h3>`), nigdy dwóch niezależnych `replace`.
  Cache: `styles.css?v=20260804b` na 13 stronach. Wdrożone FTP + zweryfikowane MD5 i odpytaniem produkcji.
- **2026-08-04 (c)** — **`.htaccess` NIE ISTNIEJE na serwerze — wymuszenie HTTPS nie działa.** Sekcja 3 tego
  pliku twierdziła, że `htaccess` (bez kropki) to kopia żywego `.htaccess` z korzenia serwera. Sprawdzone
  przez FTP (`GetFileSize`): `.htaccess` → **550 (brak pliku)**, jest tylko `htaccess` (103 B, bez kropki),
  którego Apache nie czyta. Skutek: `http://www.sscar.pl/` oddaje pełną treść z **kodem 200 bez przekierowania**
  — ta sama treść żyje pod http:// i https:// (duplicate content). Łagodzi to `canonical` wskazujący na
  `https://`, ale przekierowanie należy przywrócić. **Nie wgrywać `.htaccess` automatycznie** — to zmiana
  infrastrukturalna, robić świadomie i z weryfikacją, że hosting ją przyjmuje.
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
