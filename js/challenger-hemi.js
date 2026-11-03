/* Poglądowy model cyklu V8 HEMI: przekrój jednego cylindra, kolejność zapłonu i MDS.
   Geometria i czasy zaworów są umowne; nie jest to charakterystyka konkretnej wersji silnika. */
(function () {
    'use strict';
    var lab = document.getElementById('hl-lab');
    if (!lab) return;

    var ORDER = [1, 8, 4, 3, 6, 5, 7, 2];
    var MDS_OFF = [1, 4, 6, 7];
    var CX = 210, CY = 470, THROW = 62, ROD = 206, WRIST_TDC = 202;
    var DEGREES_PER_SECOND = 120;

    var STROKES = {
        intake: { name: 'Ssanie', short: 'ssanie', text: 'Tłok schodzi w dół, zawór dolotowy jest otwarty i do cylindra wpływa mieszanka.' },
        compression: { name: 'Sprężanie', short: 'sprężanie', text: 'Oba zawory są zamknięte, a tłok idący w górę ściska mieszankę w komorze spalania.' },
        power: { name: 'Praca', short: 'praca', text: 'Zapłon w pobliżu górnego położenia tłoka. Rozprężające się gazy pchają tłok w dół i obracają wałem.' },
        exhaust: { name: 'Wydech', short: 'wydech', text: 'Tłok wraca do góry, a otwarty zawór wylotowy wypuszcza spaliny z cylindra.' }
    };

    var HEADS = {
        hemi: 'HEMI: zawory leżą naprzeciw siebie w kopule. Jest miejsce na dwa duże zawory, a mieszanka i spaliny mają prostszą drogę. Współczesny 5.7 ma komorę spłaszczoną i dwie świece na cylinder.',
        wedge: 'Komora klinowa: zawory stoją obok siebie po jednej stronie skosu, więc wybór ich wielkości jest bardziej ograniczony. Rysunek pokazuje jedną świecę, jak w typowym klasycznym układzie.'
    };

    var slider = lab.querySelector('#hl-angle');
    var angleOut = lab.querySelector('#hl-angle-value');
    var playBtn = lab.querySelector('#hl-play');
    var mdsBox = lab.querySelector('#hl-mds');
    var status = lab.querySelector('#hl-status');
    var explanation = lab.querySelector('#hl-explanation');
    var resultBox = lab.querySelector('.hl-result');
    var headNote = lab.querySelector('#hl-head-note');
    var countOut = lab.querySelector('#hl-fire-count');
    var piston = lab.querySelector('#hl-piston');
    var rod = lab.querySelector('#hl-rod');
    var crank = lab.querySelector('#hl-crank');
    var gas = lab.querySelector('#hl-gas');
    var chambers = lab.querySelectorAll('.hl-chamber');
    var sparks = lab.querySelectorAll('.hl-spark');
    var valvesIn = lab.querySelectorAll('.hl-valve-in');
    var valvesEx = lab.querySelectorAll('.hl-valve-ex');
    var portsIn = lab.querySelectorAll('.hl-port-in');
    var portsEx = lab.querySelectorAll('.hl-port-ex');
    var heads = { hemi: lab.querySelector('#hl-head-hemi'), wedge: lab.querySelector('#hl-head-wedge') };
    var cylButtons = lab.querySelectorAll('.hl-cyl');
    var orderItems = lab.querySelectorAll('.hl-order li');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var theta = 360, selected = 1, headType = 'hemi', mds = false;
    var playing = false, frame = 0, last = 0, onScreen = true, lastMessage = '';

    function mod(value, base) { return ((value % base) + base) % base; }
    function isOff(cyl) { return mds && MDS_OFF.indexOf(cyl) !== -1; }
    function phaseOf(cyl) { return mod(theta - 90 * ORDER.indexOf(cyl), 720); }
    function strokeOf(phase) {
        return phase < 180 ? 'intake' : phase < 360 ? 'compression' : phase < 540 ? 'power' : 'exhaust';
    }

    function mix(from, to, t) {
        var out = [0, 1, 2].map(function (i) { return Math.round(from[i] + (to[i] - from[i]) * t); });
        return 'rgb(' + out.join(',') + ')';
    }

    function gasColor(phase, off) {
        if (off) return 'rgb(64,68,72)';
        if (phase < 180) return mix([38, 62, 80], [66, 124, 160], phase / 180);
        if (phase < 360) return mix([66, 124, 160], [196, 150, 72], (phase - 180) / 180);
        if (phase < 540) return mix([255, 92, 36], [116, 66, 52], (phase - 360) / 180);
        return mix([116, 100, 94], [58, 58, 60], (phase - 540) / 180);
    }

    function setValve(nodes, lift) {
        nodes.forEach(function (node) { node.setAttribute('transform', 'translate(0 ' + lift.toFixed(2) + ')'); });
    }

    function setPort(nodes, active, color) {
        nodes.forEach(function (node) { node.setAttribute('stroke', active ? color : '#1c1d1f'); });
    }

    function paintEngine() {
        var off = isOff(selected);
        var phase = phaseOf(selected);
        var radians = phase * Math.PI / 180;
        var pinX = CX + THROW * Math.sin(radians);
        var pinY = CY - THROW * Math.cos(radians);
        var side = THROW * Math.sin(radians);
        var wristY = CY - (THROW * Math.cos(radians) + Math.sqrt(ROD * ROD - side * side));
        var color = gasColor(phase, off);

        piston.setAttribute('transform', 'translate(0 ' + (wristY - WRIST_TDC).toFixed(2) + ')');
        rod.setAttribute('x2', pinX.toFixed(2));
        rod.setAttribute('y2', pinY.toFixed(2));
        rod.setAttribute('y1', wristY.toFixed(2));
        crank.setAttribute('transform', 'rotate(' + mod(phase, 360).toFixed(1) + ' ' + CX + ' ' + CY + ')');
        gas.setAttribute('height', Math.max(0, wristY - 30 - 170).toFixed(2));
        gas.setAttribute('fill', color);
        chambers.forEach(function (node) { node.setAttribute('fill', color); });

        var inLift = !off && phase < 180 ? Math.sin(radians) * 18 : 0;
        var exLift = !off && phase >= 540 ? Math.sin((phase - 540) * Math.PI / 180) * 16 : 0;
        setValve(valvesIn, inLift);
        setValve(valvesEx, exLift);
        setPort(portsIn, inLift > 0.5, '#427ca0');
        setPort(portsEx, exLift > 0.5, '#74645e');

        var spark = !off && phase >= 350 && phase < 375;
        sparks.forEach(function (node) { node.style.opacity = spark ? '1' : '0'; });
    }

    function paintMap() {
        cylButtons.forEach(function (button) {
            var cyl = Number(button.dataset.cyl);
            var stroke = strokeOf(phaseOf(cyl));
            var off = isOff(cyl);
            var label = off ? 'wyłączony' : STROKES[stroke].short;
            button.className = 'hl-cyl hl-is-' + (off ? 'off' : stroke);
            button.querySelector('small').textContent = label;
            button.setAttribute('aria-pressed', cyl === selected ? 'true' : 'false');
            button.setAttribute('aria-label', 'Cylinder ' + cyl + ': ' + label);
        });

        // Ostatni zapłon w kolejności, z pominięciem cylindrów wyłączonych przez MDS.
        var index = Math.floor(mod(theta - 360, 720) / 90);
        for (var step = 0; step < 8 && isOff(ORDER[index]); step++) index = mod(index - 1, 8);
        orderItems.forEach(function (item, i) {
            item.classList.toggle('is-off', isOff(ORDER[i]));
            item.classList.toggle('is-fired', i === index);
        });
    }

    function paintText() {
        var phase = phaseOf(selected);
        var stroke = STROKES[strokeOf(phase)];
        var off = isOff(selected);
        var whole = Math.round(mod(theta, 720));
        var valueText = 'Wał ' + whole + '° · cylinder ' + selected + ': ' + (off ? 'wyłączony' : stroke.short);
        angleOut.value = valueText;
        slider.setAttribute('aria-valuetext', valueText);

        var title = off ? 'Cylinder ' + selected + ' wyłączony' : stroke.name + ' · cylinder ' + selected;
        var body = off
            ? 'Zawory pozostają zamknięte, a cylinder nie dostaje paliwa ani zapłonu. Tłok nadal się porusza, bo łączy go z wałem korbowód, a uwięziony gaz działa jak sprężyna.'
            : stroke.text;
        if (title + body !== lastMessage) {
            status.textContent = title;
            explanation.textContent = body;
            lastMessage = title + body;
        }
    }

    function render() {
        paintEngine();
        paintMap();
        paintText();
    }

    function setHead(type) {
        headType = type;
        heads.hemi.style.display = type === 'hemi' ? '' : 'none';
        heads.wedge.style.display = type === 'wedge' ? '' : 'none';
        headNote.textContent = HEADS[type];
    }

    function tick(now) {
        if (!playing) return;
        var delta = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (onScreen) {
            theta = mod(theta + delta * DEGREES_PER_SECOND, 720);
            slider.value = String(Math.round(theta / 5) * 5);
            render();
        }
        frame = window.requestAnimationFrame(tick);
    }

    function setPlaying(next) {
        playing = next;
        window.cancelAnimationFrame(frame);
        playBtn.textContent = next ? 'Zatrzymaj ❚❚' : 'Uruchom silnik ▶';
        playBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
        // Podczas animacji komunikaty nie są odczytywane — zmieniałyby się co półtorej sekundy.
        resultBox.setAttribute('aria-live', next ? 'off' : 'polite');
        if (next) {
            last = performance.now();
            frame = window.requestAnimationFrame(tick);
        }
    }

    function syncMotionPreference() {
        if (reducedMotion.matches) {
            setPlaying(false);
            playBtn.disabled = true;
            playBtn.textContent = 'Użyj suwaka';
        } else {
            playBtn.disabled = false;
            if (!playing) playBtn.textContent = 'Uruchom silnik ▶';
        }
    }

    slider.addEventListener('input', function () {
        setPlaying(false);
        theta = Number(slider.value);
        render();
    });
    playBtn.addEventListener('click', function () { setPlaying(!playing); });
    mdsBox.addEventListener('change', function () { mds = mdsBox.checked; render(); });
    lab.querySelectorAll('input[name="hl-head"]').forEach(function (radio) {
        radio.addEventListener('change', function () { if (radio.checked) setHead(radio.value); });
    });
    cylButtons.forEach(function (button) {
        button.addEventListener('click', function () { selected = Number(button.dataset.cyl); render(); });
    });
    lab.querySelector('#hl-reset').addEventListener('click', function () {
        setPlaying(false);
        syncMotionPreference();
        theta = 360; selected = 1; mds = false;
        slider.value = '360';
        mdsBox.checked = false;
        lab.querySelector('input[name="hl-head"][value="hemi"]').checked = true;
        setHead('hemi');
        render();
    });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            onScreen = entries[0].isIntersecting;
        }).observe(lab);
    }
    reducedMotion.addEventListener('change', syncMotionPreference);
    window.addEventListener('pagehide', function () { setPlaying(false); });

    countOut.hidden = false;
    lab.querySelector('fieldset').disabled = false;
    cylButtons.forEach(function (button) { button.disabled = false; });
    syncMotionPreference();
    setHead('hemi');
    render();
}());
