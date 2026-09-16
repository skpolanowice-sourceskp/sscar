/* ============================================================================
   Atrapa DOM + canvas do TESTOWANIA SYMULATORA GEOMETRII BEZ PRZEGLADARKI.

   W tym srodowisku nie ma ani przegladarki headless, ani node-canvas, wiec
   jedyny sposob, zeby sprawdzic czy kod z <script> w geometria-3d.html w ogole
   dziala (i jak wyglada), to podstawic mu falszywy DOM, nagrac wszystkie
   wywolania rysujace i wyrenderowac je osobno.

   Uzycie (z korzenia repo):
       python tools/canvas_extract.py  tmp/check.js      # wytnij IIFE ze strony
       node   tools/canvas_harness.js  default           # uruchom + nagraj ops.json
       python tools/canvas_render.py   main widok        # ops.json -> out_widok.png

   Scenariusze: default (przemiata wszystkie suwaki i przyciski, szuka wyjatkow),
   init, camber, toe, caster, steer, press.

   UWAGA: kompozycja alfa w canvas_render.py potrafi wyciagnac na wierzch
   element narysowany WCZESNIEJ (widac to na sprezynie kolumny, ktora w
   przegladarce jest schowana za kolem). Kolejnosc rysowania sprawdzaj
   w ops.json po indeksach, nie na oko z PNG.

   Atrapa DOM jest skrojona pod #geo-lab. Do innej sekcji trzeba przerobic
   drzewo elementow na dole pliku.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const src = fs.readFileSync(process.env.GEO_JS || path.join(SP, 'check.js'), 'utf8');

const OPS = { main: [], patch: [] };
let target = 'main';

function makeCtx(tag){
  const st = { fillStyle:'#000', strokeStyle:'#000', lineWidth:1, lineCap:'butt',
               lineJoin:'miter', font:'', textAlign:'start', textBaseline:'alphabetic',
               globalAlpha:1 };
  let cur = [];
  const stack = [];
  const push = o => OPS[tag].push(o);
  const ctx = {
    canvas: null,
    get fillStyle(){ return st.fillStyle; },   set fillStyle(v){ st.fillStyle = (v && v._grad) ? 'rgba(255,255,255,0.03)' : v; },
    get strokeStyle(){ return st.strokeStyle; }, set strokeStyle(v){ st.strokeStyle = v; },
    get lineWidth(){ return st.lineWidth; },   set lineWidth(v){ st.lineWidth = v; },
    get lineCap(){ return st.lineCap; },       set lineCap(v){ st.lineCap = v; },
    get lineJoin(){ return st.lineJoin; },     set lineJoin(v){ st.lineJoin = v; },
    get font(){ return st.font; },             set font(v){ st.font = v; },
    get textAlign(){ return st.textAlign; },   set textAlign(v){ st.textAlign = v; },
    get textBaseline(){ return st.textBaseline; }, set textBaseline(v){ st.textBaseline = v; },
    setTransform(a,b,c,d,e,f){ push({op:'xf', m:[a,b,c,d,e,f]}); },
    clearRect(x,y,w,h){ push({op:'clear', r:[x,y,w,h]}); },
    save(){ stack.push(Object.assign({}, st)); },
    restore(){ const s = stack.pop(); if(s) Object.assign(st, s); },
    beginPath(){ cur = []; },
    moveTo(x,y){ cur.push(['M',x,y]); },
    lineTo(x,y){ cur.push(['L',x,y]); },
    closePath(){ cur.push(['Z']); },
    rect(x,y,w,h){ cur.push(['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']); },
    arc(x,y,r,a0,a1,ccw){ cur.push(['A',x,y,r,a0,a1,!!ccw]); },
    clip(){},
    setLineDash(){},
    fill(){ push({op:'fill', p:cur.slice(), c:st.fillStyle}); },
    stroke(){ push({op:'stroke', p:cur.slice(), c:st.strokeStyle, w:st.lineWidth, cap:st.lineCap}); },
    fillRect(x,y,w,h){ push({op:'frect', r:[x,y,w,h], c:st.fillStyle}); },
    strokeRect(x,y,w,h){ push({op:'srect', r:[x,y,w,h], c:st.strokeStyle, w:st.lineWidth}); },
    fillText(t,x,y){ push({op:'text', t:String(t), x, y, c:st.fillStyle, a:st.textAlign, b:st.textBaseline, f:st.font}); },
    measureText(t){ return { width: String(t).length * 6.2 }; },
    createRadialGradient(){ const st=[]; return { addColorStop:(o,c)=>st.push([o,c]), _st:st, _grad:true }; },
    getImageData(){ return { data:[0,0,0,0] }; }   // wymusza fallback koloru
  };
  return ctx;
}

/* ---------------- atrapa DOM ---------------- */
let raf = [];
class El {
  constructor(tag, id, cls, data){
    this.tagName = (tag||'div').toUpperCase();
    this.id = id || '';
    this._cls = new Set((cls||'').split(/\s+/).filter(Boolean));
    this.dataset = data || {};
    this.style = {};
    this.children = [];
    this.parent = null;
    this.textContent = '';
    this.innerHTML = '';
    this.attrs = {};
    this.handlers = {};
    this.width = 0; this.height = 0;
    this._ctx = null;
    this.classList = {
      add: (...c) => c.forEach(x => this._cls.add(x)),
      remove: (...c) => c.forEach(x => this._cls.delete(x)),
      contains: c => this._cls.has(c),
      toggle: (c, on) => { if(on === undefined) on = !this._cls.has(c); on ? this._cls.add(c) : this._cls.delete(c); return on; }
    };
  }
  get className(){ return [...this._cls].join(' '); }
  getContext(){ if(!this._ctx){ this._ctx = makeCtx(this.id === 'patch-canvas' ? 'patch' : 'main'); } return this._ctx; }
  getBoundingClientRect(){
    if(this.id === 'geo-canvas')   return { width:700, height:525, top:400, left:0 };
    if(this.id === 'patch-canvas') return { width:560, height:196, top:900, left:0 };
    return { width:600, height:300, top:100, left:0 };
  }
  setAttribute(k,v){ this.attrs[k] = v; }
  getAttribute(k){ return this.attrs[k]; }
  addEventListener(t, fn){ (this.handlers[t] = this.handlers[t] || []).push(fn); }
  fire(t, ev){ (this.handlers[t]||[]).forEach(fn => fn(ev || {})); }
  setPointerCapture(){} releasePointerCapture(){}
  closest(sel){ let n = this; while(n){ if(n.matches(sel)) return n; n = n.parent; } return null; }
  matchSimple(sel){
    const m = sel.match(/^([a-z]*)(?:\.([\w-]+))?(?:\[data-([\w-]+)="([^"]+)"\])?$/);
    if(!m) return false;
    if(m[1] && this.tagName !== m[1].toUpperCase()) return false;
    if(m[2] && !this._cls.has(m[2])) return false;
    if(m[3] && this.dataset[m[3]] !== m[4]) return false;
    return true;
  }
  matches(sel){
    const parts = sel.trim().split(/\s+/);
    if(!this.matchSimple(parts[parts.length - 1])) return false;
    let n = this.parent, i = parts.length - 2;
    while(i >= 0){
      if(!n) return false;
      if(n.matchSimple(parts[i])) i--;
      n = n.parent;
    }
    return true;
  }
  all(){ let out = [this]; this.children.forEach(c => out = out.concat(c.all())); return out; }
  querySelectorAll(sel){ const r = this.all().filter(e => e !== this && e.matches(sel)); r.forEach = Array.prototype.forEach.bind(r); return r; }
  querySelector(sel){ return this.querySelectorAll(sel)[0] || null; }
  add(child){ child.parent = this; this.children.push(child); return child; }
}

const byId = {};
function mk(tag, id, cls, data, parent){
  const e = new El(tag, id, cls, data);
  if(id) byId[id] = e;
  if(parent) parent.add(e);
  return e;
}

const sec = mk('section', 'geo-lab', 'geo-lab');
const lab = mk('div', null, 'lab', null, sec);
const stage = mk('div', null, 'lab-stage', null, lab);
const vp = mk('div', null, 'lab-viewport', null, stage);
mk('canvas', 'geo-canvas', null, null, vp);
const hudBox = mk('div', null, 'lab-hud', null, vp);
['camber','toe','caster'].forEach(k => {
  const chip = mk('span', null, 'hud-chip', {p:k}, hudBox);
  mk('b', 'hud-' + k, null, null, chip);
});
mk('p', 'lab-hint', 'lab-hint', null, vp);
const cams = mk('div', null, 'lab-cams', null, stage);
['iso','camber','toe','caster'].forEach((c,i) => mk('button', null, 'cam-btn' + (i===0?' is-on':''), {cam:c}, cams));

const panel = mk('div', null, 'lab-panel', null, lab);
const RANGES = {
  camber:{min:-30,max:30,value:-3}, toe:{min:-50,max:50,value:2},
  caster:{min:0,max:100,value:45},  steer:{min:-34,max:34,value:0},
  press:{min:14,max:34,value:22}
};
Object.keys(RANGES).forEach(k => {
  const ctl = mk('div', null, 'ctl', {p:k}, panel);
  const inp = mk('input', 'in-' + k, 'ctl-range', null, ctl);
  Object.assign(inp, RANGES[k]);
  mk('output', 'out-' + k, 'ctl-val', null, ctl);
  mk('span', 'fill-' + k, 'ctl-fill', null, ctl);
});
mk('button', 'lab-reset', 'panel-reset', null, panel);

const out = mk('div', null, 'lab-out', null, sec);
const patchBox = mk('div', null, 'out-patch', null, out);
mk('canvas', 'patch-canvas', null, null, patchBox);
mk('p', 'verdict', 'out-verdict', null, patchBox);
const effBox = mk('div', null, 'out-eff', null, out);
['m-life','m-stab','m-ret','m-agi','m-eff'].forEach(id => {
  const m = mk('div', id, 'meter', null, effBox);
  const bar = mk('span', null, 'meter-bar', null, m);
  mk('i', null, null, null, bar);
  mk('b', null, null, null, m);
});

const dxList = mk('ol', null, 'dx-list', null, sec);
const DX = [
  {camber:'-3', toe:'42', caster:'45', press:'22'},
  {camber:'-24', toe:'2', caster:'45', press:'22'},
  {camber:'22', toe:'2', caster:'45', press:'22'},
  {camber:'-3', toe:'2', caster:'45', press:'15'},
  {camber:'-3', toe:'2', caster:'45', press:'32'}
];
DX.forEach(d => { const row = mk('li', null, 'dx-row', null, dxList); mk('button', null, 'dx-sim', d, row); });

const documentStub = {
  documentElement: new El('html'),
  body: new El('body'),
  getElementById: id => byId[id] || null,
  querySelector: s => sec.querySelector(s),
  querySelectorAll: s => sec.querySelectorAll(s),
  createElement: t => new El(t),
  fonts: { ready: Promise.resolve() }
};
const windowStub = {
  matchMedia: () => ({ matches:false }),
  devicePixelRatio: 1,
  pageYOffset: 0,
  scrollTo: () => {},
  ResizeObserver: null,
  addEventListener: () => {}
};
const gcs = () => ({ getPropertyValue: () => 'oklch(48.5% 0.222 25.8)', color:'' });
const rafStub = fn => { raf.push(fn); return raf.length; };
const perf = { now: () => Date.now() };

/* ---------------- uruchomienie ---------------- */
const run = new Function('document','window','getComputedStyle','requestAnimationFrame','performance','ResizeObserver','console', src);
const errs = [];
try {
  run(documentStub, windowStub, gcs, rafStub, perf, undefined, console);
} catch(e){ errs.push('INIT: ' + e.stack); }

function pump(n){
  for(let i = 0; i < n; i++){
    const q = raf; raf = [];
    if(!q.length) break;
    q.forEach(fn => { try { fn(perf.now()); } catch(e){ errs.push('RAF: ' + e.stack); } });
  }
}
pump(80);

/* --------- scenariusze --------- */
function setSlider(k, v){
  const el = byId['in-' + k];
  el.value = v;
  try { el.fire('input'); } catch(e){ errs.push('input ' + k + ': ' + e.stack); }
  pump(60);
}
const report = [];
function snap(tag){
  report.push({
    tag,
    verdict: (byId.verdict.innerHTML || '').replace(/<[^>]+>/g, '').slice(0, 86),
    life: byId['m-life'].querySelector('b').textContent,
    stab: byId['m-stab'].querySelector('b').textContent,
    ret:  byId['m-ret'].querySelector('b').textContent,
    agi:  byId['m-agi'].querySelector('b').textContent,
    eff:  byId['m-eff'].querySelector('b').textContent,
    hud: ['camber','toe','caster'].map(k => byId['hud-' + k].textContent).join(' | '),
    ops: OPS.main.length
  });
}
snap('fabryczne');

const scen = process.argv[2] || 'default';
if(scen === 'camber')  setSlider('camber', -24);
if(scen === 'toe')   { setSlider('toe', 42); }
if(scen === 'caster') { setSlider('caster', 85); }
if(scen === 'steer')  { setSlider('caster', 85); OPS.main.length = 0; setSlider('steer', 30); }
if(scen === 'press')   setSlider('press', 15);
if(scen !== 'default') snap(scen);

/* przebieg wszystkich suwakow i przyciskow — szukamy wyjatkow */
if(scen === 'default'){
  OPS.main.length = 0; OPS.patch.length = 0;
  Object.keys(RANGES).forEach(k => {
    const el = byId['in-' + k];
    for(let v = +el.min; v <= +el.max; v += Math.max(1, Math.round((+el.max - +el.min)/12))) setSlider(k, v);
    setSlider(k, RANGES[k].value);
  });
  sec.querySelectorAll('.cam-btn').forEach(b => { b.fire('click'); pump(40); });
  sec.querySelectorAll('.dx-sim').forEach(b => { b.fire('click'); pump(40); });
  byId['lab-reset'].fire('click'); pump(60);
  snap('po pelnym przebiegu');
  OPS.main.length = 0; OPS.patch.length = 0;
  pump(5);
}

/* ostatnia klatka do renderu */
fs.writeFileSync(path.join(SP, 'ops.json'), JSON.stringify(OPS));
console.log(JSON.stringify({ errors: errs, report }, null, 2));
