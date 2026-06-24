/* =============================================================
   SSCAR – Panel: widok Klienci (krok 4).
   Wyszukiwarka + profil (dane, auta, historia, notatki, blokada).
   Rejestruje się jako window.PanelViews.clients.
   ============================================================= */
(function () {
    'use strict';

    var api = null, host = null, current = null, triedImport = false;

    function esc(s) {
        return ('' + (s == null ? '' : s)).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmtDate(dt) {
        if (!dt) return '';
        var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(dt);
        return m ? (m[3] + '.' + m[2] + '.' + m[1] + ' ' + m[4] + ':' + m[5]) : dt;
    }

    function mount(theHost, theApi) {
        host = theHost; api = theApi;
        host.innerHTML =
            '<div class="pnl-clients">' +
                '<div class="pnl-clients-list">' +
                    '<div class="pnl-clients-search">' +
                        '<input id="cl-q" type="search" autocomplete="off" placeholder="Szukaj: nazwisko, telefon, nr rej.">' +
                    '</div>' +
                    '<div class="pnl-clients-results" id="cl-results"></div>' +
                '</div>' +
                '<div class="pnl-client-detail" id="cl-detail">' +
                    '<div class="pnl-placeholder"><h2>Klienci</h2><p>Wybierz klienta z listy, aby zobaczyć profil.</p></div>' +
                '</div>' +
            '</div>';

        var q = host.querySelector('#cl-q');
        var t;
        q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { search(q.value); }, 250); });
        search('', true); // pierwsze ładowanie: dozwolony auto-import historii
    }

    function search(q, auto) {
        var box = host.querySelector('#cl-results');
        box.innerHTML = '<div class="pnl-cal-loading">Szukam…</div>';
        api('clients.php?q=' + encodeURIComponent(q || '')).then(function (data) {
            var rows = data.clients || [];
            // Brak klientów przy pierwszym wejściu → wciągnij profile z dotychczasowych rezerwacji.
            if (auto && !triedImport && rows.length === 0) {
                triedImport = true;
                box.innerHTML = '<div class="pnl-cal-loading">Importuję klientów z rezerwacji…</div>';
                api('migrate_clients.php', { method: 'POST', json: {} })
                    .then(function () { search(''); })
                    .catch(function () { renderList(rows); });
                return;
            }
            renderList(rows);
        }).catch(function (err) {
            box.innerHTML = '<div class="pnl-clients-empty">' +
                esc((err && err.message) || 'Błąd wczytywania.') +
                '<button type="button" class="pnl-btn pnl-btn-subtle" id="cl-import">Zaimportuj klientów z rezerwacji</button></div>';
            var imp = document.getElementById('cl-import');
            if (imp) imp.addEventListener('click', runImport);
        });
    }

    function renderList(rows) {
        var box = host.querySelector('#cl-results');
        if (!rows.length) {
            box.innerHTML = '<div class="pnl-clients-empty">Brak klientów. ' +
                '<button type="button" class="pnl-btn pnl-btn-subtle" id="cl-import">Zaimportuj z rezerwacji</button></div>';
            var imp = document.getElementById('cl-import');
            if (imp) imp.addEventListener('click', runImport);
            return;
        }
        box.innerHTML = rows.map(function (c) {
            return '<button type="button" class="pnl-client-row' + (+c.blocked ? ' is-blocked' : '') + '" data-id="' + c.id + '">' +
                '<span class="pnl-client-row-top">' +
                    '<span class="pnl-client-name">' + esc(c.name || '(bez nazwiska)') + '</span>' +
                    (+c.blocked ? '<span class="pnl-badge-block">blokada</span>' : '<span class="pnl-client-visits">' + (+c.visits || 0) + '×</span>') +
                '</span>' +
                '<span class="pnl-client-meta">' + esc(c.phone_display) + (c.plates ? ' · ' + esc(c.plates) : '') + '</span>' +
            '</button>';
        }).join('');
        Array.prototype.forEach.call(box.querySelectorAll('.pnl-client-row'), function (b) {
            b.addEventListener('click', function () {
                Array.prototype.forEach.call(box.querySelectorAll('.pnl-client-row'), function (x) { x.classList.remove('is-active'); });
                b.classList.add('is-active');
                openProfile(b.dataset.id);
            });
        });
    }

    function runImport(e) {
        var btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Importuję…';
        api('migrate_clients.php', { method: 'POST', json: {} }).then(function (r) {
            search(host.querySelector('#cl-q').value);
        }).catch(function (err) {
            btn.disabled = false; btn.textContent = 'Spróbuj ponownie';
            window.alert((err && err.message) || 'Import nie powiódł się. Uruchom schema_admin.sql w phpMyAdmin.');
        });
    }

    function openProfile(id) {
        var pane = host.querySelector('#cl-detail');
        pane.innerHTML = '<div class="pnl-cal-loading">Wczytuję profil…</div>';
        api('client.php?id=' + encodeURIComponent(id)).then(function (d) {
            current = d.client;
            renderProfile(d.client, d.vehicles || [], d.history || []);
        }).catch(function (err) {
            pane.innerHTML = '<div class="pnl-clients-empty">' + esc((err && err.message) || 'Błąd.') + '</div>';
        });
    }

    function renderProfile(c, vehicles, history) {
        var pane = host.querySelector('#cl-detail');
        var blocked = +c.blocked === 1;

        var vehHtml = vehicles.length
            ? vehicles.map(function (v) {
                return '<div class="pnl-veh"><span class="pnl-veh-plate">' + esc(v.plate) + '</span>' +
                    '<span class="pnl-veh-name">' + esc(v.vehicle || '—') + '</span></div>';
            }).join('')
            : '<p class="pnl-muted">Brak zapisanych pojazdów.</p>';

        var histHtml = history.length
            ? history.map(function (h) {
                return '<div class="pnl-hist-row"><span class="pnl-hist-when">' + esc(fmtDate(h.start_dt)) + '</span>' +
                    '<span class="pnl-hist-svc">' + esc(h.serviceLabel) + (h.subtypeLabel && h.subtypeLabel !== h.serviceLabel ? ' · ' + esc(h.subtypeLabel) : '') + '</span>' +
                    '<span class="pnl-hist-plate">' + esc(h.cust_plate) + '</span></div>';
            }).join('')
            : '<p class="pnl-muted">Brak historii wizyt.</p>';

        pane.innerHTML =
            '<div class="pnl-client-head">' +
                '<div>' +
                    '<h2 class="pnl-client-title">' + esc(c.name || '(bez nazwiska)') + (blocked ? ' <span class="pnl-badge-block">zablokowany</span>' : '') + '</h2>' +
                    '<a class="pnl-client-phone" href="tel:' + esc(c.phone_display) + '">' + esc(c.phone_display) + '</a>' +
                    (c.email ? '<span class="pnl-client-email">' + esc(c.email) + '</span>' : '') +
                '</div>' +
                '<button type="button" class="pnl-btn ' + (blocked ? 'pnl-btn-subtle' : 'pnl-btn-danger') + '" id="cl-block">' +
                    (blocked ? 'Odblokuj' : 'Zablokuj rezerwacje') + '</button>' +
            '</div>' +
            (blocked && c.blocked_reason ? '<div class="pnl-alert">Powód blokady: ' + esc(c.blocked_reason) + '</div>' : '') +

            '<section class="pnl-client-sec"><h3 class="pnl-sec-title">Pojazdy</h3>' + vehHtml + '</section>' +

            '<section class="pnl-client-sec"><h3 class="pnl-sec-title">Notatki</h3>' +
                '<textarea id="cl-notes" class="pnl-notes" rows="4" placeholder="Notatka widoczna tylko dla obsługi…">' + esc(c.notes || '') + '</textarea>' +
                '<button type="button" class="pnl-btn pnl-btn-primary pnl-notes-save" id="cl-notes-save">Zapisz notatkę</button>' +
                '<span class="pnl-save-hint" id="cl-notes-hint"></span>' +
            '</section>' +

            '<section class="pnl-client-sec"><h3 class="pnl-sec-title">Historia wizyt</h3>' + histHtml + '</section>';

        document.getElementById('cl-block').addEventListener('click', function () { toggleBlock(c, blocked); });
        document.getElementById('cl-notes-save').addEventListener('click', function () { saveNotes(c.id); });
    }

    function toggleBlock(c, blocked) {
        var payload = { id: c.id, blocked: !blocked };
        if (!blocked) {
            var reason = window.prompt('Powód blokady (opcjonalnie):', '');
            if (reason === null) return; // anulowano
            payload.blocked_reason = reason;
        } else {
            if (!window.confirm('Odblokować rezerwacje online dla tego numeru?')) return;
        }
        api('client.php', { method: 'PATCH', json: payload }).then(function () {
            openProfile(c.id);
            search(host.querySelector('#cl-q').value);
        }).catch(function (err) { window.alert((err && err.message) || 'Nie udało się zapisać.'); });
    }

    function saveNotes(id) {
        var hint = document.getElementById('cl-notes-hint');
        var btn = document.getElementById('cl-notes-save');
        btn.disabled = true; hint.textContent = '';
        api('client.php', { method: 'PATCH', json: { id: id, notes: document.getElementById('cl-notes').value } })
            .then(function () { btn.disabled = false; hint.textContent = 'Zapisano'; setTimeout(function () { hint.textContent = ''; }, 2000); })
            .catch(function (err) { btn.disabled = false; hint.textContent = (err && err.message) || 'Błąd zapisu.'; });
    }

    window.PanelViews = window.PanelViews || {};
    window.PanelViews.clients = { mount: mount };
})();
