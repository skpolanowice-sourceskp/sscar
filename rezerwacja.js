/* =============================================================
   SSCAR – Rezerwacja online
   -------------------------------------------------------------
   Front-end modułu rezerwacji. Cała dostępność i wysyłka idą
   przez DWIE funkcje (szew integracji):

       getAvailability(serviceKey, dateISO)  -> zwraca zajęte godziny
       submitBooking(payload)                -> zapisuje rezerwację

   Teraz działają na PRZYKŁADOWYCH danych (deterministyczny mock).
   Aby podłączyć Google Calendar: w tych dwóch funkcjach podmień
   mock na fetch() do skryptów PHP na vh.pl (patrz komentarze TODO).
   Reszta pliku nie wymaga zmian.
   ============================================================= */
(function () {
    'use strict';

    /* ---------- Tryb pracy ---------- */
    // true  = przykładowa dostępność (demo, bez serwera)
    // false = realne dane z backendu Google Calendar (po wdrożeniu Etapu 2)
    var USE_MOCK = false;
    var API_BASE = 'reservations/';

    /* ---------- Konfiguracja biznesowa (łatwa do edycji) ---------- */

    // Godziny pracy wg dnia tygodnia (0 = niedziela ... 6 = sobota).
    // [otwarcie, zamknięcie] w pełnych godzinach. null = nieczynne.
    var HOURS = {
        0: null,      // niedziela
        1: [7, 20],   // poniedziałek
        2: [7, 20],   // wtorek
        3: [7, 20],   // środa
        4: [7, 20],   // czwartek
        5: [7, 20],   // piątek
        6: [8, 14]    // sobota
    };

    var MIN_LEAD_DAYS = 0;       // najwcześniejszy dzień = dziś
    var MIN_LEAD_MINUTES = 60;   // ale slot musi być min. 60 min od teraz
    var DAYS_AHEAD = 21;         // ile dni do przodu pokazujemy
    var STATION_PHONE = '+48796995620';

    // Usługi i ich warianty. duration = czas trwania slotu w minutach.
    // resource = osobne stanowisko (przegląd i klima liczą się niezależnie).
    var SERVICES = {
        techniczne: {
            label: 'Badanie techniczne',
            icon: 'fa-clipboard-check',
            resource: 'techniczne',
            subtypes: [
                { key: 'osobowy',     label: 'Osobowy',           meta: 'do 3.5t',                   duration: 20, price: '149 zł' },
                { key: 'gaz',         label: 'Osobowy z LPG/CNG', meta: '+ badanie instalacji gazu', duration: 30, price: '245 zł' },
                { key: 'taxi',        label: 'Okresowe Taxi (bez LPG)', meta: 'osobowe + badanie taxi', duration: 20, price: '213 zł' },
                { key: 'taxigaz',     label: 'Okresowe Taxi + LPG', meta: 'taxi + badanie instalacji gazu', duration: 30, price: '309 zł' },
                { key: 'motocykl',    label: 'Motocykl',          meta: '',                          duration: 10, price: '94 zł' },
                { key: 'powypadkowe', label: 'Powypadkowe',       meta: 'łącznie z okresowym',       duration: 30, price: '292 zł' },
                { key: 'pierwszarej', label: 'Pierwsza rejestracja w kraju', meta: 'pojazd do pierwszej rejestracji w PL', duration: 30, price: '240 zł' },
                { key: 'dodatkowe',   label: 'Przegląd dodatkowy', meta: 'samo taxi bez okresowego, poprawkowe/uzupełniające, po zatrzymaniu dowodu', duration: 10, price: '' }
            ]
        },
        przedzakupem: {
            label: 'Sprawdzenie przed zakupem',
            icon: 'fa-magnifying-glass',
            resource: 'przedzakupem',
            subtypes: [
                { key: 'baza', label: 'Podstawowe', meta: '', duration: 20, price: '150 zł' },
                { key: 'full', label: 'Pełne',      meta: '', duration: 60, price: '500 zł' }
            ]
        },
        klimatyzacja: {
            label: 'Serwis klimatyzacji',
            icon: 'fa-snowflake',
            resource: 'klimatyzacja',
            // Jeden wariant – bez wyboru czynnika (dla stacji bez różnicy).
            // Usługa z jednym wariantem pomija krok wyboru (patrz selectService).
            subtypes: [
                // duration = realny czas w grafiku (podłączenie/obsługa = 10 min, tyle blokuje slot i event).
                // displayDuration = czas POKAZYWANY klientowi (cała obsługa klimy trwa ~50 min).
                { key: 'klima', label: 'Serwis klimatyzacji', meta: '', duration: 10, displayDuration: 50, price: '' }
            ]
        }
    };

    /* ---------- Stan ---------- */

    var state = {
        service: null,
        subtype: null,
        date: null,   // ISO YYYY-MM-DD
        slot: null,   // 'HH:MM'
        loadToken: 0
    };

    /* ---------- Pomocnicze: daty i czas ---------- */

    var DOW_SHORT = ['niedz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
    var DOW_LONG = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
    var MON_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
    var MON_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function toISO(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function fromISO(iso) {
        var p = iso.split('-');
        return new Date(+p[0], +p[1] - 1, +p[2]);
    }

    function startOfToday() {
        var d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(d, n) {
        var x = new Date(d);
        x.setDate(x.getDate() + n);
        return x;
    }

    function minutesToHHMM(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

    // Niedziela Wielkanocna danego roku (computus – ten sam wynik co w lib.php).
    function easterDate(year) {
        var a = year % 19;
        var b = Math.floor(year / 100);
        var c = year % 100;
        var d = Math.floor(b / 4);
        var e = b % 4;
        var f = Math.floor((b + 8) / 25);
        var g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4);
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = Math.floor((a + 11 * h + 22 * l) / 451);
        var month = Math.floor((h + l - 7 * m + 114) / 31);
        var day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    // Dzień ustawowo wolny od pracy w PL (stacja nieczynna). Lustro rez_is_holiday().
    var HOLIDAYS_FIXED = ['01-01', '01-06', '05-01', '05-03', '08-15', '11-01', '11-11', '12-25', '12-26'];
    function isHoliday(d) {
        var md = pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        if (HOLIDAYS_FIXED.indexOf(md) !== -1) return true;
        var easter = easterDate(d.getFullYear());
        var iso = toISO(d);
        // Poniedziałek Wielkanocny (+1), Boże Ciało (+60).
        return iso === toISO(addDays(easter, 1)) || iso === toISO(addDays(easter, 60));
    }

    function dateLong(iso) {
        var d = fromISO(iso);
        return DOW_LONG[d.getDay()] + ', ' + d.getDate() + ' ' + MON_GEN[d.getMonth()];
    }

    /* ---------- Generowanie slotów z godzin pracy ---------- */

    function slotsForDay(iso, duration) {
        var d = fromISO(iso);
        var h = HOURS[d.getDay()];
        if (!h) return [];
        var out = [];
        var open = h[0] * 60;
        var close = h[1] * 60;
        for (var t = open; t + duration <= close; t += duration) {
            out.push(minutesToHHMM(t));
        }
        return out;
    }

    // Sloty możliwe do rezerwacji: dla dnia dzisiejszego odsiewa godziny
    // wcześniejsze niż teraz + minimalne wyprzedzenie (MIN_LEAD_MINUTES).
    function bookableSlots(iso, duration) {
        var all = slotsForDay(iso, duration);
        if (iso !== toISO(new Date())) return all;
        var now = new Date();
        var minMin = now.getHours() * 60 + now.getMinutes() + MIN_LEAD_MINUTES;
        return all.filter(function (t) {
            var p = t.split(':');
            return (+p[0]) * 60 + (+p[1]) >= minMin;
        });
    }

    /* ---------- Deterministyczny pseudolosowy "zajęte" (mock) ---------- */

    function hash(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = (h * 16777619) >>> 0;
        }
        return (h % 1000) / 1000;
    }

    /* =============================================================
       SZEW INTEGRACJI #1 — dostępność (zajęte godziny)
       Teraz: mock. Docelowo:
         var r = await fetch('reservations/availability.php?resource='
                  + encodeURIComponent(resource) + '&date=' + dateISO);
         var data = await r.json();   // { busy: ['07:20','08:00', ...] }
         return data.busy;
       ============================================================= */
    function getAvailability(serviceKey, dateISO) {
        if (USE_MOCK) return mockAvailability(dateISO);
        var url = API_BASE + 'availability.php'
            + '?service=' + encodeURIComponent(serviceKey)
            + '&subtype=' + encodeURIComponent(state.subtype)
            + '&date=' + encodeURIComponent(dateISO);
        return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) {
            if (!r.ok) throw new Error('availability ' + r.status);
            return r.json();
        }).then(function (data) { return data.busy || []; });
    }

    function mockAvailability(dateISO) {
        // Demo: jeden wspólny grafik (jak w produkcji – jeden pracownik).
        return new Promise(function (resolve) {
            setTimeout(function () {
                var all = slotsForDay(dateISO, currentDuration());
                var busy = all.filter(function (time) {
                    return hash('stacja|' + dateISO + '|' + time) < 0.4;
                });
                resolve(busy);
            }, 320);
        });
    }

    /* =============================================================
       SZEW INTEGRACJI #2 — zapis rezerwacji
       Teraz: mock. Docelowo:
         var r = await fetch('reservations/book.php', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload)
         });
         if (!r.ok) throw new Error('save failed');
         return await r.json();   // { ref: 'SSC-...' }
       Payload zawiera startISO/endISO – gotowe pod event w Google Calendar.
       ============================================================= */
    function submitBooking(payload) {
        if (USE_MOCK) return mockBooking(payload);
        return fetch(API_BASE + 'book.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: payload.serviceKey,
                subtype: payload.subtypeKey,
                date: payload.date,
                time: payload.time,
                consent: true,
                customer: payload.customer
            })
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (data) {
                if (!r.ok) {
                    var err = new Error(data.error || ('HTTP ' + r.status));
                    err.status = r.status;
                    throw err;
                }
                return data;
            });
        });
    }

    function mockBooking(payload) {
        return new Promise(function (resolve) {
            setTimeout(function () {
                var d = fromISO(payload.date);
                var ref = 'SSC-' + ('' + d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate())
                    + '-' + Math.floor(100 + Math.random() * 900);
                resolve({ ref: ref });
            }, 900);
        });
    }

    /* ---------- Odczyt aktualnego wariantu / czasu ---------- */

    function currentSubtypeObj() {
        if (!state.service || !state.subtype) return null;
        var list = SERVICES[state.service].subtypes;
        for (var i = 0; i < list.length; i++) if (list[i].key === state.subtype) return list[i];
        return null;
    }

    function currentDuration() {
        var s = currentSubtypeObj();
        return s ? s.duration : 30;
    }

    // Czas POKAZYWANY klientowi (może różnić się od realnego slotu, np. klima 50 vs 10 min).
    function displayMinutes(s) {
        return (s && s.displayDuration) ? s.displayDuration : (s ? s.duration : 0);
    }

    /* ---------- DOM skróty ---------- */
    function el(id) { return document.getElementById(id); }

    /* ---------- Radiogroup z obsługą klawiatury (roving tabindex) ---------- */

    function buildRadioGroup(container, items, getSelectedKey, onSelect) {
        container.innerHTML = '';
        var buttons = [];
        items.forEach(function (item, idx) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = item.className;
            btn.setAttribute('role', 'radio');
            btn.dataset.key = item.key;
            btn.innerHTML = item.html;
            var selected = getSelectedKey() === item.key;
            btn.setAttribute('aria-checked', selected ? 'true' : 'false');
            btn.tabIndex = selected || (!getSelectedKey() && idx === 0) ? 0 : -1;
            btn.addEventListener('click', function () { onSelect(item.key); });
            btn.addEventListener('keydown', function (e) {
                var i = buttons.indexOf(btn);
                var next = -1;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % buttons.length;
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + buttons.length) % buttons.length;
                else if (e.key === 'Home') next = 0;
                else if (e.key === 'End') next = buttons.length - 1;
                if (next >= 0) {
                    e.preventDefault();
                    buttons[next].focus();
                    onSelect(buttons[next].dataset.key);
                }
            });
            buttons.push(btn);
            container.appendChild(btn);
        });
    }

    /* ---------- Render: usługi (krok 1) ---------- */

    function renderServices() {
        var items = Object.keys(SERVICES).map(function (key) {
            var s = SERVICES[key];
            return {
                key: key,
                className: 'rez-tile',
                html: '<i class="fas ' + s.icon + '" aria-hidden="true"></i><span class="rez-tile-name">' + s.label + '</span>'
            };
        });
        buildRadioGroup(el('rez-services'), items, function () { return state.service; }, selectService);
    }

    function renderSubtypes() {
        var wrap = el('rez-subtypes-wrap');
        if (!state.service) { wrap.hidden = true; return; }
        wrap.hidden = false;
        el('rez-subtypes-label').textContent = SERVICES[state.service].label;
        var items = SERVICES[state.service].subtypes.map(function (s) {
            var main = '<span class="rez-opt-name">' + s.label + '</span>';
            if (s.meta) main += '<span class="rez-opt-desc">' + s.meta + '</span>';
            var figs = '<span class="rez-opt-time">' + displayMinutes(s) + ' min</span>';
            if (s.price) figs += '<span class="rez-opt-price">' + s.price + '</span>';
            return {
                key: s.key,
                className: 'rez-opt',
                html: '<span class="rez-opt-main">' + main + '</span>'
                    + '<span class="rez-opt-figs">' + figs + '</span>'
            };
        });
        buildRadioGroup(el('rez-subtypes'), items, function () { return state.subtype; }, selectSubtype);
    }

    /* ---------- Render: dni (krok 2) ---------- */

    function renderDays() {
        var container = el('rez-days');
        container.innerHTML = '';
        var today = startOfToday();
        var earliest = addDays(today, MIN_LEAD_DAYS);
        for (var i = 0; i < DAYS_AHEAD; i++) {
            var d = addDays(today, i);
            var iso = toISO(d);
            var dow = d.getDay();
            var holiday = isHoliday(d);
            var closed = !HOURS[dow] || holiday;
            var tooSoon = d < earliest;
            var disabled = closed || tooSoon;

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rez-day';
            btn.dataset.iso = iso;
            btn.disabled = disabled;
            btn.setAttribute('aria-pressed', state.date === iso ? 'true' : 'false');
            var statusTxt = holiday ? ', święto – nieczynne' : (closed ? ', nieczynne' : (tooSoon ? ', niedostępne' : ''));
            var label = (i === 0 ? 'dziś, ' : '') + DOW_LONG[dow] + ' ' + d.getDate() + ' ' + MON_GEN[d.getMonth()] + statusTxt;
            btn.setAttribute('aria-label', label);
            btn.innerHTML =
                '<span class="rez-day-dow">' + (i === 0 ? 'dziś' : DOW_SHORT[dow]) + '</span>' +
                '<span class="rez-day-num">' + d.getDate() + '</span>' +
                '<span class="rez-day-mon">' + MON_SHORT[d.getMonth()] + '</span>';
            if (!disabled) {
                (function (theIso) {
                    btn.addEventListener('click', function () { selectDay(theIso); });
                })(iso);
            }
            container.appendChild(btn);
        }
    }

    /* ---------- Render: sloty (krok 2) ---------- */

    function renderSlotsLoading() {
        var area = el('rez-slots-area');
        var html = '<div class="rez-slots" aria-hidden="true">';
        for (var i = 0; i < 10; i++) html += '<div class="rez-slot-skeleton"></div>';
        html += '</div><span class="rez-sr-only">Wczytuję wolne godziny…</span>';
        area.innerHTML = html;
    }

    function renderSlots(busy) {
        var area = el('rez-slots-area');
        var all = bookableSlots(state.date, currentDuration());
        var free = all.filter(function (t) { return busy.indexOf(t) === -1; });

        if (free.length === 0) {
            var next = findNextAvailable(addDays(fromISO(state.date), 1));
            var nextHtml = next
                ? ' Najbliższy wolny termin: <button type="button" class="rez-link" id="rez-jump">'
                    + dateLong(next.date) + ', godz. ' + next.time + '</button>.'
                : '';
            area.innerHTML = '<div class="rez-empty"><i class="fas fa-calendar-xmark" aria-hidden="true"></i>'
                + 'Brak wolnych godzin w wybranym dniu.' + nextHtml + '</div>';
            if (next) {
                el('rez-jump').addEventListener('click', function () {
                    selectDay(next.date, function () { selectSlot(next.time); });
                });
            }
            return;
        }

        var html = '<div class="rez-slots" role="group" aria-label="Wolne godziny">';
        free.forEach(function (t) {
            html += '<button type="button" class="rez-slot" data-time="' + t + '" aria-pressed="'
                + (state.slot === t ? 'true' : 'false') + '">' + t + '</button>';
        });
        html += '</div>';
        area.innerHTML = html;
        Array.prototype.forEach.call(area.querySelectorAll('.rez-slot'), function (b) {
            b.addEventListener('click', function () { selectSlot(b.dataset.time); });
        });
    }

    function findNextAvailable(fromDate) {
        // Podpowiedź liczona lokalnie tylko w trybie demo. W trybie backendu
        // pomijamy ją, by nie wysyłać wielu zapytań na raz.
        if (!USE_MOCK) return null;
        var today = startOfToday();
        var end = addDays(today, DAYS_AHEAD);
        var d = new Date(fromDate);
        var dur = currentDuration();
        while (d < end) {
            var iso = toISO(d);
            if (HOURS[d.getDay()] && !isHoliday(d) && d >= addDays(today, MIN_LEAD_DAYS)) {
                var all = slotsForDay(iso, dur);
                for (var i = 0; i < all.length; i++) {
                    if (hash('stacja|' + iso + '|' + all[i]) >= 0.4) {
                        return { date: iso, time: all[i] };
                    }
                }
            }
            d = addDays(d, 1);
        }
        return null;
    }

    /* ---------- Akcje ---------- */

    function selectService(key) {
        if (state.service === key) return;
        state.service = key;
        state.subtype = null;
        state.slot = null;
        markChecked('rez-services', key);
        var subs = SERVICES[key].subtypes;
        if (subs.length === 1) {
            // Usługa bez wariantów (np. klima) – wybierz automatycznie i pomiń krok wyboru.
            el('rez-subtypes-wrap').hidden = true;
            state.subtype = subs[0].key;
            setStepDone(1, SERVICES[key].label);
            if (state.date) refreshSlots();
            openStep(2);
        } else {
            renderSubtypes();
            if (state.date) refreshSlots();
        }
        updateSummary();
        updateSubmit();
    }

    function selectSubtype(key) {
        state.subtype = key;
        markChecked('rez-subtypes', key);
        if (state.date) refreshSlots();   // czas trwania mógł się zmienić
        setStepDone(1, SERVICES[state.service].label + ' · ' + currentSubtypeObj().label);
        openStep(2);
        updateSummary();
        updateSubmit();
    }

    function selectDay(iso, after) {
        state.date = iso;
        state.slot = null;
        Array.prototype.forEach.call(el('rez-days').querySelectorAll('.rez-day'), function (b) {
            b.setAttribute('aria-pressed', b.dataset.iso === iso ? 'true' : 'false');
        });
        updateSummary();
        updateSubmit();
        refreshSlots(after);
    }

    function selectSlot(time) {
        state.slot = time;
        Array.prototype.forEach.call(el('rez-slots-area').querySelectorAll('.rez-slot'), function (b) {
            b.setAttribute('aria-pressed', b.dataset.time === time ? 'true' : 'false');
        });
        setStepDone(2, dateLong(state.date) + ', godz. ' + time);
        openStep(3);
        var name = el('rez-name');
        if (name) name.focus();
        updateSummary();
        updateSubmit();
    }

    function refreshSlots(after) {
        if (!state.date || !state.service || !state.subtype) return;
        var token = ++state.loadToken;
        renderSlotsLoading();
        getAvailability(state.service, state.date).then(function (busy) {
            if (token !== state.loadToken) return; // pominięto nieaktualną odpowiedź
            renderSlots(busy);
            if (typeof after === 'function') after();
        }).catch(function () {
            if (token !== state.loadToken) return;
            el('rez-slots-area').innerHTML =
                '<div class="rez-alert"><i class="fas fa-triangle-exclamation"></i>'
                + '<span>Nie udało się wczytać wolnych godzin. Odśwież stronę lub zadzwoń: '
                + '<a href="tel:' + STATION_PHONE + '" style="color:var(--primary-red);font-weight:700;">796 995 620</a>.</span></div>';
        });
    }

    function markChecked(containerId, key) {
        Array.prototype.forEach.call(el(containerId).querySelectorAll('[role="radio"]'), function (b) {
            var on = b.dataset.key === key;
            b.setAttribute('aria-checked', on ? 'true' : 'false');
            b.tabIndex = on ? 0 : -1;
        });
    }

    /* ---------- Sterowanie krokami ---------- */

    function openStep(n) {
        for (var i = 1; i <= 3; i++) {
            var step = el('rez-step-' + i);
            step.classList.toggle('is-active', i === n);
            if (i === n) step.classList.remove('is-locked');
        }
    }

    function setStepDone(n, recapText) {
        var step = el('rez-step-' + n);
        step.classList.add('is-done');
        el('rez-recap-' + n).textContent = recapText;
        step.querySelector('[data-edit]').hidden = false;
    }

    function setupEditButtons() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (btn) {
            btn.addEventListener('click', function () {
                openStep(+btn.dataset.edit);
            });
        });
    }

    /* ---------- Podsumowanie ---------- */

    function setSummary(id, text) {
        var node = el(id);
        if (text) { node.textContent = text; node.classList.remove('empty'); }
        else { node.textContent = '—'; node.classList.add('empty'); }
    }

    function updateSummary() {
        var s = state.service ? SERVICES[state.service].label : null;
        var sub = currentSubtypeObj();
        setSummary('sum-service', s);
        setSummary('sum-subtype', sub ? sub.label : null);
        setSummary('sum-date', state.date ? dateLong(state.date) : null);
        setSummary('sum-time', state.slot);
        setSummary('sum-duration', sub ? displayMinutes(sub) + ' min' : null);
        // Ukryj wiersz "Szczegóły" dla usług bez wariantów (np. klima).
        var subRow = el('sum-subtype').closest('.rez-summary-row');
        if (subRow) {
            var single = !!(state.service && SERVICES[state.service].subtypes.length === 1);
            subRow.style.display = single ? 'none' : '';
        }
    }

    function isComplete() {
        return state.service && state.subtype && state.date && state.slot;
    }

    function updateSubmit() {
        el('rez-submit').disabled = !isComplete();
    }

    /* ---------- Walidacja formularza ---------- */

    function setFieldError(fieldId, errId, msg) {
        var field = el(fieldId);
        var err = el(errId);
        if (msg) {
            field.classList.add('invalid');
            var input = field.querySelector('input, textarea');
            if (input) input.setAttribute('aria-invalid', 'true');
            err.textContent = msg;
        } else {
            field.classList.remove('invalid');
            var inp = field.querySelector('input, textarea');
            if (inp) inp.removeAttribute('aria-invalid');
            err.textContent = '';
        }
    }

    function validateForm() {
        var ok = true;
        var name = el('rez-name').value.trim();
        var phone = el('rez-phone').value.trim();
        var plate = el('rez-plate').value.trim();
        var vehicleEl = el('rez-vehicle');
        var vehicle = vehicleEl ? vehicleEl.value.trim() : '';
        var email = el('rez-email').value.trim();
        var consent = el('rez-consent').checked;

        if (name.length < 3) { setFieldError('rez-f-name', 'rez-e-name', 'Podaj imię i nazwisko.'); ok = false; }
        else setFieldError('rez-f-name', 'rez-e-name', '');

        var phoneDigits = phone.replace(/[^0-9]/g, '');
        if (phoneDigits.length < 9) { setFieldError('rez-f-phone', 'rez-e-phone', 'Podaj poprawny numer telefonu.'); ok = false; }
        else setFieldError('rez-f-phone', 'rez-e-phone', '');

        if (plate.length < 3) { setFieldError('rez-f-plate', 'rez-e-plate', 'Podaj numer rejestracyjny.'); ok = false; }
        else setFieldError('rez-f-plate', 'rez-e-plate', '');

        if (vehicleEl) {
            if (vehicle.length < 2) { setFieldError('rez-f-vehicle', 'rez-e-vehicle', 'Podaj markę i model.'); ok = false; }
            else setFieldError('rez-f-vehicle', 'rez-e-vehicle', '');
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError('rez-f-email', 'rez-e-email', 'Podaj poprawny adres e-mail.'); ok = false;
        } else setFieldError('rez-f-email', 'rez-e-email', '');

        if (!consent) { el('rez-e-consent').textContent = 'Zaznacz zgodę, aby kontynuować.'; ok = false; }
        else el('rez-e-consent').textContent = '';

        return ok;
    }

    /* ---------- Wysyłka ---------- */

    function handleSubmit() {
        if (!isComplete()) { openStep(2); return; }

        // upewnij się, że krok 3 jest otwarty zanim pokażemy błędy formularza
        openStep(3);
        if (!validateForm()) {
            var firstErr = document.querySelector('.rez-field.invalid input, .rez-field.invalid textarea');
            if (firstErr) firstErr.focus();
            return;
        }

        var sub = currentSubtypeObj();
        var startISO = state.date + 'T' + state.slot + ':00';
        var startMin = (+state.slot.split(':')[0]) * 60 + (+state.slot.split(':')[1]);
        var endMin = startMin + sub.duration;
        var endISO = state.date + 'T' + minutesToHHMM(endMin) + ':00';

        var payload = {
            resource: SERVICES[state.service].resource,
            serviceKey: state.service,
            subtypeKey: state.subtype,
            service: SERVICES[state.service].label,
            subtype: sub.label,
            date: state.date,
            time: state.slot,
            durationMin: sub.duration,
            startISO: startISO,
            endISO: endISO,
            customer: {
                name: el('rez-name').value.trim(),
                phone: el('rez-phone').value.trim(),
                plate: el('rez-plate').value.trim().toUpperCase(),
                vehicle: (el('rez-vehicle') ? el('rez-vehicle').value.trim() : ''),
                email: el('rez-email').value.trim(),
                notes: el('rez-notes').value.trim()
            }
        };

        var btn = el('rez-submit');
        btn.disabled = true;
        var original = btn.textContent;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>Rezerwuję…';
        el('rez-form-error').innerHTML = '';

        submitBooking(payload).then(function (res) {
            showSuccess(payload, res.ref);
        }).catch(function (err) {
            btn.disabled = false;
            btn.textContent = original;

            // Slot zajęty w międzyczasie – wróć do wyboru godziny i odśwież.
            if (err && err.status === 409) {
                openStep(2);
                state.slot = null;
                updateSummary();
                updateSubmit();
                refreshSlots();
            }

            var serverMsg = (err && err.message && err.message.indexOf('HTTP') === -1
                && err.message.toLowerCase().indexOf('failed') === -1) ? err.message : null;
            var msg = serverMsg || 'Nie udało się zapisać rezerwacji. Spróbuj ponownie lub zadzwoń:';
            el('rez-form-error').innerHTML =
                '<div class="rez-alert"><i class="fas fa-triangle-exclamation"></i>'
                + '<span>' + escapeHtml(msg) + ' '
                + '<a href="tel:' + STATION_PHONE + '" style="color:var(--primary-red);font-weight:700;">796 995 620</a>.</span></div>';
        });
    }

    function showSuccess(payload, ref) {
        el('rez-widget').hidden = true;
        var recap = el('rez-recap');
        recap.innerHTML =
            row('Usługa', payload.service) +
            (payload.subtype && payload.subtype !== payload.service ? row('Szczegóły', payload.subtype) : '') +
            row('Dzień', dateLong(payload.date)) +
            row('Godzina', payload.time) +
            row('Pojazd', payload.customer.plate + (payload.customer.vehicle ? ' · ' + payload.customer.vehicle : ''));
        el('rez-ref-num').textContent = ref;
        var box = el('rez-success');
        box.hidden = false;
        box.querySelector('h2').setAttribute('tabindex', '-1');
        box.querySelector('h2').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function row(dt, dd) {
        return '<div class="rez-summary-row"><dt>' + dt + '</dt><dd>' + escapeHtml(dd) + '</dd></div>';
    }

    function escapeHtml(s) {
        return ('' + s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ---------- Init ---------- */

    function init() {
        if (!el('rez-widget')) return;
        renderServices();
        renderDays();
        setupEditButtons();
        updateSummary();
        el('rez-submit').addEventListener('click', handleSubmit);
        // czyszczenie błędów przy edycji pól
        ['rez-name', 'rez-phone', 'rez-plate', 'rez-vehicle', 'rez-email'].forEach(function (id) {
            var input = el(id);
            if (input) input.addEventListener('input', function () {
                var field = input.closest('.rez-field');
                if (field && field.classList.contains('invalid')) validateForm();
            });
        });
        el('rez-consent').addEventListener('change', function () {
            if (el('rez-consent').checked) el('rez-e-consent').textContent = '';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
