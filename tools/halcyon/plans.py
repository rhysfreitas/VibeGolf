# python3 tools/halcyon/plans.py (after sample.mjs): out/plan<n>.png and out/prof<n>.png for each hole, and
# out/map.png for the whole course. White pages, light colours, so they print.
import json, os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from matplotlib.patches import Polygon, Circle, Ellipse
from math import hypot
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); G = os.path.join(OUT, 'grid')
D = json.load(open(f'{G}/holes.json')); SURF = D['SURF']; TEES = D['teeSets']
YD = 0.9144
COL = {'park': (0.86, 0.91, 0.76), 'rough': (0.76, 0.85, 0.62), 'fairway': (0.62, 0.81, 0.50), 'fringe': (0.55, 0.78, 0.45),
       'green': (0.60, 0.86, 0.48), 'tee': (0.70, 0.84, 0.56), 'sand': (0.95, 0.91, 0.78), 'water': (0.62, 0.78, 0.90), 'window': (0.10, 0.12, 0.22),
       'wood': (0.52, 0.68, 0.46), 'garden': (0.90, 0.90, 0.82), 'plaza': (0.88, 0.86, 0.82), 'stone': (0.80, 0.78, 0.74), 'void': (0.10, 0.10, 0.12)}
INK = '#2b2b2b'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
pal = np.array([COL[s] for s in SURF])

def label(ax, p, text, **k):
    ax.annotate(text, p, fontsize=k.pop('fs', 6.2), ha='center', va='center', color=k.pop('color', INK), zorder=20,
                bbox=dict(boxstyle='round,pad=0.18', fc='white', ec='none', alpha=0.85), **k)

TREE = {'lime': ((0.42, 0.62, 0.36), (0.22, 0.40, 0.20)), 'plane': ((0.36, 0.56, 0.34), (0.18, 0.34, 0.18)), 'yew': ((0.20, 0.38, 0.26), (0.10, 0.22, 0.14)),
        'poplar': ((0.40, 0.58, 0.32), (0.22, 0.36, 0.18)), 'willow': ((0.56, 0.70, 0.42), (0.32, 0.46, 0.24))}
def rect(o, pad=0):
    c, s_ = np.cos(o['rot']), np.sin(o['rot']); w, l = o['w'] / 2 + pad, o.get('l', o['w']) / 2 + pad
    return np.array([[o['x'] + u * c - v * s_, o['z'] + u * s_ + v * c] for u, v in ((-w, -l), (w, -l), (w, l), (-w, l))])
def draw_objs(ax, objs):
    for o in objs:
        k = o['kind']
        if k in TREE:
            fc, ec = TREE[k]
            ax.add_patch(Circle((o['x'], o['z']), o['r'], fc=fc, ec=ec, lw=0.3, zorder=7, alpha=0.92))
        elif k in ('villa', 'clubhouse'):
            ax.add_patch(Polygon(rect(o), fc='white', ec=INK, lw=0.7 if k == 'villa' else 1.1, zorder=9))
            if k == 'clubhouse': ax.add_patch(Polygon(rect(o, -5), fc='none', ec=INK, lw=0.4, zorder=9))
        elif k == 'leg':
            ax.add_patch(Polygon(rect(o), fc=(0.80, 0.82, 0.86), ec=INK, lw=0.9, zorder=9))
            ax.add_patch(Polygon(rect(o, -6), fc='none', ec=(0.5, 0.52, 0.58), lw=0.4, zorder=9))
        elif k == 'wall':
            ax.plot([o['a'][0], o['b'][0]], [o['a'][1], o['b'][1]], color=INK, lw=1.8, solid_capstyle='butt', zorder=9)
        elif k == 'bridge':
            ax.plot([o['a'][0], o['b'][0]], [o['a'][1], o['b'][1]], color=(0.45, 0.42, 0.38), lw=3.2, zorder=10)
            ax.plot([o['a'][0], o['b'][0]], [o['a'][1], o['b'][1]], color='white', lw=1.4, zorder=10)
        elif k == 'falls':
            ax.add_patch(Polygon(np.array([[o['x'] - o['w'] / 2, o['z'] - 2], [o['x'] + o['w'] / 2, o['z'] - 2], [o['x'] + o['w'] / 2, o['z'] + 2], [o['x'] - o['w'] / 2, o['z'] + 2]]), fc=(0.80, 0.90, 0.98), ec=(0.30, 0.50, 0.70), lw=0.5, zorder=9))
        elif k == 'beam':   # a beam across the rim glass on a wall rib: the floor's edge (a) to the wall (b)
            a, b = np.array(o['a']), np.array(o['b']); d = b - a; n = np.array([-d[1], d[0]]) / np.hypot(*d) * o['w'] / 2
            ax.add_patch(Polygon(np.array([a - n, b - n, b + n, a + n]), fc=(0.86, 0.88, 0.92), ec=INK, lw=0.5, zorder=9))
        elif k == 'sill':   # the sill along the wall's foot
            P = np.array(o['pts']); ax.plot(P[:, 0], P[:, 1], color=(0.80, 0.82, 0.87), lw=2.4, solid_capstyle='butt', zorder=9); ax.plot(P[:, 0], P[:, 1], color=INK, lw=0.4, zorder=9)
        elif k == 'window':
            P = np.array(o['pts']); ax.add_patch(Polygon(P, fc='none', ec='white', lw=1.4, zorder=6)); ax.add_patch(Polygon(P, fc='none', ec=INK, lw=0.5, zorder=6))

