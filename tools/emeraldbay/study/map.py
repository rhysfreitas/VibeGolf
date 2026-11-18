import json, numpy as np
from PIL import Image
m = json.load(open('../out/study/map.json')); nx, nz, C = m['nx'], m['nz'], m['C']
a = np.fromfile('../out/study/map.bin', dtype=np.float32).reshape(nz, nx, 2); y, t = a[..., 0], a[..., 1].astype(int)
gz, gx = np.gradient(y, C); slope = np.hypot(gx, gz)
sh = np.clip(0.75 + (-gx * 0.6 + gz * 0.6) / np.sqrt(1 + gx**2 + gz**2) * 0.5, 0.3, 1.2)
col = np.zeros((nz, nx, 3))
col[:] = [60, 110, 50]
col[slope > 1.6] = [190, 180, 160]
col[t == 1] = [205, 190, 150]; col[t == 2] = [240, 232, 210]; col[t == 4] = [140, 160, 90]
deep = np.clip(-y / 20, 0, 1)[..., None]
water = (1 - deep) * np.array([90, 210, 200]) + deep * np.array([20, 60, 130])
col = np.where((t == 0)[..., None], water, col * sh[..., None])
img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).resize((nx * 2 // 2, nz * 2 // 2))
img.save('../out/study/map.png')
print(y.max(), (slope > 1.6).mean())
