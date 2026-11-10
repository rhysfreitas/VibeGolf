# python3 tools/reclaim/plans.py (after sample.mjs): out/plan<n>.png and out/prof<n>.png for each hole, and
# out/map.png for the whole course. White pages, light colours, so they print.
import json, os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from matplotlib.patches import Polygon, Circle
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); G = os.path.join(OUT, 'grid')
D = json.load(open(f'{G}/holes.json')); SURF = D['SURF']; TEES = D['teeSets']
YD = 0.9144
COL = {'street': (0.87, 0.86, 0.83), 'rough': (0.70, 0.79, 0.58), 'fairway': (0.60, 0.79, 0.46), 'fringe': (0.66, 0.84, 0.50),
       'green': (0.70, 0.89, 0.55), 'tee': (0.68, 0.85, 0.52), 'sand': (0.95, 0.90, 0.72), 'water': (0.72, 0.82, 0.89),
       'rubble': (0.78, 0.74, 0.68), 'stands': (0.80, 0.78, 0.74), 'deck': (0.74, 0.74, 0.74), 'building': (0.72, 0.71, 0.70), 'void': (0.25, 0.25, 0.26)}
INK = '#2b2b2b'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
pal = np.array([COL[s] for s in SURF])

def label(ax, p, text, **k):
    ax.annotate(text, p, fontsize=k.pop('fs', 6.2), ha='center', va='center', color=k.pop('color', INK), zorder=20,
                bbox=dict(boxstyle='round,pad=0.18', fc='white', ec='none', alpha=0.85), **k)