for h in D['holes']:
    n, W, H = h['n'], h['W'], h['H']
    raw = open(f'{G}/h{n}.bin', 'rb').read()
    hgt = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).copy()
    srf = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W)
    void = np.isnan(hgt); hf = np.where(void, np.nanmin(hgt) - 8, hgt)
    rgb = pal[srf].copy()
    shade = LightSource(azdeg=315, altdeg=40).hillshade(hf, vert_exag=1.6, dx=1, dy=1)
    rgb = np.clip(rgb * (0.78 + 0.28 * shade[..., None]), 0, 1); rgb[void] = COL['void']
    x0, z0 = h['x0'], h['z0']; ext = [x0, x0 + W, z0 + H, z0]
    L = np.array(h['line'])
    cx0, cx1 = L[:, 0].min() - 95, L[:, 0].max() + 95; cz0, cz1 = L[:, 1].min() - 60, L[:, 1].max() + 40
    w, hh = cx1 - cx0, cz1 - cz0; asp = 7.3 / 5.2
    if hh / w < asp: d = (w * asp - hh) / 2; cz0 -= d; cz1 += d
    else: d = (hh / asp - w) / 2; cx0 -= d; cx1 += d
    fig = plt.figure(figsize=(5.2, 7.3), dpi=220); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0.005, 0.005, 0.99, 0.99]); ax.imshow(rgb, extent=ext, interpolation='bilinear', zorder=1)
    # stipple the bunkers and sandbars (grains), the swamp's mud and the tar
    rng = np.random.default_rng(n)
    for code, col, ms in ((SURF.index('sand'), '#a89470', 0.8),):
        rr, cc = np.nonzero(srf == code)
        if len(rr):
            k = rng.random(len(rr)) < 0.07
            ax.plot(x0 + cc[k] + 0.5, z0 + rr[k] + 0.5, 'o', ms=ms, mew=0, color=col, zorder=3)
    xs = x0 + np.arange(W) + 0.5; zs = z0 + np.arange(H) + 0.5
    hm = np.where(void, np.nan, hgt) + h['base']
    
    lo, hi = np.floor(np.nanmin(hm)), np.ceil(np.nanmax(hm))
    ax.contour(xs, zs, hm, levels=np.arange(lo - lo % 2, hi + 1, 2), colors='#506070', linewidths=0.15, alpha=0.4, zorder=2)
    cs = ax.contour(xs, zs, hm, levels=np.arange(lo - lo % 10, hi + 1, 10), colors='#405060', linewidths=0.45, alpha=0.7, zorder=2)
    ax.clabel(cs, fontsize=4.5, fmt='%d', inline=True)
    # the water's edge and the tar pit's, inked; the cliffs hachured by their contours
    ax.contour(xs, zs, (srf == SURF.index('water')).astype(float), levels=[0.5], colors='#3b6e96', linewidths=0.5, zorder=3)
    # the floor windows: stars through the glass
    wv = srf == SURF.index('window')
    if wv.any():
        rr, cc = np.nonzero(wv); k = rng.random(len(rr)) < 0.012
        ax.plot(x0 + cc[k] + 0.5, z0 + rr[k] + 0.5, '.', ms=0.9, color='white', zorder=4)
    draw_objs(ax, h['objs']); draw_objs(ax, h['wobjs'])
    ax.plot(L[:, 0], L[:, 1], ls=(0, (5, 3)), color='#c99a00', lw=1.1, zorder=14)
    if h.get('bold'): B = np.array(h['bold']['line']); ax.plot(B[:, 0], B[:, 1], ls=(0, (1.5, 2)), color='#b5341f', lw=1.2, zorder=14)
    segs = [(L[i], L[i + 1]) for i in range(len(L) - 1)]; tot = sum(hypot(*(b - a)) for a, b in segs)
    for yd in range(100, int(tot / YD), 50):
        s = tot - yd * YD
        for a, b in segs:
            l = hypot(*(b - a))
            if s <= l:
                p = a + (b - a) * s / l; u = (b - a) / l; nrm = np.array([-u[1], u[0]]) * 7
                ax.plot([p[0] - nrm[0], p[0] + nrm[0]], [p[1] - nrm[1], p[1] + nrm[1]], color=INK, lw=0.8, zorder=15)
                ax.text(p[0] + nrm[0] * 1.6, p[1] + nrm[1] * 1.6, str(yd), fontsize=5.5, ha='center', va='center', zorder=15, color=INK)
                break
            s -= l
    for t in TEES:
        p = h['tees'].get(t['id'])
        if p: ax.plot(p[0], p[1], 'o', ms=4.2, mfc=t['color'], mec=INK, mew=0.6, zorder=16)
    tp = h['tips']; ax.plot(tp[0], tp[1], 'o', ms=6.5, mfc='none', mec=INK, mew=0.8, ls='none', zorder=16)
    ax.annotate(f"tips {h['tipsYards']}", tp, xytext=(6, -2), textcoords='offset points', fontsize=5.2, color='#555', zorder=18)
    ax.plot(*h['pin'], marker='o', ms=2, color=INK, zorder=17); ax.plot([h['pin'][0], h['pin'][0]], [h['pin'][1], h['pin'][1] - 9], color=INK, lw=0.7, zorder=17)
    ax.add_patch(Polygon([[h['pin'][0], h['pin'][1] - 9], [h['pin'][0] + 6, h['pin'][1] - 7.5], [h['pin'][0], h['pin'][1] - 6]], fc='#c0392b', ec='none', zorder=17))
    for t in h['targets']:
        ax.plot(*t['p'], marker='o', ms=4, mfc='#e85d3f' if t['bold'] else '#26a6b8', mec=INK, mew=0.5, zorder=16)
        ax.annotate(f"{t['name']} · {t['d']}", t['p'], xytext=(6, 3), textcoords='offset points', fontsize=5.6, zorder=18,
                    bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
    for p, t in h['labels']: label(ax, p, t, fs=5.8, color='#334')

    sx, sz = cx0 + 12, cz1 - 12
    ax.plot([sx, sx + 100], [sz, sz], color=INK, lw=1.5, zorder=20); ax.text(sx + 50, sz - 6, '100 m', fontsize=5.5, ha='center', zorder=20)
    th = np.radians(h['place']['heading']); nx, nz = -np.sin(th), -np.cos(th)   # north in the hole's frame
    ax.annotate('N', xy=(cx1 - 16 + nx * 10, cz1 - 22 + nz * 10), xytext=(cx1 - 16, cz1 - 22), fontsize=6.5, ha='center', va='center', zorder=20,
                arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.8), bbox=dict(boxstyle='circle,pad=0.2', fc='white', ec=INK, lw=0.5))
    ax.set_xlim(cx0, cx1); ax.set_ylim(cz1, cz0); ax.set_aspect('equal'); ax.axis('off')
    fig.savefig(f'{OUT}/plan{n}.png', facecolor='white'); plt.close(fig)

    # the profile along the line (and the bold line), with the drives from the back tee; heights absolute
    profs = [('along the line', h['prof'], h['drives'])] + ([('the bold line', h['bold']['prof'], h['bold']['drives'])] if h.get('bold') else [])
    fig = plt.figure(figsize=(6.4, 1.75 if len(profs) == 1 else 2.45), dpi=220); fig.patch.set_facecolor('white')
    for i, (title, P, dr) in enumerate(profs):
        top = 0.95 - i * (0.88 / len(profs)); hgt_ = 0.88 / len(profs) - (0.22 if len(profs) == 1 else 0.17)
        ax = fig.add_axes([0.075, top - hgt_ - 0.05, 0.915, hgt_])
        b0 = h['base']
        s = np.array([p[0] for p in P]); y = np.array([np.nan if p[1] is None else p[1] + b0 for p in P])
        floor = np.nanmin(y) - 6
        ax.fill_between(s, floor, np.where(np.isnan(y), floor, y), color='#e6ebf1', lw=0)
        for k in range(len(P) - 1):
            if P[k][1] is not None and P[k + 1][1] is not None: ax.plot(s[k:k + 2], y[k:k + 2], color=[c * 0.8 for c in COL.get(P[k][2], (0.5, 0.5, 0.5))], lw=2.4, solid_capstyle='butt')
            elif P[k][1] is None: ax.axvspan(s[k], s[k + 1], color=COL['void'], alpha=0.85, lw=0)
        ymax = max(np.nanmax(y) + 10, max([h['teeY'] + b0 + d['apex'] + 6 for d in dr.values()] or [0]))
        for p in P:
            for a, b, what in p[3]:
                ax.add_patch(plt.Rectangle((p[0] - 2, a + b0), 4, min(b + b0, ymax + 50) - a - b0, fc=(0.36, 0.42, 0.50), ec='none', zorder=6))
        sty = {'tour': ('#b5341f', '-', 'tour drive'), 'mid': ('#4b6fa8', '-', '150 mph'), 'high': ('#b5341f', ':', 'high drive')}
        for k, d in dr.items():
            c, ls, lab = sty[k]; A = np.array(d['pts']); fl = A[A[:, 2] == 0]
            ax.plot(fl[:, 0], fl[:, 1] + b0, color=c, ls=ls, lw=0.9, label=f"{lab}: {d['carry'] / YD:.0f} yd carry" + (f", hits {d['hit']['what']}" if d['hit'] else ''), zorder=5)
        ax.set_xlim(0, s[-1]); ax.set_ylim(floor, ymax); ax.tick_params(labelsize=5.5)
        ax.set_ylabel('m', fontsize=6); ax.grid(alpha=0.2, lw=0.4)
        ttl = f"{title}: tee {h['teeY'] + b0:.0f} m, green {h['pinY'] + b0:.0f} m ({h['pinY'] - h['teeY']:+.0f} m; climbs {h['rise']}, drops {h['fall']})" if i == 0 else title
        ax.set_title(ttl, fontsize=6.5, loc='left')
        if dr: ax.legend(fontsize=5, loc='upper right', frameon=False)
    fig.axes[-1].set_xlabel('metres from the back tee', fontsize=6)
    fig.savefig(f'{OUT}/prof{n}.png', facecolor='white'); plt.close(fig)

