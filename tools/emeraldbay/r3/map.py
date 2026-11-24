import json, numpy as np
from PIL import Image, ImageDraw, ImageFont
m = json.load(open('../out/r3/map.json')); nx, nz, C = int(m['nx']), int(m['nz']), m['C']
a = np.fromfile('../out/r3/map.bin', dtype=np.float32).reshape(nz, nx, 2); y, t = a[..., 0], a[..., 1].astype(int)
gz, gx = np.gradient(y, C); slope = np.hypot(gx, gz)
sh = np.clip(0.8 + (-gx * 0.5 + gz * 0.5) / np.sqrt(1 + gx**2 + gz**2) * 0.6, 0.35, 1.25)
col = np.zeros((nz, nx, 3)); col[:] = [70, 120, 60]
col[slope > 2.0] = [200, 190, 172]
col[t == 1] = [214, 200, 160]; col[t == 2] = [244, 236, 214]; col[t == 4] = [150, 182, 100]
deep = np.clip(-y / 18, 0, 1)[..., None]
water = (1 - deep) * np.array([110, 214, 206]) + deep * np.array([40, 92, 160])
col = np.where((t == 0)[..., None], water, col * sh[..., None])
img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).resize((nx, nz))
d = ImageDraw.Draw(img)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
px = lambda X, Z: ((X - m['X0']) / C, (Z - m['Z0']) / C)
for h in m['holes']:
    pts = [px(*p) for p in h['P']]
    d.line(pts, fill=(255, 255, 255), width=5); d.line(pts, fill=(200, 30, 30), width=2)
    d.ellipse([pts[-1][0] - 5, pts[-1][1] - 5, pts[-1][0] + 5, pts[-1][1] + 5], fill=(250, 230, 40), outline=(0, 0, 0))
    x, yy = pts[0]; d.rectangle([x - 11, yy - 10, x + 11, yy + 10], fill=(255, 255, 255), outline=(0, 0, 0)); d.text((x - 5, yy - 9), str(h['n']), fill=(0, 0, 0), font=F)
img.save('../out/r3/map.png'); print(img.size)
