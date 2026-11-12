# python3 xsec.py now.json prop.json hole out.png "label|x,z|heading_deg|half|along" ...: cross sections (left of the
# hole to the right, or along it when along=1) through the ground now and proposed, coloured by surface. White page.
import json, sys, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
COL = {'street': '#c9c6bf', 'rough': '#a9c38c', 'fairway': '#5fa845', 'fringe': '#6dbb52', 'green': '#3f9a3a', 'tee': '#6fb257', 'sand': '#e8d59a',
       'water': '#7fb3dd', 'rubble': '#b9ab98', 'stands': '#c9c6bf', 'deck': '#b8b8b8', 'building': '#999', 'void': '#333'}
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
nowD, propD = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])); n = sys.argv[3]; out = sys.argv[4]; secs = sys.argv[5:]
def sample(H, x, z):
    i = (x - H['x0']) / H['C']; j = (z - H['z0']) / H['C']
    k, l = int(round(i)), int(round(j))
    if k < 0 or l < 0 or k >= H['nx'] or l >= H['nz']: return None, None
    y = H['Y'][l * H['nx'] + k]; s = H['SURF'][H['S'][l * H['nx'] + k]]
    return y, s
fig, axs = plt.subplots(len(secs), 1, figsize=(7.6, 1.55 * len(secs) + 0.2), dpi=200, squeeze=False)
for ax, sec in zip(axs[:, 0], secs):
    lab, c, hd, half, *al = sec.split('|'); cx, cz = map(float, c.split(',')); a = np.radians(float(hd)); half = float(half); along = al and al[0] == '1'
    fx, fz = np.sin(a), -np.cos(a); rx, rz = np.cos(a), np.sin(a)
    t = np.arange(-half, half + 0.1, 1.0)
    for H, ls, name, lw in ((nowD[n], (0, (3, 2)), 'now', 0.9), (propD[n], '-', 'proposed', 1.4)):
        ys, ss = [], []
        for v in t:
            x, z = (cx + fx * v, cz + fz * v) if along else (cx + rx * v, cz + rz * v)
            y, s = sample(H, x, z); ys.append(np.nan if y is None else y); ss.append(s)
        ys = np.array(ys, float)
        ax.plot(t, ys, color='#333' if name == 'now' else '#111', lw=lw, ls=ls, label=name, zorder=3)
        if name == 'proposed':
            for k in range(len(t) - 1):
                if ss[k] and not np.isnan(ys[k]): ax.fill_between(t[k:k + 2], ys[k:k + 2], np.nanmin(ys) - 3, color=COL.get(ss[k], '#ddd'), lw=0, zorder=1)
        else:
            # the surface now as a strip along the bottom
            lo = None
    ax.set_title(lab, fontsize=8, loc='left'); ax.grid(alpha=0.25, lw=0.4)
    ax.set_xlabel(('metres along the line from the section point' if along else 'metres left (−) and right (+) of the line'), fontsize=6.5); ax.set_ylabel('m', fontsize=6.5)
    ax.legend(fontsize=6, loc='upper right', frameon=False)
    ax.set_xlim(-half, half)
fig.tight_layout(); fig.savefig(out, facecolor='white'); print('wrote', out)
