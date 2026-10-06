/* Poglądowy model zmiany obciążenia, niezależny od sterowania Hydractive. */
(function () {
    'use strict';
    var lab = document.getElementById('xm-lab');
    if (!lab) return;

    var load = lab.querySelector('#xm-load');
    var correction = lab.querySelector('#xm-correction');
    var body = lab.querySelector('#xm-body');
    var oil = lab.querySelector('#xm-oil');
    var membrane = lab.querySelector('#xm-membrane');
    var people = lab.querySelectorAll('.xm-person');
    var amount = lab.querySelector('#xm-load-value');
    var status = lab.querySelector('#xm-status');
    var explanation = lab.querySelector('#xm-explanation');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var timer = 0;
    var frame = 0;
    var offset = 0;
    var previousLoad = 0;

    function cancel() {
        window.clearTimeout(timer);
        window.cancelAnimationFrame(frame);
        timer = frame = 0;
    }

    function paint(value) {
        offset = value;
        body.setAttribute('transform', 'translate(0 ' + value.toFixed(2) + ')');
    }

    function moveTo(target, duration, done) {
        if (reducedMotion.matches) {
            paint(target);
            if (done) done();
            return;
        }
        var start = performance.now();
        var from = offset;
        function tick(now) {
            var progress = Math.min(1, (now - start) / duration);
            var eased = 1 - Math.pow(1 - progress, 3);
            paint(from + (target - from) * eased);
            if (progress < 1) frame = window.requestAnimationFrame(tick);
            else {
                frame = 0;
                if (done) done();
            }
        }
        frame = window.requestAnimationFrame(tick);
    }

    function settled(count) {
        status.textContent = 'Wysokość wyrównana';
        explanation.textContent = count
            ? 'Nadwozie wróciło do poziomu odniesienia. Azot pozostaje bardziej sprężony: wyrównanie wysokości nie usuwa dodatkowego obciążenia.'
            : 'Pasażerowie wysiedli. Układ odprowadził nadmiar płynu i przywrócił poziom odniesienia.';
    }

    function update() {
        cancel();
        var count = Number(load.value);
        var changed = count !== previousLoad;
        var difference = count - previousLoad;
        previousLoad = count;
        amount.value = count + (count === 0 ? ' osób' : count === 1 ? ' osoba' : ' osoby') + ' · +' + (count * 75) + ' kg';
        load.setAttribute('aria-valuetext', amount.value);
        people.forEach(function (person, index) { person.style.opacity = index < count ? '1' : '0.12'; });

        // Skala rysunku jest ilustracyjna, nie jest charakterystyką zawieszenia XM.
        var boundary = 112 - count * 9;
        oil.setAttribute('y', boundary);
        oil.setAttribute('height', 196 - boundary);
        membrane.setAttribute('d', 'M 28 ' + boundary + ' Q 90 ' + (boundary - 11) + ' 152 ' + boundary);

        if (!correction.checked) {
            status.textContent = count ? 'Nadwozie niżej' : 'Poziom odniesienia';
            explanation.textContent = count
                ? 'Bez wyrównywania wysokości nadwozie pozostaje niżej po dołożeniu obciążenia. To porównanie zasady działania, nie tryb jazdy w XM.'
                : 'Brak dodatkowych pasażerów. Włącz wyrównywanie i przesuń suwak, żeby zobaczyć reakcję układu.';
            moveTo(count * 8, 300);
            return;
        }

        if (!count && !changed && Math.abs(offset) < 0.1) {
            status.textContent = 'Poziom odniesienia';
            explanation.textContent = 'Dołóż pasażerów suwakiem. Nadwozie najpierw opadnie, a potem wróci do tej samej wysokości.';
            paint(0);
            return;
        }

        if (reducedMotion.matches) {
            paint(0);
            settled(count);
            return;
        }

        status.textContent = 'Wyrównywanie…';
        explanation.textContent = difference < 0
            ? 'Po odciążeniu nadwozie unosi się. Korektor odprowadza płyn, żeby przywrócić poprzednią wysokość.'
            : 'Pod obciążeniem nadwozie opada. Korektor dopuszcza płyn, żeby przywrócić poprzednią wysokość.';
        var initialOffset = changed ? offset + difference * 8 : offset;
        moveTo(initialOffset, 280, function () {
            timer = window.setTimeout(function () {
                timer = 0;
                moveTo(0, 800, function () { settled(count); });
            }, 450);
        });
    }

    load.addEventListener('input', update);
    correction.addEventListener('change', update);
    lab.querySelector('#xm-reset').addEventListener('click', function () {
        cancel();
        load.value = '0';
        correction.checked = true;
        previousLoad = 0;
        paint(0);
        update();
    });
    reducedMotion.addEventListener('change', update);
    window.addEventListener('pagehide', cancel);
    lab.querySelector('fieldset').disabled = false;
    update();
}());