def draw_objs(ax, objs, plan=True):
    for o in objs:
        k = o['kind']
        if k == 'bldg':
            P = np.array(o['pts']); hatch = '////' if o.get('open') else None
            ax.add_patch(Polygon(P, closed=True, fc=(0.62, 0.61, 0.60) if not o.get('open') else (0.80, 0.78, 0.74), ec=INK, lw=0.5, hatch=hatch, zorder=8))
            c = P.mean(0); t = f"{o['h']:.0f} m"
            if o.get('label'): t = o['label']
            ax.text(c[0], c[1], t, fontsize=5.4 if not o.get('label') else 6, ha='center', va='center', color='white' if not o.get('open') and not o.get('label') else INK, zorder=9,
                    bbox=None if not o.get('label') else dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
        elif k == 'tree':
            ax.add_patch(Circle((o['x'], o['z']), o['r'], fc=(0.33, 0.50, 0.30), ec=(0.2, 0.32, 0.18), lw=0.3, alpha=0.9, zorder=7))
        elif k == 'box':
            ax.add_patch(Polygon(np.array(o['pts']), fc=(0.62, 0.40, 0.28) if o['color'] == 'rust' else (0.4, 0.45, 0.5), ec=INK, lw=0.3, zorder=7))
        elif k == 'el':
            P = np.array(o['pts']); ax.plot(P[:, 0], P[:, 1], color='#4a3f35', lw=4.0, solid_capstyle='butt', zorder=10)
            ax.plot(P[:, 0], P[:, 1], color='#b9a58f', lw=1.4, ls=(0, (2, 2)), zorder=11)
            if o.get('broken'): ax.plot(*P[-1], marker='x', ms=7, mew=1.6, color='#9a2a1a', zorder=12)
            label(ax, P[len(P) // 2], o.get('label', 'the El') + f" ({o['y']:.0f} m up)")
        elif k == 'slab':
            ax.add_patch(Polygon(np.array(o['pts']), fc='none', ec=INK, lw=0.7, ls='--', zorder=9))
            if o.get('label'): label(ax, np.array(o['pts']).mean(0), o['label'])
        elif k == 'span':
            a, b = np.array(o['a'][:2]), np.array(o['b'][:2]); d = b - a; n = np.array([-d[1], d[0]]) / np.linalg.norm(d) * o['w'] / 2
            Q = np.array([a + n, b + n, b - n, a - n])
            ax.add_patch(Polygon(Q, fc=(0.55, 0.55, 0.58, 0.35), ec=INK, lw=0.8, ls='--', zorder=11))
            label(ax, (a + b) / 2, f"{o['label']}\n{o['b'][2]:.0f}–{o['a'][2]:.0f} m up" if not o.get('deck') else o['label'])
        elif k == 'col':
            ax.add_patch(Circle((o['x'], o['z']), 1.6, fc=INK, zorder=9))
        elif k == 'pole':
            ax.plot(o['x'], o['z'], marker='s', ms=3, color=INK, zorder=9)
        elif k == 'crane':
            ax.plot(o['x'], o['z'], marker='P', ms=6, color='#7a5a2a', zorder=9)
        elif k == 'bridge':
            a, b = np.array(o['a']), np.array(o['b'])
            for p in (a, b): ax.plot(*p, marker='s', ms=6, color=INK, zorder=12)
            ax.plot([a[0], b[0]], [a[1], b[1]], color=INK, lw=0.6, ls=':', zorder=11)
            label(ax, a + (b - a) * 0.12, 'north tower (78 m)')
        elif k == 'marker':
            ax.plot(o['x'], o['z'], marker='*', ms=8, mfc='#ffd23f', mec=INK, mew=0.5, zorder=13)

for h in D['holes']:
    n, W, H = h['n'], h['W'], h['H']
    raw = open(f'{G}/h{n}.bin', 'rb').read()
    hgt = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).copy()
    srf = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W)
    void = np.isnan(hgt); hf = np.where(void, np.nanmin(hgt) - 8, hgt)
    rgb = pal[srf].copy()
    shade = LightSource(azdeg=315, altdeg=45).hillshade(hf, vert_exag=1.4, dx=1, dy=1)
    rgb = np.clip(rgb * (0.78 + 0.32 * shade[..., None]), 0, 1); rgb[void] = COL['void']
    x0, z0 = h['x0'], h['z0']; ext = [x0, x0 + W, z0 + H, z0]
    # crop to the play: the hole's line +- 110 m (portrait page)
    L = np.array(h['line'])
    cx0, cx1 = L[:, 0].min() - 105, L[:, 0].max() + 105; cz0, cz1 = L[:, 1].min() - 70, L[:, 1].max() + 45
    w, hh = cx1 - cx0, cz1 - cz0; asp = 7.3 / 5.2
    if hh / w < asp: d = (w * asp - hh) / 2; cz0 -= d; cz1 += d
    else: d = (hh / asp - w) / 2; cx0 -= d; cx1 += d
    fig = plt.figure(figsize=(5.2, 7.3), dpi=220); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0.005, 0.005, 0.99, 0.99]); ax.imshow(rgb, extent=ext, interpolation='bilinear', zorder=1)
    xs = x0 + np.arange(W) + 0.5; zs = z0 + np.arange(H) + 0.5
    lo, hi = np.floor(np.nanmin(hgt)), np.ceil(np.nanmax(hgt))
    hm = np.where(void, np.nan, hgt)
    ax.contour(xs, zs, hm, levels=np.arange(lo, hi + 1, 1), colors=INK, linewidths=0.15, alpha=0.35, zorder=2)
    cs = ax.contour(xs, zs, hm, levels=np.arange(lo - lo % 5, hi + 1, 5), colors=INK, linewidths=0.4, alpha=0.6, zorder=2)
    ax.clabel(cs, fontsize=4.5, fmt='%d', inline=True)
    draw_objs(ax, h['objs'])
    ax.plot(L[:, 0], L[:, 1], ls=(0, (5, 3)), color='#c99a00', lw=1.1, zorder=14)
    if h.get('bold'): B = np.array(h['bold']['line']); ax.plot(B[:, 0], B[:, 1], ls=(0, (1.5, 2)), color='#b5341f', lw=1.2, zorder=14)
    # yardage to the green along the line, every 50 yd
    from math import hypot
    segs = [(L[i], L[i + 1]) for i in range(len(L) - 1)]; tot = sum(hypot(*(b - a)) for a, b in segs)
    for yd in range(100, int(tot / YD), 50):
        s = tot - yd * YD; acc = 0
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
    for p, t in h['labels']: label(ax, p, t, fs=5.8, color='#444444' if t != 'THE RIFT' else 'white') if t != 'THE RIFT' else ax.text(p[0], p[1], t, color='white', fontsize=6.5, ha='center', va='center', rotation=0, zorder=20, weight='bold')
    # scale bar and north
    sx, sz = cx0 + 12, cz1 - 12
    ax.plot([sx, sx + 100], [sz, sz], color=INK, lw=1.5, zorder=20); ax.text(sx + 50, sz - 6, '100 m', fontsize=5.5, ha='center', zorder=20)
    th = np.radians(h['place']['heading']); nx, nz = -np.sin(th), -np.cos(th)   # north in the hole's frame
    ax.annotate('N', xy=(cx1 - 16 + nx * 10, cz1 - 22 + nz * 10), xytext=(cx1 - 16, cz1 - 22), fontsize=6.5, ha='center', va='center', zorder=20,
                arrowprops=dict(arrowstyle='-|>', color=INK, lw=0.8), bbox=dict(boxstyle='circle,pad=0.2', fc='white', ec=INK, lw=0.5))
    ax.set_xlim(cx0, cx1); ax.set_ylim(cz1, cz0); ax.set_aspect('equal'); ax.axis('off')
    fig.savefig(f'{OUT}/plan{n}.png', facecolor='white'); plt.close(fig)

    # the profile along the line (and the bold line), with the drives from the back tee
    profs = [('along the line', h['prof'], h['drives'])] + ([('the bold line', h['bold']['prof'], h['bold']['drives'])] if h.get('bold') else [])
    fig = plt.figure(figsize=(5.6, 2.3 if len(profs) == 1 else 3.6), dpi=220); fig.patch.set_facecolor('white')
    for i, (title, P, dr) in enumerate(profs):
        top = 0.97 - i * (0.92 / len(profs)); hgt_ = 0.92 / len(profs) - 0.17
        ax = fig.add_axes([0.08, top - hgt_ - 0.04, 0.9, hgt_])
        s = np.array([p[0] for p in P]); y = np.array([np.nan if p[1] is None else p[1] for p in P])
        floor = np.nanmin(y) - 6
        ax.fill_between(s, floor, np.where(np.isnan(y), floor, y), color='#e9e4da', lw=0)
        for k in range(len(P) - 1):
            if P[k][1] is not None and P[k + 1][1] is not None: ax.plot(s[k:k + 2], y[k:k + 2], color=[c * 0.85 for c in COL.get(P[k][2], (0.5, 0.5, 0.5))], lw=2.4, solid_capstyle='butt')
        ymax = max(np.nanmax(y) + 12, 20, max([h['teeY'] + d['apex'] + 6 for d in dr.values()] or [0]))
        for k, p in enumerate(P):
            for a, b, what in p[3]:
                ax.add_patch(plt.Rectangle((p[0] - 1, a), 2, min(b, ymax + 50) - a, fc=(0.55, 0.55, 0.56), ec='none', zorder=3))
                ymax = max(ymax, min(b + 6, 110))
        sty = {'tour': ('#b5341f', '-', 'tour drive'), 'mid': ('#4b6fa8', '-', '150 mph drive'), 'high': ('#b5341f', ':', 'high drive')}
        for k, d in dr.items():
            c, ls, lab = sty[k]; A = np.array(d['pts']); fl = A[A[:, 2] == 0]
            ax.plot(fl[:, 0], fl[:, 1], color=c, ls=ls, lw=0.9, label=f"{lab}: {d['carry'] / YD:.0f} yd carry" + (f", hits {d['hit']['what']}" if d['hit'] else ''), zorder=5)
        ax.set_xlim(0, s[-1]); ax.set_ylim(floor, ymax); ax.tick_params(labelsize=5.5)
        ax.set_ylabel('m', fontsize=6); ax.grid(alpha=0.2, lw=0.4)
        ttl = f"{title}: tee {h['teeY']:.0f} m, green {h['pinY']:.0f} m ({h['pinY'] - h['teeY']:+.0f} m)" if i == 0 else title
        ax.set_title(ttl, fontsize=6.5, loc='left')
        if dr: ax.legend(fontsize=5, loc='upper right', frameon=False)
    fig.axes[-1].set_xlabel('metres from the back tee', fontsize=6)
    fig.savefig(f'{OUT}/prof{n}.png', facecolor='white'); plt.close(fig)

