# Quick mockups of proposed hole changes: the real ground sampled from the game (sample.mjs),
# edited roughly in numpy, drawn now beside proposed at the same scale, with profiles and cross-sections.
import json, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from scipy import ndimage

plt.rcParams['font.family'] = 'Inter'
import os
GRID = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'mockgrid')
COL = {'void': (0.93, 0.95, 0.98), 'tee': (0.55, 0.78, 0.42), 'fairway': (0.42, 0.67, 0.28), 'fringe': (0.50, 0.75, 0.34),
       'firstcut': (0.36, 0.55, 0.24), 'rough': (0.33, 0.46, 0.22), 'desert': (0.78, 0.60, 0.43), 'sand': (0.93, 0.85, 0.62),
       'waste': (0.82, 0.71, 0.52), 'water': (0.30, 0.52, 0.75), 'green': (0.55, 0.84, 0.40), 'rock': (0.62, 0.36, 0.26),
       'ice': (0.72, 0.84, 0.92), 'powder': (0.97, 0.97, 1.0)}
LAVA = (0.92, 0.38, 0.12)
NEW = '#d81b60'   # proposed marks

def smooth01(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

class Hole:
    def __init__(self, course, n):
        D = json.load(open(f'{GRID}/{course}.json')); self.SURF = D['SURF']; m = D['holes'][n - 1]
        self.course, self.m, self.n = course, m, n
        W, H = m['W'], m['H']; raw = open(f'{GRID}/{course}_h{n}.bin', 'rb').read()
        self.h = np.frombuffer(raw[:W * H * 4], dtype=np.float32).reshape(H, W).astype(float)
        self.s_ = np.frombuffer(raw[W * H * 4:], dtype=np.uint8).reshape(H, W).copy()
        self.W, self.H, self.x0, self.z0 = W, H, m['x0'], m['z0']
        self.X, self.Z = np.meshgrid(self.x0 + np.arange(W), self.z0 + np.arange(H))
        self.lava = course == 'emberfell'
        self.set_line([tuple(p) for p in m['line']])
        self.tee_marks = []   # proposed tees: (x, z, label)
        self.pin = tuple(m['pin']); self.greens_new = None
    def copy(self):
        o = object.__new__(Hole); o.__dict__.update(self.__dict__)
        o.h = self.h.copy(); o.s_ = self.s_.copy(); o.tee_marks = list(self.tee_marks); return o
    def set_line(self, line):
        self.line = line
        L = np.array(line, float); d0 = L[1] - L[0]; d0 /= np.hypot(*d0); d1 = L[-1] - L[-2]; d1 /= np.hypot(*d1)
        E = np.vstack([L[0] - d0 * 400, L, L[-1] + d1 * 200])
        best = np.full(self.X.shape, np.inf); S = np.zeros_like(best); O = np.zeros_like(best); acc = -400.0
        for a, b in zip(E[:-1], E[1:]):
            d = b - a; l = np.hypot(*d); u = d / l
            t = np.clip((self.X - a[0]) * u[0] + (self.Z - a[1]) * u[1], 0, l)
            px, pz = a[0] + u[0] * t, a[1] + u[1] * t
            dist = np.hypot(self.X - px, self.Z - pz)
            off = (self.X - a[0]) * (-u[1]) + (self.Z - a[1]) * u[0]
            m = dist < best; best[m] = dist[m]; S[m] = acc + t[m]; O[m] = off[m]; acc += l
        self.S, self.O, self.E = S, O, E
        self.len = sum(np.hypot(*(np.array(b) - np.array(a))) for a, b in zip(line[:-1], line[1:]))
    def at(self, s, off=0.0):
        """local (x, z) of a point s metres along the line (negative = behind the tee), off to the right"""
        E = self.E; acc = -400.0
        for a, b in zip(E[:-1], E[1:]):
            d = b - a; l = np.hypot(*d)
            if s <= acc + l or (b == E[-1]).all():
                u = d / l; t = s - acc; return (a[0] + u[0] * t - u[1] * off, a[1] + u[1] * t + u[0] * off)
            acc += l
    def surf(self, name): return self.SURF.index(name)
    def ground(self, x, z):
        c, r = x - self.x0, z - self.z0
        if not (0 <= c < self.W - 1 and 0 <= r < self.H - 1): return np.nan
        return ndimage.map_coordinates(self.h, [[r], [c]], order=1, cval=np.nan)[0]
    def surf_at(self, x, z):
        c, r = int(round(x - self.x0)), int(round(z - self.z0))
        if not (0 <= c < self.W and 0 <= r < self.H): return 'void'
        return self.SURF[self.s_[r, c]]
    def green_area(self): return int((self.s_ == self.surf('green')).sum())

    # ---- edits ----
    def profile_now(self, s0, s1, step=1.0, smooth=0):
        ss = np.arange(s0, s1 + step, step); hh = np.array([self.ground(*self.at(s)) for s in ss])
        if smooth: hh = ndimage.uniform_filter1d(np.where(np.isnan(hh), np.nanmean(hh), hh), int(smooth / step), mode='nearest')
        return ss, hh
    def reprofile(self, pts, half=45, edge=35, smooth=15):
        """make the ground along the line follow pts [(s, h)], keeping its shape across"""
        s0, s1 = pts[0][0], pts[-1][0]
        ss, old = self.profile_now(s0 - 30, s1 + 30, 1.0, smooth)
        new = np.interp(ss, [p[0] for p in pts], [p[1] for p in pts])
        delta = new - old; delta[ss < s0] = 0; delta[ss > s1] = 0
        delta = ndimage.uniform_filter1d(delta, 9, mode='nearest')
        D = np.interp(self.S, ss, delta, left=0, right=0)
        w = 1 - smooth01((np.abs(self.O) - half) / edge)
        self.h += D * w
    def raise_mask(self, mask, dh, edge=8, top=None):
        """lift the ground under mask by dh (or to a level top), falling back over edge metres outside"""
        dist = ndimage.distance_transform_edt(~mask)
        w = 1 - smooth01(dist / edge)
        if top is None: self.h += dh * w
        else:
            tgt = np.where(np.isnan(self.h), top, top)
            self.h = self.h + (tgt - self.h) * w * (self.h < tgt) if dh is None else self.h
    def level_to(self, mask, top, edge=8):
        dist = ndimage.distance_transform_edt(~mask); w = 1 - smooth01(dist / edge)
        self.h = np.where(np.isnan(self.h), self.h, self.h + (top - self.h) * w)
    def tilt(self, s0, s1, grade, half=40, edge=25, ramp=25):
        ws = smooth01((self.S - (s0 - ramp)) / ramp) * (1 - smooth01((self.S - s1) / ramp))
        off = np.clip(self.O, -half, half)
        w = 1 - smooth01((np.abs(self.O) - half) / edge)
        self.h += grade * off * ws * np.where(np.abs(self.O) > half, 1, 1) * np.maximum(w, 0.0) + 0 * w
    def paint(self, mask, name): self.s_[mask & ~np.isnan(self.h)] = self.surf(name)
    def carve(self, mask):
        self.h[mask] = np.nan; self.s_[mask] = 0
    def fill(self, mask, name='rough', iters=200):
        """fill open air under mask with ground smoothed in from round it"""
        h = self.h.copy(); known = ~np.isnan(h); h[~known] = np.nanmean(h)
        todo = mask & ~known
        for _ in range(iters):
            a = ndimage.uniform_filter(h, 5); h[todo] = a[todo]
        self.h[todo] = h[todo]; self.s_[mask] = self.surf(name)
    def rect(self, s0, s1, o0, o1): return (self.S >= s0) & (self.S <= s1) & (self.O >= o0) & (self.O <= o1)
    def ellipse(self, s, off, along, across, rot=0):
        cx, cz = self.at(s, off)
        # rot in degrees from the line's direction at s
        a = np.deg2rad(rot); dx, dz = self.X - cx, self.Z - cz
        ps, po = self.at(s + 1, off); u = np.array([ps - cx, po - cz]); u /= np.hypot(*u)
        r = np.array([-u[1], u[0]])
        ua = u * np.cos(a) + r * np.sin(a); ra = np.array([-ua[1], ua[0]])
        ls = dx * ua[0] + dz * ua[1]; lo = dx * ra[0] + dz * ra[1]
        return (ls / along) ** 2 + (lo / across) ** 2 <= 1
    def is_(self, *names): return np.isin(self.s_, [self.surf(n) for n in names])
    def scale_green(self, k, sel=None, collar=3, shift=(0, 0), tiers=None):
        g = self.is_('green')
        if sel is not None: g &= sel
        lab, n = ndimage.label(g)
        if n > 1:
            sizes = ndimage.sum(g, lab, range(1, n + 1)); g = lab == (1 + int(np.argmax(sizes)))
        cz, cx = ndimage.center_of_mass(g)
        rr, cc = np.mgrid[0:self.H, 0:self.W]
        src_r = cz + (rr - cz - shift[1]) / k; src_c = cx + (cc - cx - shift[0]) / k
        ng = ndimage.map_coordinates(g.astype(float), [src_r, src_c], order=1) > 0.5
        gone = g & ~ng
        self.s_[gone] = self.surf('fringe')
        near = ndimage.binary_dilation(ng, iterations=collar) & ~ng
        keep = self.is_('water', 'void', 'ice') | np.isnan(self.h)
        self.s_[near & ~keep] = self.surf('fringe')
        self.s_[ng & ~np.isnan(self.h)] = self.surf('green')
        # green surface: smooth the ground under it
        hs = ndimage.uniform_filter(np.where(np.isnan(self.h), np.nanmean(self.h), self.h), 9)
        self.h = np.where(ng & ~np.isnan(self.h), hs, self.h)
        return ng
    def tee(self, s, off=0, label='new tee', pad=(9, 7)):
        x, z = self.at(s, off); self.tee_marks.append((x, z, label))
        return x, z

def make_island(H, mask, top, name='rough', depth=None):
    """new ground (an island or a shelf) over mask, top level at top"""
    H.h[mask] = top; H.s_[mask] = H.surf(name)
def island_of(H, s, off=0):
    lab, n = ndimage.label(~np.isnan(H.h)); x, z = H.at(s, off)
    return lab == lab[int(round(z - H.z0)), int(round(x - H.x0))]
def add_target(H, s, off, label):
    x, z = H.at(s, off); H.tee_marks.append((x, z, label)); return x, z

from draw import *
def along(H, s): return H.ground(*H.at(s))
def smooth_fill(H, mask, k=9):
    H.h[mask] = ndimage.uniform_filter(np.nan_to_num(H.h, nan=np.nanmean(H.h)), k)[mask]
