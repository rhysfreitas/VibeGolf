# python3 tools/labyrinth/plans.py (after sample.mjs and grids.mjs): out/plan<tag>.png, out/prof<tag>.png,
# out/green<tag>.png and out/map.png. White pages, light colours, so they print. Walls are drawn as their footprints,
# shaded by height (pale for a low wall, dark for one 50 m or more), with the height of the ones that matter written
# on them; the shut door of a two-version hole in red.
import json, os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from matplotlib.patches import Polygon, Circle
from math import hypot
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); G = os.path.join(OUT, 'grid')
S = json.load(open(f'{OUT}/sample.json')); SURF = S['surf']
YD = 0.9144
COL = {'floor': (0.80, 0.85, 0.66), 'rough': (0.72, 0.83, 0.56), 'rubble': (0.80, 0.77, 0.70), 'wall': (0.62, 0.58, 0.53), 'fairway': (0.56, 0.80, 0.44),
       'fringe': (0.52, 0.78, 0.40), 'green': (0.60, 0.88, 0.47), 'tee': (0.66, 0.84, 0.52), 'sand': (0.97, 0.93, 0.80), 'water': (0.58, 0.73, 0.84), 'penalty': (0.93, 0.78, 0.76)}
TEEC = {'tower': '#6b4a2f', 'rampart': '#b08a3e', 'gate': '#3f6a5a', 'court': '#e6dfcc', 'tips': '#45474d'}
INK = '#2b2b2b'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
pal = np.array([COL[s] for s in SURF])

def wallcol(hm, kind):
    if kind == 'door': return '#b5341f'
    t = min(1, max(0, (hm - 2) / 55)); return (0.86 - 0.5 * t, 0.82 - 0.5 * t, 0.76 - 0.48 * t)
def shaded(hgt, srf, exag=1.6, d=1):
    rgb = pal[srf].copy()
    shade = LightSource(azdeg=255, altdeg=35).hillshade(hgt, vert_exag=exag, dx=d, dy=d)
    return np.clip(rgb * np.clip(0.74 + 0.32 * shade, 0, 1.1)[..., None], 0, 1)
def flag(ax, p, col='#c0392b', k=9):
    ax.plot(*p, marker='o', ms=2, color=INK, zorder=17); ax.plot([p[0], p[0]], [p[1], p[1] - k], color=INK, lw=0.7, zorder=17)
    ax.add_patch(Polygon([[p[0], p[1] - k], [p[0] + k * 0.66, p[1] - k * 0.83], [p[0], p[1] - k * 0.66]], fc=col, ec='none', zorder=17))
def along(L, s):
    for a, b in zip(L[:-1], L[1:]):
        l = hypot(b[0] - a[0], b[1] - a[1])
        if s <= l or (a, b) == (L[-2], L[-1]): u = ((b[0] - a[0]) / l, (b[1] - a[1]) / l); return (a[0] + u[0] * s, a[1] + u[1] * s), u
        s -= l

