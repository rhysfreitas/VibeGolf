# python3 tools/wreckersreach/plans.py (after sample.mjs): out/plan<n>.png and out/prof<n>.png for each hole, the
# green diagrams and out/map.png for the whole course. White pages, light colours, so they print.
# (After tools/buriedkingdom/plans.py.)
import json, os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from matplotlib.patches import Polygon, Circle
from math import hypot
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); G = os.path.join(OUT, 'grid')
D = json.load(open(f'{G}/holes.json')); SURF = D['SURF']; TEES = D['teeSets']
YD = 0.9144
COL = {'dune': (0.95, 0.91, 0.80), 'fescue': (0.83, 0.82, 0.58), 'fairway': (0.60, 0.79, 0.46), 'fringe': (0.54, 0.77, 0.42),
       'green': (0.58, 0.85, 0.46), 'tee': (0.68, 0.83, 0.54), 'pot': (0.99, 0.95, 0.83), 'tussock': (0.66, 0.64, 0.36),
       'beach': (0.90, 0.85, 0.72), 'water': (0.62, 0.77, 0.86), 'wreck': (0.55, 0.45, 0.34), 'stone': (0.78, 0.74, 0.66), 'void': (0.10, 0.10, 0.12)}
INK = '#2b2b2b'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
pal = np.array([COL[s] for s in SURF])

def label(ax, p, text, **k):
    ax.annotate(text, p, fontsize=k.pop('fs', 6.2), ha='center', va='center', color=k.pop('color', INK), zorder=20,
                bbox=dict(boxstyle='round,pad=0.18', fc='white', ec='none', alpha=0.85), **k)

def box_pts(x, z, w, l, rot):
    c, s_ = np.cos(rot), np.sin(rot); w, l = w / 2, l / 2   # rot: yaw of its length (0 = down the hole, -z)
    return np.array([[x + u * c + v * s_, z + u * s_ - v * c] for u, v in ((-w, -l), (w, -l), (w, l), (-w, l))])
TIMBER = (0.56, 0.42, 0.30); STONE = (0.80, 0.76, 0.68)
FILL = {'hull': TIMBER, 'castle': (0.50, 0.37, 0.26), 'lugger': (0.62, 0.48, 0.34), 'rib': TIMBER, 'inn': (0.70, 0.56, 0.40), 'wall': STONE}
def draw_objs(ax, objs):
    for o in objs:
        k = o['kind']
        if k in FILL:
            a = 0.45 if o.get('sunk') else 1
            ax.add_patch(Polygon(box_pts(o['x'], o['z'], o['w'], o['l'], o['rot']), fc=FILL[k], ec=INK, lw=0.45, alpha=a, zorder=9))
        elif k in ('mast', 'lantern', 'bell'):
            ax.add_patch(Circle((o['x'], o['z']), max(1.2, o['r'] * 2.5), fc='#3a2a1a', ec='white', lw=0.4, zorder=10))
        elif k == 'beacon':
            ax.add_patch(Circle((o['x'], o['z']), o['r'], fc=STONE, ec=INK, lw=0.6, zorder=10))

