# python3 tools/emeraldbay/plans.py (after sample.mjs): out/plan<id>.png, out/prof<id>.png, out/xsec<id>.png, out/green<n>.png
# and out/map-low.png / out/map-high.png. A page id is the hole's number, with L or H for the tide holes (3, 5, 9) at
# low and high tide. White pages, light colours, so they print. Water is drawn pale turquoise over sand, deeper blue
# where it is deep; the dashed blue line is the high-water mark. (After tools/cloudrest/plans.py.)
import json, os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from matplotlib.patches import Polygon, Circle
from math import hypot
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); G = os.path.join(OUT, 'grid')
D = json.load(open(f'{G}/holes.json')); SURF = D['SURF']; TEES = D['teeSets']; TIDES = D['tides']
YD = 0.9144
COL = {'rough': (0.76, 0.84, 0.60), 'jungle': (0.55, 0.68, 0.47), 'rock': (0.76, 0.74, 0.70), 'fairway': (0.56, 0.80, 0.44),
       'fringe': (0.52, 0.78, 0.40), 'green': (0.58, 0.87, 0.46), 'tee': (0.66, 0.84, 0.52), 'sand': (0.95, 0.86, 0.62), 'drysand': (0.99, 0.96, 0.86),
       'wetsand': (0.90, 0.86, 0.74), 'water': (0.62, 0.86, 0.86), 'void': (0.62, 0.86, 0.86)}
DEEP = np.array((0.36, 0.60, 0.76))
INK = '#2b2b2b'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
pal = np.array([COL[s] for s in SURF])
VOID = SURF.index('void')

def label(ax, p, text, **k):
    ax.annotate(text, p, fontsize=k.pop('fs', 6.2), ha='center', va='center', color=k.pop('color', INK), zorder=20,
                bbox=dict(boxstyle='round,pad=0.18', fc='white', ec='none', alpha=0.85), **k)
def box_pts(x, z, w, l, rot):
    # rot: compass bearing of its length in the frame (0 = -z); length along (sin, -cos)
    fx, fz = np.sin(rot), -np.cos(rot); rx, rz = -fz, fx; w, l = w / 2, l / 2
    return np.array([[x + u * rx + v * fx, z + u * rz + v * fz] for u, v in ((-w, -l), (w, -l), (w, l), (-w, l))])
def nanf(a): return np.array([np.nan if v is None else v for v in a], float)

WATER = SURF.index('water')
def shaded(hgt, srf, exag=1.6, d=1, sea=0.0):
    rgb = pal[srf].copy()
    land = np.where(srf == WATER, sea, hgt)
    shade = LightSource(azdeg=300, altdeg=38).hillshade(land, vert_exag=exag, dx=d, dy=d)
    k = np.clip(0.74 + 0.32 * shade, 0, 1.1)[..., None]
    out = np.clip(rgb * k, 0, 1)
    wm = srf == WATER
    t = np.clip((sea - hgt) / 6.0, 0, 1)[..., None]
    wcol = np.array(COL['water']) * (1 - t) + DEEP * t
    out[wm] = wcol[wm]
    return out

