# SEO, indeksacja, struktura URL

Czytaj przy dodawaniu/przenoszeniu podstron, zmianach w nawigacji, sitemapie i danych strukturalnych.
Historia diagnozy: `docs/CHANGELOG.md`, wpisy 2026-08-04 (a–e). Dane z GSC: `docs/dane_google/`.

## Najważniejsze ustalenia

- **Sitemapa nie wystarcza do indeksacji.** W sierpniu 2026 11 z 12 stron miało status „wykryta – obecnie
  niezindeksowana", mimo że były w `sitemap.xml`. Realnym sygnałem są **linki wewnętrzne**. Stąd `.footer-nav`
  (sitewide mapa linków w stopce), sekcja „Nasze usługi" na `index.html` i bloki „Zobacz też" na podstronach.
- **Nowa podstrona =** link w górnym menu i w stopce na każdej stronie (reguła w `CLAUDE.md`) + wpis
  w `sitemap.xml` + po deployu w GSC „Sprawdzenie adresu URL" → **„Poproś o zaindeksowanie"**.
- **Brak 301.** Na serwerze nie ma `.htaccess`, więc zaindeksowanych stron **nie przenosimy**. Podstrony
  usługowe zostają płasko w korzeniu. Jeśli adres trzeba zmienić, stary plik zostaje jako `meta refresh 0`
  + `canonical` na nowy (tak zrobiono z `blog-geometria-kol-na-golej-ramie.html`).
- **Katalogi działają i nie wystawiają listingu**, o ile mają `index.html` (zmierzone 2026-09-17 na `/blog/`).
- `http://` i `https://` serwują tę samą treść (brak przekierowania) — łagodzi to `canonical` na `https://www.sscar.pl/...`.
- Challenge antybotowy na HTTPS nie blokuje Googlebota (dowód z GSC), ale blokuje narzędzia SEO firm trzecich.

## Dane strukturalne

- `index.html` i `o-nas.html` mają `openingHoursSpecification` — przy zmianie godzin aktualizuj razem z tekstem.
- `badania-techniczne.html` ma `FAQPage` — tekst 1:1 z treścią widoczną na stronie.
- **Bez `aggregateRating`** (ocena pochodzi z Google — oznaczanie cudzych opinii łamie wytyczne).
- Dane strukturalne opisują tylko treść widoczną na danej stronie.

## Fakty firmowe (używać zamiast ogólników)

- Stacja **DW/126/P**, ul. Polanowicka 82, 51-180 Wrocław, uruchomiona **2024**.
- Godziny: **pon.–śr. 7:00–19:00, czw.–pt. 7:00–20:00, sob. 8:00–14:00** (od 2026-10-19).
- Telefony: SKP **796 995 620**, opony **609 995 620** (`rodo.html` celowo ma 609 jako kontakt — nie ujednolicać).
- Diagności (**dwóch** — nie dopisywać trzeciego z rejestru BIP): **Sebastian Stefanik** (`DWR/D/0046`, od 2017,
  badania + klimatyzacja), **Michał Jarosiński** (`DW/D/0249`, od 2022, badania + geometria).
- Geometria: **HANWAY HWAV28**. Zakres badań: okresowe, motocykle, LPG, haki, powypadkowe — **bez przyczep
  i zabytkowych**. Orły Motoryzacji 2025 i 2026, Złoty Medal 2025, ~4,9/5 z ~258 opinii Google.
- Administrator danych (RODO): Sebastian Stefanik, ul. Jagodowa 12, 55-003 Nadolice Małe, NIP 8992532559.

## Treść

- Post z Facebooka to materiał źródłowy, nie wpis — przepisany 1:1 jest thin contentem. Procedura: `docs/BLOG.md`.
- Hierarchia nagłówków h1→h2→h3 bez przeskoków. Globalne style `h2` trzeba zdejmować w komponentach (`docs/FRONTEND.md`).
