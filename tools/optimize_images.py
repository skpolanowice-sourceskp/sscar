"""
Generator wariantów responsywnych dla zdjęć SSCAR.

Dla każdego pliku źródłowego tworzy w katalogu img/:
  <slug>-800.webp, <slug>-1400.webp, <slug>-2200.webp   (srcset)
  <slug>-1400.jpg                                        (fallback dla <img>)

Nazwy wyjściowe są czysto ASCII — pliki źródłowe mają w nazwach polskie znaki
("przód"), które psuły się przy wysyłce FTP i wymagały kodowania URL w HTML-u.

Użycie:
    python tools/optimize_images.py

Nowe zdjęcia (portrety, hala, kolejne auta): wrzuć plik do img/_src/ i dopisz
wpis do listy SOURCES poniżej — albo uruchom z flagą --auto, żeby przerobić
wszystko z img/_src/ ze slugiem z nazwy pliku.

Skrypt leży w tools/, a czyta i pisze do katalogów w korzeniu projektu
(img/_src/ -> img/), więc ścieżki liczone są od katalogu nadrzędnego.
"""

import os
import re
import sys
import unicodedata

from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE_DIR, "img")
SRC_DIR = os.path.join(OUT_DIR, "_src")

WIDTHS = [800, 1400, 2200]
FALLBACK_WIDTH = 1400
WEBP_QUALITY = 78
JPEG_QUALITY = 82

# (plik źródłowy w img/_src/, slug wyjściowy)
SOURCES = [
    ("BMW-M3-F.jpg", "m3"),
    ("Gt-63-S-przód.jpg", "amg-gt63s"),
    ("drift-bober-przód.jpg", "drift-bober"),
    ("eclipse-przód.jpg", "eclipse"),
    ("Maverick-przód.jpg", "maverick"),
    ("mandaryna-bok-1.jpg", "chevrolet-3100"),
    # Hero index.html – budynek stacji o świcie. Oryginał ma 1537 px szerokości,
    # więc wariant 2200 zostanie pominięty (nie powiększamy).
    ("stacja-sscar.png", "hero-stacja"),
]

# Warianty hero: (plik źródłowy, slug, ile procent wysokości zostawić od góry).
# Zdjęcia mają wypalony w dolnym pasie podpis (marka, rocznik, moc + logo SKP).
# Na pełnoekranowym hero ten podpis przebija zza nagłówka i dubluje dane
# z rejestru, więc dolny pas jest tu odcinany. W rejestrze zostaje nienaruszony.
HERO_SOURCES = [
    ("BMW-M3-F.jpg", "hero-m3", 0.66),
]

HERO_WIDTHS = [1200, 1900, 2600]


def slugify(name):
    """Nazwa pliku -> bezpieczny slug ASCII (ą->a, spacje->myślniki)."""
    stem = os.path.splitext(os.path.basename(name))[0]
    stem = stem.replace("ł", "l").replace("Ł", "L")
    stem = unicodedata.normalize("NFKD", stem)
    stem = stem.encode("ascii", "ignore").decode("ascii")
    stem = re.sub(r"[^a-zA-Z0-9]+", "-", stem).strip("-").lower()
    return stem or "img"


def variants(src_path, slug):
    """Zapisuje warianty szerokości. Zwraca (zapisane_bajty, pominięte)."""
    written = 0
    skipped = 0

    with Image.open(src_path) as img:
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        for width in WIDTHS:
            if img.width < width and width != WIDTHS[0]:
                # nie powiększamy — pomijamy warianty szersze niż oryginał
                skipped += 1
                continue

            target_w = min(width, img.width)
            target_h = round(img.height * target_w / img.width)
            resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

            webp_path = os.path.join(OUT_DIR, f"{slug}-{width}.webp")
            resized.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
            written += os.path.getsize(webp_path)

            if width == FALLBACK_WIDTH:
                jpg_path = os.path.join(OUT_DIR, f"{slug}-{width}.jpg")
                resized.save(jpg_path, "JPEG", quality=JPEG_QUALITY,
                             optimize=True, progressive=True)
                written += os.path.getsize(jpg_path)

    return written, skipped