# the course map: the ring's floor laid out with north (spinward, up the curve) to the right, west at the top
M = json.load(open(f'{G}/world.json'))
raw = open(f'{G}/world.bin', 'rb').read(); N = M['MW'] * M['MH']
m = np.frombuffer(raw[:N], dtype=np.uint8).reshape(M['MH'], M['MW']); mh = np.frombuffer(raw[N:], dtype=np.float32).reshape(M['MH'], M['MW'])
vd = np.isnan(mh); hf = np.where(vd, np.nanmin(mh) - 10, mh)
shade = LightSource(azdeg=315, altdeg=40).hillshade(hf, vert_exag=2.0, dx=M['WR'], dy=M['WR'])
img = np.clip(pal[m] * (0.74 + 0.32 * shade[..., None]), 0, 1); img[vd] = COL['void']
X0, Z0, WR = M['X0'], M['Z0'], M['WR']; X1, Z1 = X0 + M['MW'] * WR, Z0 + M['MH'] * WR
imgT = img.transpose(1, 0, 2)[:, ::-1]            # rows: a (west at the top), columns: s (north to the right)
fig = plt.figure(figsize=(10.2, 5.0), dpi=200); fig.patch.set_facecolor('white')
ax = fig.add_axes([0, 0, 1, 1]); ax.imshow(imgT, extent=[-Z1, -Z0, X1, X0], interpolation='bilinear')
P = lambda a, s_: (s_, a)
# the night side, south of the day/night line
ax.add_patch(plt.Rectangle((-Z1, X0), M['terminator'] + Z1, X1 - X0, fc=(0.35, 0.40, 0.58), alpha=0.22, ec='none', zorder=2))
ax.plot([M['terminator']] * 2, [X0, X1], color=(0.30, 0.35, 0.52), lw=0.9, ls=(0, (6, 3)), zorder=3)
ax.text(M['terminator'] - 12, -300, 'the night side', rotation=90, fontsize=7, color=(0.22, 0.26, 0.42), ha='right', va='center', zorder=20)
for a_ in (-450, 450): ax.plot([-Z1, -Z0], [a_, a_], color=(0.22, 0.38, 0.62), lw=3.0, zorder=5)
ax.text(1640, -462, 'west rim glass', fontsize=6.5, ha='right', va='bottom', color=(0.2, 0.32, 0.5), zorder=20)
ax.text(1640, 462, 'east rim glass', fontsize=6.5, ha='right', va='top', color=(0.2, 0.32, 0.5), zorder=20)
rng = np.random.default_rng(5)
rr, cc = np.nonzero(m == SURF.index('window'))
k = rng.random(len(rr)) < 0.06
ax.plot(-(Z0 + (rr[k] + 0.5) * WR), X0 + (cc[k] + 0.5) * WR, '.', ms=0.8, color='white', zorder=4)
for hh in M['holes']:
    for o in hh['objs']:
        if o['kind'] == 'wall':
            ax.plot([-o['a'][1], -o['b'][1]], [o['a'][0], o['b'][0]], color=INK, lw=1.0, zorder=8); continue
        c, s_ = np.cos(o['rot']), np.sin(o['rot']); w, l = o['w'] / 2, o['l'] / 2
        Q = np.array([[o['at'][0] + u * c - v * s_, o['at'][1] + u * s_ + v * c] for u, v in ((-w, -l), (w, -l), (w, l), (-w, l))])
        ax.add_patch(Polygon(np.c_[-Q[:, 1], Q[:, 0]], fc=(0.80, 0.82, 0.86) if o['kind'] == 'leg' else 'white', ec=INK, lw=0.5 if o['kind'] == 'villa' else 0.9, zorder=8))