for h in S['meta']:
    tag, W, H = h['tag'], h['W'], h['H']
    raw = open(f'{G}/h{tag}.bin', 'rb').read()
    hgt = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).copy(); srf = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W)
    x0, z0 = h['x0'], h['z0']; ext = [x0, x0 + W, z0 + H, z0]
    L = np.array(h['line']); T = np.array(list(h['tees'].values()) + ([h['tips']['tee']] if h['tips'] else []))
    allp = np.vstack([L, T])
    cx0, cx1 = allp[:, 0].min() - 70, allp[:, 0].max() + 70; cz0, cz1 = allp[:, 1].min() - 55, allp[:, 1].max() + 45
    w, hh = cx1 - cx0, cz1 - cz0; asp = 6.3 / 5.2
    if hh / w < asp: d = (w * asp - hh) / 2; cz0 -= d; cz1 += d
    else: d = (hh / asp - w) / 2; cx0 -= d; cx1 += d
    fig = plt.figure(figsize=(5.2, 6.3), dpi=230); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0.005, 0.005, 0.99, 0.99]); ax.imshow(shaded(hgt, srf), extent=ext, interpolation='bilinear', zorder=1)
    xs = x0 + np.arange(W) + 0.5; zs = z0 + np.arange(H) + 0.5
    lo, hi = np.floor(np.nanmin(hgt)), np.ceil(np.nanmax(hgt))
    ax.contour(xs, zs, hgt, levels=np.arange(lo, hi + 1, 1), colors='#506070', linewidths=0.12, alpha=0.35, zorder=2)
    cs = ax.contour(xs, zs, hgt, levels=np.arange(lo - lo % 5, hi + 1, 5), colors='#405060', linewidths=0.4, alpha=0.6, zorder=2)
    ax.clabel(cs, fontsize=4.3, fmt='%d', inline=True)
    for nm, col, lw in (('water', '#3b6e96', 0.6), ('penalty', '#b5341f', 0.7), ('sand', '#7a5a2a', 0.6), ('fairway', '#4f7a3a', 0.3), ('green', '#2f5a22', 0.5)):
        ax.contour(xs, zs, (srf == SURF.index(nm)).astype(float), levels=[0.5], colors=col, linewidths=lw, zorder=3)
    # the walls, by height; the ones near the play labelled
    Ln = h['line']
    def near_line(p, m=55):
        best = 1e9
        for a, b in zip(Ln[:-1], Ln[1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]; t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz))); best = min(best, hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t))
        return best < m
    labelled = []
    for o in sorted(h['walls'], key=lambda o: o['y1']):
        if o['ground'] or o['kind'] == 'lintel': continue
        hm = o['y1'] - o['floor']; P = np.array(o['pts'])
        ax.add_patch(Polygon(P, fc=wallcol(hm, o['kind']), ec=INK if o['kind'] != 'parapet' else '#777', lw=0.25, zorder=9, alpha=0.95 if o['kind'] != 'parapet' else 0.8))
        c = P.mean(0)
        if o['kind'] not in ('parapet', 'door') and near_line(c) and all(hypot(c[0] - q[0], c[1] - q[1]) > 34 for q in labelled) and cx0 < c[0] < cx1 and cz0 < c[1] < cz1:
            labelled.append(c); ax.text(c[0], c[1], f"{hm:.0f}", fontsize=4.6, ha='center', va='center', color='white' if hm > 30 else INK, zorder=10, weight='bold')
    for o in h['walls']:   # lintels (over a gate or door) as a hatched outline
        if o['kind'] == 'lintel': ax.add_patch(Polygon(np.array(o['pts']), fill=False, hatch='xxxx', ec='#555', lw=0.3, zorder=10))
    for t in h['plants']: ax.add_patch(Circle(t['at'], t['r'], fc='#3f6a3a', ec='#24401f', lw=0.4, alpha=0.6, zorder=8))
    ax.plot(L[:, 0], L[:, 1], ls=(0, (5, 3)), color='#c99a00', lw=1.1, zorder=14)
    if h['boldAt'] and not any(t['bold'] and t['name'] == 'Down the steps' for t in h['targets']):
        b = h['tees']['tower']; ax.plot([b[0], h['boldAt'][0]], [b[1], h['boldAt'][1]], ls=(0, (1.5, 2)), color='#b5341f', lw=1.2, zorder=14)
    tot = h['len']
    for yd in range(50 if h['par'] == 3 else 100, int(tot / YD), 50):
        (p, u) = along(Ln, tot - yd * YD); nrm = np.array([-u[1], u[0]]) * 6
        ax.plot([p[0] - nrm[0], p[0] + nrm[0]], [p[1] - nrm[1], p[1] + nrm[1]], color=INK, lw=0.8, zorder=15)
        ax.text(p[0] + nrm[0] * 1.7, p[1] + nrm[1] * 1.7, str(yd), fontsize=5.3, ha='center', va='center', zorder=15, color=INK, bbox=dict(boxstyle='round,pad=0.1', fc='white', ec='none', alpha=0.7))
    # drives from each tee (where they come down and stop)
    for k, d in h['drives'].items():
        tr = np.array(d['track']); ax.plot(tr[:, 0], tr[:, 1], color=TEEC[k], lw=0.6, alpha=0.9, zorder=12)
        ax.plot(*d['end'], marker='v', ms=3.2, mfc=TEEC[k], mec=INK, mew=0.4, zorder=13)
    for s in h['scatter']: ax.plot(*s['end'], 'o', ms=1.4, color='#8a1f1f' if s['rest'] in ('water', 'penalty') else '#36506a', alpha=0.7, zorder=11)
    if h['boldScatter']:
        for s in h['boldScatter']: ax.plot(*s['end'], 'x', ms=2, mew=0.5, color='#b5341f', alpha=0.8, zorder=11)
    for k, t in h['tee3'].items():
        for m in t['miss']: ax.plot(*m['end'], 'o', ms=1.4, color='#36506a', alpha=0.7, zorder=11)
    for k, p in h['tees'].items(): ax.plot(p[0], p[1], 'o', ms=4.4, mfc=TEEC[k], mec=INK, mew=0.6, zorder=16)
    if h['tips']: tp = h['tips']['tee']; ax.plot(*tp, 'o', ms=6.5, mfc='none', mec=INK, mew=0.8, zorder=16); ax.annotate(f"tips {h['tips']['yards']}", tp, xytext=(6, -3), textcoords='offset points', fontsize=5, color='#555', zorder=18)
    flag(ax, h['pin'])
    for t in h['targets']:
        ax.plot(*t['p'], marker='o', ms=4, mfc='#e85d3f' if t['bold'] else '#26a6b8', mec=INK, mew=0.5, zorder=16)
        ax.annotate(f"{t['name']} · {t['d']}", t['p'], xytext=(6, 3), textcoords='offset points', fontsize=5.3, zorder=18, bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
    sx, sz = cx0 + 12, cz1 - 12
    ax.plot([sx, sx + 100], [sz, sz], color=INK, lw=1.5, zorder=20); ax.text(sx + 50, sz - 6, '100 m', fontsize=5.5, ha='center', zorder=20, bbox=dict(boxstyle='round,pad=0.1', fc='white', ec='none', alpha=0.8))
    ax.annotate('N', xy=(cx1 - 16, cz0 + 12), xytext=(cx1 - 16, cz0 + 30), fontsize=6.5, ha='center', va='center', zorder=20,
                arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.8), bbox=dict(boxstyle='circle,pad=0.2', fc='white', ec=INK, lw=0.5))
    ax.set_xlim(cx0, cx1); ax.set_ylim(cz1, cz0); ax.set_aspect('equal'); ax.axis('off')
    fig.savefig(f'{OUT}/plan{tag}.png', facecolor='white'); plt.close(fig)

    # the profile along the line: the ground (coloured by surface), walls the line passes under or beside as bars,
    # the drives from the back tee
    P = h['prof']; s = np.array([p[0] for p in P]); y = np.array([p[1] for p in P]); wt = np.array([p[3] for p in P])
    fig = plt.figure(figsize=(6.4, 1.8), dpi=220); fig.patch.set_facecolor('white'); ax = fig.add_axes([0.075, 0.24, 0.915, 0.62])
    floor = np.nanmin(y) - 5
    ax.fill_between(s, floor, y, color='#e6ebe0', lw=0, zorder=1)
    for k in range(len(P) - 1): ax.plot(s[k:k + 2], y[k:k + 2], color=[c * 0.8 for c in COL.get(P[k][2], (0.5, 0.5, 0.5))], lw=2.4, solid_capstyle='butt', zorder=3)
    ymax = np.nanmax(y) + 12
    for k in range(len(P)):
        if wt[k] > 0: ax.add_patch(plt.Rectangle((s[k] - 1, y[k]), 2, wt[k], fc=(0.55, 0.50, 0.44), ec='none', zorder=6)); ymax = max(ymax, y[k] + wt[k] + 4)
    sty = {'tower': '#6b4a2f', 'rampart': '#b08a3e', 'gate': '#3f6a5a', 'court': '#9a9384', 'tips': '#45474d'}
    import math
    def sOf(pt):
        best, bs, acc = 1e9, 0, 0
        for a, b in zip(Ln[:-1], Ln[1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]; l = hypot(dx, dz); t = max(0, min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dz) / (l * l))); dd = hypot(pt[0] - a[0] - dx * t, pt[1] - a[1] - dz * t)
            if dd < best: best, bs = dd, acc + t * l
            acc += l
        return bs
    for k, d in list(h['drives'].items())[:5]:
        tr = d['track']; ss = [sOf(p) for p in tr]; ax.plot(ss, [p[2] for p in tr], color=sty[k], lw=0.8, label=f"{k}: {d['club']} {d['carry']}/{d['total']} yd, {d['rest']}" + (f", off the {d['wall']}" if d['wall'] else ''), zorder=7)
        ymax = max(ymax, max(p[2] for p in tr) + 3)
    for k, t in h['tee3'].items():
        tr = t['track']; ss = [sOf(p) for p in tr]; ax.plot(ss, [p[2] for p in tr], color=sty[k], lw=0.8, label=f"{k}: {t['club']} ({t['plays']} yd), {t['rest']}", zorder=7); ymax = max(ymax, max(p[2] for p in tr) + 3)
    ax.set_xlim(s[0], s[-1]); ax.set_ylim(floor, ymax); ax.tick_params(labelsize=5.5); ax.set_ylabel('m', fontsize=6); ax.grid(alpha=0.2, lw=0.4)
    ax.set_title(f"along the line: tee {h['teeY']:.0f} m, green {h['pinY']:.0f} m ({h['pinY'] - h['teeY']:+.0f} m). Grey bars: walls the line runs under or through (to their tops)", fontsize=6.2, loc='left')
    ax.legend(fontsize=4.6, loc='upper right', frameon=False, ncol=1)
    ax.set_xlabel('metres from the back tee along the line', fontsize=6)
    fig.savefig(f'{OUT}/prof{tag}.png', facecolor='white'); plt.close(fig)

    # the green (its own frame: the approach from the bottom)
    J = json.load(open(f'{G}/green{tag}.json')); N = J['N']; st = J['step']; half = (N - 1) / 2 * st
    Hh = np.array(J['h'], float).reshape(N, N); GM = np.array(J['gm'], float).reshape(N, N); SF = np.array(J['s'], int).reshape(N, N)
    lim = half - 2; ext = [-half - st / 2, half + st / 2, -half - st / 2, half + st / 2]
    fig = plt.figure(figsize=(2.3, 2.3), dpi=220); ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(-lim, lim); ax.set_ylim(-lim, lim); ax.axis('off')
    img = pal[SF].copy(); img[SF == SURF.index('green')] = (0.66, 0.88, 0.56)
    ax.imshow(img, extent=ext, origin='upper', interpolation='nearest')
    ys_, xs_ = np.mgrid[half:-half - st / 2:-st, -half:half + st / 2:st]
    Hg = np.where(GM < 0.4, Hh, np.nan); glo, ghi = np.nanmin(Hg), np.nanmax(Hg)
    lv = np.arange(np.floor(glo / 0.05) * 0.05, ghi + 0.05, 0.05)
    ax.contour(xs_, ys_, Hg, levels=lv, colors='#3d5a2e', linewidths=0.3, alpha=0.8)
    lv2 = [v for v in lv if abs(round(v / 0.25) * 0.25 - v) < 1e-6]
    if lv2: ax.contour(xs_, ys_, Hg, levels=lv2, colors='#2a3f20', linewidths=0.7)
    ax.contour(xs_, ys_, GM, levels=[0], colors=INK, linewidths=0.9)
    gy, gx = np.gradient(Hh, st)
    for r in range(4, N - 4, 7):
        for c in range(4, N - 4, 7):
            if GM[r, c] > -1: continue
            dx, dy = -gx[r, c], gy[r, c]; sl = hypot(dx, dy) * 100
            if sl < 0.4: continue
            Lr = min(3.6, 1.3 + sl * 0.6); u, v = dx / hypot(dx, dy) * Lr, dy / hypot(dx, dy) * Lr
            ax.annotate('', xy=(xs_[r, c] + u / 2, ys_[r, c] + v / 2), xytext=(xs_[r, c] - u / 2, ys_[r, c] - v / 2), arrowprops=dict(arrowstyle='-|>', color='#c0392b' if sl > 3 else INK, lw=0.6, mutation_scale=5))
    for a, b in J['areas']: ax.add_patch(Circle((a, b), 3, fill=False, ls=(0, (2, 1.5)), lw=0.6, ec='#1f5fa8'))
    ax.plot([0, 0], [0, 2.6], color=INK, lw=0.7); ax.add_patch(Polygon([[0, 2.6], [1.6, 2.15], [0, 1.7]], color='#d23b2a')); ax.plot(0, 0, 'o', ms=1.6, color=INK)
    ax.plot([-lim + 2, -lim + 12], [-lim + 1.5, -lim + 1.5], color=INK, lw=1.2); ax.text(-lim + 7, -lim + 2.4, '10 m', fontsize=5.5, ha='center')
    ax.annotate('approach', xy=(lim - 5, -lim + 6), xytext=(lim - 5, -lim + 0.5), fontsize=5, ha='center', va='bottom', arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.6))
    fig.savefig(f'{OUT}/green{tag}.png', facecolor='white'); plt.close(fig)

