# Laboratorium geometrii 3D (`geometria-3d.html`)

Czytaj przed każdą zmianą symulatora geometrii. Całość (CSS + JS) jest **inline** w `geometria-3d.html`;
`css/styles.css` i `js/` nie biorą w tym udziału.

> **Stan obecny:** renderer WebGL z 2026-09-17 (sekcja 1). Sekcja 2 opisuje wcześniejszy rasteryzator 2D —
> **model liczbowy, układ współrzędnych, oś sworznia i model zużycia nadal obowiązują**; obejścia typowo
> rendererowe 2D (sortowanie malarzem, pełna tarcza felgi, `tools/canvas_*`) dotyczą historii.

## 1. Renderer WebGL (2026-09-17)

- **2026-09-17** — **Nowy model WebGL w `geometria-3d.html`**, zaakceptowany przez właściciela.
  Proceduralne siatki: opona z przestrzennym bieżnikiem i napisami, dzielone ramiona felgi,
  nawiercana tarcza hamulcowa, czerwony zacisk, amortyzator, sprężyna i wahacz. Materiały,
  oświetlenie studyjne i mapa cieni; bez bibliotek, zewnętrznych modeli i tekstur.
  `createWheelRenderer()` tworzy `.geo-webgl` pod oryginalnym canvasem adnotacji.
  Suwaki, wykres, treści i model liczbowy zachowane; oryginalny profil `PROF` służy teraz
  wyłącznie obliczeniom kontaktu/kinematyki. Kadrowanie mobilne uwzględnia pasek HUD.
  Całość nadal inline; `css/styles.css` i `js/` bez zmian. Kopia robocza
  `geometria-3d-laboratorium.html` usunięta po przeniesieniu zaakceptowanej wersji.
  **Weryfikacja:** Chromium/WebGL, 320–1440 px, wszystkie suwaki i kamery, obrót,
  5 przykładów zużycia, reset, klawiatura, reduced motion, utrata/odtworzenie kontekstu
  WebGL i fallback bez WebGL. Wyniki liczbowe porównane z poprzednią wersją dla nastaw
  minimalnych, maksymalnych i bazowych. Testy telefonu to emulacja viewportu, nie fizyczny telefon.
  **Ważne:** poniższe historyczne obejścia rasteryzatora 2D (pełna tarcza felgi, sortowanie
  prymitywów malarzem) nie dotyczą nowego renderera — przesłanianie rozstrzyga bufor głębokości.
  Atrapa `tools/canvas_harness.js` nie weryfikuje nowej sceny WebGL; używać prawdziwej przeglądarki.
  **Stan: WDROŻONE przez FTP 2026-09-17.** Odczyt FTP i publiczny HTML identyczne z plikiem
  lokalnym; renderowanie produkcyjne sprawdzone w Chromium bez błędów JS/WebGL. Hosting może
  zwracać klientom HTTP stronę „Weryfikacja” — weryfikacja w przeglądarce przeszła poprawnie.

## 2. Model, układ współrzędnych i pułapki (2026-09-16, wersja 2D)

