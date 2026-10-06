# Citroën XM — wpis z 6 października 2026

Plik: `blog/citroen-xm-hydropneumatyka.html`.
Tytuł: „Citroën XM – dlaczego płynie po drodze?”.
Stan: wdrożony przez FTP 2026-10-06; bez zgłoszenia do GSC.

## Materiał i źródła

Zdjęcie dostarczył właściciel: `Srebrny Citroën XM na złotej godzinie.png`.
Oryginał pozostaje nietknięty; identyczna kopia źródłowa jest w
`img/_src/blog/citroen-xm-hydropneumatyka.png`.
Warianty WebP 800/1400 px i JPG 1400 px powstały przez `variants()` z istniejącego
`tools/optimize_images.py`. Bez przycinania kadru. Wariant 2200 px pominięty,
ponieważ oryginał ma 1536 × 1024 px. Wpis dopisany do `SOURCES` generatora.

Źródła sprawdzone 2026-10-06, linkowane przy odpowiednich akapitach wpisu:

- [Citroën, historia XM-a (2019)](https://www.media.stellantis.com/de-de/citroen/press/100-jahre-citroen-xm-als-erstes-serienfahrzeug-mit-elektronisch-gesteuertem-fahrwerk): premiera w maju 1989, Bertone, Car of the Year 1990, Break w 1991, modernizacja w 1994, produkcja do 2000, czujniki i sterowanie Hydractive.
- [Citroën Origins, XM](https://www.citroenorigins.fr/fr/vehicule/xm): przegroda szklana między kabiną a bagażnikiem, nazywana trzynastą szybą.
- [Citroën, geneza XM-a (2021)](https://www.media.stellantis.com/it-it/citroen/press/citroen-xm-la-genesi-della-grande-stradista-degli-anni-90): funkcja wewnętrznej szyby przy otwieraniu klapy.
- [Citroën, Paul Magès i hydropneumatyka](https://www.media.stellantis.com/it-it/citroen/press/paul-mages-il-professore-che-invento-le-sospensioni-idropneumatiche): gaz jako element sprężysty, membrana, przekazywanie ruchu przez płyn i zasada samopoziomowania.
- [Citroën Technical Training, module B7, ref. 6.2.304, June 2001 (PDF, kopia XM Club)](https://xmclub.nl/sites/default/files/Hydractive%20Citroen%20Official%20Training%20Manual.pdf): drukowane strony 5–7 o azocie, obciążeniu, wysokości i dołączaniu sfery; strony 19–21 o stanach soft/firm. Tekst dokumentu odczytany; screenshot PDF nie był dostępny w narzędziu przeglądania.

Nie ustalano rocznika, silnika, wyposażenia ani stanu technicznego egzemplarza ze zdjęcia.

## Model interaktywny

SVG i style znajdują się we wpisie; zachowanie w `js/xm-hydropneumatyka.js`.
Suwak dodaje 0–4 pasażerów po umowne 75 kg. Przełącznik porównuje działanie z korekcją
wysokości i bez niej; nie przedstawia fabrycznego trybu jazdy ani przełącznika Sport.
Po dołożeniu obciążenia nadwozie opada, po korekcji wraca do poziomu odniesienia.
Po odciążeniu schemat pokazuje odwrotny ruch. Azot przy zwiększonym obciążeniu pozostaje
bardziej sprężony także po wyrównaniu wysokości.

Skala i czas reakcji są poglądowe. Brak wyliczeń rzeczywistego prześwitu, ciśnień,
charakterystyki tłumienia czy zachowania konkretnej wersji XM-a.
Zmiany suwaka anulują poprzednie animacje i opóźnienia; reset przywraca stan początkowy.
Przy `prefers-reduced-motion: reduce` stan końcowy pojawia się bez animacji.
Bez JS artykuł i diagram pozostają widoczne, a nieaktywne kontrolki mają wyjaśnienie.

## Walidacja lokalna

- SEO: tytuł poniżej 60 znaków, opis 151 znaków, jeden H1, poprawne JSON-LD i daty,
  canonical, podgląd social, kafelek na początku bloga i wpis w sitemapie.
- Ścieżki względne `../`, lokalne zasoby i linki istnieją; menu i stopka zgodne
  z istniejącym wpisem. Zdjęcia mają alt i rzeczywiste proporcje width/height.
- `node --check js/xm-hydropneumatyka.js` i `git diff --check` przeszły.
- Chromium/Playwright: opadnięcie nadwozia, powrót do poziomu odniesienia, stan bez
  korekcji, szybkie zmiany suwaka i przełącznika, reset, klawiatura, reduced motion,
  brak JS, przejście z kafelka. Brak błędów JavaScript i lokalnych odpowiedzi 404.
- Szerokości 320, 390 i 768 px bez poziomego przepełnienia; wygląd sprawdzony
  na zrzutach desktop/mobile w `tools/out_xm_*.png` (gitignored).
- Podgląd HTTP na `http://127.0.0.1:4173/blog/citroen-xm-hydropneumatyka.html`: 200.

## Publikacja FTP — 2026-10-06

Wgrano poniższe 7 plików. Każdy pobrano ponownie przez FTP i porównano bajt po bajcie
z lokalnym — zgodność 7/7. Przed wgraniem zachowano poprzednie wersje dostępnych plików
oraz manifest w lokalnym, gitignored katalogu `tools/_xm_deploy_backup_20261006_110306/`.

Produkcja sprawdzona przez Chromium po HTTPS: odebrany HTML wpisu identyczny z lokalnym,
zdjęcie ładuje się, dołożenie 4 pasażerów i przełączenie korekcji działają,
widok 320 px bez poziomego przepełnienia. Nowy kafelek jest pierwszy na blogu,
przejście do wpisu ładuje działający skrypt. Brak błędów JS oraz odpowiedzi HTTP 4xx/5xx.

1. `blog/citroen-xm-hydropneumatyka.html`
2. `js/xm-hydropneumatyka.js`
3. `img/blog/citroen-xm-hydropneumatyka-800.webp`
4. `img/blog/citroen-xm-hydropneumatyka-1400.webp`
5. `img/blog/citroen-xm-hydropneumatyka-1400.jpg`
6. `blog.html`
7. `sitemap.xml`

Wspólny CSS nie został zmieniony; bez podbijania jego wersji na innych stronach.
Oryginałów zdjęć, `docs/`, `tools/` i plików Markdown nie wysyłać na FTP.
Pozostaje zgłoszenie URL w Google Search Console zgodnie z `docs/BLOG.md`.
