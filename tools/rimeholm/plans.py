# python3 tools/rimeholm/plans.py (after sample.mjs): out/plan<n>.png and out/prof<n>.png for each hole, and
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
COL = {'snow': (0.95, 0.96, 0.98), 'rough': (0.86, 0.90, 0.95), 'fairway': (0.74, 0.83, 0.92), 'fringe': (0.62, 0.80, 0.50),
       'green': (0.66, 0.87, 0.52), 'tee': (0.70, 0.80, 0.90), 'sand': (0.42, 0.41, 0.43), 'water': (0.55, 0.78, 0.86),
       'ice': (0.70, 0.86, 0.94), 'rock': (0.56, 0.57, 0.62), 'rubble': (0.74, 0.76, 0.80), 'travertine': (0.93, 0.89, 0.80),
       'hall': (0.55, 0.42, 0.30), 'void': (0.16, 0.22, 0.34), 'powder': (0.88, 0.93, 1.0)}
INK = '#2b2b2b'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
pal = np.array([COL[s] for s in SURF])

def label(ax, p, text, **k):
    ax.annotate(text, p, fontsize=k.pop('fs', 6.2), ha='center', va='center', color=k.pop('color', INK), zorder=20,
                bbox=dict(boxstyle='round,pad=0.18', fc='white', ec='none', alpha=0.85), **k)

def draw_objs(ax, objs):
    for o in objs:
        k = o['kind']
        if k == 'serac':
            ax.add_patch(Circle((o['x'], o['z']), o['r'], fc=(0.62, 0.80, 0.92), ec='#3d6f8f', lw=0.6, zorder=8))
            ax.text(o['x'], o['z'], f"{o['h']:.0f}", fontsize=4.2, ha='center', va='center', color='#1e3d52', zorder=9)
        elif k == 'boulder':
            ax.add_patch(Circle((o['x'], o['z']), o['r'] * 0.8, fc=(0.48, 0.48, 0.52), ec=INK, lw=0.3, zorder=7))
        elif k == 'tree':
            ax.add_patch(Circle((o['x'], o['z']), o['r'], fc=(0.25, 0.42, 0.33), ec=(0.15, 0.28, 0.2), lw=0.3, zorder=7))
        elif k == 'roof':
            ax.add_patch(Polygon(np.array(o['pts']), fc='none', ec=INK, lw=0.8, ls='--', zorder=9))
            label(ax, np.array(o['pts']).mean(0), f"{o['label']} (roof {o['y']:.0f} m up)")
        elif k == 'arch':
            a, b = np.array(o['a'][:2]), np.array(o['b'][:2]); d = b - a; n = np.array([-d[1], d[0]]) / np.linalg.norm(d) * o['w'] / 2
            ax.add_patch(Polygon(np.array([a + n, b + n, b - n, a - n]), fc=(0.70, 0.86, 0.94, 0.6), ec='#3d6f8f', lw=0.8, ls='--', zorder=11))
            label(ax, (a + b) / 2 + n * 3, f"{o['label']} ({o['h']:.0f} m)")
        elif k == 'hall':
            P = np.array(o['pts']); ax.add_patch(Polygon(P, fc=(0.62, 0.46, 0.30), ec=INK, lw=0.6, zorder=8))
            c = P.mean(0); label(ax, c, o['label'])
        elif k == 'longship':
            c, s = np.cos(o['rot']), np.sin(o['rot']); L, B = o['len'] / 2, o['beam'] / 2
            t = np.linspace(-1, 1, 30); u = np.concatenate([t * L, t[::-1] * L]); v = np.concatenate([B * (1 - t ** 2) ** 0.7, -B * (1 - t[::-1] ** 2) ** 0.7])
            P = np.stack([o['x'] + u * c - v * s, o['z'] + u * s + v * c], 1)
            ax.add_patch(Polygon(P, fc=(0.36, 0.30, 0.25, 0.45), ec='#4a3a2a', lw=0.7, ls=(0, (2, 1)), zorder=6))
        elif k == 'mammoth':
            ax.add_patch(Ellipse((o['x'], o['z']), 14, 7, angle=np.degrees(o['dir']) - 90, fc=(0.45, 0.33, 0.24, 0.55), ec='#4a3a2a', lw=0.6, ls=(0, (2, 1)), zorder=8))
        elif k == 'iceblock':
            ax.add_patch(Polygon(np.array([[o['x'] + np.cos(a + o['tilt']) * o['r'], o['z'] + np.sin(a + o['tilt']) * o['r'] * 0.8] for a in np.linspace(0, 6.28, 6)[:-1]]), fc=(0.80, 0.90, 0.97), ec='#3d6f8f', lw=0.35, zorder=7))
        elif k == 'brazier':
            ax.plot(o['x'], o['z'], marker='o', ms=2.4, mfc='#f0a030', mec=INK, mew=0.3, zorder=9)

