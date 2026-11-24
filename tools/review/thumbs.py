# Menu thumbnails, second step (the first is thumbs.mjs, which renders the courses from the game):
#   python3 tools/review/thumbs.py [--sheet]
# 1. each course's render, tools/review/out/thumb_<course>.png, scaled to 640x360 -> assets/thumb-<course>.jpg
# 2. the home menu's Play Golf and Mini games thumbnails, put together from the tiles' own thumbnails
#    -> assets/thumb-home-golf.jpg, assets/thumb-home-games.jpg
# --sheet also writes every layout at the home card's sizes (112 and 88 px wide) to tools/review/out/home-thumbs.png
# for choosing. The home card shows them at 112x70 css px (88x55 on a phone), so they are made at 448x280 (4x).
import sys, os, math
from PIL import Image, ImageDraw, ImageFilter

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
A = lambda n: os.path.join(REPO, 'assets', f'thumb-{n}.jpg')
W, H = 448, 280
BG = (16, 28, 34)
GAP = 6

# what each picture shows: courses chosen for contrast (golden sky, a glacier at night, the volcano at dusk, the ring,
# the islands); the seven playable mini games
GOLF = ['aerie', 'rimeholm', 'redmesa', 'emeraldbay', 'halcyon']
GAMES = ['shape-it', 'zombie-siege', 'island-hopper', 'horse', 'carnival-booth', 'wedge-ladder', 'golf-bowling']

def cover(im, w, h, focus=(0.5, 0.5)):
  """scale and crop im to fill w x h, keeping the point focus (fractions) in view"""
  s = max(w / im.width, h / im.height); im = im.resize((max(w, round(im.width * s)), max(h, round(im.height * s))), Image.LANCZOS)
  x = min(max(0, round(im.width * focus[0] - w / 2)), im.width - w); y = min(max(0, round(im.height * focus[1] - h / 2)), im.height - h)
  return im.crop((x, y, x + w, y + h))

def rounded(im, r):
  m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255); return m

# where each picture's subject sits (fractions across and down), for crops
FOCUS = {}

def slices(names, slant=0.28):
  """vertical strips with slanted edges, a dark gap between them, each showing its picture's subject"""
  out = Image.new('RGB', (W, H), BG); n = len(names); off = slant * H
  for i, nm in enumerate(names):
    x0 = i * W / n; x1 = (i + 1) * W / n
    # the strip is a parallelogram leaning right: its left edge from x0+off/2 at the top to x0-off/2 at the bottom
    l = lambda y, x: x + off / 2 - off * y / H
    poly = [(l(0, x0) + (GAP / 2 if i else -99), 0), (l(0, x1) - (GAP / 2 if i < n - 1 else -99), 0),
            (l(H, x1) - (GAP / 2 if i < n - 1 else -99), H), (l(H, x0) + (GAP / 2 if i else -99), H)]
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    # the picture's subject on the strip's centre line: a picture a little wider than the strip, shifted along
    pw = round(W / n + off + 2 * GAP + 40); fx, fy = FOCUS.get(nm, (0.5, 0.5))
    sh = cover(Image.open(A(nm)).convert('RGB'), pw, H, (fx, fy))
    layer = Image.new('RGB', (W, H), BG); layer.paste(sh, (round((x0 + x1) / 2 - pw / 2), 0))
    out.paste(layer, (0, 0), m)
  return out

def grid(names, cols, rows, extra=None):
  out = Image.new('RGB', (W, H), BG); g = GAP
  tw = (W - g * (cols + 1)) / cols; th = (H - g * (rows + 1)) / rows
  cells = [(c, r) for r in range(rows) for c in range(cols)]
  for k, (c, r) in enumerate(cells):
    x = round(g + c * (tw + g)); y = round(g + r * (th + g)); w = round(tw); h = round(th)
    if k < len(names): im = cover(Image.open(A(names[k])).convert('RGB'), w, h)
    elif extra: im = extra(w, h)
    else: continue
    out.paste(im, (x, y), rounded(im, 10))
  return out

def soon_tile(w, h):
  """the game on the way: a dim tile with a dashed edge"""
  im = Image.new('RGB', (w, h), (30, 44, 52)); d = ImageDraw.Draw(im)
  for x in range(8, w - 8, 14): d.line((x, 4, x + 7, 4), fill=(130, 150, 160), width=3); d.line((x, h - 5, x + 7, h - 5), fill=(130, 150, 160), width=3)
  for y in range(8, h - 8, 14): d.line((4, y, 4, y + 7), fill=(130, 150, 160), width=3); d.line((w - 5, y, w - 5, y + 7), fill=(130, 150, 160), width=3)
  r = 5
  for k in (-1, 0, 1): d.ellipse((w / 2 + k * 16 - r, h / 2 - r, w / 2 + k * 16 + r, h / 2 + r), fill=(170, 188, 196))
  return im

