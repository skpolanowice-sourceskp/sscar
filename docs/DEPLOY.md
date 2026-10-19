# Deploy na vh.pl (FTP) + weryfikacja produkcji

## Jak wgrać

```bash
python tools/ftp_upload.py index.html css/styles.css js/nav.js reservations/lib.php
```

Skrypt czyta dane z `.vscode/sftp.json` (host `ftp.vh16333.vh.net.pl`, remotePath `/`), zachowuje ścieżki,
zakłada brakujące katalogi, a każdy plik czyta z powrotem i porównuje bajt w bajt. Odmawia wgrania plików
spoza web rootu. **Nie pisz własnych skryptów FTP z hasłem w komendzie.**

## Zasady

- **Korzeń repo = web root.** Nie wgrywaj: `tools/`, `docs/`, `img/_src/`, `*.md`, `*.py`, `.vscode/`, `.git/`
  (lista `ignore` w `sftp.json`). `img/`, `css/`, `js/`, `blog/` wgrywaj.
- `reservations/config.php` żyje **tylko na serwerze** (gitignored) — nie nadpisuj.
- **Cache-busting:** `css/styles.css` ma cache 7 dni → po zmianie podbij `?v=YYYYMMDDx` na **wszystkich**
  stronach, które go ładują (+ `docs/blog-post-template.html`). Po zmianie `js/panel*.js`/`css/panel.css` →
  `?v=` w `panel.html`. Po zmianie `js/rezerwacja.js` → `?v=` w `rezerwacja.html`.
- **`.htaccess` w korzeniu serwera NIE ISTNIEJE.** Plik `htaccess` (bez kropki) w repo to szkic — Apache go nie czyta.
  Nie ma więc wymuszenia HTTPS ani przekierowań 301. Wgranie `.htaccess` to świadoma zmiana infrastruktury.
  `reservations/admin/.htaccess` istnieje i działa (allowlista endpointów).
- **Kasowanie plików z serwera:** nazwy spoza ASCII psuje .NET `FtpWebRequest` (550). Używaj `ftplib`
  z `encoding='utf-8'` (np. `ftp.delete(...)` w krótkim skrypcie korzystającym z `load_config()` z `tools/ftp_upload.py`).

## Weryfikacja produkcji

- **⚠️ HTTPS jest za ochroną antybotową hostingu:** klienci bez JS (curl, PowerShell, Python) dostają stronę
  `<title>Weryfikacja</title>` **z kodem 200**. Kod 200 ≠ treść. Sprawdzaj **zawartość**, najlepiej po
  `http://www.sscar.pl/...` (HTTP serwuje treść) albo w prawdziwej przeglądarce. Googlebot jest z challenge'u
  zwolniony — to nie jest problem indeksacji.
- Dla zmian wizualnych: obejrzyj stronę w przeglądarce (Chrome przez claude-in-chrome), łącznie z widokiem ~320 px.
- Po deployu dopisz stan wdrożenia do wpisu w `docs/CHANGELOG.md`.