sp = M['spoke']; ax.plot([sp['s']] * 2, [sp['legs'][0][0], sp['legs'][1][0]], color=(0.45, 0.47, 0.53), lw=0.8, ls=(0, (2, 2)), zorder=7)
aq = M['aqueduct']; ax.plot([aq['from'][1], aq['to'][1]], [aq['from'][0], aq['to'][0]], color=(0.55, 0.50, 0.44), lw=3.5, solid_capstyle='butt', zorder=7)
tm = M['tram']; ax.plot([-100, 1900], [0, 0], color=(0.55, 0.55, 0.50), lw=0.6, ls=(0, (1, 3)), zorder=3)
for hh in M['holes']:
    L = np.array(hh['line']); ax.plot(-L[:, 1], L[:, 0], ls=(0, (4, 2)), color='#c99a00', lw=1.0, zorder=10)
    t = hh['tees'][M['back']]; ax.plot(-t[1], t[0], 'o', ms=10, mfc='white', mec=INK, mew=0.8, zorder=11); ax.text(-t[1], t[0], str(hh['n']), fontsize=7, ha='center', va='center', weight='bold', zorder=12)
    e = L[-1]; ax.plot(-e[1], e[0], marker='o', ms=2.5, color='#c0392b', zorder=11)
    mid = L[len(L) // 2] if len(L) > 2 else (L[0] + L[-1]) / 2
    ax.annotate(hh['name'], (-mid[1], mid[0]), xytext=(8, 8), textcoords='offset points', fontsize=7, zorder=12, bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
for (a_, s_), t_ in (((-179, 176), 'the Long Window'), ((-430, 1000), 'the long lake'), ((240, 1350), 'the canal'), ((240, 1545), 'the lock'),
                     ((370, 1625), 'the aqueduct'), ((72, 1822), 'the clubhouse'), ((130, 1110), 'the spoke'), ((262, 585), 'tram stop'), ((-445, 385), 'the high terrace'),
                     ((-397, 650), 'the balcony'), ((395, 240), 'the walled garden'), ((-250, 1160), 'the falls'), ((0, -30), 'ring tram')):
    label(ax, (s_, a_ + 22), t_, fs=6.5)
x0_, x1_, y0_, y1_ = -110, 1990, -500, 500
w_, h_ = x1_ - x0_, y1_ - y0_; asp = 5.0 / 10.2
if h_ / w_ < asp: d = (w_ * asp - h_) / 2; y0_ -= d; y1_ += d
else: d = (h_ / asp - w_) / 2; x0_ -= d; x1_ += d
ax.set_xlim(x0_, x1_); ax.set_ylim(y1_, y0_); ax.set_aspect('equal'); ax.axis('off')
ax.plot([x0_ + 260, x0_ + 460], [y1_ - 22, y1_ - 22], color=INK, lw=2, zorder=20); ax.text(x0_ + 360, y1_ - 36, '200 m', fontsize=7, ha='center', zorder=20, bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
ax.annotate('', xy=(x1_ - 40, y0_ + 22), xytext=(x1_ - 120, y0_ + 22), arrowprops=dict(arrowstyle='-|>', color=INK), zorder=20)
ax.text(x1_ - 130, y0_ + 22, 'N (spinward, up the curve)', fontsize=7, ha='right', va='center', zorder=20)
fig.savefig(f'{OUT}/map.png', facecolor='white'); plt.close(fig)
# green diagrams: the approach comes up from the bottom; contours every 5 cm (bold every 25), arrows downhill
# (longer = steeper, red over 3%), the pin areas as dashed rings, the pin as a flag
for n in range(1, 10):
    gj = f'{G}/green{n}.json'
    if not os.path.exists(gj): continue
    J = json.load(open(gj)); N = J['N']; st = J['step']
    Hh = np.array([np.nan if v is None else v for v in J['h']], float).reshape(N, N)
    GM = np.array(J['gm'], float).reshape(N, N); SF = np.array(J['s'], int).reshape(N, N)
    ext = [-24.25, 24.25, -24.25, 24.25]
    fig = plt.figure(figsize=(2.3, 2.3), dpi=220); ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(-22, 22); ax.set_ylim(-22, 22); ax.axis('off')
    img = pal[SF].copy(); img[SF == SURF.index('green')] = (0.66, 0.88, 0.56)
    ax.imshow(img, extent=ext, origin='upper', interpolation='nearest')
    ys, xs = np.mgrid[24:-24.5:-st, -24:24.5:st]
    on = GM < 0.4
    Hg = np.where(on, Hh, np.nan)
    lo, hi = np.nanmin(Hg), np.nanmax(Hg)
    lv = np.arange(np.floor(lo / 0.05) * 0.05, hi + 0.05, 0.05)
    ax.contour(xs, ys, Hg, levels=lv, colors='#3d5a2e', linewidths=0.35, alpha=0.8)
    lv2 = [v for v in lv if abs(round(v / 0.25) * 0.25 - v) < 1e-6]
    if lv2: ax.contour(xs, ys, Hg, levels=lv2, colors='#2a3f20', linewidths=0.8)
    ax.contour(xs, ys, GM, levels=[0], colors=INK, linewidths=0.9)
    gy, gx = np.gradient(Hh, st)           # gy along rows (down the page), so uphill up-page is -gy
    for r in range(4, N - 4, 8):
        for c in range(4, N - 4, 8):
            if GM[r, c] > -1 or np.isnan(Hh[r, c]): continue
            dx, dy = -gx[r, c], gy[r, c]     # downhill, in page axes (x right, y up)
            sl = hypot(dx, dy) * 100
            if sl < 0.4: continue
            L = min(3.6, 1.3 + sl * 0.6); u, v = dx / hypot(dx, dy) * L, dy / hypot(dx, dy) * L
            ax.annotate('', xy=(xs[r, c] + u / 2, ys[r, c] + v / 2), xytext=(xs[r, c] - u / 2, ys[r, c] - v / 2),
                        arrowprops=dict(arrowstyle='-|>', color='#c0392b' if sl > 3 else INK, lw=0.7, mutation_scale=6))
    for a, b in J['areas']: ax.add_patch(Circle((a, b), 3, fill=False, ls=(0, (2, 1.5)), lw=0.7, ec='#1f5fa8'))
    ax.plot([0, 0], [0, 2.6], color=INK, lw=0.7); ax.add_patch(Polygon([[0, 2.6], [1.6, 2.15], [0, 1.7]], color='#d23b2a')); ax.plot(0, 0, 'o', ms=1.6, color=INK)
    ax.plot([-20, -10], [-20.5, -20.5], color=INK, lw=1.2); ax.text(-15, -19.6, '10 m', fontsize=5.5, ha='center')
    ax.annotate('approach', xy=(17, -15), xytext=(17, -21), fontsize=5, ha='center', va='bottom', arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.6))
    fig.savefig(f'{OUT}/green{n}.png', facecolor='white'); plt.close(fig)
print('plans, profiles, greens and map written')