def fan(names, n_show=5):
  """a hand of cards fanned out, the middle one on top"""
  out = Image.new('RGB', (W, H), BG); cw, ch = 280, 158
  names = names[:n_show]; k = len(names); mid = (k - 1) / 2
  order = sorted(range(k), key=lambda i: -abs(i - mid))
  for i in order:
    t = i - mid; ang = -t * (8 if k > 3 else 10); im = cover(Image.open(A(names[i])).convert('RGB'), cw, ch)
    card = Image.new('RGBA', (cw + 8, ch + 8), (0, 0, 0, 0)); ImageDraw.Draw(card).rounded_rectangle((0, 0, cw + 7, ch + 7), 12, fill=(235, 232, 222, 255))
    card.paste(im, (4, 4), rounded(im, 9))
    card = card.rotate(ang, Image.BICUBIC, expand=True)
    cx = W / 2 + t * (52 if k > 3 else 95); cy = H / 2 + 12 + abs(t) * 10
    sh = Image.new('RGBA', card.size, (0, 0, 0, 0)); sh.putalpha(card.getchannel('A').point(lambda a: a * 0.55)); sh = sh.filter(ImageFilter.GaussianBlur(6))
    out.paste(sh, (round(cx - card.width / 2 + 3), round(cy - card.height / 2 + 5)), sh)
    out.paste(card, (round(cx - card.width / 2), round(cy - card.height / 2)), card)
  return out

LAYOUTS = {
  'golf': {'slices3': lambda: slices(GOLF[:3]), 'slices4': lambda: slices(GOLF[:4], 0.3), 'grid4': lambda: grid(GOLF[:4], 2, 2), 'fan3': lambda: fan(GOLF[:3], 3), 'grid6': lambda: grid(GOLF[:3] + ['halcyon', 'cloudrest', 'lostvalley'], 3, 2)},
  'games': {'grid7': lambda: grid(GAMES, 4, 2, soon_tile), 'grid6': lambda: grid(GAMES[:6], 3, 2), 'fan5': lambda: fan(GAMES, 5), 'slices4': lambda: slices([GAMES[0], GAMES[1], GAMES[4], GAMES[6]], 0.3)},
}
PICK = {'golf': 'slices3', 'games': 'grid7'}

# a gamma lift for a course whose tile reads too dark at menu size (its dusk is darker than the menu around it)
LIFT = {'emberfell': 0.8}

if __name__ == '__main__':
  OUT = os.path.join(REPO, 'tools/review/out')
  for f in sorted(os.listdir(OUT)):
    if f.startswith('thumb_') and f.count('_') == 1 and f.endswith('.png'):
      c = f[6:-4]; im = Image.open(os.path.join(OUT, f)).convert('RGB').resize((640, 360), Image.LANCZOS)
      if c in LIFT: im = im.point([round(255 * (i / 255) ** LIFT[c]) for i in range(256)] * 3)
      im.save(A(c), quality=84, optimize=True)
      print('course', c)
  for kind, name in PICK.items():
    LAYOUTS[kind][name]().save(os.path.join(REPO, 'assets', f'thumb-home-{kind}.jpg'), quality=86, optimize=True)
  if '--sheet' in sys.argv:
    rows = [(k, n, f()) for k in LAYOUTS for n, f in LAYOUTS[k].items()]
    sheet = Image.new('RGB', (1400, 40 + 200 * len(rows)), 'white'); d = ImageDraw.Draw(sheet)
    for i, (k, n, im) in enumerate(rows):
      y = 20 + i * 200; d.text((20, y + 70), f'{k}: {n}', fill='black')
      sheet.paste(im.resize((W // 2 * 1, H // 2)), (200, y))              # large
      a = im.resize((224, 140), Image.LANCZOS); sheet.paste(a, (460, y))   # 112 css px at 2x
      b = im.resize((176, 110), Image.LANCZOS); sheet.paste(b, (720, y))   # 88 css px at 2x
      c = im.resize((112, 70), Image.LANCZOS); sheet.paste(c, (940, y))    # 112 at 1x
    sheet.save(os.path.join(REPO, 'tools/review/out/home-thumbs.png'))
