/* =============================================================
   SSCAR – Panel obsługi: bootstrap, logowanie, routing widoków.
   Widoki (kalendarz, klienci) montują się w #pnl-view.
   Klient API: api(path, opts) -> Promise<json>, dokłada CSRF i cookie sesji.
   ============================================================= */
(function () {
    'use strict';

    var API = 'reservations/admin/';

    var state = {
        csrf: null,
        view: 'calendar'
    };

    function $(id) { return document.getElementById(id); }

    /* ---------- Klient API ---------- */
    function api(path, opts) {
        opts = opts || {};
        var method = opts.method || 'GET';
        var headers = {};
        if (opts.json !== undefined) headers['Content-Type'] = 'application/json';
        if (state.csrf && method !== 'GET') headers['X-CSRF-Token'] = state.csrf;
        if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });

        return fetch(API + path, {
            method: method,
            headers: headers,
            body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
            credentials: 'same-origin'
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
    // Udostępnij modułom widoków (kalendarz/klienci montowane w kolejnych krokach).
    window.PanelAPI = { api: api, getCsrf: function () { return state.csrf; } };

    /* ---------- Przełączanie ekranów ---------- */
    function show(elId) {
        ['pnl-boot', 'pnl-login', 'pnl-app'].forEach(function (id) {
            var node = $(id);
            if (node) node.hidden = (id !== elId);
        });
    }

    function showLogin() {
        show('pnl-login');
        var pass = $('pnl-pass');
        if (pass) { pass.value = ''; pass.focus(); }
    }

    function showApp() {
        show('pnl-app');
        mountView(state.view);
    }

    /* ---------- Routing widoków ---------- */
    function setActiveTab(view) {
        Array.prototype.forEach.call(document.querySelectorAll('.pnl-tab'), function (t) {
            var on = t.dataset.view === view;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }

    function mountView(view) {
        state.view = view;
        setActiveTab(view);
        var host = $('pnl-view');
        if (!host) return;

        // Moduły widoków rejestrują się jako window.PanelViews[view] = { mount(host, api) }.
        var mod = (window.PanelViews || {})[view];
        if (mod && typeof mod.mount === 'function') {
            mod.mount(host, api);
            return;
        }
        // Fallback do czasu wdrożenia danego widoku.
        host.innerHTML = '<div class="pnl-placeholder">'
            + '<h2>' + (view === 'clients' ? 'Klienci' : 'Kalendarz') + '</h2>'
            + '<p>Ten widok pojawi się w kolejnym kroku wdrożenia.</p></div>';
    }

    /* ---------- Logowanie ---------- */
    function handleLogin(e) {
        e.preventDefault();
        var btn = $('pnl-login-btn');
        var errBox = $('pnl-login-error');
        var pass = $('pnl-pass').value;
        errBox.textContent = '';
        if (!pass) { errBox.textContent = 'Podaj hasło.'; return; }

        btn.disabled = true;
        var label = btn.textContent;
        btn.innerHTML = '<span class="pnl-spin" aria-hidden="true"></span>Logowanie…';

        api('login.php', { method: 'POST', json: { password: pass } })
            .then(function (d) {
                state.csrf = d.csrf || null;
                btn.disabled = false;
                btn.textContent = label;
                showApp();
            })
            .catch(function (err) {
                btn.disabled = false;
                btn.textContent = label;
                errBox.textContent = (err && err.message) ? err.message : 'Nie udało się zalogować.';
                $('pnl-pass').focus();
            });
    }

    function handleLogout() {
        api('logout.php', { method: 'POST' }).catch(function () {}).then(function () {
            state.csrf = null;
            showLogin();
        });
    }

    /* ---------- Start ---------- */
    function boot() {
        $('pnl-login-form').addEventListener('submit', handleLogin);
        $('pnl-logout').addEventListener('click', handleLogout);
        Array.prototype.forEach.call(document.querySelectorAll('.pnl-tab'), function (t) {
            t.addEventListener('click', function () { mountView(t.dataset.view); });
        });

        api('session.php')
            .then(function (d) {
                if (d && d.authenticated) { state.csrf = d.csrf || null; showApp(); }
                else showLogin();
            })
            .catch(showLogin);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
