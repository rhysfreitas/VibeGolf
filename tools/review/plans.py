# python3 tools/review/plans.py <course> (after sample.mjs) -> tools/review/out/<course>_plan<n>.png: a plan (tee at the bottom) and the profile along the line for each hole
# steep steps (>= 3 m over 4 m) within 8 m of short grass are marked in red: the plateau check
import json, sys, os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
course = sys.argv[1] if len(sys.argv) > 1 else 'aerie'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
D = json.load(open(f'{OUT}/grid/{course}.json')); SURF = D['SURF']
COL = {'void': (0.93, 0.95, 0.98), 'tee': (0.55, 0.78, 0.42), 'fairway': (0.42, 0.67, 0.28), 'fringe': (0.50, 0.75, 0.34),
       'firstcut': (0.36, 0.55, 0.24), 'rough': (0.33, 0.46, 0.22), 'desert': (0.78, 0.60, 0.43), 'sand': (0.93, 0.85, 0.62),
       'waste': (0.82, 0.71, 0.52), 'water': (0.30, 0.52, 0.75), 'green': (0.55, 0.84, 0.40), 'rock': (0.62, 0.36, 0.26)}
if course == 'aerie': COL['rough'] = (0.38, 0.52, 0.27)
if course == 'hollowmere': COL['void'] = (0.2, 0.2, 0.22)
pal = np.array([COL[s] for s in SURF])
def shift(a, dy, dx, fill):
    o = np.full_like(a, fill); H, W = a.shape
    o[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = a[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]; return o
def dilate(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r: o |= shift(m, dy, dx, False)
    return o
summary = []
for h in D['holes']:
    W, H, n = h['W'], h['H'], h['n']
    raw = open(f'{OUT}/grid/{course}_h{n}.bin', 'rb').read()
    hgt = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).copy()
    srf = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W)
    void = np.isnan(hgt); hf = np.where(void, np.nanmin(hgt) - 5, hgt)
    # steps: height change of 3 m or more within 4 m, between two grounds
    step = np.zeros_like(void)
    for dy, dx in [(4, 0), (-4, 0), (0, 4), (0, -4), (3, 3), (-3, 3), (3, -3), (-3, -3)]:
        o = shift(hgt, dy, dx, np.nan); step |= (np.abs(o - hgt) >= 3) & ~np.isnan(o) & ~void
    short = np.isin(srf, [SURF.index(s) for s in ('fairway', 'fringe', 'green')])
    near = step & dilate(short, 8)
    rgb = pal[srf].copy()
    ls = LightSource(azdeg=315, altdeg=40)
    shade = ls.hillshade(hf, vert_exag=1.6, dx=1, dy=1)
    rgb = rgb * (0.55 + 0.6 * shade[..., None]); rgb = np.clip(rgb, 0, 1)
    rgb[void] = COL['void']
    rgb[near] = rgb[near] * 0.35 + np.array([0.9, 0.1, 0.1]) * 0.65
    summary.append((n, int(near.sum()), int(short.sum())))
    # the figure: plan above, profile below (z0 + r is local z; the hole runs toward -z, so flip so the tee is at the bottom)
    ext = [h['x0'], h['x0'] + W, h['z0'] + H, h['z0']]
    fig = plt.figure(figsize=(6.2, 9.0), dpi=150); fig.patch.set_facecolor('white')
    ax = fig.add_axes([0.06, 0.25, 0.9, 0.7]); ax.imshow(rgb, extent=ext, interpolation='bilinear')
    lv = np.arange(np.floor(np.nanmin(hgt)), np.nanmax(hgt) + 1, 2)
    xs = h['x0'] + np.arange(W); zs = h['z0'] + np.arange(H)
    if len(lv) > 1: ax.contour(xs, zs, np.where(void, np.nan, hgt), levels=lv, colors='k', linewidths=0.25, alpha=0.35)
    L = np.array(h['line']); ax.plot(L[:, 0], L[:, 1], '--', color='#ffd23f', lw=1.2)
    for t in h['trees']: ax.add_patch(plt.Circle((t[0], t[1]), max(2, t[2] * 0.8), color='#1e4d1e', alpha=0.8, lw=0))
    for s in h['teeSets']:
        p = h['tees'].get(s['id'])
        if p: ax.plot(p[0], p[1], 'o', ms=5, mfc=s['color'], mec='k', mew=0.6)
    ax.plot(*h['pin'], marker='^', ms=7, mfc='white', mec='k')
    for t in h['targets']:
        ax.plot(*t['p'], marker='o', ms=5, mfc='#26c6da', mec='k', mew=0.5)
        ax.annotate(t['name'], t['p'], xytext=(4, 3), textcoords='offset points', fontsize=6, color='k', bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.8))
    ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3]); ax.set_aspect('equal'); ax.tick_params(labelsize=6)
    ax.set_title(f"{n}. {h['name']}  par {h['par']}, {h['yards'][h['teeSets'][0]['id']]} yd   (red: steep step beside short grass)", fontsize=8)
    # profile
    px = fig.add_axes([0.1, 0.05, 0.86, 0.15]); P = h['prof']
    s = np.array([p[0] for p in P]); y = np.array([np.nan if p[1] is None else p[1] for p in P])
    px.fill_between(s, np.nanmin(y) - 6, y, color='#d9cbb5', lw=0)
    for k in range(len(P) - 1):
        c = COL.get(P[k][2], (0.5, 0.5, 0.5))
        if P[k][1] is not None and P[k + 1][1] is not None: px.plot(s[k:k + 2], y[k:k + 2], color=c, lw=2.2)
    px.axhline(h['teeY'], color='k', lw=0.4, ls=':'); px.set_xlim(0, s[-1]); px.tick_params(labelsize=6)
    px.set_ylabel('m', fontsize=6); px.set_xlabel('metres along the line', fontsize=6)
    px.set_title(f"tee {h['teeY']:.0f} m, green {h['pinY']:.0f} m ({h['pinY'] - h['teeY']:+.0f} m)", fontsize=7)
    fig.savefig(f'{OUT}/{course}_plan{n}.png', facecolor='white'); plt.close(fig)
print(course, 'steep-beside-short cells:', summary)