for h in D['holes']:
    n, W, H = h['n'], h['W'], h['H']
    raw = open(f'{G}/h{n}.bin', 'rb').read()
    hgt = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).copy()
    srf = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W)
    rgb = pal[srf].copy()
    shade = LightSource(azdeg=315, altdeg=40).hillshade(hgt, vert_exag=1.8, dx=1, dy=1)
    rgb = np.clip(rgb * (0.76 + 0.30 * shade[..., None]), 0, 1)
    x0, z0 = h['x0'], h['z0']; ext = [x0, x0 + W, z0 + H, z0]
    L = np.array(h['line'])
    cx0, cx1 = L[:, 0].min() - 95, L[:, 0].max() + 95; cz0, cz1 = L[:, 1].min() - 60, L[:, 1].max() + 40
    w, hh = cx1 - cx0, cz1 - cz0; asp = 7.3 / 5.2
    if hh / w < asp: d = (w * asp - hh) / 2; cz0 -= d; cz1 += d
    else: d = (hh / asp - w) / 2; cx0 -= d; cx1 += d
    fig = plt.figure(figsize=(5.2, 7.3), dpi=220); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0.005, 0.005, 0.99, 0.99]); ax.imshow(rgb, extent=ext, interpolation='bilinear', zorder=1)
    # the tussocks: dark gold dots; grains in the pots
    rng = np.random.default_rng(n)
    rr, cc = np.nonzero(srf == SURF.index('tussock'))
    if len(rr): ax.plot(x0 + cc + 0.5, z0 + rr + 0.5, 's', ms=0.9, mew=0, color='#7a6f2c', zorder=3)
    rr, cc = np.nonzero(srf == SURF.index('pot'))
    if len(rr):
        k = rng.random(len(rr)) < 0.2
        ax.plot(x0 + cc[k] + 0.5, z0 + rr[k] + 0.5, 'o', ms=0.6, mew=0, color='#b89c62', zorder=3)
    xs = x0 + np.arange(W) + 0.5; zs = z0 + np.arange(H) + 0.5
    hm = hgt + h['base']
    lo, hi = np.floor(np.nanmin(hm)), np.ceil(np.nanmax(hm))
    ax.contour(xs, zs, hm, levels=np.arange(lo - lo % 1, hi + 1, 1), colors='#506070', linewidths=0.12, alpha=0.35, zorder=2)
    cs = ax.contour(xs, zs, hm, levels=np.arange(lo - lo % 5, hi + 1, 5), colors='#405060', linewidths=0.45, alpha=0.7, zorder=2)
    ax.clabel(cs, fontsize=4.5, fmt='%d', inline=True)
    ax.contour(xs, zs, (srf == SURF.index('water')).astype(float), levels=[0.5], colors='#3b6e96', linewidths=0.55, zorder=3)
    ax.contour(xs, zs, (srf == SURF.index('pot')).astype(float), levels=[0.5], colors='#7a5a2a', linewidths=0.6, zorder=3)
    ax.contour(xs, zs, (srf == SURF.index('fairway')).astype(float), levels=[0.5], colors='#4f7a3a', linewidths=0.3, zorder=3)
    draw_objs(ax, h['objs'])
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
    def flag(p, col='#c0392b'):
        ax.plot(*p, marker='o', ms=2, color=INK, zorder=17); ax.plot([p[0], p[0]], [p[1], p[1] - 9], color=INK, lw=0.7, zorder=17)
        ax.add_patch(Polygon([[p[0], p[1] - 9], [p[0] + 6, p[1] - 7.5], [p[0], p[1] - 6]], fc=col, ec='none', zorder=17))
    flag(h['pin'])
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
    # the signature wind: from the south-west
    wa = np.radians(225 - h['place']['heading']); wx, wz = np.sin(wa + np.pi), -np.cos(wa + np.pi)   # blowing toward
    bx, bz = cx0 + 24, cz0 + 24
    ax.annotate('', xy=(bx + wx * 14, bz + wz * 14), xytext=(bx - wx * 14, bz - wz * 14), arrowprops=dict(arrowstyle='-|>', color='#2f6f9f', lw=1.4), zorder=20)
    ax.text(bx, bz + 22, 'wind', fontsize=5.5, ha='center', color='#2f6f9f', zorder=20)
    ax.set_xlim(cx0, cx1); ax.set_ylim(cz1, cz0); ax.set_aspect('equal'); ax.axis('off')
    fig.savefig(f'{OUT}/plan{n}.png', facecolor='white'); plt.close(fig)

    # the profile along the line (and the bold line), with the drives from the back tee; heights absolute
    profs = [('along the line', h['prof'], h['drives'])] + ([('the bold line', h['bold']['prof'], h['bold']['drives'])] if h.get('bold') else [])
    fig = plt.figure(figsize=(6.4, 1.75 if len(profs) == 1 else 2.45), dpi=220); fig.patch.set_facecolor('white')
    for i, (title, P, dr) in enumerate(profs):
        top = 0.95 - i * (0.88 / len(profs)); hgt_ = 0.88 / len(profs) - (0.22 if len(profs) == 1 else 0.17)
        ax = fig.add_axes([0.075, top - hgt_ - 0.05, 0.915, hgt_])
        b0 = h['base']
        s = np.array([p[0] for p in P]); y = np.array([p[1] + b0 for p in P])
        floor = min(np.nanmin(y) - 4, -1)
        ax.fill_between(s, floor, y, color='#e6ebf1', lw=0)
        ax.axhline(0, color='#3b6e96', lw=0.4, ls=':')
        for k in range(len(P) - 1):
            ax.plot(s[k:k + 2], y[k:k + 2], color=[c * 0.8 for c in COL.get(P[k][2], (0.5, 0.5, 0.5))], lw=2.4, solid_capstyle='butt')
        ymax = max(np.nanmax(y) + 8, max([h['teeY'] + b0 + d['apex'] + 4 for d in dr.values()] or [0]))
        for p in P:
            for a, b, what in p[3]:
                ax.add_patch(plt.Rectangle((p[0] - 2, a + b0), 4, min(b + b0, ymax + 50) - a - b0, fc=(0.48, 0.38, 0.28), ec='none', zorder=6))
        sty = {'tour': ('#b5341f', '-', 'tour drive'), 'mid': ('#4b6fa8', '-', '150 mph'), 'high': ('#b5341f', ':', 'high drive'), 'windy': ('#2f6f9f', '--', '150 mph, the Sea wind')}
        for k, d in dr.items():
            c, ls, lab = sty[k]; A = np.array(d['pts']); fl = A[A[:, 2] == 0]; rl = A[A[:, 2] == 1]
            ax.plot(fl[:, 0], fl[:, 1] + b0, color=c, ls=ls, lw=0.9, label=f"{lab}: {d['carry'] / YD:.0f} carry, {d['total'] / YD:.0f} total" + (f", hits {d['hit']['what']}" if d['hit'] else ''), zorder=5)
            ax.plot([d['total']], [np.interp(d['total'], s, y)], marker='v', ms=3, color=c, zorder=7)
        ax.set_xlim(0, s[-1]); ax.set_ylim(floor, ymax); ax.tick_params(labelsize=5.5)
        ax.set_ylabel('m', fontsize=6); ax.grid(alpha=0.2, lw=0.4)
        ttl = f"{title}: tee {h['teeY'] + b0:.0f} m, green {h['pinY'] + b0:.0f} m ({h['pinY'] - h['teeY']:+.0f} m; climbs {h['rise']}, drops {h['fall']})" if i == 0 else title
        ax.set_title(ttl, fontsize=6.5, loc='left')
        if dr: ax.legend(fontsize=4.8, loc='upper right', frameon=False)
    fig.axes[-1].set_xlabel('metres from the back tee (▼ where it stops)', fontsize=6)
    fig.savefig(f'{OUT}/prof{n}.png', facecolor='white'); plt.close(fig)