for h in D['holes']:
    n, W, H = h['n'], h['W'], h['H']
    raw = open(f'{G}/h{n}.bin', 'rb').read()
    hgt = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).copy()
    srf = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W)
    void = np.isnan(hgt); hf = np.where(void, np.nanmin(hgt) - 8, hgt)
    rgb = pal[srf].copy()
    shade = LightSource(azdeg=315, altdeg=40).hillshade(hf, vert_exag=1.6, dx=1, dy=1)
    # blue shadows on the snow
    rgb = np.clip(rgb * (0.80 + 0.26 * shade[..., None]) - (1 - shade[..., None]) * np.array([0.06, 0.03, 0.0]), 0, 1); rgb[void] = COL['void']
    x0, z0 = h['x0'], h['z0']; ext = [x0, x0 + W, z0 + H, z0]
    L = np.array(h['line'])
    cx0, cx1 = L[:, 0].min() - 95, L[:, 0].max() + 95; cz0, cz1 = L[:, 1].min() - 60, L[:, 1].max() + 40
    w, hh = cx1 - cx0, cz1 - cz0; asp = 7.3 / 5.2
    if hh / w < asp: d = (w * asp - hh) / 2; cz0 -= d; cz1 += d
    else: d = (hh / asp - w) / 2; cx0 -= d; cx1 += d
    fig = plt.figure(figsize=(5.2, 7.3), dpi=220); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0.005, 0.005, 0.99, 0.99]); ax.imshow(rgb, extent=ext, interpolation='bilinear', zorder=1)
    # stipple the bunkers so they read as sand (black sand: pale grains) and powder (blue specks)
    rng = np.random.default_rng(n)
    for code, col, ms in ((SURF.index('sand'), '#c9c9cf', 0.9), (SURF.index('powder'), '#6f8fc0', 0.8)):
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
    # the crevasses and the moulin's rims, inked
    ax.contour(xs, zs, void.astype(float), levels=[0.5], colors=INK, linewidths=0.6, zorder=3)
    draw_objs(ax, h['objs']); draw_objs(ax, h['wobjs'])
    # crevasse edges, the raised lip inked heavier with hachures down from it; scarps as a hachured line
    def hach(P, side, ln=3.2, every=3):
        P = np.array(P)
        for i in range(0, len(P) - 1, every):
            a, b = P[i], P[i + 1]; d = b - a; l = np.hypot(*d)
            if l == 0: continue
            n = np.array([-d[1], d[0]]) / l * side * ln
            ax.plot([a[0], a[0] + n[0]], [a[1], a[1] + n[1]], color=INK, lw=0.45, zorder=4)
    for c in h['cracks']:
        if 'ring' in c: continue
        if 'scarp' in c:
            P = np.array(c['scarp']); ax.plot(P[:, 0], P[:, 1], color=INK, lw=1.1, zorder=4); hach(c['scarp'], -c['side'], 4, 2); continue
        for e in ('L', 'R'):
            P = np.array(c[e]); lip = c['lip'] == e
            ax.plot(P[:, 0], P[:, 1], color=INK, lw=1.3 if lip else 0.55, zorder=4)
            if lip: hach(c[e], -1 if e == 'R' else 1, 2.6, 2)
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
    ax.plot(*h['pin'], marker='o', ms=2, color=INK, zorder=17); ax.plot([h['pin'][0], h['pin'][0]], [h['pin'][1], h['pin'][1] - 9], color=INK, lw=0.7, zorder=17)
    ax.add_patch(Polygon([[h['pin'][0], h['pin'][1] - 9], [h['pin'][0] + 6, h['pin'][1] - 7.5], [h['pin'][0], h['pin'][1] - 6]], fc='#c0392b', ec='none', zorder=17))
    for t in h['targets']:
        ax.plot(*t['p'], marker='o', ms=4, mfc='#e85d3f' if t['bold'] else '#26a6b8', mec=INK, mew=0.5, zorder=16)
        ax.annotate(f"{t['name']} · {t['d']}", t['p'], xytext=(6, 3), textcoords='offset points', fontsize=5.6, zorder=18,
                    bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
    for p, t in h['labels']: label(ax, p, t, fs=5.8, color='#334')
    for o in h['objs']:
        if o['kind'] in ('longship', 'mammoth'): label(ax, (o['x'], o['z'] + (14 if o['kind'] == 'mammoth' else 0)), o['label'], fs=5.6, color='#4a3a2a')
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
                ax.add_patch(plt.Rectangle((p[0] - 1, a + b0), 2, min(b + b0, ymax + 50) - a - b0, fc=(0.55, 0.65, 0.72), ec='none', zorder=3))
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

# the course map
M = json.load(open(f'{G}/world.json'))
raw = open(f'{G}/world.bin', 'rb').read(); N = M['MW'] * M['MH']
m = np.frombuffer(raw[:N], dtype=np.uint8).reshape(M['MH'], M['MW']); mh = np.frombuffer(raw[N:], dtype=np.float32).reshape(M['MH'], M['MW'])
vd = np.isnan(mh); hf = np.where(vd, np.nanmin(mh) - 10, mh)
shade = LightSource(azdeg=315, altdeg=40).hillshade(hf, vert_exag=2.2, dx=M['WR'], dy=M['WR'])
img = np.clip(pal[m] * (0.78 + 0.28 * shade[..., None]) - (1 - shade[..., None]) * np.array([0.07, 0.03, 0.0]), 0, 1); img[vd] = COL['void']
ext = [M['X0'], M['X0'] + M['MW'] * M['WR'], M['Z0'] + M['MH'] * M['WR'], M['Z0']]
fig = plt.figure(figsize=(10.2, 6.9), dpi=200); fig.patch.set_facecolor('white')
ax = fig.add_axes([0, 0, 1, 1]); ax.imshow(img, extent=ext, interpolation='bilinear')
xs = M['X0'] + (np.arange(M['MW']) + 0.5) * M['WR']; zs = M['Z0'] + (np.arange(M['MH']) + 0.5) * M['WR']
cs = ax.contour(xs, zs, np.where(vd, np.nan, mh), levels=np.arange(60, 200, 10), colors='#405060', linewidths=0.3, alpha=0.5)
ax.clabel(cs, fontsize=4.5, fmt='%d', inline=True)
ax.add_patch(Polygon(np.array(M['hall']), fc=(0.62, 0.46, 0.30), ec=INK, lw=0.5))
for hh in M['holes']:
    L = np.array(hh['line']); ax.plot(L[:, 0], L[:, 1], ls=(0, (4, 2)), color='#c99a00', lw=1.0)
    t = hh['tees']['mammoth']; ax.plot(*t, 'o', ms=10, mfc='white', mec=INK, mew=0.8); ax.text(*t, str(hh['n']), fontsize=7, ha='center', va='center', weight='bold')
    e = L[-1]; ax.plot(e[0], e[1], marker='o', ms=2.5, color='#c0392b')
    mid = L[len(L) // 2] if len(L) > 2 else (L[0] + L[-1]) / 2
    ax.annotate(hh['name'], mid, xytext=(10, -10), textcoords='offset points', fontsize=7, bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
x0, x1, z0, z1 = -240, 1280, -800, 540
w, hh_ = x1 - x0, z1 - z0; asp = 6.9 / 10.2
if hh_ / w < asp: d = (w * asp - hh_) / 2; z0 -= d; z1 += d
else: d = (hh_ / asp - w) / 2; x0 -= d; x1 += d
ax.set_xlim(x0, x1); ax.set_ylim(z1, z0); ax.set_aspect('equal'); ax.axis('off')
ax.plot([x0 + 40, x0 + 240], [z1 - 40, z1 - 40], color=INK, lw=2); ax.text(x0 + 140, z1 - 55, '200 m', fontsize=7, ha='center')
ax.annotate('N', xy=(x1 - 50, z0 + 30), xytext=(x1 - 50, z0 + 90), fontsize=8, ha='center', arrowprops=dict(arrowstyle='-|>', color=INK))
label(ax, (60, -30), 'the hall', fs=6.5)
fig.savefig(f'{OUT}/map.png', facecolor='white'); plt.close(fig)
print('plans, profiles and map written')
