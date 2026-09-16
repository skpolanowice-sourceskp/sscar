"""Renderuje zrzut operacji canvas (ops.json) do PNG, zeby dalo sie obejrzec
symulator bez przegladarki. Obsluguje tylko te operacje, ktorych uzywa kod."""
import json, math, re, sys, os
from PIL import Image, ImageDraw, ImageFont

SP = os.path.dirname(os.path.abspath(__file__))
SS = 2  # supersampling

def parse_color(c):
    c = (c or '').strip()
    m = re.match(r'rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)', c)
    if m:
        a = float(m.group(4)) if m.group(4) is not None else 1.0
        return (int(float(m.group(1))), int(float(m.group(2))), int(float(m.group(3))), int(a * 255))
    if c.startswith('#'):
        h = c[1:]
        if len(h) == 3:
            h = ''.join(ch * 2 for ch in h)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    return (255, 0, 255, 255)

def flatten(path):
    """[['M',x,y],['L',x,y],['Z'],['A',cx,cy,r,a0,a1,ccw]] -> lista subsciezek."""
    subs, cur = [], []
    for seg in path:
        k = seg[0]
        if k == 'M':
            if len(cur) > 1: subs.append(cur)
            cur = [(seg[1], seg[2])]
        elif k == 'L':
            cur.append((seg[1], seg[2]))
        elif k == 'Z':
            if len(cur) > 1: subs.append(cur)
            cur = []
        elif k == 'A':
            _, cx, cy, r, a0, a1, ccw = seg
            if ccw and a1 > a0: a1 -= 2 * math.pi
            if (not ccw) and a1 < a0: a1 += 2 * math.pi
            n = max(6, int(abs(a1 - a0) / 0.12))
            for i in range(n + 1):
                a = a0 + (a1 - a0) * i / n
                cur.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    if len(cur) > 1: subs.append(cur)
    return subs

def main(src, dst, W, H, bg=(14, 13, 13, 255)):
    ops = json.load(open(src, encoding='utf-8'))
    # tylko ostatnia klatka: od ostatniego clearRect
    last = 0
    for i, o in enumerate(ops):
        if o['op'] == 'clear':
            last = i
    ops = ops[last:]

    img = Image.new('RGBA', (W * SS, H * SS), bg)
    try:
        font_c = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 12 * SS)
        font_s = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 9 * SS)
    except Exception:
        font_c = font_s = ImageFont.load_default()

    def blend(draw_fn, col):
        """Rysuje z alfa: na osobnej warstwie i kompozycja."""
        nonlocal img
        if col[3] >= 254:
            draw_fn(ImageDraw.Draw(img), col)
        else:
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            draw_fn(ImageDraw.Draw(layer), col)
            img = Image.alpha_composite(img, layer)

    for o in ops:
        k = o['op']
        if k in ('clear', 'xf'):
            continue
        if k == 'fill':
            col = parse_color(o['c'])
            for sub in flatten(o['p']):
                pts = [(x * SS, y * SS) for x, y in sub]
                if len(pts) < 3: continue
                blend(lambda d, c, p=pts: d.polygon(p, fill=c), col)
        elif k == 'stroke':
            col = parse_color(o['c'])
            w = max(1, int(round(o.get('w', 1) * SS)))
            for sub in flatten(o['p']):
                pts = [(x * SS, y * SS) for x, y in sub]
                if len(pts) < 2: continue
                blend(lambda d, c, p=pts, w=w: d.line(p, fill=c, width=w, joint='curve'), col)
                if o.get('cap') == 'round':
                    for px, py in (pts[0], pts[-1]):
                        r = w / 2.0
                        blend(lambda d, c, px=px, py=py, r=r: d.ellipse([px-r, py-r, px+r, py+r], fill=c), col)
        elif k == 'frect':
            x, y, w, h = o['r']
            blend(lambda d, c, r=(x*SS, y*SS, (x+w)*SS, (y+h)*SS): d.rectangle(r, fill=c), parse_color(o['c']))
        elif k == 'srect':
            x, y, w, h = o['r']
            blend(lambda d, c, r=(x*SS, y*SS, (x+w)*SS, (y+h)*SS): d.rectangle(r, outline=c, width=SS), parse_color(o['c']))
        elif k == 'text':
            col = parse_color(o['c'])
            f = font_s if '9px' in (o.get('f') or '') else font_c
            x, y = o['x'] * SS, o['y'] * SS
            anchor = {'center': 'mm', 'left': 'lm', 'right': 'rm', 'start': 'ls'}.get(o.get('a'), 'lm')
            if o.get('b') == 'bottom':
                anchor = anchor[0] + 's'
            blend(lambda d, c, x=x, y=y, t=o['t'], f=f, a=anchor: d.text((x, y), t, fill=c, font=f, anchor=a), col)

    img.convert('RGB').resize((W, H), Image.LANCZOS).save(dst)
    print('zapisano', dst, W, 'x', H, '| operacji:', len(ops))

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'main'
    tag = sys.argv[2] if len(sys.argv) > 2 else 'view'
    data = json.load(open(os.path.join(SP, 'ops.json'), encoding='utf-8'))
    tmp = os.path.join(SP, '_' + which + '.json')
    json.dump(data[which], open(tmp, 'w', encoding='utf-8'))
    if which == 'main':
        main(tmp, os.path.join(SP, 'out_%s.png' % tag), 700, 525)
    else:
        main(tmp, os.path.join(SP, 'out_%s.png' % tag), 560, 196, bg=(31, 29, 29, 255))