# the course map
M = json.load(open(f'{G}/world.json'))
raw = open(f'{G}/world.bin', 'rb').read(); N = M['MW'] * M['MH']
m = np.frombuffer(raw[:N], dtype=np.uint8).reshape(M['MH'], M['MW']); mh = np.frombuffer(raw[N:], dtype=np.float32).reshape(M['MH'], M['MW'])
shade = LightSource(azdeg=315, altdeg=40).hillshade(mh, vert_exag=1.6, dx=M['WR'], dy=M['WR'])
img = np.clip(pal[m] * (0.72 + 0.34 * shade[..., None]), 0, 1)
ext = [M['X0'], M['X0'] + M['MW'] * M['WR'], M['Z0'] + M['MH'] * M['WR'], M['Z0']]
fig = plt.figure(figsize=(6.6, 10.2), dpi=200); fig.patch.set_facecolor('white')
ax = fig.add_axes([0, 0, 1, 1]); ax.imshow(img, extent=ext, interpolation='bilinear')
xs = M['X0'] + (np.arange(M['MW']) + 0.5) * M['WR']; zs = M['Z0'] + (np.arange(M['MH']) + 0.5) * M['WR']
cs = ax.contour(xs, zs, mh, levels=np.arange(5, 40, 5), colors='#6a5a40', linewidths=0.3, alpha=0.5)
ax.clabel(cs, fontsize=4.5, fmt='%d', inline=True)
ax.contour(xs, zs, (m == SURF.index('water')).astype(float), levels=[0.5], colors='#3b6e96', linewidths=0.5)
for o in M['props']:
    k = o['kind']
    if k in FILL and o.get('w'):
        ax.add_patch(Polygon(box_pts(o['at'][0], o['at'][1], o['w'], o['l'], o['rot']), fc=FILL[k], ec=INK, lw=0.3, zorder=6))
    elif k in ('mast', 'lantern', 'bell', 'beacon'):
        ax.add_patch(Circle(o['at'], 3 if k == 'beacon' else 1.8, fc='#3a2a1a', ec='white', lw=0.3, zorder=7))
