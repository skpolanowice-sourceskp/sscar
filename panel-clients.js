/* =============================================================
   SSCAR – Panel: widok Klienci.
   Wyszukiwarka + profil + pełne zarządzanie bazą:
   ręczne dodawanie, edycja danych, pojazdy (dodaj/edytuj/usuń),
   notatki, blokada numeru, usuwanie profilu.
   Rejestruje się jako window.PanelViews.clients.
   ============================================================= */
(function () {
    'use strict';

    var api = null, host = null, current = null, triedImport = false, lastQ = '';

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
    function phoneDigits(s) { return ('' + (s == null ? '' : s)).replace(/\D/g, ''); }
    function val(id) { var n = document.getElementById(id); return n ? n.value.trim() : ''; }

    function field(label, id, value, ph, type) {
        return '<label class="pnl-field"><span class="pnl-label">' + esc(label) + '</span>' +
            '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '"' +
            (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' autocomplete="off"></label>';
    }

    /* ---------- Montaż ---------- */
    function mount(theHost, theApi) {
        host = theHost; api = theApi;
        host.innerHTML =
            '<div class="pnl-clients">' +
                '<div class="pnl-clients-list">' +
                    '<div class="pnl-clients-search">' +
                        '<input id="cl-q" type="search" autocomplete="off" placeholder="Szukaj: nazwisko, telefon, nr rej.">' +
                        '<button type="button" class="pnl-btn pnl-btn-primary pnl-clients-new" id="cl-new" title="Dodaj klienta">+ Nowy</button>' +
                    '</div>' +
                    '<div class="pnl-clients-tools" style="padding:0 0 8px;">' +
                        '<button type="button" class="pnl-btn pnl-btn-subtle" id="cl-import-top" style="width:100%;" ' +
                        'title="Podepnij historyczne rezerwacje do profili i utwórz pojazdy (nr rej. + marka/model)">' +
                        'Zaimportuj z rezerwacji</button>' +
                    '</div>' +
                    '<div class="pnl-clients-results" id="cl-results"></div>' +
                '</div>' +
                '<div class="pnl-client-detail" id="cl-detail">' +
                    '<div class="pnl-placeholder"><h2>Klienci</h2><p>Wybierz klienta z listy lub dodaj nowego.</p></div>' +
                '</div>' +
            '</div>';

        var q = host.querySelector('#cl-q');
        var t;
        q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { search(q.value); }, 250); });
        host.querySelector('#cl-new').addEventListener('click', openCreateForm);
        var impTop = host.querySelector('#cl-import-top');
        if (impTop) impTop.addEventListener('click', runImport);
        search('', true); // pierwsze ładowanie: dozwolony auto-import historii
    }

    function showPlaceholder() {
        current = null;
        var pane = host.querySelector('#cl-detail');
        pane.innerHTML = '<div class="pnl-placeholder"><h2>Klienci</h2><p>Wybierz klienta z listy lub dodaj nowego.</p></div>';
        Array.prototype.forEach.call(host.querySelectorAll('.pnl-client-row'), function (x) { x.classList.remove('is-active'); });
    }
    function refreshList() { search(lastQ); }

    /* ---------- Lista / wyszukiwanie ---------- */
    function search(q, auto) {
        lastQ = q || '';
        var box = host.querySelector('#cl-results');
        box.innerHTML = '<div class="pnl-cal-loading">Szukam…</div>';
        api('clients.php?q=' + encodeURIComponent(lastQ)).then(function (data) {
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
            box.innerHTML = '<div class="pnl-clients-empty">' +
                (lastQ ? 'Brak wyników dla „' + esc(lastQ) + '".' : 'Brak klientów. ') +
                (lastQ ? '' : '<button type="button" class="pnl-btn pnl-btn-subtle" id="cl-import">Zaimportuj z rezerwacji</button>') +
                '</div>';
            var imp = document.getElementById('cl-import');
            if (imp) imp.addEventListener('click', runImport);
            return;
        }
        box.innerHTML = rows.map(function (c) {
            return '<button type="button" class="pnl-client-row' + (+c.blocked ? ' is-blocked' : '') +
                    (current && +current.id === +c.id ? ' is-active' : '') + '" data-id="' + c.id + '">' +
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
            r = r || {};
            var imported = (+r.from_bookings || 0) + (+r.from_events || 0);
            var total = +r.clients_total || 0;
            if (r.db_error && imported === 0 && total === 0) {
                btn.disabled = false; btn.textContent = 'Spróbuj ponownie';
                window.alert('Import nie zapisał klientów.\nBłąd bazy: ' + r.db_error);
                return;
            }
            window.alert('Import zakończony.\nDopasowano numery: ' + imported +
                ' (rezerwacje: ' + (+r.from_bookings || 0) + ', kalendarz: ' + (+r.from_events || 0) + ').' +
                '\nKlientów w bazie: ' + total + '.' +
                '\nPojazdów w bazie: ' + (+r.vehicles_total || 0) + '.' +
                (r.google_error ? '\n\nUwaga (kalendarz): ' + r.google_error : ''));
            search('');
        }).catch(function (err) {
            btn.disabled = false; btn.textContent = 'Spróbuj ponownie';
            window.alert((err && err.message) || 'Import nie powiódł się. Uruchom schema_admin.sql w phpMyAdmin.');
        });
    }

    /* ---------- Nowy klient ---------- */
    function openCreateForm() {
        current = null;
        Array.prototype.forEach.call(host.querySelectorAll('.pnl-client-row'), function (x) { x.classList.remove('is-active'); });
        var pane = host.querySelector('#cl-detail');
        pane.innerHTML =
            '<div class="pnl-client-head"><h2 class="pnl-client-title">Nowy klient</h2></div>' +
            '<form class="pnl-form pnl-client-edit" id="cl-create" novalidate>' +
                field('Imię i nazwisko', 'nc-name', '', 'np. Jan Kowalski') +
                '<div class="pnl-form-row">' +
                    field('Telefon', 'nc-phone', '', '600 700 800') +
                    field('E-mail', 'nc-email', '', 'opcjonalnie', 'email') +
                '</div>' +
                '<div class="pnl-form-row">' +
                    field('Nr rej. (opcjonalnie)', 'nc-plate', '', 'SK 1234A') +
                    field('Pojazd (opcjonalnie)', 'nc-vehicle', '', 'np. Octavia') +
                '</div>' +
                '<label class="pnl-field"><span class="pnl-label">Notatka</span>' +
                    '<textarea id="nc-notes" rows="3" placeholder="Widoczna tylko dla obsługi…"></textarea></label>' +
                '<p class="pnl-form-error" id="nc-error" role="alert"></p>' +
                '<div class="pnl-edit-actions">' +
                    '<button type="button" class="pnl-btn pnl-btn-ghost" id="nc-cancel">Anuluj</button>' +
                    '<button type="submit" class="pnl-btn pnl-btn-primary" id="nc-save">Zapisz klienta</button>' +
                '</div>' +
            '</form>';
        var nm = document.getElementById('nc-name'); if (nm) nm.focus();
        document.getElementById('nc-cancel').addEventListener('click', showPlaceholder);
        document.getElementById('cl-create').addEventListener('submit', function (e) {
            e.preventDefault();
            var err = document.getElementById('nc-error'); err.textContent = '';
            var name = val('nc-name'), phone = val('nc-phone');
            if (name.length < 2) { err.textContent = 'Podaj imię i nazwisko.'; return; }
            if (phoneDigits(phone).length < 9) { err.textContent = 'Podaj poprawny telefon (min. 9 cyfr).'; return; }
            var btn = document.getElementById('nc-save'); btn.disabled = true;
            api('clients.php', { method: 'POST', json: {
                name: name, phone: phone, email: val('nc-email'),
                plate: val('nc-plate'), vehicle: val('nc-vehicle'), notes: val('nc-notes')
            } }).then(function (r) {
                refreshList();
                if (r && r.id) openProfile(r.id);
            }).catch(function (e2) {
                btn.disabled = false;
                var existingId = e2 && e2.data && e2.data.existingId;
                if (existingId) {
                    err.innerHTML = esc(e2.message) + ' <button type="button" class="pnl-link" id="nc-open">Otwórz profil</button>';
                    var ob = document.getElementById('nc-open');
                    if (ob) ob.addEventListener('click', function () { openProfile(existingId); });
                } else {
                    err.textContent = (e2 && e2.message) || 'Nie udało się dodać klienta.';
                }
            });
        });
    }

    /* ---------- Profil ---------- */
    function openProfile(id) {
        var pane = host.querySelector('#cl-detail');
        pane.innerHTML = '<div class="pnl-cal-loading">Wczytuję profil…</div>';
        api('client.php?id=' + encodeURIComponent(id)).then(function (d) {
            current = d.client;
            // odśwież podświetlenie wiersza na liście
            Array.prototype.forEach.call(host.querySelectorAll('.pnl-client-row'), function (x) {
                x.classList.toggle('is-active', +x.dataset.id === +d.client.id);
            });
            renderProfile(d.client, d.vehicles || [], d.history || []);
        }).catch(function (err) {
            pane.innerHTML = '<div class="pnl-clients-empty">' + esc((err && err.message) || 'Błąd.') + '</div>';
        });
    }

    function vehRowHtml(v) {
        return '<div class="pnl-veh" data-id="' + v.id + '">' +
            '<span class="pnl-veh-plate">' + esc(v.plate) + '</span>' +
            '<span class="pnl-veh-name">' + esc(v.vehicle || '—') + '</span>' +
            '<span class="pnl-veh-tools">' +
                '<button type="button" class="pnl-iconbtn pnl-iconbtn--sm" data-veh-edit title="Edytuj pojazd">✎</button>' +
                '<button type="button" class="pnl-iconbtn pnl-iconbtn--sm" data-veh-del title="Usuń pojazd">✕</button>' +
            '</span>' +
        '</div>';
    }

    function renderProfile(c, vehicles, history) {
        var pane = host.querySelector('#cl-detail');
        var blocked = +c.blocked === 1;

        var vehHtml = vehicles.length
            ? vehicles.map(vehRowHtml).join('')
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
                '<div class="pnl-client-headactions">' +
                    '<button type="button" class="pnl-btn pnl-btn-subtle" id="cl-edit">Edytuj dane</button>' +
                    '<button type="button" class="pnl-btn ' + (blocked ? 'pnl-btn-subtle' : 'pnl-btn-danger') + '" id="cl-block">' +
                        (blocked ? 'Odblokuj' : 'Zablokuj') + '</button>' +
                '</div>' +
            '</div>' +
            (blocked && c.blocked_reason ? '<div class="pnl-alert">Powód blokady: ' + esc(c.blocked_reason) + '</div>' : '') +

            '<section class="pnl-client-sec"><h3 class="pnl-sec-title">Pojazdy</h3>' +
                '<div id="cl-veh-list">' + vehHtml + '</div>' +
                '<div class="pnl-veh-add">' +
                    '<input id="cl-veh-plate" placeholder="Nr rej." autocomplete="off">' +
                    '<input id="cl-veh-name" placeholder="Marka / model" autocomplete="off">' +
                    '<button type="button" class="pnl-btn pnl-btn-subtle" id="cl-veh-add">Dodaj</button>' +
                '</div>' +
                '<span class="pnl-save-hint pnl-save-hint--err" id="cl-veh-hint"></span>' +
            '</section>' +

            '<section class="pnl-client-sec"><h3 class="pnl-sec-title">Notatki</h3>' +
                '<textarea id="cl-notes" class="pnl-notes" rows="4" placeholder="Notatka widoczna tylko dla obsługi…">' + esc(c.notes || '') + '</textarea>' +
                '<button type="button" class="pnl-btn pnl-btn-primary pnl-notes-save" id="cl-notes-save">Zapisz notatkę</button>' +
                '<span class="pnl-save-hint" id="cl-notes-hint"></span>' +
            '</section>' +

            '<section class="pnl-client-sec"><h3 class="pnl-sec-title">Historia wizyt</h3>' + histHtml + '</section>' +

            '<section class="pnl-client-sec pnl-danger-zone">' +
                '<button type="button" class="pnl-btn pnl-btn-danger" id="cl-delete">Usuń klienta</button>' +
            '</section>';

        document.getElementById('cl-edit').addEventListener('click', function () { openCoreEdit(c); });
        document.getElementById('cl-block').addEventListener('click', function () { toggleBlock(c, blocked); });
        document.getElementById('cl-notes-save').addEventListener('click', function () { saveNotes(c.id); });
        document.getElementById('cl-delete').addEventListener('click', function () { deleteClient(c); });
        wireVehicles(c);
    }

    /* ---------- Edycja danych podstawowych ---------- */
    function openCoreEdit(c) {
        var head = host.querySelector('.pnl-client-head');
        if (!head) return;
        head.innerHTML =
            '<form class="pnl-form pnl-client-edit" id="cl-core" novalidate>' +
                field('Imię i nazwisko', 'ce2-name', c.name || '', 'np. Jan Kowalski') +
                '<div class="pnl-form-row">' +
                    field('Telefon', 'ce2-phone', c.phone_display || '', '') +
                    field('E-mail', 'ce2-email', c.email || '', 'opcjonalnie', 'email') +
                '</div>' +
                '<p class="pnl-form-error" id="ce2-error" role="alert"></p>' +
                '<div class="pnl-edit-actions">' +
                    '<button type="button" class="pnl-btn pnl-btn-ghost" id="ce2-cancel">Anuluj</button>' +
                    '<button type="submit" class="pnl-btn pnl-btn-primary" id="ce2-save">Zapisz dane</button>' +
                '</div>' +
            '</form>';
        document.getElementById('ce2-cancel').addEventListener('click', function () { openProfile(c.id); });
        document.getElementById('cl-core').addEventListener('submit', function (e) {
            e.preventDefault();
            var err = document.getElementById('ce2-error'); err.textContent = '';
            var phone = val('ce2-phone');
            if (phoneDigits(phone).length < 9) { err.textContent = 'Podaj poprawny telefon (min. 9 cyfr).'; return; }
            var btn = document.getElementById('ce2-save'); btn.disabled = true;
            api('client.php', { method: 'PATCH', json: { id: c.id, name: val('ce2-name'), phone: phone, email: val('ce2-email') } })
                .then(function () { openProfile(c.id); refreshList(); })
                .catch(function (e2) { btn.disabled = false; err.textContent = (e2 && e2.message) || 'Nie udało się zapisać.'; });
        });
    }

    /* ---------- Pojazdy ---------- */
    function wireVehicles(c) {
        var list = document.getElementById('cl-veh-list');
        if (list) Array.prototype.forEach.call(list.querySelectorAll('.pnl-veh'), function (row) {
            var ed = row.querySelector('[data-veh-edit]');
            var dl = row.querySelector('[data-veh-del]');
            if (ed) ed.addEventListener('click', function () { editVehicleRow(c, row); });
            if (dl) dl.addEventListener('click', function () { delVehicle(c, row.dataset.id, row); });
        });
        var add = document.getElementById('cl-veh-add');
        if (add) add.addEventListener('click', function () { addVehicle(c); });
        var plate = document.getElementById('cl-veh-plate');
        if (plate) plate.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addVehicle(c); } });
    }

    function addVehicle(c) {
        var p = val('cl-veh-plate'), n = val('cl-veh-name');
        var hint = document.getElementById('cl-veh-hint');
        if (!p) { hint.textContent = 'Podaj numer rejestracyjny.'; return; }
        hint.textContent = '';
        api('client.php', { method: 'PATCH', json: { id: c.id, vehicle_add: { plate: p, vehicle: n } } })
            .then(function () { openProfile(c.id); })
            .catch(function (err) { hint.textContent = (err && err.message) || 'Błąd zapisu pojazdu.'; });
    }

    function editVehicleRow(c, row) {
        var id = row.dataset.id;
        var plate = row.querySelector('.pnl-veh-plate').textContent;
        var name = row.querySelector('.pnl-veh-name').textContent;
        if (name === '—') name = '';
        row.classList.add('is-editing');
        row.innerHTML =
            '<input class="pnl-veh-ein" id="ve-plate-' + id + '" value="' + esc(plate) + '" placeholder="Nr rej." autocomplete="off">' +
            '<input class="pnl-veh-ein" id="ve-name-' + id + '" value="' + esc(name) + '" placeholder="Marka / model" autocomplete="off">' +
            '<span class="pnl-veh-tools">' +
                '<button type="button" class="pnl-iconbtn pnl-iconbtn--sm" data-veh-save title="Zapisz">✓</button>' +
                '<button type="button" class="pnl-iconbtn pnl-iconbtn--sm" data-veh-cancel title="Anuluj">✕</button>' +
            '</span>';
        row.querySelector('[data-veh-save]').addEventListener('click', function () {
            var p = val('ve-plate-' + id), n = val('ve-name-' + id);
            if (!p) { window.alert('Podaj numer rejestracyjny.'); return; }
            api('client.php', { method: 'PATCH', json: { id: c.id, vehicle_edit: { id: +id, plate: p, vehicle: n } } })
                .then(function () { openProfile(c.id); })
                .catch(function (err) { window.alert((err && err.message) || 'Nie udało się zapisać pojazdu.'); });
        });
        row.querySelector('[data-veh-cancel]').addEventListener('click', function () { openProfile(c.id); });
    }

    function delVehicle(c, vid, row) {
        var plate = row.querySelector('.pnl-veh-plate');
        if (!window.confirm('Usunąć pojazd ' + (plate ? plate.textContent : '') + ' z profilu?')) return;
        api('client.php', { method: 'PATCH', json: { id: c.id, vehicle_del: +vid } })
            .then(function () { openProfile(c.id); })
            .catch(function (err) { window.alert((err && err.message) || 'Nie udało się usunąć pojazdu.'); });
    }

    /* ---------- Notatki / blokada / usuwanie ---------- */
    function saveNotes(id) {
        var hint = document.getElementById('cl-notes-hint');
        var btn = document.getElementById('cl-notes-save');
        btn.disabled = true; hint.textContent = ''; hint.classList.remove('pnl-save-hint--err');
        api('client.php', { method: 'PATCH', json: { id: id, notes: document.getElementById('cl-notes').value } })
            .then(function () { btn.disabled = false; hint.textContent = 'Zapisano'; setTimeout(function () { hint.textContent = ''; }, 2000); })
            .catch(function (err) { btn.disabled = false; hint.classList.add('pnl-save-hint--err'); hint.textContent = (err && err.message) || 'Błąd zapisu.'; });
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
            refreshList();
        }).catch(function (err) { window.alert((err && err.message) || 'Nie udało się zapisać.'); });
    }

    function deleteClient(c) {
        if (!window.confirm('Usunąć klienta „' + (c.name || c.phone_display) + '"?\n\nProfil i jego pojazdy zostaną usunięte. Rezerwacje w grafiku pozostaną nienaruszone.')) return;
        api('client.php', { method: 'DELETE', json: { id: c.id } }).then(function () {
            showPlaceholder();
            refreshList();
        }).catch(function (err) { window.alert((err && err.message) || 'Nie udało się usunąć klienta.'); });
    }

    window.PanelViews = window.PanelViews || {};
    window.PanelViews.clients = { mount: mount };
})();
