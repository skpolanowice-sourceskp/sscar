/* =============================================================
   SSCAR – Panel: edycja kalendarza (krok 3).
   Tworzenie rezerwacji/blokad, edycja w szufladzie, usuwanie oraz
   przeciąganie / zmiana długości wprost na siatce.
   Rejestruje się jako window.PanelCalendarEdit; korzysta z
   window.PanelAPI oraz window.PanelCalendarInternals.
   ============================================================= */
(function () {
    'use strict';

    function api() { return window.PanelAPI.api.apply(null, arguments); }
    function I() { return window.PanelCalendarInternals; }

    var meta = null;
    var gridCtx = null;   // {ppm, open, close, events} z enhanceGrid

    /* ---------- util ---------- */
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function minToHHMM(m) { m = Math.max(0, Math.min(1439, m)); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
    function hhmmToMin(s) { var p = (s || '').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
    function esc(s) {
        return ('' + (s == null ? '' : s)).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function val(id) { var n = document.getElementById(id); return n ? n.value.trim() : ''; }

    function loadMeta() {
        if (meta) return Promise.resolve(meta);
        return api('meta.php').then(function (m) { meta = m; return m; });
    }

    /* ---------- Optymistyczny UI ----------
       Wszystkie zapisy (tworzenie/edycja/przesuwanie/usuwanie) nanosimy natychmiast
       na lokalny magazyn kalendarza i przerysowujemy siatkę bez sieci; request do
       backendu leci w tle. Błąd → wycofanie zmiany (rollback) + toast. */
    function tempId() { return 'tmp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6); }

    // Etykiety usługi/wariantu z meta (render kafelka i szuflady ich potrzebuje).
    function labelsFor(serviceKey, subtypeKey) {
        var s = findService(serviceKey);
        var out = { serviceLabel: s ? s.label : serviceKey, subtypeLabel: subtypeKey };
        if (s) for (var i = 0; i < s.subtypes.length; i++) if (s.subtypes[i].key === subtypeKey) { out.subtypeLabel = s.subtypes[i].label; break; }
        return out;
    }

    // Optymistyczne wydarzenie „rezerwacja" z danych formularza (kształt jak z events.php).
    function bookingEventShape(id, b, startISO, endISO) {
        var lab = labelsFor(b.service, b.subtype);
        return {
            id: id, type: 'rezerwacja', source: 'db', allDay: false,
            start: startISO, end: endISO,
            service: b.service, serviceLabel: lab.serviceLabel, subtypeLabel: lab.subtypeLabel,
            plate: b.customer.plate, vehicle: b.customer.vehicle, phone: b.customer.phone,
            name: b.customer.name, email: b.customer.email, notes: b.customer.notes,
            title: lab.subtypeLabel + (b.customer.plate ? ' · ' + b.customer.plate : '')
        };
    }

    // Tworzenie: dodaj wpis lokalnie (pending), zapisz w tle, po sukcesie podmień
    // tymczasowe id na realne z serwera (bez refetchu), po błędzie usuń + toast.
    function createInBackground(payload, optEv) {
        I().closeDrawer();
        optEv._pending = true;
        I().addLocal(optEv);
        I().saveBegin();
        api('event.php', { method: 'POST', json: payload }).then(function (res) {
            I().applyLocal(optEv.id, { id: (res && res.id) || optEv.id, ref: (res && res.ref) || optEv.ref, _pending: false });
        }).catch(function (err) {
            I().removeLocal(optEv.id);
            I().toast((err && err.message) || 'Nie udało się zapisać terminu.', 'error');
        }).then(function () { I().saveEnd(); });
    }

    // Edycja/przesunięcie: nanieś patch lokalnie, zapisz w tle, po błędzie wycofaj + toast.
    function patchInBackground(id, patch, payload) {
        I().closeDrawer();
        var prev = I().applyLocal(id, patch);
        I().saveBegin();
        api('event.php', { method: 'PATCH', json: payload }).catch(function (err) {
            if (prev) I().applyLocal(id, prev);
            I().toast((err && err.message) || 'Nie udało się zapisać zmian.', 'error');
        }).then(function () { I().saveEnd(); });
    }

    function findService(key) {
        var list = (meta && meta.services) || [];
        for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
        return list[0] || null;
    }
    function serviceOptions(sel) {
        return ((meta && meta.services) || []).map(function (s) {
            return '<option value="' + esc(s.key) + '"' + (s.key === sel ? ' selected' : '') + '>' + esc(s.label) + '</option>';
        }).join('');
    }
    function subtypeOptions(serviceKey, sel) {
        var s = findService(serviceKey);
        if (!s) return '';
        return s.subtypes.map(function (st) {
            return '<option value="' + esc(st.key) + '" data-dur="' + st.duration + '"' + (st.key === sel ? ' selected' : '') + '>'
                + esc(st.label) + ' · ' + st.duration + ' min</option>';
        }).join('');
    }

    /* ---------- Pola rezerwacji ---------- */
    // opts.clientToggle (tylko przy tworzeniu) dorzuca pola jako opcjonalne + checkbox
    // „Dodaj klienta do bazy" – admin może wbić sam termin / szybką blokadę bez danych klienta.
    function bookingFieldsHtml(v, opts) {
        var toggle = (opts && opts.clientToggle)
            ? '<label class="pnl-check"><input type="checkbox" id="ce-addclient"' + (v.addClient === false ? '' : ' checked') + '> Dodaj klienta do bazy</label>' +
              '<p class="pnl-check-hint">Dane klienta są opcjonalne. Odznacz, gdy to tylko szybka blokada slota — baza klientów zostanie czysta. Dopisanie do bazy wymaga telefonu.</p>'
            : '';
        var custHint = (opts && opts.clientToggle) ? ' (opcjonalnie)' : '';
        return '' +
            '<label class="pnl-field"><span class="pnl-label">Data</span><input type="date" id="ce-date" value="' + esc(v.date) + '"></label>' +
            '<label class="pnl-field"><span class="pnl-label">Usługa</span><select id="ce-service">' + serviceOptions(v.service) + '</select></label>' +
            '<label class="pnl-field"><span class="pnl-label">Wariant</span><select id="ce-subtype"></select></label>' +
            '<div class="pnl-form-row">' +
                '<label class="pnl-field"><span class="pnl-label">Godzina</span><input type="time" id="ce-time" step="600" value="' + esc(v.time) + '"></label>' +
                '<label class="pnl-field"><span class="pnl-label">Czas (min)</span><input type="number" id="ce-dur" min="5" step="5" value="' + esc(v.dur) + '"></label>' +
            '</div>' +
            '<label class="pnl-field"><span class="pnl-label">Imię i nazwisko' + custHint + '</span><input id="ce-name" value="' + esc(v.name) + '"></label>' +
            '<div class="pnl-form-row">' +
                '<label class="pnl-field"><span class="pnl-label">Telefon' + custHint + '</span><input id="ce-phone" value="' + esc(v.phone) + '"></label>' +
                '<label class="pnl-field"><span class="pnl-label">Nr rej.' + custHint + '</span><input id="ce-plate" value="' + esc(v.plate) + '"></label>' +
            '</div>' +
            '<label class="pnl-field"><span class="pnl-label">Pojazd</span><input id="ce-vehicle" value="' + esc(v.vehicle) + '"></label>' +
            '<label class="pnl-field"><span class="pnl-label">E-mail</span><input id="ce-email" value="' + esc(v.email) + '"></label>' +
            '<label class="pnl-field"><span class="pnl-label">Uwagi</span><textarea id="ce-notes" rows="2">' + esc(v.notes) + '</textarea></label>' +
            toggle;
    }

    function wireServiceSubtype(v) {
        var svc = document.getElementById('ce-service');
        var sub = document.getElementById('ce-subtype');
        var dur = document.getElementById('ce-dur');
        function fillSub(selKey) { sub.innerHTML = subtypeOptions(svc.value, selKey); }
        fillSub(v.subtype);
        function applyDur() {
            var opt = sub.options[sub.selectedIndex];
            if (opt && opt.dataset.dur) dur.value = opt.dataset.dur;
        }
        svc.addEventListener('change', function () { fillSub(null); applyDur(); });
        sub.addEventListener('change', applyDur);
    }

    function readBooking() {
        var addEl = document.getElementById('ce-addclient');
        return {
            date: val('ce-date'),
            time: val('ce-time'),
            dur: parseInt(val('ce-dur'), 10) || 0,
            service: val('ce-service'),
            subtype: val('ce-subtype'),
            addClient: addEl ? addEl.checked : false,
            customer: {
                name: val('ce-name'), phone: val('ce-phone'), plate: val('ce-plate'),
                vehicle: val('ce-vehicle'), email: val('ce-email'), notes: val('ce-notes')
            }
        };
    }

    // opts.lenient (tworzenie) = dane klienta opcjonalne; telefon wymagany tylko gdy
    // zaznaczono dopisanie do bazy (to klucz profilu). Bez opts = edycja, walidacja jak dawniej.
    function validBooking(b, errEl, opts) {
        if (!b.date) { errEl.textContent = 'Podaj datę.'; return false; }
        if (!/^\d{2}:\d{2}$/.test(b.time)) { errEl.textContent = 'Podaj godzinę.'; return false; }
        if (opts && opts.lenient) {
            if (b.addClient && b.customer.phone.replace(/\D/g, '').length < 9) {
                errEl.textContent = 'Aby dopisać klienta do bazy, podaj telefon (albo odznacz „Dodaj klienta do bazy").';
                return false;
            }
            return true;
        }
        if (b.customer.name.length < 2) { errEl.textContent = 'Podaj imię i nazwisko.'; return false; }
        if (b.customer.phone.replace(/\D/g, '').length < 9) { errEl.textContent = 'Podaj poprawny telefon.'; return false; }
        if (b.customer.plate.length < 2) { errEl.textContent = 'Podaj numer rejestracyjny.'; return false; }
        return true;
    }

    /* ---------- Tworzenie ---------- */
    function openCreate(seed) {
        loadMeta().then(function () {
            var date = (seed && seed.date) || todayISO();
            var time = seed && seed.min != null ? minToHHMM(Math.round(seed.min / 10) * 10) : '08:00';
            var firstSvc = (meta.services[0] || { key: '', subtypes: [{}] });
            // Czas trwania z przeciągnięcia na siatce (seed.durationMin) ma pierwszeństwo
            // przed domyślnym czasem pierwszego wariantu usługi.
            var seedDur = (seed && seed.durationMin) ? Math.max(5, seed.durationMin) : null;
            var v = { date: date, time: time, dur: seedDur || (firstSvc.subtypes[0] || {}).duration || 20,
                service: firstSvc.key, subtype: (firstSvc.subtypes[0] || {}).key, name: '', phone: '', plate: '', vehicle: '', email: '', notes: '', addClient: true };

            var html =
                '<div class="pnl-drawer-head"><span class="pnl-form-title">Nowy termin</span>' +
                    '<button type="button" class="pnl-iconbtn" data-close aria-label="Zamknij">✕</button></div>' +
                '<div class="pnl-seg pnl-seg--full" id="ce-kind">' +
                    '<button type="button" class="pnl-seg-btn is-active" data-kind="rezerwacja">Rezerwacja</button>' +
                    '<button type="button" class="pnl-seg-btn" data-kind="blok">Blokada</button>' +
                '</div>' +
                '<form class="pnl-form" id="ce-form" novalidate>' +
                    '<div id="ce-sec-rez">' + bookingFieldsHtml(v, { clientToggle: true }) + '</div>' +
                    '<div id="ce-sec-blok" hidden>' +
                        '<label class="pnl-field"><span class="pnl-label">Opis</span><input id="ce-title" placeholder="np. urlop, przerwa techniczna"></label>' +
                        '<label class="pnl-check"><input type="checkbox" id="ce-allday"> Cały dzień</label>' +
                        '<div class="pnl-form-row" id="ce-blok-time">' +
                            '<label class="pnl-field"><span class="pnl-label">Godzina</span><input type="time" id="ce-btime" step="600" value="' + esc(time) + '"></label>' +
                            '<label class="pnl-field"><span class="pnl-label">Czas (min)</span><input type="number" id="ce-bdur" min="10" step="10" value="' + (seedDur || 60) + '"></label>' +
                        '</div>' +
                    '</div>' +
                    '<p class="pnl-form-error" id="ce-error" role="alert"></p>' +
                    '<div class="pnl-drawer-actions">' +
                        '<button type="button" class="pnl-btn pnl-btn-ghost" data-close>Anuluj</button>' +
                        '<button type="submit" class="pnl-btn pnl-btn-primary" id="ce-save">Zapisz</button>' +
                    '</div>' +
                '</form>';

            I().openDrawerHtml(html);
            wireServiceSubtype(v);

            var kind = 'rezerwacja';
            Array.prototype.forEach.call(document.querySelectorAll('#ce-kind .pnl-seg-btn'), function (b) {
                b.addEventListener('click', function () {
                    kind = b.dataset.kind;
                    Array.prototype.forEach.call(document.querySelectorAll('#ce-kind .pnl-seg-btn'), function (x) { x.classList.toggle('is-active', x === b); });
                    document.getElementById('ce-sec-rez').hidden = (kind !== 'rezerwacja');
                    document.getElementById('ce-sec-blok').hidden = (kind !== 'blok');
                });
            });
            var allday = document.getElementById('ce-allday');
            allday.addEventListener('change', function () { document.getElementById('ce-blok-time').hidden = allday.checked; });

            document.getElementById('ce-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var errEl = document.getElementById('ce-error');
                errEl.textContent = '';
                if (kind === 'blok') {
                    var bdate = val('ce-date'), btitle = val('ce-title');
                    var ballday = allday.checked, btime = val('ce-btime');
                    var bdur = parseInt(val('ce-bdur'), 10) || 60;
                    if (!bdate) { errEl.textContent = 'Podaj datę.'; return; }
                    if (!ballday && !/^\d{2}:\d{2}$/.test(btime)) { errEl.textContent = 'Podaj godzinę.'; return; }
                    var payload = { kind: 'blok', date: bdate, title: btitle, allDay: ballday, time: btime, durationMin: bdur };
                    var optTitle = 'Blokada: ' + (btitle || 'Blokada');
                    var optBlok;
                    if (ballday) {
                        optBlok = { id: tempId(), type: 'blok', allDay: true, start: bdate + 'T00:00:00', end: bdate + 'T00:00:00', title: optTitle };
                    } else {
                        var bm = hhmmToMin(btime);
                        optBlok = { id: tempId(), type: 'blok', allDay: false,
                            start: bdate + 'T' + minToHHMM(bm), end: bdate + 'T' + minToHHMM(bm + bdur), title: optTitle };
                    }
                    createInBackground(payload, optBlok);
                } else {
                    var b = readBooking();
                    if (!validBooking(b, errEl, { lenient: true })) return;
                    var startISO = b.date + 'T' + b.time;
                    var endISO = b.date + 'T' + minToHHMM(hhmmToMin(b.time) + b.dur);
                    var payload2 = { kind: 'rezerwacja', date: b.date, time: b.time, durationMin: b.dur,
                        service: b.service, subtype: b.subtype, addClient: b.addClient, customer: b.customer };
                    createInBackground(payload2, bookingEventShape(tempId(), b, startISO, endISO));
                }
            });
        }).catch(function () { alert('Nie udało się wczytać konfiguracji usług.'); });
    }

    /* ---------- Edycja rezerwacji ---------- */
    function openBookingEdit(ev) {
        loadMeta().then(function () {
            var s = I().parseLocal(ev.start), en = I().parseLocal(ev.end);
            var dur = (s && en) ? (en.min - s.min) : 20;
            var v = {
                date: s ? s.date : todayISO(), time: s ? minToHHMM(s.min) : '08:00', dur: dur,
                service: ev.service, subtype: lookupSubtypeKey(ev),
                name: ev.name || '', phone: ev.phone || '', plate: ev.plate || '', vehicle: ev.vehicle || '', email: ev.email || '', notes: ev.notes || ''
            };
            var html =
                '<div class="pnl-drawer-head"><span class="pnl-form-title">Edytuj rezerwację</span>' +
                    '<button type="button" class="pnl-iconbtn" data-close aria-label="Zamknij">✕</button></div>' +
                '<form class="pnl-form" id="ce-form" novalidate>' + bookingFieldsHtml(v) +
                    '<p class="pnl-form-error" id="ce-error" role="alert"></p>' +
                    '<div class="pnl-drawer-actions">' +
                        '<button type="button" class="pnl-btn pnl-btn-ghost" data-close>Anuluj</button>' +
                        '<button type="submit" class="pnl-btn pnl-btn-primary" id="ce-save">Zapisz zmiany</button>' +
                    '</div>' +
                '</form>';
            I().openDrawerHtml(html);
            wireServiceSubtype(v);
            document.getElementById('ce-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var errEl = document.getElementById('ce-error'); errEl.textContent = '';
                var b = readBooking();
                if (!validBooking(b, errEl, { lenient: true })) return;
                var startISO = b.date + 'T' + b.time;
                var endISO = b.date + 'T' + minToHHMM(hhmmToMin(b.time) + b.dur);
                var payload = { id: ev.id, start: startISO, end: endISO,
                    service: b.service, subtype: b.subtype, customer: b.customer };
                var shape = bookingEventShape(ev.id, b, startISO, endISO);
                // Patch tylko pól wpływających na render (bez id/type/source).
                var patch = { start: startISO, end: endISO,
                    service: shape.service, serviceLabel: shape.serviceLabel, subtypeLabel: shape.subtypeLabel,
                    plate: shape.plate, vehicle: shape.vehicle, phone: shape.phone,
                    name: shape.name, email: shape.email, notes: shape.notes, title: shape.title };
                patchInBackground(ev.id, patch, payload);
            });
        });
    }

    // Klucz wariantu po etykiecie (events.php zwraca subtypeLabel, nie key).
    function lookupSubtypeKey(ev) {
        var s = findService(ev.service);
        if (!s) return '';
        for (var i = 0; i < s.subtypes.length; i++) if (s.subtypes[i].label === ev.subtypeLabel) return s.subtypes[i].key;
        return (s.subtypes[0] || {}).key || '';
    }

    /* ---------- Edycja blokady / wpisu Google (typ „inne") ---------- */
    // Jeden formularz dla blokad i ręcznych wydarzeń z kalendarza – różni je tylko
    // prefiks „Blokada:" (dokładany po stronie serwera na podstawie pola kind).
    function openSimpleEdit(ev) {
        var isBlok = ev.type === 'blok';
        var s = I().parseLocal(ev.start), en = I().parseLocal(ev.end);
        var title = isBlok ? (ev.title || 'Blokada').replace(/^Blokada:\s*/i, '') : (ev.title || '');
        var dur = (s && en && en.min > s.min) ? (en.min - s.min) : 60;
        var heading = isBlok ? 'Edytuj blokadę' : 'Edytuj wpis';
        var labelTitle = isBlok ? 'Opis' : 'Tytuł';
        var html =
            '<div class="pnl-drawer-head"><span class="pnl-form-title">' + heading + '</span>' +
                '<button type="button" class="pnl-iconbtn" data-close aria-label="Zamknij">✕</button></div>' +
            '<form class="pnl-form" id="ce-form" novalidate>' +
                '<label class="pnl-field"><span class="pnl-label">' + labelTitle + '</span><input id="ce-title" value="' + esc(title) + '"></label>' +
                (ev.allDay ? '' :
                '<div class="pnl-form-row">' +
                    '<label class="pnl-field"><span class="pnl-label">Data</span><input type="date" id="ce-date" value="' + esc(s ? s.date : todayISO()) + '"></label>' +
                    '<label class="pnl-field"><span class="pnl-label">Godzina</span><input type="time" id="ce-time" step="600" value="' + esc(s ? minToHHMM(s.min) : '08:00') + '"></label>' +
                '</div>' +
                '<label class="pnl-field"><span class="pnl-label">Czas (min)</span><input type="number" id="ce-dur" min="10" step="10" value="' + dur + '"></label>') +
                '<p class="pnl-form-error" id="ce-error" role="alert"></p>' +
                '<div class="pnl-drawer-actions">' +
                    '<button type="button" class="pnl-btn pnl-btn-ghost" data-close>Anuluj</button>' +
                    '<button type="submit" class="pnl-btn pnl-btn-primary" id="ce-save">Zapisz zmiany</button>' +
                '</div>' +
            '</form>';
        I().openDrawerHtml(html);
        document.getElementById('ce-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var errEl = document.getElementById('ce-error'); errEl.textContent = '';
            var newTitle = val('ce-title');
            var payload = { id: ev.id, kind: isBlok ? 'blok' : 'inne', title: newTitle };
            // Optymistyczny tytuł jak po stronie serwera (blok dostaje prefiks „Blokada:").
            var patch = { title: isBlok ? ('Blokada: ' + (newTitle || 'Blokada')) : (newTitle || '(bez tytułu)') };
            if (!ev.allDay) {
                var date = val('ce-date'), time = val('ce-time'), d = parseInt(val('ce-dur'), 10) || 60;
                if (!date || !/^\d{2}:\d{2}$/.test(time)) { errEl.textContent = 'Podaj datę i godzinę.'; return; }
                payload.start = date + 'T' + time;
                payload.end = date + 'T' + minToHHMM(hhmmToMin(time) + d);
                patch.start = payload.start; patch.end = payload.end;
            }
            patchInBackground(ev.id, patch, payload);
        });
    }

    /* ---------- Akcje w szufladzie szczegółów ---------- */
    function decorateDrawer(dr, ev, ctx) {
        var actions = dr.querySelector('#pnl-drawer-actions');
        if (!actions) return;
        // Każdy wpis da się edytować bez kasowania: rezerwacja pełnym formularzem,
        // blokady i ręczne wydarzenia Google – tytułem/terminem.
        var canEdit = true;
        var delLabel = ev.type === 'rezerwacja' ? 'Anuluj rezerwację' : 'Usuń';
        actions.innerHTML =
            (canEdit ? '<button type="button" class="pnl-btn pnl-btn-subtle" data-edit>Edytuj</button>' : '') +
            '<button type="button" class="pnl-btn pnl-btn-danger" data-del>' + delLabel + '</button>';
        if (canEdit) actions.querySelector('[data-edit]').addEventListener('click', function () {
            if (ev.type === 'rezerwacja') openBookingEdit(ev); else openSimpleEdit(ev);
        });
        actions.querySelector('[data-del]').addEventListener('click', function () {
            var msg = ev.type === 'rezerwacja'
                ? 'Anulować rezerwację ' + (ev.plate || '') + '? Tej operacji nie można cofnąć.'
                : 'Usunąć ten wpis z kalendarza?';
            if (!window.confirm(msg)) return;
            // Optymistycznie: zamknij szufladę i zdejmij wpis od razu, kasuj w tle.
            ctx.close();
            var removed = I().removeLocal(ev.id);
            I().saveBegin();
            api('event.php', { method: 'DELETE', json: { id: ev.id } }).catch(function (err) {
                if (removed) I().addLocal(removed);   // wróć wpis, jeśli backend odmówił
                I().toast((err && err.message) || 'Nie udało się usunąć.', 'error');
            }).then(function () { I().saveEnd(); });
        });
    }

    /* ---------- Przeciąganie / zmiana długości na siatce ---------- */
    function enhanceGrid(scroll, ctx) {
        gridCtx = ctx;
        Array.prototype.forEach.call(scroll.querySelectorAll('.pnl-ev'), function (node) {
            var ev = (ctx.events || []).filter(function (x) { return x.id === node.dataset.id; })[0];
            if (!ev || ev.allDay || ev._pending) return;   // wpisy w trakcie zapisu nieedytowalne
            // uchwyt zmiany długości
            var handle = document.createElement('div');
            handle.className = 'pnl-ev-resize';
            node.appendChild(handle);
            node.addEventListener('pointerdown', function (e) { startDrag(e, node, ev, 'move'); });
            handle.addEventListener('pointerdown', function (e) { e.stopPropagation(); startDrag(e, node, ev, 'resize'); });
        });
        // Tworzenie terminu wprost na siatce: klik = domyślny czas, przeciągnięcie
        // od–do = od razu zadana długość (jak w Google Calendar).
        Array.prototype.forEach.call(scroll.querySelectorAll('.pnl-cal-daycol'), function (col) {
            col.addEventListener('pointerdown', function (e) {
                if (e.button !== undefined && e.button !== 0) return;
                if (e.target !== col) return; // tylko puste miejsce, nie blok wydarzenia
                startCreateDrag(e, col);
            });
        });
    }

    // Rysowanie nowego terminu przeciągnięciem na pustej kolumnie dnia.
    // Model „kratki": kursor wskazuje konkretną 10-min kratkę (FLOOR, nie zaokrąglenie
    // do najbliższej linii) – dzięki temu klik/przeciągnięcie zaczyna się DOKŁADNIE w tej
    // kratce, w którą celujesz, a nie w sąsiedniej (naprawa „trafia w kratkę niżej/wyżej").
    function startCreateDrag(e, col) {
        var ppm = gridCtx.ppm;
        var cell = 10 * ppm;                         // px na jedną 10-min kratkę
        var openMin = gridCtx.open * 60, closeMin = gridCtx.close * 60;
        var rect = col.getBoundingClientRect();
        var maxSlot = Math.round((closeMin - openMin) / 10) - 1;   // ostatnia pełna kratka
        function slotAt(clientY) {
            var s = Math.floor((clientY - rect.top) / cell);
            return Math.max(0, Math.min(maxSlot, s));
        }
        var anchorSlot = slotAt(e.clientY);
        var curSlot = anchorSlot, moved = false;

        var ghost = document.createElement('div');
        ghost.className = 'pnl-cal-ghost';
        col.appendChild(ghost);

        function paint() {
            var a = Math.min(anchorSlot, curSlot), b = Math.max(anchorSlot, curSlot);
            var aMin = openMin + a * 10, bMin = openMin + (b + 1) * 10;   // koniec = spód ostatniej kratki
            ghost.style.top = ((aMin - openMin) * ppm) + 'px';
            ghost.style.height = ((bMin - aMin) * ppm) + 'px';
            ghost.textContent = minToHHMM(aMin) + '–' + minToHHMM(bMin);
        }
        paint();
        col.setPointerCapture(e.pointerId);

        function onMove(me) {
            var sNow = slotAt(me.clientY);
            if (sNow !== anchorSlot) moved = true;
            curSlot = sNow;
            paint();
        }
        function onUp() {
            col.releasePointerCapture(e.pointerId);
            col.removeEventListener('pointermove', onMove);
            col.removeEventListener('pointerup', onUp);
            if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
            var a = Math.min(anchorSlot, curSlot), b = Math.max(anchorSlot, curSlot);
            var aMin = openMin + a * 10, dur = (b - a + 1) * 10;
            if (moved) openCreate({ date: col.dataset.date, min: aMin, durationMin: dur });
            else openCreate({ date: col.dataset.date, min: aMin });
        }
        col.addEventListener('pointermove', onMove);
        col.addEventListener('pointerup', onUp);
    }

    function startDrag(e, node, ev, mode) {
        if (e.button !== undefined && e.button !== 0) return;
        var ppm = gridCtx.ppm;
        var cell = 10 * ppm;                          // px na jedną 10-min kratkę
        var s = I().parseLocal(ev.start), en = I().parseLocal(ev.end);
        if (!s || !en) return;
        var startMin = s.min, endMin = en.min, dur = endMin - startMin;
        var date = s.date;
        var openMin = gridCtx.open * 60, closeMin = gridCtx.close * 60;
        var startY = e.clientY;
        var grabDy = e.clientY - node.getBoundingClientRect().top;   // gdzie w bloku chwycono
        var col = node.closest('.pnl-cal-daycol');
        var origTop = parseFloat(node.style.top) || 0;
        var colTop = col ? col.getBoundingClientRect().top : (e.clientY - grabDy - origTop);
        var curStart = startMin, curEnd = endMin;
        var moved = false;
        node.setPointerCapture(e.pointerId);
        node.classList.add('is-dragging');

        // Pozycja BEZWZGLĘDNA (px w kolumnie) → minuty, zaokrąglona do najbliższej 10-min
        // linii siatki. Dzięki temu krawędź ląduje dokładnie na kratce (a nie „obok"), a stare
        // wpisy z godziną spoza siatki przy pierwszym ruszeniu same się prostują.
        function snapMin(px) { return openMin + Math.round(px / cell) * 10; }

        function onMove(me) {
            if (!moved && Math.abs(me.clientY - startY) < 4) return;
            moved = true;
            if (mode === 'move') {
                // Górna krawędź bloku = kursor minus offset chwytu (zachowuje uchwyt).
                var ns = snapMin((me.clientY - grabDy) - colTop);
                ns = Math.max(openMin, Math.min(closeMin - dur, ns));
                curStart = ns; curEnd = ns + dur;
                node.style.top = ((ns - openMin) * ppm) + 'px';
            } else {
                // Dolna krawędź = pozycja kursora w kolumnie.
                var ne = snapMin(me.clientY - colTop);
                ne = Math.max(startMin + 10, Math.min(closeMin, ne));
                curEnd = ne;
                node.style.height = ((ne - startMin) * ppm) + 'px';
            }
        }

        function onUp() {
            node.releasePointerCapture(e.pointerId);
            node.removeEventListener('pointermove', onMove);
            node.removeEventListener('pointerup', onUp);
            node.classList.remove('is-dragging');
            if (!moved) return;
            // zablokuj klik otwierający szczegóły po przeciągnięciu
            var suppress = function (ce) { ce.stopImmediatePropagation(); ce.preventDefault(); document.removeEventListener('click', suppress, true); };
            document.addEventListener('click', suppress, true);
            setTimeout(function () { document.removeEventListener('click', suppress, true); }, 350);

            // curStart/curEnd to już zsnapowane minuty (bez powrotu przez piksele = bez błędu float).
            var newStartISO = date + 'T' + minToHHMM(curStart);
            var newEndISO = date + 'T' + minToHHMM(curEnd);
            // Optymistycznie: przerysuj z danych (kafelek ląduje dokładnie tam, gdzie upuszczono,
            // etykieta godzin się odświeża), a PATCH leci w tle. Błąd → wycofaj + toast.
            var prev = I().applyLocal(ev.id, { start: newStartISO, end: newEndISO });
            api('event.php', { method: 'PATCH', json: { id: ev.id, start: newStartISO, end: newEndISO } })
                .catch(function (err) {
                    if (prev) I().applyLocal(ev.id, prev);
                    I().toast((err && err.message) || 'Nie udało się przenieść terminu.', 'error');
                });
        }

        node.addEventListener('pointermove', onMove);
        node.addEventListener('pointerup', onUp);
    }

    window.PanelCalendarEdit = {
        openCreate: openCreate,
        decorateDrawer: decorateDrawer,
        enhanceGrid: enhanceGrid
    };
})();