# the course map: the maze from above, walls by height, the nine lines (and the other way on 3 and 7)
M = json.load(open(f'{G}/world.json'))
raw = open(f'{G}/world.bin', 'rb').read(); N = M['MW'] * M['MH']
m = np.frombuffer(raw[:N], dtype=np.uint8).reshape(M['MH'], M['MW']); mh = np.frombuffer(raw[N:], dtype=np.float32).reshape(M['MH'], M['MW']).copy()
img = shaded(mh, m, exag=1.4, d=M['WR'])
ext = [M['X0'], M['X0'] + M['MW'] * M['WR'], M['Z0'] + M['MH'] * M['WR'], M['Z0']]
fig = plt.figure(figsize=(7.0, 8.2), dpi=210); fig.patch.set_facecolor('white')
ax = fig.add_axes([0, 0, 1, 1]); ax.imshow(img, extent=ext, interpolation='bilinear')
for o in sorted(M['walls'], key=lambda o: o['h']):
    if o['kind'] == 'lintel': continue
    if o['only'] == 'A' or (o['kind'] == 'door' and o['only'] != 'B'): continue
    ax.add_patch(Polygon(np.array(o['pts']), fc=wallcol(o['h'], o['kind']) if not o['ground'] else (0.78, 0.83, 0.62), ec='none', lw=0, zorder=5))