def hero_variants(src_path, slug, keep_top):
    """Kadr hero: odcina dolny pas z wypalonym podpisem, potem skaluje."""
    written = 0

    with Image.open(src_path) as img:
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        cropped = img.crop((0, 0, img.width, round(img.height * keep_top)))

        for width in HERO_WIDTHS:
            target_w = min(width, cropped.width)
            target_h = round(cropped.height * target_w / cropped.width)
            resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

            webp_path = os.path.join(OUT_DIR, f"{slug}-{width}.webp")
            resized.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
            written += os.path.getsize(webp_path)

            if width == HERO_WIDTHS[1]:
                jpg_path = os.path.join(OUT_DIR, f"{slug}-{width}.jpg")
                resized.save(jpg_path, "JPEG", quality=JPEG_QUALITY,
                             optimize=True, progressive=True)
                written += os.path.getsize(jpg_path)

        return written, cropped.width, cropped.height


def collect():
    """Buduje listę (ścieżka, slug) z SOURCES oraz opcjonalnie z img/_src/."""
    jobs = []

    for filename, slug in SOURCES:
        path = os.path.join(SRC_DIR, filename)
        if os.path.exists(path):
            jobs.append((path, slug))
        else:
            print(f"  pominięto (brak pliku): {filename}")

    if "--auto" in sys.argv and os.path.isdir(SRC_DIR):
        known = {slug for _, slug in SOURCES}
        # Pliki z SOURCES leżą w tym samym katalogu, ale ich slug jest ręczny
        # ("BMW-M3-F.jpg" -> "m3"), więc po samym slugu ich nie rozpoznamy —
        # bez tego zbioru --auto przerobiłby je drugi raz jako "bmw-m3-f-*".
        # Porównujemy nazwę bez rozszerzenia, bo obok oryginałów leżą jeszcze
        # stare, ręczne konwersje .webp tych samych zdjęć.
        def stem(name):
            return os.path.splitext(os.path.basename(name))[0].lower()

        handled = {stem(name) for name, _ in SOURCES}
        handled |= {stem(name) for name, _, _ in HERO_SOURCES}
        for filename in sorted(os.listdir(SRC_DIR)):
            if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                continue
            if stem(filename) in handled:
                continue
            slug = slugify(filename)
            if slug in known:
                continue
            jobs.append((os.path.join(SRC_DIR, filename), slug))
            known.add(slug)

    return jobs


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    jobs = collect()
    if not jobs:
        print("Brak plików do przetworzenia.")
        return

    print(f"Generuję warianty {WIDTHS} do {OUT_DIR}\n")

    total_src = 0
    total_out = 0

    for src_path, slug in jobs:
        try:
            src_size = os.path.getsize(src_path)
            written, skipped = variants(src_path, slug)
        except Exception as exc:
            print(f"  BŁĄD {os.path.basename(src_path)}: {exc}")
            continue

        total_src += src_size
        total_out += written
        note = f" ({skipped} wariant(y) pominięte — oryginał za mały)" if skipped else ""
        print(f"  {os.path.basename(src_path)} -> {slug}-*"
              f"  {src_size/1024/1024:.2f}MB -> {written/1024/1024:.2f}MB{note}")

    for filename, slug, keep_top in HERO_SOURCES:
        src_path = os.path.join(SRC_DIR, filename)
        if not os.path.exists(src_path):
            print(f"  pominięto hero (brak pliku): {filename}")
            continue
        try:
            written, w, h = hero_variants(src_path, slug, keep_top)
        except Exception as exc:
            print(f"  BŁĄD hero {filename}: {exc}")
            continue
        total_out += written
        print(f"  {filename} -> {slug}-*  kadr {w}x{h}"
              f" (górne {keep_top:.0%})  {written/1024/1024:.2f}MB")

    if total_src:
        print(f"\nŹródła: {total_src/1024/1024:.2f}MB"
              f"  ->  warianty razem: {total_out/1024/1024:.2f}MB")
        print(f"Największy pojedynczy plik wysyłany do przeglądarki to wariant 800 "
              f"— przeciętnie ~{total_out/len(jobs)/len(WIDTHS)/1024:.0f}KB.")


if __name__ == "__main__":
    main()