for h in D['pages']:
    n, pid, W, H, st = h['n'], h['id'], h['W'], h['H'], h['step']
    raw = open(f'{G}/h{pid}.bin', 'rb').read()
    hgt = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).copy()
    srf = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W)
    sea = h['sea']
    rgb = shaded(hgt, srf, d=st, sea=sea)
    x0, z0 = h['x0'], h['z0']; ext = [x0, x0 + W * st, z0 + H * st, z0]
    L = np.array(h['line'])
    cx0, cx1 = L[:, 0].min() - 95, L[:, 0].max() + 95; cz0, cz1 = L[:, 1].min() - 60, L[:, 1].max() + 40
    w, hh = cx1 - cx0, cz1 - cz0; asp = 7.3 / 5.2
    if hh / w < asp: d = (w * asp - hh) / 2; cz0 -= d; cz1 += d
    else: d = (hh / asp - w) / 2; cx0 -= d; cx1 += d
    fig = plt.figure(figsize=(5.2, 7.3), dpi=220); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0.005, 0.005, 0.99, 0.99]); ax.imshow(rgb, extent=ext, interpolation='bilinear', zorder=1)
    xs = x0 + (np.arange(W) + 0.5) * st; zs = z0 + (np.arange(H) + 0.5) * st
    rng = np.random.default_rng(n)
    for nm, mk, ms, col, p in (('jungle', '^', 1.0, '#3f6a34', 0.05), ('rock', 's', 0.7, '#6d6a64', 0.08), ('sand', 'o', 0.6, '#b89c62', 0.25)):
        rr, cc = np.nonzero(srf == SURF.index(nm))
        if len(rr): k = rng.random(len(rr)) < p; ax.plot(x0 + (cc[k] + 0.5) * st, z0 + (rr[k] + 0.5) * st, mk, ms=ms, mew=0, color=col, zorder=3)
    hm = np.where(srf == WATER, np.nan, hgt + h['base'])
    lo, hi = np.floor(np.nanmin(hm)), np.ceil(np.nanmax(hm))
    ax.contour(xs, zs, hm, levels=np.arange(lo - lo % 1, min(hi, 60) + 1, 1), colors='#506070', linewidths=0.12, alpha=0.3, zorder=2)
    cs = ax.contour(xs, zs, hm, levels=np.arange(lo - lo % 5, hi + 1, 5), colors='#405060', linewidths=0.45, alpha=0.65, zorder=2)
    ax.clabel(cs, fontsize=4.5, fmt='%d', inline=True)
    # the high-water mark (at low tide the sand below it is dry, firm wet sand)
    ax.contour(xs, zs, hgt + h['base'], levels=[TIDES['high']], colors='#2f7fa8', linewidths=0.55, linestyles=[(0, (3, 2))], zorder=3)
    for nm, col, lw in (('water', '#2a6f8f', 0.6), ('sand', '#7a5a2a', 0.6), ('fairway', '#4f7a3a', 0.3)):
        ax.contour(xs, zs, (srf == SURF.index(nm)).astype(float), levels=[0.5], colors=col, linewidths=lw, zorder=3)
    ax.plot(L[:, 0], L[:, 1], ls=(0, (5, 3)), color='#c99a00', lw=1.1, zorder=14)
    if h.get('bold'): B = np.array(h['bold']['line']); ax.plot(B[:, 0], B[:, 1], ls=(0, (1.5, 2)), color='#b5341f', lw=1.2, zorder=14)
    if h.get('route'): B = np.array(h['route']['line']); ax.plot(B[:, 0], B[:, 1], ls=(0, (4, 2)), color='#1f5fa8', lw=1.3, zorder=14)
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
    def flag(p, col='#c0392b'):
        ax.plot(*p, marker='o', ms=2, color=INK, zorder=17); ax.plot([p[0], p[0]], [p[1], p[1] - 9], color=INK, lw=0.7, zorder=17)
        ax.add_patch(Polygon([[p[0], p[1] - 9], [p[0] + 6, p[1] - 7.5], [p[0], p[1] - 6]], fc=col, ec='none', zorder=17))
    flag(h['pin'])
    for t in h['targets']:
        if t.get('name') and t['p'] == h['pin']: continue
        ax.plot(*t['p'], marker='o', ms=4, mfc='#e85d3f' if t['bold'] else '#26a6b8', mec=INK, mew=0.5, zorder=16)
        ax.annotate(f"{t['name']} · {t['d']}", t['p'], xytext=(6, 3), textcoords='offset points', fontsize=5.6, zorder=18,
                    bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
    for p in h['sections']:
        pass
    for p, t in h['labels']: label(ax, p, t, fs=5.8, color='#334')
    # where the cross sections cut
    for sec in h['sections']:
        a, b = sec['ends']; ax.plot([a[0], b[0]], [a[1], b[1]], color='#7b2d26', lw=0.6, ls=(0, (3, 1.5)), zorder=13)
        ax.text(b[0], b[1], sec['tag'], fontsize=5.5, color='#7b2d26', zorder=18, ha='center', va='center', bbox=dict(boxstyle='circle,pad=0.15', fc='white', ec='#7b2d26', lw=0.5))
    sx, sz = cx0 + 12, cz1 - 12
    ax.plot([sx, sx + 100], [sz, sz], color=INK, lw=1.5, zorder=20); ax.text(sx + 50, sz - 6, '100 m', fontsize=5.5, ha='center', zorder=20)
    th = np.radians(h['place']['heading']); nx, nz = -np.sin(th), -np.cos(th)
    ax.annotate('N', xy=(cx1 - 16 + nx * 10, cz1 - 22 + nz * 10), xytext=(cx1 - 16, cz1 - 22), fontsize=6.5, ha='center', va='center', zorder=20,
                arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.8), bbox=dict(boxstyle='circle,pad=0.2', fc='white', ec=INK, lw=0.5))
    ax.set_xlim(cx0, cx1); ax.set_ylim(cz1, cz0); ax.set_aspect('equal'); ax.axis('off')
    tt = ('Low tide' if h['tide'] == 'low' else 'High tide') if h['tideHole'] else 'Drawn at high tide'
    ax.text(cx0 + 10, cz0 + 14, tt, fontsize=7.5, weight='bold', color='#1f5fa8' if h['tide'] == 'high' else '#7a5a2a', zorder=21, bbox=dict(boxstyle='round,pad=0.25', fc='white', ec='none', alpha=0.9))
    fig.savefig(f'{OUT}/plan{pid}.png', facecolor='white'); plt.close(fig)

    # the profile along the line (and the bold line), with the drives from the back tee; heights absolute; open air
    # as a gap down to the mist
    profs = [('along the line', h['prof'], h['drives'])] + ([('the bold line', h['bold']['prof'], h['bold']['drives'])] if h.get('bold') else []) + ([('the high-tide route (along the spit)', h['route']['prof'], {})] if h.get('route') else [])
    fig = plt.figure(figsize=(6.4, 1.75 if len(profs) == 1 else 2.45), dpi=220); fig.patch.set_facecolor('white')
    b0 = h['base']; seaY = h['sea'] + b0
    for i, (title, P, dr) in enumerate(profs):
        top = 0.95 - i * (0.88 / len(profs)); hgt_ = 0.88 / len(profs) - (0.22 if len(profs) == 1 else 0.17)
        ax = fig.add_axes([0.075, top - hgt_ - 0.05, 0.915, hgt_])
        s = np.array([p[0] for p in P]); y = nanf([p[1] for p in P]) + b0
        floor = min(np.nanmin(y) - 3, -4)
        ax.axhspan(floor, seaY, color='#d8f0f0', lw=0, zorder=0)
        ax.axhline(TIDES['high'], color='#2f7fa8', lw=0.5, ls=(0, (3, 2)), zorder=2); ax.axhline(TIDES['low'], color='#2f7fa8', lw=0.4, ls=(0, (1, 2)), zorder=2)
        ax.text(s[-1] * 0.99, seaY + 0.3, f"the sea ({'low' if h['tide'] == 'low' else 'high'} tide)", fontsize=5, ha='right', va='bottom', color='#2f7fa8')
        ax.fill_between(s, floor, y, color='#e6ebe0', lw=0, zorder=1)
        for k in range(len(P) - 1):
            if np.isnan(y[k]) or np.isnan(y[k + 1]): continue
            ax.plot(s[k:k + 2], y[k:k + 2], color=[c * 0.8 for c in COL.get(P[k][2], (0.5, 0.5, 0.5))], lw=2.4, solid_capstyle='butt', zorder=3)
        ymax = max(min(np.nanmax(y), 70) + 8, max([h['teeY'] + b0 + d['apex'] + 4 for d in dr.values()] or [0]), h['teeY'] + b0 + 6)
        for p in P:
            if p[4] is not None: ax.add_patch(plt.Rectangle((p[0] - 1, p[4] + b0), 2, 6, fc=(0.45, 0.40, 0.36), ec='none', zorder=6)); ymax = max(ymax, min(p[4] + b0 + 8, 70))
        sty = {'tour': ('#b5341f', '-', 'tour drive'), 'mid': ('#4b6fa8', '-', '150 mph'), 'high': ('#b5341f', ':', 'high drive')}
        for k, d in dr.items():
            c, ls, lab = sty[k]; A = np.array(d['pts']); fl = A[A[:, 2] == 0]; rl = A[A[:, 2] == 1]
            ax.plot(fl[:, 0], fl[:, 1], color=c, ls=ls, lw=0.9, label=f"{lab}: {d['carry'] / YD:.0f} carry, {d['total'] / YD:.0f} total, {d['rest']}" + (', off rock' if d['rocks'] else ''), zorder=5)
            ax.plot([d['total']], [max(seaY, np.interp(d['total'], s, y))], marker='v', ms=3, color=c, zorder=7)
        ax.set_xlim(0, s[-1]); ax.set_ylim(floor, ymax); ax.tick_params(labelsize=5.5)
        ax.set_ylabel('m', fontsize=6); ax.grid(alpha=0.2, lw=0.4)
        ttl = f"{title}: tee {h['teeY'] + b0:.0f} m, green {h['pinY'] + b0:.0f} m ({h['pinY'] - h['teeY']:+.0f} m; climbs {h['rise']}, drops {h['fall']})" if i == 0 else title
        ax.set_title(ttl, fontsize=6.5, loc='left')
        if dr: ax.legend(fontsize=4.8, loc='upper right', frameon=False)
    fig.axes[-1].set_xlabel('metres from the back tee (▼ where it stops; rock overhead, the cave\'s roof or the overhang, as a brown bar)', fontsize=6)
    fig.savefig(f'{OUT}/prof{pid}.png', facecolor='white'); plt.close(fig)

    # cross sections, looking down the hole (left on the left)
    if h['sections']:
        k = len(h['sections'])
        fig = plt.figure(figsize=(6.4, 1.05 * k + 0.25), dpi=220); fig.patch.set_facecolor('white')
        for i, sec in enumerate(h['sections']):
            ax = fig.add_axes([0.075, 1 - (i + 1) / k + 0.12 / k + (0.07 if i == k - 1 else 0) * 0, 0.915, 0.72 / k])
            o = np.array([p[0] for p in sec['pts']]); y = nanf([p[1] for p in sec['pts']]) + b0
            ax.axhspan(min(seaY, np.nanmin(y)) - 4, seaY, color='#d8f0f0', lw=0)
            ax.fill_between(o, np.nanmin(y) - 6, y, color='#e6ebe0', lw=0)
            for j in range(len(o) - 1):
                if np.isnan(y[j]) or np.isnan(y[j + 1]): continue
                ax.plot(o[j:j + 2], y[j:j + 2], color=[c * 0.8 for c in COL.get(sec['pts'][j][2], (0.5, 0.5, 0.5))], lw=2.2, solid_capstyle='butt')
            ax.axvline(0, color='#c99a00', lw=0.6, ls=(0, (4, 2)))
            yl = np.nanmin(y) - 4, max(np.nanmax(y) + 4, np.nanmin(y) + 20)
            ax.set_ylim(min(yl[0], seaY - 4), min(yl[1], 60)); ax.set_xlim(o[0], o[-1]); ax.set_aspect('auto'); ax.tick_params(labelsize=5); ax.grid(alpha=0.2, lw=0.4)
            ax.set_title(f"{sec['tag']}  {sec['yd']} yd from the green, square to the line (looking down the hole: left on the left). Real scale across, heights ×1", fontsize=5.8, loc='left')
            ax.set_aspect(1, adjustable='datalim')
        fig.axes[-1].set_xlabel('metres from the line', fontsize=5.5)
        fig.savefig(f'{OUT}/xsec{pid}.png', facecolor='white'); plt.close(fig)