t = M['tower']; c = t['at']; ax.add_patch(Polygon([[c[0] - t['half'], c[1] - t['half']], [c[0] + t['half'], c[1] - t['half']], [c[0] + t['half'], c[1] + t['half']], [c[0] - t['half'], c[1] + t['half']]], fc='#3a3530', ec=INK, lw=0.6, zorder=6))
ax.annotate('the tower, 120 m', c, xytext=(14, 18), textcoords='offset points', fontsize=6.5, zorder=12, bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
for hh in M['holes']:
    for a in hh['alt']: A = np.array(a['line']); ax.plot(A[:, 0], A[:, 1], ls=(0, (1.5, 2)), color='#8a6a00', lw=0.9, zorder=8); ax.plot(*a['pin'], marker='o', ms=2.5, color='#c0392b', zorder=9)
    L = np.array(hh['line']); ax.plot(L[:, 0], L[:, 1], ls=(0, (4, 2)), color='#8a6a00', lw=1.1, zorder=8)
    t = hh['tee']; ax.plot(*t, 'o', ms=10, mfc='white', mec=INK, mew=0.8, zorder=10); ax.text(*t, str(hh['n']), fontsize=7, ha='center', va='center', weight='bold', zorder=11)
    ax.plot(*hh['pin'], marker='o', ms=2.5, color='#c0392b', zorder=9)
x0, x1, z0, z1 = ext[0], ext[1], ext[3], ext[2]
ax.set_xlim(x0, x1); ax.set_ylim(z1, z0); ax.set_aspect('equal'); ax.axis('off')
ax.plot([x0 + 40, x0 + 240], [z1 - 30, z1 - 30], color=INK, lw=2); ax.text(x0 + 140, z1 - 48, '200 m', fontsize=7, ha='center', bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
ax.annotate('N', xy=(x1 - 40, z0 + 30), xytext=(x1 - 40, z0 + 90), fontsize=8, ha='center', arrowprops=dict(arrowstyle='-|>', color=INK))
fig.savefig(f'{OUT}/map.png', facecolor='white'); plt.close(fig)
print('plans, profiles, greens and map written')
