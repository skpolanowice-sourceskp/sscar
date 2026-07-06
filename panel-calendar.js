/* =============================================================
   SSCAR – Panel: widok Kalendarz (reskin Google Calendar).
   Podziałka 10 min, widok Dzień / Tydzień, odczyt z events.php.
   Rejestruje się jako window.PanelViews.calendar.
   Zapis (tworzenie/edycja/przesuwanie) dochodzi w kroku 3 (extendDrawer).
   ============================================================= */
(function () {
    'use strict';

    var PPM = 2.6;            // px na minutę (10 min = 26 px, godzina = 156 px) – szersza podziałka, łatwiej trafić
    var GUTTER = 56;         // szerokość rynny z godzinami
    var DEFAULT_OPEN = 7;
    var DEFAULT_CLOSE = 20;

    var DOW_SHORT = ['niedz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
    var MON_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
    var MON_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

    var api = null;
    var host = null;
    var st = {
        view: 'day',         // 'day' | 'week' – domyślnie pojedynczy dzień (obsługa pracuje „na dziś")
        anchor: null,        // Date (lokalny) – dzień bazowy
        loadToken: 0,
        events: [],
        days: [],
        nowTimer: null,      // interwał odświeżający linię „teraz" na żywo
        pollTimer: null,     // interwał cichego dociągania zmian z serwera (live-update)
        saving: 0            // liczba trwających zapisów w tle (PATCH/POST/DELETE) – wstrzymują polling
    };

    /* ---------- Daty ---------- */
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function fromISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function mondayOf(d) { var x = new Date(d); var off = (x.getDay() + 6) % 7; return addDays(x, -off); }

    // Wyciąga ścianę zegara z ISO (kalendarz jest w strefie stacji – ignorujemy offset).
    function parseLocal(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
        if (!m) return null;
        return { date: m[1] + '-' + m[2] + '-' + m[3], min: (+m[4]) * 60 + (+m[5]) };
    }

    /* ---------- Zakres widoku ---------- */
    function viewDates() {
        if (st.view === 'day') return [toISO(st.anchor)];
        var mon = mondayOf(st.anchor);
        var out = [];
        for (var i = 0; i < 6; i++) out.push(toISO(addDays(mon, i))); // Pn–Sob (niedziela zamknięta)
        return out;
    }

    function dayMeta(iso) {
        for (var i = 0; i < st.days.length; i++) if (st.days[i].date === iso) return st.days[i];
        return null;
    }

    // Granice pionowe siatki: min(open) .. max(close) wśród dni otwartych.
    function bounds() {
        var open = 24, close = 0;
        st.days.forEach(function (d) {
            if (d.open != null) open = Math.min(open, d.open);
            if (d.close != null) close = Math.max(close, d.close);
        });
        if (open >= close) { open = DEFAULT_OPEN; close = DEFAULT_CLOSE; }
        return { open: open, close: close };
    }

    /* ---------- Render: powłoka ---------- */
    function mount(theHost, theApi) {
        host = theHost; api = theApi;
        if (!st.anchor) st.anchor = startOfToday();
        host.innerHTML =
            '<div class="pnl-cal">' +
                '<div class="pnl-cal-toolbar">' +
                    '<div class="pnl-cal-nav">' +
                        '<button type="button" class="pnl-btn pnl-btn-subtle" data-nav="today">Dziś</button>' +
                        '<button type="button" class="pnl-iconbtn" data-nav="prev" aria-label="Poprzedni">‹</button>' +
                        '<button type="button" class="pnl-iconbtn" data-nav="next" aria-label="Następny">›</button>' +
                        '<h2 class="pnl-cal-title" id="pnl-cal-title"></h2>' +
                    '</div>' +
                    '<div class="pnl-cal-tools">' +
                        '<button type="button" class="pnl-btn pnl-btn-primary" data-act="create">+ Termin</button>' +
                        '<div class="pnl-seg" role="group" aria-label="Widok">' +
                            '<button type="button" class="pnl-seg-btn" data-view="day">Dzień</button>' +
                            '<button type="button" class="pnl-seg-btn" data-view="week">Tydzień</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="pnl-cal-scroll" id="pnl-cal-scroll"></div>' +
            '</div>' +
            '<div class="pnl-drawer-backdrop" id="pnl-drawer-backdrop" hidden></div>' +
            '<aside class="pnl-drawer" id="pnl-drawer" hidden aria-hidden="true"></aside>';

        host.querySelector('[data-nav="today"]').addEventListener('click', function () { st.anchor = startOfToday(); load(); });
        host.querySelector('[data-nav="prev"]').addEventListener('click', function () { st.anchor = addDays(st.anchor, st.view === 'day' ? -1 : -7); load(); });
        host.querySelector('[data-nav="next"]').addEventListener('click', function () { st.anchor = addDays(st.anchor, st.view === 'day' ? 1 : 7); load(); });
        Array.prototype.forEach.call(host.querySelectorAll('.pnl-seg-btn'), function (b) {
            b.addEventListener('click', function () { st.view = b.dataset.view; load(); });
        });
        host.querySelector('[data-act="create"]').addEventListener('click', function () {
            if (window.PanelCalendarEdit) window.PanelCalendarEdit.openCreate(null);
        });
        host.querySelector('#pnl-drawer-backdrop').addEventListener('click', closeDrawer);
        document.removeEventListener('keydown', onEsc); // bez duplikatów przy ponownym montażu
        document.addEventListener('keydown', onEsc);

        // Linia „teraz" idzie na żywo (bez przeładowania) – przesuwamy ją co 20 s.
        if (st.nowTimer) clearInterval(st.nowTimer);
        st.nowTimer = setInterval(tickNow, 20000);

        // Live-update: co 30 s cichy refetch (bez flasha/skoku scrolla), żeby nowe
        // rezerwacje online / zmiany w Google Calendar pojawiały się same, bez F5.
        if (st.pollTimer) clearInterval(st.pollTimer);
        st.pollTimer = setInterval(autoRefresh, 30000);
        document.removeEventListener('visibilitychange', onVisibility);
        document.addEventListener('visibilitychange', onVisibility);

        load();
    }

    function onEsc(e) { if (e.key === 'Escape') closeDrawer(); }

    // Cichy refetch z serwera, tylko gdy to bezpieczne: karta widoczna, siatka
    // zamontowana, nikt niczego nie przeciąga i nie wisi niedokończony zapis
    // (inaczej refetch mógłby „zgubić" wpis optymistyczny sprzed potwierdzenia).
    function autoRefresh() {
        if (document.hidden || !host || st.saving > 0) return;
        var scroll = host.querySelector('#pnl-cal-scroll');
        if (!scroll || !scroll.querySelector('.pnl-cal-daycol')) return;   // inny widok / nie zamontowany
        if (scroll.querySelector('.is-dragging') || scroll.querySelector('.pnl-cal-ghost')) return;
        for (var i = 0; i < st.events.length; i++) if (st.events[i]._pending) return;
        refresh();
    }

    // Powrót do karty (np. z telefonu/innego okna) = od razu dociągnij świeży grafik.
    function onVisibility() { if (!document.hidden) autoRefresh(); }

    // Przesuwa (tworzy/usuwa) czerwoną linię bieżącej godziny bez przerysowania siatki.
    // Wołane z interwału – dlatego kalendarz „tyka" na żywo, a nie dopiero po odświeżeniu.
    function tickNow() {
        if (!host) return;
        var scroll = host.querySelector('#pnl-cal-scroll');
        if (!scroll || !scroll.querySelector('.pnl-cal-daycol')) return;   // widok nie jest zamontowany
        var b = bounds();
        var now = new Date();
        var iso = toISO(now);
        var min = now.getHours() * 60 + now.getMinutes();
        var inHours = (min >= b.open * 60 && min <= b.close * 60);
        var top = (min - b.open * 60) * PPM;
        Array.prototype.forEach.call(scroll.querySelectorAll('.pnl-cal-daycol'), function (col) {
            var line = col.querySelector('.pnl-now');
            if (col.dataset.date !== iso || !inHours) {
                if (line) line.parentNode.removeChild(line);   // inny dzień / poza godzinami
                return;
            }
            if (!line) {
                line = document.createElement('div');
                line.className = 'pnl-now';
                line.innerHTML = '<span class="pnl-now-dot"></span>';
                col.appendChild(line);
            }
            line.style.top = top + 'px';
        });
    }

    function syncToolbar() {
        Array.prototype.forEach.call(host.querySelectorAll('.pnl-seg-btn'), function (b) {
            b.classList.toggle('is-active', b.dataset.view === st.view);
        });
        var dates = viewDates();
        var title;
        if (st.view === 'day') {
            var d = fromISO(dates[0]);
            title = DOW_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MON_GEN[d.getMonth()] + ' ' + d.getFullYear();
        } else {
            var a = fromISO(dates[0]), b = fromISO(dates[dates.length - 1]);
            var left = a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MON_SHORT[a.getMonth()] : '');
            title = left + '–' + b.getDate() + ' ' + MON_SHORT[b.getMonth()] + ' ' + b.getFullYear();
        }
        host.querySelector('#pnl-cal-title').textContent = title;
    }

    /* ---------- Ładowanie danych ---------- */
    function load() {
        syncToolbar();
        var dates = viewDates();
        var from = dates[0], to = dates[dates.length - 1];
        var token = ++st.loadToken;
        var scroll = host.querySelector('#pnl-cal-scroll');
        scroll.innerHTML = '<div class="pnl-cal-loading">Wczytuję grafik…</div>';

        api('events.php?from=' + from + '&to=' + to).then(function (data) {
            if (token !== st.loadToken) return;
            st.events = data.events || [];
            st.days = data.days || [];
            renderGrid({ autoScroll: true });
        }).catch(function (err) {
            if (token !== st.loadToken) return;
            scroll.innerHTML = '<div class="pnl-cal-loading pnl-cal-error">' +
                'Nie udało się wczytać grafiku' + (err && err.status === 401 ? ' (wygasła sesja – odśwież stronę).' : '.') +
                '</div>';
        });
    }

    // Cichy refetch bez placeholdera „Wczytuję…" i bez skoku scrolla – do pogodzenia
    // stanu optymistycznego z prawdą serwera, gdy zajdzie potrzeba (współdzieli loadToken,
    // więc nawigacja w trakcie zawsze wygrywa).
    function refresh() {
        var dates = viewDates();
        var from = dates[0], to = dates[dates.length - 1];
        var token = ++st.loadToken;
        api('events.php?from=' + from + '&to=' + to).then(function (data) {
            if (token !== st.loadToken) return;
            st.events = data.events || [];
            st.days = data.days || [];
            renderGrid({ keepScroll: true });
        }).catch(function () { /* cichy – zostaje stan optymistyczny */ });
    }

    /* ---------- Lokalne mutacje magazynu (optymistyczny UI) ----------
       Zmiany nanosimy najpierw na st.events i przerysowujemy siatkę BEZ sieci,
       a zapis do backendu leci w tle. Dzięki temu przeciąganie / edycja / tworzenie
       są natychmiastowe, a nie „przeładowują cały kalendarz". */
    function eventIndex(id) {
        for (var i = 0; i < st.events.length; i++) if (st.events[i].id === id) return i;
        return -1;
    }
    // Nanosi patch na wydarzenie i przerysowuje; zwraca snapshot poprzednich wartości
    // (tylko zmienianych pól) do ewentualnego wycofania po błędzie sieci.
    function applyLocal(id, patch) {
        var i = eventIndex(id);
        if (i < 0) return null;
        var prev = {}, k;
        for (k in patch) if (patch.hasOwnProperty(k)) prev[k] = st.events[i][k];
        for (k in patch) if (patch.hasOwnProperty(k)) st.events[i][k] = patch[k];
        renderGrid({ keepScroll: true });
        return prev;
    }
    function addLocal(ev) {
        st.events.push(ev);
        renderGrid({ keepScroll: true });
    }
    function removeLocal(id) {
        var i = eventIndex(id);
        if (i < 0) return null;
        var ev = st.events.splice(i, 1)[0];
        renderGrid({ keepScroll: true });
        return ev;
    }

    /* ---------- Toast (błędy zapisu w tle) ---------- */
    function toast(msg, type) {
        var box = host || document.body;
        var t = document.createElement('div');
        t.className = 'pnl-toast' + (type === 'error' ? ' pnl-toast--error' : '');
        t.setAttribute('role', 'status');
        t.textContent = msg;
        box.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('is-in'); });
        setTimeout(function () {
            t.classList.remove('is-in');
            setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
        }, 3400);
    }

    /* ---------- Render: siatka ---------- */
    function renderGrid(opts) {
        opts = opts || {};
        var scroll = host.querySelector('#pnl-cal-scroll');
        var prevScroll = scroll.scrollTop;   // zachowaj pozycję przy przerysowaniu lokalnym
        var dates = viewDates();
        var b = bounds();
        var totalMin = (b.close - b.open) * 60;
        var bodyH = totalMin * PPM;

        // Nagłówki kolumn (sticky)
        var head = '<div class="pnl-cal-head" style="grid-template-columns:' + GUTTER + 'px repeat(' + dates.length + ',minmax(0,1fr))">';
        head += '<div class="pnl-cal-corner"></div>';
        var todayISO = toISO(startOfToday());
        dates.forEach(function (iso) {
            var d = fromISO(iso), meta = dayMeta(iso);
            var cls = 'pnl-cal-dayhead' + (iso === todayISO ? ' is-today' : '') + (meta && meta.closed ? ' is-closed' : '');
            var chips = st.events.filter(function (e) {
                if (!e.allDay) return false; var p = parseLocal(e.start); return p && p.date === iso;
            }).map(function (e) {
                return '<button type="button" class="pnl-ev-chip pnl-ev--' + evClass(e) + (e._pending ? ' is-pending' : '') + '" data-id="' + escAttr(e.id) + '">' + escHtml(evTitle(e)) + '</button>';
            }).join('');
            head += '<div class="' + cls + '">' +
                '<span class="pnl-cal-dow">' + DOW_SHORT[d.getDay()] + '</span>' +
                '<span class="pnl-cal-date">' + d.getDate() + '</span>' +
                (meta && meta.holiday ? '<span class="pnl-cal-flag">święto</span>' : (meta && meta.closed ? '<span class="pnl-cal-flag">nieczynne</span>' : '')) +
                (chips ? '<div class="pnl-cal-allday">' + chips + '</div>' : '') +
                '</div>';
        });
        head += '</div>';

        // Ciało: rynna + kolumny dni
        var body = '<div class="pnl-cal-body" style="grid-template-columns:' + GUTTER + 'px repeat(' + dates.length + ',minmax(0,1fr));height:' + bodyH + 'px">';
        body += '<div class="pnl-cal-gutter">';
        for (var h = b.open; h <= b.close; h++) {
            body += '<div class="pnl-cal-hour" style="top:' + ((h - b.open) * 60 * PPM) + 'px">' + pad(h) + ':00</div>';
        }
        body += '</div>';

        dates.forEach(function (iso) {
            var meta = dayMeta(iso);
            var closedOverlay = (meta && meta.closed)
                ? '<div class="pnl-cal-closedlay">' + (meta.holiday ? 'święto' : 'nieczynne') + '</div>' : '';
            body += '<div class="pnl-cal-daycol" data-date="' + iso + '" style="background-size:100% ' + (60 * PPM) + 'px,100% ' + (30 * PPM) + 'px,100% ' + (10 * PPM) + 'px">' +
                closedOverlay + renderDayEvents(iso, b) + renderNow(iso, b) +
                '</div>';
        });
        body += '</div>';

        scroll.innerHTML = head + body;

        // Klik w wydarzenie (bloki w siatce + chipy całodniowe w nagłówku)
        Array.prototype.forEach.call(scroll.querySelectorAll('.pnl-ev, .pnl-ev-chip'), function (node) {
            node.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = node.dataset.id;
                var ev = st.events.filter(function (x) { return x.id === id; })[0];
                if (ev) openDrawer(ev);
            });
        });
        // Tworzenie w pustym obszarze dnia (klik lub przeciągnięcie od–do) obsługuje
        // moduł edycji w enhanceGrid – ma tam kontekst PPM i granic siatki.

        // Auto-scroll do godziny otwarcia (lub „teraz") tylko przy świeżym wczytaniu widoku.
        // Przy przerysowaniu lokalnym (przeciągnięcie/edycja/tworzenie) trzymamy pozycję.
        if (opts.autoScroll) {
            var now = new Date();
            var focusMin = (toISO(now) >= dates[0] && toISO(now) <= dates[dates.length - 1])
                ? Math.max(0, now.getHours() * 60 + now.getMinutes() - b.open * 60 - 60) : 0;
            scroll.scrollTop = focusMin * PPM;
        } else {
            scroll.scrollTop = prevScroll;
        }

        // Hak edycji (krok 3): przeciąganie / zmiana długości.
        if (window.PanelCalendarEdit && typeof window.PanelCalendarEdit.enhanceGrid === 'function') {
            window.PanelCalendarEdit.enhanceGrid(scroll, { ppm: PPM, open: b.open, close: b.close, events: st.events });
        }
    }

    function renderDayEvents(iso, b) {
        var evs = st.events.filter(function (e) {
            if (e.allDay) return false;
            var p = parseLocal(e.start);
            return p && p.date === iso;
        }).map(function (e) {
            var s = parseLocal(e.start), en = parseLocal(e.end);
            var startMin = s.min;
            var endMin = en ? (en.date > iso ? b.close * 60 : en.min) : startMin + 10;
            if (endMin <= startMin) endMin = startMin + 10;
            return { ev: e, startMin: startMin, endMin: endMin };
        });
        packLanes(evs);

        var html = '';
        evs.forEach(function (it) {
            var top = (it.startMin - b.open * 60) * PPM;
            var hgt = Math.max((it.endMin - it.startMin) * PPM, 15);
            var lanes = it._lanes || 1, lane = it._lane || 0;
            var widthPct = 100 / lanes, leftPct = lane * widthPct;
            var e = it.ev;
            var t1 = minLabel(it.startMin), t2 = minLabel(it.endMin);
            var tier = hgt < 34 ? ' is-xs' : '';   // ≈10 min (motocykl/klima) → kompaktowy, jednoliniowy kafelek
            html += '<button type="button" class="pnl-ev pnl-ev--' + evClass(e) + tier + (e._pending ? ' is-pending' : '') + '" data-id="' + escAttr(e.id) + '" ' +
                'style="top:' + top + 'px;height:' + hgt + 'px;left:calc(' + leftPct + '% + 2px);width:calc(' + widthPct + '% - 4px)">' +
                evBody(e, t1, t2, tier) +
                '</button>';
        });
        return html;
    }

    function renderNow(iso, b) {
        var now = new Date();
        if (toISO(now) !== iso) return '';
        var min = now.getHours() * 60 + now.getMinutes();
        if (min < b.open * 60 || min > b.close * 60) return '';
        var top = (min - b.open * 60) * PPM;
        return '<div class="pnl-now" style="top:' + top + 'px"><span class="pnl-now-dot"></span></div>';
    }

    // Pakowanie nakładających się wydarzeń w kolumny (rzadkie – tylko ręczne wpisy Google).
    function packLanes(items) {
        items.sort(function (a, c) { return a.startMin - c.startMin || a.endMin - c.endMin; });
        var cluster = [], cols = [], clusterEnd = -1;
        function flush() {
            var n = 0;
            cluster.forEach(function (x) { n = Math.max(n, x._lane + 1); });
            cluster.forEach(function (x) { x._lanes = n; });
            cluster = []; cols = []; clusterEnd = -1;
        }
        items.forEach(function (x) {
            if (clusterEnd !== -1 && x.startMin >= clusterEnd) flush();
            var placed = false;
            for (var i = 0; i < cols.length; i++) {
                if (cols[i] <= x.startMin) { cols[i] = x.endMin; x._lane = i; placed = true; break; }
            }
            if (!placed) { x._lane = cols.length; cols.push(x.endMin); }
            cluster.push(x);
            clusterEnd = Math.max(clusterEnd, x.endMin);
        });
        flush();
    }

    function evClass(e) {
        if (e.type === 'blok') return 'block';
        if (e.type === 'inne') return 'other';
        if (e.service === 'przedzakupem') return 'buy';
        if (e.service === 'klimatyzacja') return 'ac';
        return 'tech';
    }
    function evTitle(e) {
        if (e.type === 'rezerwacja') return e.title || (e.subtypeLabel + ' · ' + e.plate);
        return e.title || (e.type === 'blok' ? 'Blokada' : 'Wpis');
    }
    // Treść kafelka w siatce. Wysokość decyduje o gęstości informacji:
    //  • bardzo krótkie terminy (≈10 min – motocykl, klima) → jedna linia poziomo
    //    (godzina startu + auto/nr rej. + telefon) — inaczej nic by się nie zmieściło;
    //  • wyższe kafelki → pionowa lista priorytetowa (marka/model, telefon, nr rej.,
    //    wariant usługi, nazwisko); nadmiar przycina overflow, więc im wyższy blok,
    //    tym więcej widać „na rzut oka".
    function evLine(cls, txt) { return '<span class="' + cls + '">' + escHtml(txt) + '</span>'; }

    function evBody(e, t1, t2, tier) {
        if (tier === ' is-xs') {
            var m = (e.type === 'rezerwacja') ? (e.vehicle || e.plate || e.subtypeLabel || '') : evTitle(e);
            var s = '<span class="pnl-ev-time">' + t1 + '</span>';
            if (m) s += '<span class="pnl-ev-main">' + escHtml(m) + '</span>';
            if (e.type === 'rezerwacja' && e.phone) s += '<span class="pnl-ev-phone">' + escHtml(fmtPhone(e.phone)) + '</span>';
            return s;
        }
        var html = '<span class="pnl-ev-time">' + t1 + '–' + t2 + '</span>';
        if (e.type !== 'rezerwacja') return html + evLine('pnl-ev-title', evTitle(e));
        var idMain = e.vehicle || e.plate || e.subtypeLabel || '';
        if (idMain) html += evLine('pnl-ev-title', idMain);
        if (e.phone) html += evLine('pnl-ev-sub', fmtPhone(e.phone));
        if (e.plate && e.vehicle) html += evLine('pnl-ev-meta', e.plate);              // marka jest tytułem → dołóż nr rej.
        if (e.subtypeLabel && (e.vehicle || e.plate)) html += evLine('pnl-ev-meta', e.subtypeLabel);
        if (e.name) html += evLine('pnl-ev-meta', e.name);
        return html;
    }
    // Telefon „na ładnie": 9 cyfr → XXX XXX XXX; w innym wypadku surowo.
    function fmtPhone(p) {
        var d = ('' + (p == null ? '' : p)).replace(/\D+/g, '');
        if (d.length === 9) return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
        if (d.length === 11 && d.slice(0, 2) === '48') { d = d.slice(2); return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6); }
        return ('' + p).trim();
    }
    function minLabel(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

    /* ---------- Szuflada ---------- */
    // Otwiera szufladę z dowolną treścią (używane przez moduł edycji – krok 3).
    function openDrawerHtml(html) {
        var dr = host.querySelector('#pnl-drawer');
        var bd = host.querySelector('#pnl-drawer-backdrop');
        dr.innerHTML = html;
        dr.hidden = false; bd.hidden = false;
        dr.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function () { dr.classList.add('is-open'); });
        var close = dr.querySelector('[data-close]');
        if (close) { close.addEventListener('click', closeDrawer); }
        return dr;
    }

    function openDrawer(ev) {
        var dr = openDrawerHtml(drawerHtml(ev));
        var close = dr.querySelector('[data-close]');
        if (close) close.focus();
        // Punkt rozszerzenia dla kroku 3 (przyciski edycji/usuwania).
        if (window.PanelCalendarEdit && window.PanelCalendarEdit.decorateDrawer) {
            window.PanelCalendarEdit.decorateDrawer(dr, ev, { close: closeDrawer, reload: load });
        }
    }

    function closeDrawer() {
        var dr = host.querySelector('#pnl-drawer');
        var bd = host.querySelector('#pnl-drawer-backdrop');
        if (!dr || dr.hidden) return;
        dr.classList.remove('is-open');
        dr.setAttribute('aria-hidden', 'true');
        setTimeout(function () { dr.hidden = true; bd.hidden = true; }, 180);
    }

    function drawerHtml(ev) {
        var s = parseLocal(ev.start), en = parseLocal(ev.end);
        var d = s ? fromISO(s.date) : null;
        var when = d ? (DOW_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MON_GEN[d.getMonth()]) : '';
        var time = ev.allDay ? 'cały dzień' : (s ? minLabel(s.min) + '–' + (en ? minLabel(en.min) : '') : '');
        var badge = ev.type === 'rezerwacja' ? 'Rezerwacja online' : (ev.type === 'blok' ? 'Blokada' : 'Wpis kalendarza');

        var rows = '';
        function row(k, v) { return v ? '<div class="pnl-dl-row"><dt>' + k + '</dt><dd>' + escHtml(v) + '</dd></div>' : ''; }
        if (ev.type === 'rezerwacja') {
            rows += row('Usługa', ev.serviceLabel);
            rows += row('Wariant', ev.subtypeLabel);
            rows += row('Pojazd', (ev.plate || '') + (ev.vehicle ? ' (' + ev.vehicle + ')' : ''));
            rows += row('Klient', ev.name);
            rows += row('Telefon', ev.phone);
            rows += row('E-mail', ev.email);
            rows += row('Uwagi', ev.notes);
            rows += row('Nr', ev.ref);
        } else {
            rows += row('Tytuł', ev.title);
            rows += row('Opis', ev.description);
        }

        return '<div class="pnl-drawer-head">' +
                '<span class="pnl-ev-badge pnl-ev--' + evClass(ev) + '">' + badge + '</span>' +
                '<button type="button" class="pnl-iconbtn" data-close aria-label="Zamknij">✕</button>' +
            '</div>' +
            '<div class="pnl-drawer-when"><strong>' + escHtml(when) + '</strong><span>' + escHtml(time) + '</span></div>' +
            '<dl class="pnl-dl">' + rows + '</dl>' +
            '<div class="pnl-drawer-actions" id="pnl-drawer-actions"></div>';
    }

    /* ---------- util ---------- */
    function escHtml(s) {
        return ('' + (s == null ? '' : s)).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function escAttr(s) { return escHtml(s); }

    // Udostępnij wnętrzności dla modułu edycji (krok 3).
    window.PanelCalendarInternals = {
        reload: function () { load(); },       // pełne wczytanie (placeholder + auto-scroll) – nawigacja
        refresh: refresh,                      // cichy refetch (bez flasha, trzyma scroll)
        applyLocal: applyLocal,                // optymistyczna zmiana wydarzenia (zwraca snapshot do rollbacku)
        addLocal: addLocal,                    // optymistyczne dodanie wydarzenia
        removeLocal: removeLocal,              // optymistyczne usunięcie (zwraca wydarzenie do rollbacku)
        toast: toast,
        saveBegin: function () { st.saving++; },                       // zapis w tle startuje – wstrzymaj polling
        saveEnd: function () { if (st.saving > 0) st.saving--; },      // zapis w tle skończony
        getState: function () { return st; },
        parseLocal: parseLocal,
        openDrawerHtml: openDrawerHtml,
        closeDrawer: closeDrawer,
        ppm: PPM
    };

    window.PanelViews = window.PanelViews || {};
    window.PanelViews.calendar = { mount: mount };
})();
