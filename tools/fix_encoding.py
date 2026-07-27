"""
Generator dane_klima.js z tools/dane_klima.json.

Źródłem danych o czynnikach klimatyzacji jest JSON leżący obok tego skryptu
(nie jest wysyłany na serwer). Strona klima.html ładuje wyłącznie wygenerowany
dane_klima.js z korzenia projektu — plik przypisuje dane do globalnej `acData`.

Skrypt leży w tools/, a pisze do korzenia projektu, więc ścieżki liczone są
od katalogu nadrzędnego, nie od katalogu wywołania.

Użycie:
    python tools/fix_encoding.py
"""

import json
import os

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(TOOLS_DIR)

SRC = os.path.join(TOOLS_DIR, "dane_klima.json")
DST = os.path.join(BASE_DIR, "dane_klima.js")

try:
    with open(SRC, "r", encoding="utf-8") as f:
        data = json.load(f)

    with open(DST, "w", encoding="utf-8") as f:
        f.write("const acData = \n")
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write(";")

    print(f"OK: {len(data)} rekordow -> {os.path.relpath(DST, BASE_DIR)}")
except Exception as e:
    print(f"Blad: {e}")
