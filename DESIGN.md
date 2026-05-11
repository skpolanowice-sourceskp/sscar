# SSCAR Design System

## Brand identity

Precyzyjny high-performance garage. Nie korporacja, nie osiedlowy mechanik.
Referencja estetyczna: techniczny katalog części motorsportowych, program wyścigowy DTM, manual serwisowy Porsche.

**Brand voice (fizyczny obiekt):** Stary manual serwisowy BMW – precyzyjny, pozbawiony ozdobników, autorytatywny.
**Aesthetic lane:** Technical/performance automotive. Nie editorial magazine.

---

## Typography

### Fonty

| Rola | Rodzina | Wagi |
|---|---|---|
| Nagłówki, labele, numery | Barlow Condensed | 600, 700, 900 |
| Body, UI tekst | Barlow | 400, 500, 700 |

Import:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,900;1,700;1,900&family=Barlow:wght@400;500;700&display=swap" rel="stylesheet">
```

### Hierarchia typograficzna

| Poziom | Rozmiar | Waga | Cechy |
|---|---|---|---|
| Hero h1 | `clamp(3.5rem, 8vw, 6rem)` | 900 | uppercase, Barlow Condensed |
| Section h2 | `clamp(2rem, 4vw, 3rem)` | 900 | uppercase, Barlow Condensed, letter-spacing 0.04em |
| Subsection h3 | 1.1rem | 700 | uppercase, letter-spacing 2px |
| Body | 1rem | 400 | Barlow, line-height 1.7 |
| Label/caption | 0.75rem | 700 | uppercase, letter-spacing 0.12em |
| Number accent | Barlow Condensed | 900 | italic |

### H2 underline rule
```css
h2::after {
    width: 60px;
    height: 3px;
    background: var(--primary-red);
    margin: 16px auto 0;
    /* Brak: skewX, box-shadow – to nie plakat sportowy */
}
```

---

## Color system

```css
:root {
    --primary-red: oklch(48.5% 0.222 25.8);
    --dark-bg:     oklch(13% 0.006 30);
    --surface-1:   oklch(17% 0.005 30);   /* karty, panele */
    --surface-2:   oklch(20% 0.005 30);   /* podniesione elementy */
    --border-subtle: oklch(24% 0.005 30); /* linie podziału */
    --border-accent: oklch(35% 0.05 25);  /* granice z akcentem */
    --text-main:   oklch(95% 0.005 30);
    --text-muted:  oklch(68% 0.005 30);
}
```

**Strategia:** Committed. Ciemne tło + czerwień jako głos marki. Neutralne strefy minimalnie podgrzane ku czerwieni (chroma 0.005–0.006).

**WCAG:** Czerwony jako akcent na dużych nagłówkach spełnia 3:1 (duże litery). Podstawowy tekst (text-main na dark-bg) > 12:1.

---

## Komponenty

### `.service-entry` – lista usług (wzorzec z oferta.html)
Numerowany/strzałkowy listing. Nie siatka kart.
```
border-top / border-bottom: 1px solid border-subtle
padding-left: indent przy hover
title: Barlow Condensed 900 uppercase
arrow: primary-red
```

### `.nav-index-item` – nawigacja po sekcjach (wzorzec z index.html)
Trzykolumnowy grid: numer | treść | strzałka.
```
numer: primary-red, 0.7rem, italic, Barlow Condensed
title: 95% jasności, uppercase, Barlow Condensed
desc: text-muted
```

### `.feature-item` – specyfikacja techniczna
Nie siatka identycznych kart z blur. Czysta lista specyfikacji:
```
border-top / border-bottom: border-subtle
grid: ikona (2rem) | treść
brak: backdrop-filter, border-radius jako karta
```

### `.tip-box` – ostrzeżenie / informacja
```
background: oklch(18% 0.01 25)   /* ciepłe ciemne */
border: 1px solid oklch(35% 0.08 25)
/* ZAKAZ: border-left jako kolorowy pasek */
```

### `.stat-block` / `.data-block` – metryki techniczne
```
background: var(--surface-1)
border: 1px solid var(--border-subtle)
/* ZAKAZ: backdrop-filter: blur() */
```

### Cennik: `.pricing-wrapper`, `.category-header`
```
pricing-wrapper: surface-1, border: border-subtle, bez blur
category-header: surface-2, bez border-left jako akcentu
```

### `.cta-section`
```
background: rgba(227,30,36,0.04)
border-top: 1px solid rgba(227,30,36,0.1)
/* Pełny border – nie side stripe */
```

---

## Layouty strony

### Strony usług (badania, geometria, klimatyzacja…)
```
breadcrumb → service-page-hero → stats-row → sekcje → cta-section → footer
```

### Strony informacyjne (o-nas, cennik)
```
page-hero → główna treść → sekcja wspierająca → footer
```

---

## Zakazane wzorce (absolutne)

| Wzorzec | Zamiast |
|---|---|
| `border-left > 1px` jako kolorowy akcent na kartach/alertach | Pełny border lub tło tintowe |
| `backdrop-filter: blur()` na statycznych kartach | Solid `var(--surface-1)` |
| Identyczna siatka kart icon+h4+p | Lista spec, .feature-item jako grid row |
| Gradient text (`background-clip: text`) | Solid color |
| Font-style italic na h2 sekcyjnych | Weight + uppercase dają wystarczającą hierarchię |
| `#000` / `#fff` jako czyste kolory | Zawsze tintowane w kierunku brand hue |
| Segoe UI jako brand font | Barlow + Barlow Condensed |

---

## Motion

- Scroll-triggered `fadeInUp`: `opacity 0 → 1`, `translateY 30px → 0`
- Easing: `ease-out` (cubic-bezier ~0.22, 0.61, 0.36, 1)
- Duration: max 0.8s
- Brak: bounce, elastic, animacji layout properties
- Hover transitions: `0.2–0.25s ease`