- **2026-09-16 (d)** — **`geometria-3d.html`: laboratorium geometrii przepisane od zera na
  JEDEN model 3D. Stara sekcja (3 osobne canvasy 2D + 4 kafelki „wzorców zużycia") usunięta.**
  **Dlaczego w ogóle:** poprzednia wersja rysowała camber, toe i caster jako **trzy niezależne
  obrazki 2D**, więc nie dało się z niej odczytać tego, co w tych kątach najważniejsze: że to
  **trzy obroty tej samej bryły** i że one na siebie działają. Pasek „zużycie opony" był pięcioma
  `<div>`-ami przypisywanymi drabinką `if/else`, a kafelki wzorców — czerwonymi prostokątami,
  których nikt nie rozszyfruje.
  **Co jest teraz:** jedno koło w 3D (własny rasteryzator na `<canvas>`, bez bibliotek — zgodnie
  z zasadą „bez zależności"), pięć suwaków (camber, zbieżność, caster, **skręt koła**,
  **ciśnienie**), odczyt odcisku opony i pięć mierników skutków. Całość **inline w `geometria-3d.html`**
  (precedens `dekoder.html`), więc `css/styles.css` NIETKNIĘTE — **żadnego bumpu `?v=` na 16 stronach**.

  **⚠️ UKŁAD WSPÓŁRZĘDNYCH — przeczytaj przed jakąkolwiek zmianą w tym kodzie.**
  Prawoskrętny: **X+ = na zewnątrz auta, Y+ = w górę, Z+ = kierunek jazdy**. Koło przednie lewe,
  punkt styku w (0,0,0), środek koła w (0,R,0). Stąd wynikają znaki, które łatwo pomylić:
  camber = `rotZ(-γ)`, zbieżność = `rotY(-τ)`, oś sworznia `d = [-cos ε·sin λ, cos ε·cos λ, -sin ε]`
  (ε = caster, λ = SAI). **⚠️ Oś sworznia NIE przechodzi przez środek koła** — mija go od wewnątrz
  o `KP_OFF = R·tan(SAI)` (86 mm), czyli tyle, żeby trafiała w jezdnię **w punkcie styku**
  (zerowy promień zataczania, jak w dzisiejszych autach). Dlatego skręt obraca koło wokół
  **PROSTEJ, nie wokół punktu**: do macierzy dochodzi przesunięcie `T = A − Rskręt·A` dla
  `A = (−KP_OFF, 0, 0)`. Skręt =
  obrót **wokół tej osi** o `-δ`. Składanie: `M = Rskręt · Rcamber · Rtoe`. Dzięki temu przyrost
  camberu i **podnoszenie nadwozia przy skręcaniu wychodzą same z macierzy** — nic tego nie udaje.
  Podnoszenie liczymy jako różnicę najniższego punktu bieżnika względem tej samej bryły **bez
  skrętu** (inaczej przerysowanie kątów zafałszowałoby milimetry).

  **⚠️ KĄTY W MODELU SĄ PRZERYSOWANE, LICZBY NIE.** `EX_CAMBER = 2.6`, `EX_TOE = 28`.
  Prawdziwy camber to 1–3°, a zbieżność 0,2° na koło — w bryle byłyby **niewidzialne** (pierwsza
  wersja remastera nie miała przerysowania i koło wyglądało na idealnie proste). Mnożnik działa
  **wyłącznie na macierz obrotu**; każdy odczyt (HUD, suwaki, werdykt, wyprzedzenie, przebieg)
  liczony jest z wartości rzeczywistych. Jest o tym zdanie w panelu — nie usuwać go.

  **Model zużycia (zastępuje drabinkę `if/else`):** rozkład nacisku po szerokości bieżnika
  `load(u) = (1 + 0,85·Δbar·(1−2u²)) · (1 − 0,30·camber·u)`, **normalizowany do stałej sumy**
  (ciężar auta się nie zmienia, zmienia się tylko jego rozkład), ścieranie `load^1,3` plus tarcie
  boczne od zbieżności. Trwałość = `50 000 km / max(w)`, bo oponę wymienia się przez **najbardziej
  zużyty pas**, nie przez średnią. Wychodzą liczby zgodne z praktyką: fabryka 44 000 km,
  camber −2,4° → 25 000, zbieżność +4,2 mm → 24 000, ciśnienie 1,5 bar → 19 000.

  **Lista wzorców bieżnika** (`.dx-list`) to numerowana lista ze zdjęciami, a nie siatka
  identycznych kart (`DESIGN.md` tego zakazuje). Każda pozycja ma przycisk **„Odtwórz"**, który
  **ustawia suwaki symulatora** — obie połowy sekcji są połączone, zamiast stać obok siebie.
  Przy okazji zniknęło `border-left: 3px` z `.geo-fact` (zakazany pasek boczny) i `Segoe UI`
  z etykiet canvasu (jest Barlow Condensed).

  **⚠️ PUŁAPKI, KTÓRE KOSZTOWAŁY NAJWIĘCEJ CZASU — nie powtarzać:**
  1. **⚠️ NAJDROŻSZY BŁĄD TEJ SEKCJI: felga musi być PEŁNĄ TARCZĄ w jednej płaszczyźnie.**
     Prześwity między ramionami były najpierw udawane osobną płaszczyzną na innej głębokości
     (stała `XD`), a ta płaszczyzna ich nie zakrywała — w kole były więc **prawdziwe dziury**
     i przez nie było widać sprężynę kolumny stojącą ZA kołem (zgłoszone ze zrzutu z przeglądarki).
     **Trop, który prowadzi donikąd:** sprężyna rysuje się WCZEŚNIEJ niż ściany (sprawdzone po
     indeksach w `ops.json`), więc „kolejność rysowania jest dobra" i wygląda na to, że błędu nie ma.
     Błąd nie siedzi w kolejności, tylko w SIATCE. **Test, który rozstrzyga to w 30 sekund:**
     wyrenderuj **same ściany na jaskrawej magencie** — dziury widać natychmiast.
     Teraz wszystkie pasma felgi (`cap`/`hub`/`spoke`/`lip`) leżą w jednej płaszczyźnie `XR`,
     prześwit to wyłącznie ciemniejszy kolor, a rant sięga 0,638, czyli **za stopkę opony (0,620)**,
     żeby na styku dwóch sąsiadujących wielokątów nie została włosowa szczelina.
  2. **⚠️ DRUGI NAJDROŻSZY: kolumna McPhersona NIE MOŻE być rysowana niżej niż górna krawędź opony.**
     Oś sworznia przechodzi przez środek koła, czyli leży w płaszczyźnie `x = 0` — a opona tę samą
     płaszczyznę **zajmuje**. Kolumna (a zwłaszcza gruba sprężyna) rysowana na całej długości jest
     więc **współpłaszczyznowa z gumą**: siedzi w środku opony i sortowanie głębokością nie ma tam
     czego rozstrzygać, bo oba obiekty są w tym samym miejscu. Raz wychodzi przed oponę, raz za nią.
     **Żadna poprawka w kolejności rysowania tego nie naprawi, bo to błąd GEOMETRII, nie renderingu.**
     Rozwiązanie jest takie, jak w prawdziwym aucie: widać wyłącznie to, co wystaje **ponad koło**,
     reszta siedzi w nadkolu. `buildStrut()` liczy więc punkt przebicia górą opony
     (`tOut = (R - 0,02) / kpDir[1]`) i zaczyna rysować dopiero tam. Z tego samego powodu `kpBot`
     (dolny przegub) musi zostać **w obrębie felgi** (0,52 od środka, przy 0,72 siedział w gumie).
     W widoku z góry kolumna jest **chowana w całości** (`cam.pitch < 1.15`), bo patrzymy wtedy
     wzdłuż jej osi i sprężyna rzutuje się na kółka leżące dokładnie na bieżniku.
  3. **⚠️ TRZECI: sprężyna to nie oś — zwoje wracają w dół, ku oponie.**
     Kolumna zaczynała się nad oponą (pułapka 2), ale sama **sprężyna** startowała
     „12% drogi od korpusu do górnego mocowania" — ułamkiem, który nie wie nic o oponie.
     Zwój odchyla się od osi o `rad`, więc jego najniższy punkt leży o ~0,34·`rad` bliżej
     opony niż oś; przy 10-centymetrowym zapasie osi zostawało go **8 mm** dla zwoju
     i w widoku z przodu sprężyna kładła się na górnej krawędzi bieżnika.
     **Zapamiętaj: każdy element rysowany wokół osi liczy się od SWOJEJ obwiedni, nie od osi.**
     Teraz start liczy `axisPt((R + rad*0.34 + 0.09) / dyz)` — promieniowo (`dyz` = rzut osi
     na płaszczyznę koła), bo opona to walec, a oś jest pochylona o caster i SAI.
     **Jak to sprawdzić bez przeglądarki (test niezależny od rendera):** przenieś punkty
     sprężyny do układu KOŁA (`q = Mᵀ·(p − środek)`) i sprawdź walec `|q.x| ≤ 0,306`,
     `√(q.y²+q.z²) ≤ 1,002`, przemiatając wszystkie suwaki. Dla obecnych wartości najmniejszy
     luz wychodzi **+0,109 R ≈ 35 mm** (najgorzej: camber +2°, zbieżność −5 mm, skręt 17°);
     przed poprawką było **+0,024 R ≈ 8 mm**, czyli formalnie „nie w oponie", a mimo to
     w rzucie nie do odróżnienia od kolizji. **Sam brak przecięcia w 3D NIE wystarcza — liczy
     się luz, który widać w rzucie.** Przy okazji: górne mocowanie poszło z `1,42` na
     `KP_TOP_T = 1,52` (miejsce na sprężynę), a `CY` z `0,645·h` na `0,672·h`, bo przy 1,52
     kulka mocowania wychodziła poza górną krawędź canvasu w widoku castera (zmierzone
     na `ops.json`: y = −8,5 px).
  4. **⚠️ CZWARTY: bez kąta pochylenia sworznia (SAI) kolumna stoi w złym miejscu.**
     `SAI` było najpierw 0, „bo strona nie omawia tego kąta". Skutek: oś sworznia jest wtedy
     pionowa, więc kolumna ze sprężyną ląduje **dokładnie nad środkiem koła**, a nie tam, gdzie
     stoi w aucie. Zgłoszone przez właściciela słowami „sprężyna powinna być po stronie wahacza"
     i to jest dokładnie ta diagnoza. W realnym McPhersonie oś jest pochylona do wewnątrz
     o kilkanaście stopni i **dlatego** kolumna stoi nad wahaczem, po stronie wewnętrznej
     (i dlatego wieżyczki są w środku komory silnika). Teraz `SAI = 15°`, stałe i nieregulowane.
     **Nie psuje to żadnej nakładki dydaktycznej:** w widoku z boku (caster) SAI jest niewidoczny,
     bo patrzymy wzdłuż osi poprzecznej, więc łuk dalej pokazuje czysty caster. Efekt uboczny
     jest pożądany: podnoszenie nadwozia przy skręcie staje się **asymetryczne** dla lewego
     i prawego wychylenia, bo caster i SAI raz się dodają, a raz odejmują. Tak jest w aucie.

     **⚠️ CIĄG DALSZY (piąta runda): sam kąt SAI to za mało — trzeba PRZESUNĄĆ oś.**
     Zgłoszenie brzmiało „daj sprężynę jeszcze trochę w stronę wahacza". Odruch („podkręcę SAI")
     **nie działa** i da się to policzyć: przy osi przechodzącej przez środek koła nawet
     **SAI = 26°** zostawia najbliższy zwój **22 mm WEWNĄTRZ** szerokości opony, a taki kąt
     jest już nierealny. Przyczyna jest inna: oś **nie ma prawa** przechodzić przez środek koła.
     W aucie mija go od wewnątrz i trafia w jezdnię w punkcie styku — to **zerowy promień
     zataczania**. Stąd `KP_OFF = R·tan(SAI)`: cała kolumna przesuwa się o **86 mm** do środka,
     nad wahacz, przy SAI dalej równym realnym 15°. Poprzednia wersja miała przy okazji
     **86 mm promienia zataczania** (oś schodziła na zewnątrz punktu styku) — nikt tego nie
     widział, ale to była wada konstrukcyjna modelu, nie tylko grafiki.
     **Co jeszcze z tego wynika (sprawdzić przy każdej zmianie tych stałych):**
     (a) skręt musi obracać koło wokół **prostej** (`T = A − Rskręt·A`), inaczej koło zamiata
     bokiem zamiast kręcić się w miejscu; (b) `hit` i wierzchołek łuku castera liczymy z `axisPt`,
     nie od środka koła — inaczej czerwona oś rozjeżdża się z narysowaną kolumną w widoku skrętu;
     (c) odczyt podnoszenia nadwozia **zmienił się z „+1,3 mm" na „−2,2 mm"** przy pełnym skręcie
     i tak ma być: przy zerowym promieniu zataczania znika składowa od SAI, zostaje sama od castera;
     (d) korpus amortyzatora musi sięgać **pod dolną miseczkę sprężyny** (`axisPt(tSpr − 0.06)`),
     bo po odsunięciu osi stary podział „34% drogi do góry" zostawiał widoczne samo tłoczysko.

     **⚠️ Przy okazji: wahacz nurkował do ziemi, bo `y1` było ułamkiem promienia (`R*0.24`),
     a nie wysokością przegubu.** Mocowania na podramiu siedziały 77 mm nad jezdnią, czyli
     100 mm niżej niż przegub kulowy — auto wyglądało, jakby stało na zderzaku. Teraz
     `y1 = kpBot[1] + 0.04`, czyli wahacz jest **poziomy** i sam podąża za przegubem.
     Ramiona sięgają do `x = −1,35` (było `−1,06`), bo poziomy wahacz **chowa się w całości
     za sylwetką opony** — zmierzone atrapą: przy `−1,06` w widoku izometrycznym widać **0%**
     ramienia, w widoku z przodu 79%. Test widoczności (wart powtórzenia przy każdej zmianie
     zawieszenia): zrasteryzuj z `ops.json` wszystkie wypełnienia rysowane PO danym odcinku
     i policz, ile jego punktów zostaje odkrytych.
  5. **⚠️ PIĄTY: koło jest SKORUPĄ — od środka auta widać przez nie na wylot.**
     Opona to powłoka otwarta przy stopkach, a felga ma tarczę tylko po stronie zewnętrznej,
     więc linia wzroku z kamery ustawionej od wewnątrz wchodzi otworem przy stopce i wychodzi
     drugą stroną. Przy okazji amortyzator i wahacz kończyły się w powietrzu, bo między nimi
     nie było żadnej piasty. Dołożone: **tarcza hamulcowa** (`dBands`, promień 0,46 R — realne
     ~140 mm przy kole 320 mm, nie „na całą felgę") w płaszczyźnie `XD = −0,06`, **zwrotnica**
     (`base → kpBot`) i **piasta**. Wszystko leży DO WEWNĄTRZ od tarczy, więc z zewnątrz chowa
     się za kołem samo — z głębokości, nie z kolejności.
     **⚠️ Pułapka w pułapce: sama geometria NIE wystarczyła.** Po dodaniu tarczy koło dalej
     wyglądało na przezroczyste, bo `shade()` maluje ściany odwrócone od światła prawie na
     czarno (`n·L < 0` → zostaje samo `k = 0,32`), a czarna plama czyta się dokładnie jak dziura.
     Stąd `shadeInner()` liczące **|n·L|** (światło wypełniające, odbite od jezdni i nadkola) —
     używane też dla **tylnej ściany felgi** i dla **prześwitów między ramionami**: od środka
     auta widać w nich wewnętrzny bęben felgi, czyli metal, a nie czerń.
     Weryfikacja jak w pułapce 1: **wyrenderuj tarczę na magencie** i sprawdź, czy zakrywa otwór.
     **Złapane przy okazji:** `buildFaces` liczyło środek koła jako `[0, R+groundShift, 0]`,
     czyli **bez `kpT`** — przy pełnym skręcie felga zostawała **46 mm za oponą**. Wszystko,
     co rysujemy „w układzie koła", musi dodać `kpT`.
  6. **Zawieszenie trafia do tej samej listy co ściany, sortowanej głębokością** (`seg()` i `ball()`
     obok `face()`), zamiast rysować się osobno przed nimi. Kolejność wywołań kłamie, gdy kamerą
     obrócić się na wewnętrzną stronę auta — głębokość nie kłamie nigdy. Sprężyna jest rozbita
     na pojedyncze odcinki, więc jej tylna połowa chowa się za przednią sama z siebie.
     **To samo w sobie NIE naprawiło sprężyny w kole** — patrz punkt 2.
  7. **Odcisk opony jest ZAWSZE zasłonięty przez oponę.** Z każdej kamery, z góry też, bo wtedy
     zasłania go góra koła. Dlatego `drawPatch3D()` wołamy **dwa razy**: przed ścianami (pełne
     krycie, to co wystaje na jezdnię) i po nich półprzezroczyście.
  8. **Łuk kąta przy 2–5° jest nieczytelny** (sześciopikselowy ogryzek). `arc2()` rysuje więc
     **klin** — długi wąski trójkąt — i dopiero na nim łuk z liczbą.
  9. **Kamera musi śledzić aktywny suwak przez `curView`, nie przez `active`.** Przy starcie
     `active = 'camber'`, a kamera stoi w izometrii; porównywanie do `active` powodowało, że
     pierwsze dotknięcie suwaka camber nie przełączało widoku.
  10. **Czerwień marki jest w `oklch()`** — `toRGB()` maluje ją na pikselu 1×1 i odczytuje
     `getImageData`, zamiast zgadywać RGB. Nieobsługiwany format → alpha 0 → fallback.

  **⚠️ JAK TO TESTOWAĆ BEZ PRZEGLĄDARKI (nowe narzędzia w `tools/`).** W tym środowisku nie ma ani
  przeglądarki headless, ani `node-canvas`. Powstał komplet: `tools/canvas_extract.py` (wycina IIFE
  ze strony), `tools/canvas_harness.js` (atrapa DOM + canvas, uruchamia **prawdziwy** kod, przemiata
  wszystkie suwaki i przyciski, nagrywa operacje rysowania do `ops.json`), `tools/canvas_render.py`
  (`ops.json` → PNG przez PIL). Złapało realne błędy (dziura w feldze, brak przerysowania kątów,
  kamera nieśledząca suwaka) zanim cokolwiek poszło na serwer. **Zastrzeżenie:** kompozycja alfa
  w rendererze potrafi wyciągnąć na wierzch element narysowany wcześniej — kolejność weryfikuj
  **po indeksach w `ops.json`**, nie na oko z PNG.

  **Zdjęcia bieżników:** 5 sztuk wygenerowanych przez kie.ai (`gpt-image-2`, 1K, 4:3), źródła
  w `img/_src/wear/*.jpg` (JPEG q92 — PNG-i ważyły 2,5 MB sztuka), wyjście przez **nową listę
  `THUMB_SOURCES` w `tools/optimize_images.py`** → po jednym `-800.webp` (łącznie 335 KB).
  Warianty 1400/2200 byłyby balastem przy kolumnie 150 px. Dwa ujęcia trzeba było powtórzyć:
  model nie rozumie „oba barki starte" ani „piłowanie" z ogólnego opisu — pomaga wymuszenie widoku
  **prosto z góry na bieżnik** i rozpisanie wzorca na **numerowane strefy w poprzek szerokości**.

  **Stan: WDROŻONE 2026-09-17** (FTP: `geometria-3d.html`, `badania-powypadkowe.html`
  + 5 plików `img/wear-*-800.webp`). Właściciel oglądał wersję roboczą w przeglądarce 2026-09-16
  **pięć razy** i za każdym razem zgłaszał TO SAMO („sprężyna siedzi w kole"), ale przyczyna
  była **za każdym razem inna**: (1) dziury w feldze, przez które widać było sprężynę stojącą
  ZA kołem; (2) kolumna rysowana wewnątrz bryły opony; (3) sprężyna z za małym luzem nad
  bieżnikiem; (4) SAI = 0, przez co całość stała nad środkiem koła; (5) oś sworznia przechodząca
  przez środek koła — dopiero jej przesunięcie o `R·tan(SAI)` postawiło kolumnę nad wahaczem.
  Pięć niezależnych przyczyn jednego objawu, więc każda kolejna poprawka usuwała go tylko
  częściowo — i za każdym razem wyglądało to jak „nic się nie zmieniło". **Wniosek na przyszłość:**
  przy tym symulatorze nie poprzestawać na pierwszym znalezionym powodzie i sprawdzać PIĘĆ
  rzeczy osobno — SIATKĘ (test magentą), POŁOŻENIE elementów względem bryły opony, LUZ każdego
  elementu liczony od jego własnej obwiedni (nie od osi), ANATOMIĘ zawieszenia oraz UMIEJSCOWIENIE
  osi obrotu (nie każdy „kąt" da się naprawić kątem — czasem trzeba przesunąć całą oś).
  Reszta nadal **nie była oglądana w prawdziwej przeglądarce**: sprawdzić po deployu płynność
  na telefonie i zachowanie `touch-action: pan-y`.
