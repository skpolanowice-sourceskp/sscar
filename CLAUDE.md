# CLAUDE.md — przewodnik po projekcie SSCAR

Krótka mapa projektu. **Szczegóły są w `docs/` — czytaj tylko plik dotyczący zadania** (tabela niżej).
Marka i design: `PRODUCT.md`, `DESIGN.md`. Stan na: **2026-10-19**.

## Czym jest projekt

Strona stacji kontroli pojazdów **SSCAR** (Wrocław, ul. Polanowicka 82, stacja **DW/126/P**). Trzy warstwy w jednym repo:

1. **Witryna statyczna** — HTML w korzeniu + wspólny `css/styles.css`, blog w `blog/`.
2. **Rezerwacja online** — `rezerwacja.html` + `js/rezerwacja.js` → PHP w `reservations/`.
3. **Panel admina** — `panel.html` + `js/panel*.js` + `css/panel.css` → PHP w `reservations/admin/`.

Źródło prawdy grafiku = **Google Calendar**; MySQL trzyma rezerwacje, klientów, pojazdy i blokady numerów.

## Gdzie szukać szczegółów

| Zadanie | Czytaj |
|---|---|
| Strony, CSS, zdjęcia, ikony, pułapki CSS | `docs/FRONTEND.md` |
| Rezerwacja, panel, endpointy PHP, baza, kalendarz | `docs/PANEL.md` (+ skill `sscar-baza-klientow`) |
| Wgrywanie na serwer, weryfikacja produkcji | `docs/DEPLOY.md` |
| Nowa podstrona, sitemap, schema.org, fakty firmowe | `docs/SEO.md` |
| Nowy wpis na bloga | `docs/BLOG.md` (+ `docs/blog-post-template.html`) |
| `geometria-3d.html` (symulator WebGL) | `docs/GEOMETRIA-3D.md` |
| „Dlaczego tak jest?” — historia decyzji | `docs/CHANGELOG.md` (grep po dacie/nazwie pliku, nie czytaj całego) |
| Wdrożenie rezerwacji od zera | `docs/README-rezerwacja-setup.md` |

## Stack i twarde ograniczenia

- **Czysty PHP bez Composera** (hosting współdzielony vh.pl). **Brak PHP lokalnie** — `php -l` nie działa, czytaj kod.
- **Vanilla JS** w IIFE, rejestrowane na `window.*`. Bez frameworków i bibliotek (wyjątek: Font Awesome 6.0.0 Free z CDN).
- **Windows** lokalnie; PowerShell i Git Bash. Python dostępny (narzędzia w `tools/`).
- **Sekrety:** `reservations/config.php` gitignored, żyje tylko na serwerze. Hasła FTP/admina nigdy w komendzie.
- **⚠️ PDO musi mieć `ATTR_EMULATE_PREPARES => true`** (`rez_db()` w `lib.php`). Proxy MySQL na vh.pl psuje protokół
  binarny: zapisy działają, każdy `SELECT` zwraca 0/śmieci. Nie bindować `LIMIT ?` — literały. Więcej: `docs/PANEL.md`.

## Układ repo

- **Korzeń = web root** — leży w nim tylko to, co idzie na serwer. Poza deployem: `tools/` (skrypty),
  `docs/` (dokumentacja), `img/_src/` (oryginały zdjęć), `*.md`.
- Strony `.html` usługowe **płasko w korzeniu** — zaindeksowane URL-e, na serwerze nie ma `.htaccess`, więc nie ma 301.
  Nie przenosić. Blog: hub `blog.html` w korzeniu, wpisy w `blog/<slug>.html`, zdjęcia w `img/blog/`.
- Assety: `css/` (`styles.css`, `panel.css`), `js/`, `img/`. `Logo-SSCAR.png` i `favicon.png` zostają w korzeniu.
- `htaccess` (bez kropki) = szkic, **nie** działająca konfiguracja serwera.

## Reguły, które łamano najczęściej

1. **Nawigacja identyczna na wszystkich stronach — header i stopka.** Nowa podstrona = link w `nav#nav-menu`
   (`<li><a href="X.html" class="nav-link">`, klasa obowiązkowa dla `nav.js`) **i** w `.footer-nav`.
   Bieżąca strona: `class="nav-link active"` w headerze, `aria-current="page"` w stopce. Przy `sed` rozróżniaj
   header (ma `class="nav-link`) od stopki. Kontrola (nic nie wypisze):
   ```bash
   for f in *.html; do grep -q 'id="nav-menu"' "$f" || continue
     h=$(awk '/<nav id="nav-menu">/,/<\/nav>/' "$f" | grep -c '<li>')
     s=$(awk '/<nav class="footer-nav"/,/<\/nav>/' "$f" | grep -c '<li>')
     [ "$h" -eq 8 ] && [ "$s" -eq 15 ] || echo "$f: header=$h stopka=$s"
   done
   ```
   (8 i 15 — stan na 2026-09-16; aktualizuj przy nowej pozycji.)
2. **Wpisy bloga leżą o poziom niżej — każda ścieżka względna z `../`.** Kontrola (nic nie wypisze):
   `grep -oh '\(href\|src\)="[^"]*"' blog/*.html | grep -v '="\(\.\./\|https\?:\|tel:\|mailto:\|#\)'`
3. **Cache-busting `?v=YYYYMMDDx`:** `styles.css` → wszystkie strony + szablon wpisu; `panel*` → `panel.html`;
   `rezerwacja.js` → `rezerwacja.html`.
4. **Godziny pracy są w kilku miejscach:** `REZ_HOURS` (`reservations/lib.php`), `HOURS` (`js/rezerwacja.js`),
   tekst + schema.org na `index.html`, `o-nas.html`, `oferta.html`. Zmieniaj wszystkie naraz.
5. **Nowe reguły CSS na końcu `styles.css`** (media query nie podnosi specyficzności). Lista pułapek: `docs/FRONTEND.md`.
6. **Kod 200 z HTTPS nie znaczy, że serwer zwrócił treść** — hosting serwuje challenge „Weryfikacja”. Sprawdzaj zawartość.

## Deploy

```bash
python tools/ftp_upload.py <ścieżki względem korzenia>
```
Wgrywa przez FTP z `.vscode/sftp.json`, weryfikuje każdy plik odczytem, odrzuca pliki spoza web rootu.
Szczegóły i weryfikacja produkcji: `docs/DEPLOY.md`.

## Utrzymanie dokumentacji

- Po zmianie architektury, kontraktu danych, przepływu lub konwencji: **krótki wpis (3–8 linii) na górze
  `docs/CHANGELOG.md`** z datą bezwzględną i stanem wdrożenia, a trwałą zasadę dopisz do właściwego pliku w `docs/`.
- `CLAUDE.md` trzymaj krótkim (~120 linii): tylko mapa, twarde ograniczenia i reguły ogólnoprojektowe.
  Długich opisów, historii i diagnoz tu nie dopisuj.