# the course map
M = json.load(open(f'{G}/world.json'))
m = np.frombuffer(open(f'{G}/world.bin', 'rb').read(), dtype=np.uint8).reshape(M['MH'], M['MW'])
img = pal[m]
fig = plt.figure(figsize=(10.2, 7.0), dpi=200); fig.patch.set_facecolor('white')
ax = fig.add_axes([0, 0, 1, 1]); ax.imshow(img, extent=[M['X0'], M['X0'] + M['MW'] * M['WR'], M['Z0'] + M['MH'] * M['WR'], M['Z0']], interpolation='bilinear')
for b in M['city']:
    P = np.array(b['pts']); g = 0.80 - min(b['h'], 120) / 120 * 0.32
    ax.add_patch(Polygon(P, fc=(g, g, g * 1.01) if not b['heap'] else (0.80, 0.76, 0.70), ec=(0.5, 0.5, 0.5), lw=0.15))
for b in M['bldgs']:
    ax.add_patch(Polygon(np.array(b['pts']), fc=(0.45, 0.43, 0.42), ec=INK, lw=0.3))
for hh in M['holes']:
    L = np.array(hh['line']); ax.plot(L[:, 0], L[:, 1], ls=(0, (4, 2)), color='#c99a00', lw=1.0)
    t = hh['tees']['spire']; ax.plot(*t, 'o', ms=10, mfc='white', mec=INK, mew=0.8); ax.text(*t, str(hh['n']), fontsize=7, ha='center', va='center', weight='bold')
    e = L[-1]; ax.plot(e[0], e[1], marker='o', ms=2.5, color='#c0392b')
    mid = L[len(L) // 2] if len(L) > 2 else (L[0] + L[-1]) / 2
    ax.annotate(hh['name'], mid, xytext=(10, -10), textcoords='offset points', fontsize=7, bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.85))
L = np.array(M['holes'][0]['line'])
ax.set_xlim(-560, 1330); ax.set_ylim(360, -1010); ax.set_aspect('equal'); ax.axis('off')
ax.plot([-520, -320], [320, 320], color=INK, lw=2); ax.text(-420, 305, '200 m', fontsize=7, ha='center')
ax.annotate('N', xy=(1280, -980), xytext=(1280, -920), fontsize=8, ha='center', arrowprops=dict(arrowstyle='-|>', color=INK))
fig.savefig(f'{OUT}/map.png', facecolor='white'); plt.close(fig)
print('plans, profiles and map written')
