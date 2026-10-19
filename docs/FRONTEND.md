# Witryna statyczna — konwencje, CSS, obrazy, pułapki

Czytaj przy zmianach w `*.html`, `css/styles.css`, `js/nav.js` i zdjęciach. Marka i design: `PRODUCT.md`, `DESIGN.md`.
Symulator geometrii: `docs/GEOMETRIA-3D.md`. Blog: `docs/BLOG.md`.

## Struktura

- Strony usługowe `.html` **płasko w korzeniu** (zaindeksowane URL-e, brak 301 — patrz `docs/SEO.md`).
- `css/styles.css` — wspólny, cache 7 dni (bump `?v=` na wszystkich stronach). Bez stylów panelu.
- Style jednej strony trzymamy **inline w tej stronie** z prefiksem (`dec-` w `dekoder.html`, `secnav-`/`geo-`
  w `geometria-3d.html`, `xm-` we wpisie XM) — wtedy nie trzeba bumpować `?v=` na całym serwisie.
- `js/nav.js` (menu mobilne), `js/reviews_data.js`, `js/dane_klima.js` (**generowany** przez
  `tools/fix_encoding.py` z `tools/dane_klima.json` — nie edytować ręcznie).
- `Logo-SSCAR.png` i `favicon.png` **muszą zostać w korzeniu** (bezwzględne `og:image` na podstronach).
- `robots.txt`, `sitemap.xml`, `google79c7a3b6a6e8553f.html` (weryfikacja GSC) — nie usuwać.
- Hero `index.html` to czysty `<picture>` (`img/hero-stacja-*`), bez JS. Kadr `object-position` (desktop `57% 42%`,
  mobile `63% 45%`) jest wyliczony pod szyld — nie zmieniać bez przeliczenia. Logo w hero zostaje czerwone (decyzja właściciela).

## Obrazy

- Oryginały w `img/_src/` (nie na serwer), warianty w `img/` przez `python tools/optimize_images.py`
  (800/1400/2200 webp + jpg 1400 fallback; slugi ASCII). Listy w skrypcie: `SOURCES`, `HERO_SOURCES`
  (przycina dolny pas z podpisem), `THUMB_SOURCES` (tylko -800), `SCREEN_SOURCES` (zrzuty ekranu 800/1200 —
  inaczej brak `.jpg` dla `og:image`). Slug może mieć podkatalog (`"blog/<slug>"`). `--auto` przerabia nowe pliki.

## Pułapki CSS/HTML (każda kosztowała już czas)

1. **Kolejność źródła wygrywa z media query.** Media query nie podnosi specyficzności — poprawka musi stać **po**
   bazowej regule. Nowe bloki i poprawki responsywne dopisuj **na końcu `styles.css`**.
2. **Ta sama specyficzność:** `.blok strong` na końcu pliku przykryje np. `.tip-box strong`. Pisz jawnie
   `.blok .tip-box strong`.
3. **Globalne `h2`** ma `text-align:center`, `margin-bottom:4rem` i czerwoną kreskę `h2::after`. W komponentach
   zdejmuj jawnie (`::after { content: none }`, margin, align). Zamiana `span`/`h3`→`h2` bez tego psuje układ.
   Zamieniając poziom nagłówka, używaj regexa parami, nie dwóch osobnych `replace`.
4. **Sekcja w sekcji** łapie globalne `section { padding: 7rem 5% }` — nadpisuj cały `padding`.
5. **Grid z treścią inline:** w `display:grid` każdy `<strong>`/`<a>` staje się osobnym itemem → tekst łamie się
   po słowie. Markery list rób przez `position:absolute` + `padding-left`, nie grid/flex.
6. **`min-width: auto` w gridzie:** długi link rozpycha kolumnę. Dawaj `min-width: 0` na itemach;
   `repeat(N, minmax(0,1fr))` zamiast `auto-fit` gdy liczba kolumn jest znana.
7. **Atrybut `height` na `<img>` działa jak CSS `height`** i zabija `aspect-ratio` — dopisz `height: auto`.
8. **`position: sticky` nie działa**, bo `html, body` mają `overflow-x: hidden`. Na stronie ze sticky dodaj
   `html, body { overflow-x: clip; }`.
9. **`[hidden]` przegrywa z autorskim `display`** — dopisz `.x[hidden] { display: none }`.
10. **Mobile: `h2` + `.section-subtitle`** — korekta ujemnego marginesu musi być na końcu pliku (pkt 1).
11. **Font Awesome 6.0.0 FREE** — ikony Pro (`fa-steering-wheel`, `fa-tire`) renderują pustkę bez błędu. Sprawdzenie:
    ```bash
    curl -s -o "$TMP/fa.css" https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css
    for i in $(grep -rho 'fa-[a-z0-9-]*' *.html blog/*.html | sort -u); do grep -q "\.$i:" "$TMP/fa.css" || echo "$i"; done
    ```
    (`fa-lg`, `fa-spin` to fałszywe alarmy.) Nie zostawiaj `fa.css` w korzeniu repo.
12. **Nagłówek 769–1200 px** ma osobne breakpointy (mniejsze logo i font) — menu z 8 pozycjami inaczej się nie mieści.
13. **`meta description`** bywa rozbite na dwie linie (`index.html`, `dekoder.html`) — jednoliniowy grep daje fałszywy negatyw.
14. **`prefers-reduced-motion`** — `.animate-on-scroll` ma guard; nowe animacje też muszą go mieć.

## Zasady redakcyjne (decyzje właściciela)

- `o-nas.html`: dowody zamiast deklaracji. **Nie dublować** listy usług/sprzętu (`oferta.html`, `cennik.html`)
  ani etapów sprawdzenia przed zakupem. Rejestr pojazdów: `.spec-list` tylko przy twardych danych.
- `dekoder.html`: większość „dekoderów VIN" podaje **rok modelowy**, nie datę produkcji. PartSouq działa dla marek
  JP/KR (`Production Date`), nie dla europejskich. 7zap usunięty. Nie linkować ORGA/DAM ani NHTSA vPIC (dublują nasz dekoder).
- `rodo.html`: opisuje rzeczywisty przepływ danych (pola z `book.php`, Google Calendar, blokady numerów). Zmiana
  przepływu danych w rezerwacji = aktualizacja `rodo.html`. Checkbox w rezerwacji to potwierdzenie zapoznania się,
  **nie zgoda** (podstawa: art. 6 ust. 1 lit. b).
- Stopka: kredyt `p.footer-credit` z linkiem www.m-jaro.pl w kolorach CMYK — na wszystkich stronach.