for hh in M['holes']:
    L = np.array(hh['line']); ax.plot(L[:, 0], L[:, 1], ls=(0, (4, 2)), color='#8a6a00', lw=1.0)
    t = hh['tees'][M['back']]; ax.plot(*t, 'o', ms=10, mfc='white', mec=INK, mew=0.8); ax.text(*t, str(hh['n']), fontsize=7, ha='center', va='center', weight='bold')
    e = L[-1]; ax.plot(e[0], e[1], marker='o', ms=2.5, color='#c0392b')
    mid = L[len(L) // 2] if len(L) > 2 else (L[0] + L[-1]) / 2
    ax.annotate(hh['name'], mid, xytext=(10, -10) if hh['n'] not in (6, 7, 8) else (-12, 10), ha='left' if hh['n'] not in (6, 7, 8) else 'right', textcoords='offset points', fontsize=6.5, bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
x0, x1, z0, z1 = M['X0'], M['X0'] + M['MW'] * M['WR'], M['Z0'], M['Z0'] + M['MH'] * M['WR']
ax.set_xlim(x0, x1); ax.set_ylim(z1, z0); ax.set_aspect('equal'); ax.axis('off')
ax.plot([x0 + 30, x0 + 230], [z1 - 30, z1 - 30], color=INK, lw=2); ax.text(x0 + 130, z1 - 45, '200 m', fontsize=7, ha='center', bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
ax.annotate('N', xy=(x1 - 40, z0 + 30), xytext=(x1 - 40, z0 + 90), fontsize=8, ha='center', arrowprops=dict(arrowstyle='-|>', color=INK))
ax.annotate('', xy=(x1 - 60, z0 + 190), xytext=(x1 - 110, z0 + 240), arrowprops=dict(arrowstyle='-|>', color='#2f6f9f', lw=1.6))
ax.text(x1 - 85, z0 + 262, 'the Sea wind\n(from the SW)', fontsize=6, ha='center', color='#2f6f9f')
for p_, t_ in M['labels']: label(ax, p_, t_, fs=6.3)
fig.savefig(f'{OUT}/map.png', facecolor='white'); plt.close(fig)

# green diagrams: the approach comes up from the bottom; contours every 5 cm (bold every 25), arrows downhill
# (longer = steeper, red over 3%), the pin areas as dashed rings, the pin as a flag (the other hole's flag grey)
for n in range(1, 10):
    gj = f'{G}/green{n}.json'
    if not os.path.exists(gj): continue
    J = json.load(open(gj)); N = J['N']; st = J['step']; half = (N - 1) / 2 * st
    Hh = np.array(J['h'], float).reshape(N, N)
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
    gy, gx = np.gradient(Hh, st)
    stp = 8 if N < 150 else 14
    for r in range(4, N - 4, stp):
        for c in range(4, N - 4, stp):
            if GM[r, c] > -1: continue
            dx, dy = -gx[r, c], gy[r, c]
            sl = hypot(dx, dy) * 100
            if sl < 0.4: continue
            Lr = min(3.6, 1.3 + sl * 0.6) * (1 if N < 150 else 1.8); u, v = dx / hypot(dx, dy) * Lr, dy / hypot(dx, dy) * Lr
            ax.annotate('', xy=(xs[r, c] + u / 2, ys[r, c] + v / 2), xytext=(xs[r, c] - u / 2, ys[r, c] - v / 2),
                        arrowprops=dict(arrowstyle='-|>', color='#c0392b' if sl > 3 else INK, lw=0.6, mutation_scale=5))
    for a, b in J['areas']: ax.add_patch(Circle((a, b), 3, fill=False, ls=(0, (2, 1.5)), lw=0.6, ec='#1f5fa8'))
    sc = 1 if N < 150 else 2.4
    def gflag(p, col):
        ax.plot([p[0], p[0]], [p[1], p[1] + 2.6 * sc], color=INK, lw=0.7); ax.add_patch(Polygon([[p[0], p[1] + 2.6 * sc], [p[0] + 1.6 * sc, p[1] + 2.15 * sc], [p[0], p[1] + 1.7 * sc]], color=col)); ax.plot(*p, 'o', ms=1.6, color=INK)
    gflag(J.get('pin') or [0, 0], '#d23b2a')
    if J.get('other'): gflag(J['other'], '#888888')
    bar = 10 if N < 150 else 20
    ax.plot([-lim + 2, -lim + 2 + bar], [-lim + 1.5, -lim + 1.5], color=INK, lw=1.2); ax.text(-lim + 2 + bar / 2, -lim + 1.5 + 0.9 * sc, f'{bar} m', fontsize=5.5, ha='center')
    ax.annotate('approach', xy=(lim - 5 * sc, -lim + 6 * sc), xytext=(lim - 5 * sc, -lim + 0.5), fontsize=5, ha='center', va='bottom', arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.6))
    fig.savefig(f'{OUT}/green{n}.png', facecolor='white'); plt.close(fig)
print('plans, profiles, greens and map written')