# the course map, at each tide
M = json.load(open(f'{G}/world.json'))
for tide in ('low', 'high'):
    raw = open(f'{G}/world-{tide}.bin', 'rb').read(); N = M['MW'] * M['MH']
    m = np.frombuffer(raw[:N], dtype=np.uint8).reshape(M['MH'], M['MW']); mh = np.frombuffer(raw[N:], dtype=np.float32).reshape(M['MH'], M['MW']).copy()
    img = shaded(mh, m, exag=1.0, d=M['WR'], sea=TIDES[tide])
    ext = [M['X0'], M['X0'] + M['MW'] * M['WR'], M['Z0'] + M['MH'] * M['WR'], M['Z0']]
    fig = plt.figure(figsize=(7.6, 6.6), dpi=200); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0, 0, 1, 1]); ax.imshow(img, extent=ext, interpolation='bilinear')
    xs = M['X0'] + (np.arange(M['MW']) + 0.5) * M['WR']; zs = M['Z0'] + (np.arange(M['MH']) + 0.5) * M['WR']
    land = np.where(m == WATER, np.nan, mh)
    cs = ax.contour(xs, zs, land, levels=[10, 20, 40, 80, 120, 160, 200], colors='#6a5a40', linewidths=0.25, alpha=0.45)
    ax.clabel(cs, fontsize=4.2, fmt='%d', inline=True)
    for o in M['boxes']: ax.add_patch(Polygon(box_pts(o['X'], o['Z'], o['w'], o['l'], o['rot']), fc='#7a5b3a', ec=INK, lw=0.3, zorder=7))
    for hh in M['holes']:
        L = np.array(hh['line']); ax.plot(L[:, 0], L[:, 1], ls=(0, (4, 2)), color='#8a6a00', lw=1.0)
        t = hh['tees'][M['back']]; ax.plot(*t, 'o', ms=10, mfc='white', mec=INK, mew=0.8); ax.text(*t, str(hh['n']), fontsize=7, ha='center', va='center', weight='bold')
        e = L[-1]; ax.plot(e[0], e[1], marker='o', ms=2.5, color='#c0392b')
    x0, x1, z0, z1 = ext[0], ext[1], ext[3], ext[2]
    ax.set_xlim(x0, x1); ax.set_ylim(z1, z0); ax.set_aspect('equal'); ax.axis('off')
    ax.plot([x0 + 30, x0 + 230], [z1 - 30, z1 - 30], color=INK, lw=2); ax.text(x0 + 130, z1 - 48, '200 m', fontsize=7, ha='center', bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
    ax.annotate('N', xy=(x1 - 40, z0 + 30), xytext=(x1 - 40, z0 + 90), fontsize=8, ha='center', arrowprops=dict(arrowstyle='-|>', color=INK))
    ax.text(x0 + 24, z0 + 40, 'Low tide' if tide == 'low' else 'High tide', fontsize=10, weight='bold', color='#1f5fa8', bbox=dict(boxstyle='round,pad=0.3', fc='white', ec='none', alpha=0.9))
    for p_, t_ in M['labels']: label(ax, p_, t_, fs=6.0)
    fig.savefig(f'{OUT}/map-{tide}.png', facecolor='white'); plt.close(fig)

# green diagrams (as tools/eldergrove)
for n in range(1, 10):
    gj = f'{G}/green{n}.json'
    if not os.path.exists(gj): continue
    J = json.load(open(gj)); N = J['N']; st = J['step']; half = (N - 1) / 2 * st
    Hh = nanf(J['h']).reshape(N, N)
    GM = np.array(J['gm'], float).reshape(N, N); SF = np.array(J['s'], int).reshape(N, N)
    ext = [-half - st / 2, half + st / 2, -half - st / 2, half + st / 2]
    lim = half - 2
    fig = plt.figure(figsize=(2.3, 2.3), dpi=220); ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(-lim, lim); ax.set_ylim(-lim, lim); ax.axis('off')
    img = pal[SF].copy(); img[SF == SURF.index('green')] = (0.66, 0.88, 0.56)
    ax.imshow(img, extent=ext, origin='upper', interpolation='nearest')
    ys, xs = np.mgrid[half:-half - st / 2:-st, -half:half + st / 2:st]
    on = GM < 0.4
    Hg = np.where(on, Hh, np.nan)
    lo, hi = np.nanmin(Hg), np.nanmax(Hg)
    lv = np.arange(np.floor(lo / 0.05) * 0.05, hi + 0.05, 0.05)
    ax.contour(xs, ys, Hg, levels=lv, colors='#3d5a2e', linewidths=0.3, alpha=0.8)
    lv2 = [v for v in lv if abs(round(v / 0.25) * 0.25 - v) < 1e-6]
    if lv2: ax.contour(xs, ys, Hg, levels=lv2, colors='#2a3f20', linewidths=0.7)
    ax.contour(xs, ys, GM, levels=[0], colors=INK, linewidths=0.9)
    gy, gx = np.gradient(np.nan_to_num(Hh, nan=0), st)
    for r in range(4, N - 4, 8):
        for c in range(4, N - 4, 8):
            if GM[r, c] > -1: continue
            dx, dy = -gx[r, c], gy[r, c]
            sl = hypot(dx, dy) * 100
            if sl < 0.4: continue
            Lr = min(3.6, 1.3 + sl * 0.6); u, v = dx / hypot(dx, dy) * Lr, dy / hypot(dx, dy) * Lr
            ax.annotate('', xy=(xs[r, c] + u / 2, ys[r, c] + v / 2), xytext=(xs[r, c] - u / 2, ys[r, c] - v / 2),
                        arrowprops=dict(arrowstyle='-|>', color='#c0392b' if sl > 3 else INK, lw=0.6, mutation_scale=5))
    for a, b in J['areas']: ax.add_patch(Circle((a, b), 3, fill=False, ls=(0, (2, 1.5)), lw=0.6, ec='#1f5fa8'))
    p = J.get('pin') or [0, 0]
    ax.plot([p[0], p[0]], [p[1], p[1] + 2.6], color=INK, lw=0.7); ax.add_patch(Polygon([[p[0], p[1] + 2.6], [p[0] + 1.6, p[1] + 2.15], [p[0], p[1] + 1.7]], color='#d23b2a')); ax.plot(*p, 'o', ms=1.6, color=INK)
    ax.plot([-lim + 2, -lim + 12], [-lim + 1.5, -lim + 1.5], color=INK, lw=1.2); ax.text(-lim + 7, -lim + 2.4, '10 m', fontsize=5.5, ha='center')
    ax.annotate('approach', xy=(lim - 5, -lim + 6), xytext=(lim - 5, -lim + 0.5), fontsize=5, ha='center', va='bottom', arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.6))
    fig.savefig(f'{OUT}/green{n}.png', facecolor='white'); plt.close(fig)
print('plans, profiles, sections, greens and map written')
