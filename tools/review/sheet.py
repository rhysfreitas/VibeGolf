#!/usr/bin/env python3
"""Contact sheets on white pages, for review rounds and art briefs.

  python3 tools/review/sheet.py <course> [holes...] [--views=tee,land,green] [--w=640] [--out=path]
      the renders from views.mjs, one row a hole, captioned with the hole's number, name and view
  python3 tools/review/sheet.py --files a.png b.jpg ... [--cols=3] [--w=640] [--out=path] [--title=...]
      any images in a grid, captioned with their file names: a mood board of reference photos, or a
      before/after pair

Output: tools/review/out/<course>_sheet.jpg (or sheet.jpg for --files) unless --out is given.
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'out')


def font(size):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def hole_names(course):
    js = ("import(process.argv[1]).then(m => console.log(JSON.stringify(m.HOLES.map(h => h.name))))")
    mods = {'aerie': 'aerie', 'redmesa': 'red-mesa', 'hollowmere': 'hollowmere', 'reclaim': 'reclaim'}
    path = os.path.join(REPO, 'src', 'course', mods.get(course, course) + '.js')
    try:
        return json.loads(subprocess.check_output(['node', '-e', js, path], text=True))
    except Exception:
        return []


def grid(tiles, cols, w, title=None):
    """tiles: [(path, caption)] -> one white page"""
    ims = []
    for p, cap in tiles:
        if not os.path.exists(p):
            print('missing', p)
            continue
        im = Image.open(p).convert('RGB')
        ims.append((im.resize((w, round(im.height * w / im.width))), cap))
    if not ims:
        sys.exit('nothing to put on the sheet')
    th = max(im.height for im, _ in ims)
    pad, cap_h, head = 16, 30, 54 if title else 0
    rows = (len(ims) + cols - 1) // cols
    W = cols * w + (cols + 1) * pad
    H = head + rows * (th + cap_h) + (rows + 1) * pad
    page = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(page)
    if title:
        d.text((pad, 14), title, fill=(30, 30, 30), font=font(26))
    f = font(17)
    for k, (im, cap) in enumerate(ims):
        x = pad + (k % cols) * (w + pad)
        y = head + pad + (k // cols) * (th + cap_h + pad)
        page.paste(im, (x, y))
        d.rectangle([x - 1, y - 1, x + im.width, y + im.height], outline=(200, 200, 200))
        d.text((x, y + im.height + 6), cap, fill=(40, 40, 40), font=f)
    return page


def main(argv):
    opt = {a.split('=')[0][2:]: (a.split('=', 1)[1] if '=' in a else True) for a in argv if a.startswith('--')}
    pos = [a for a in argv if not a.startswith('--')]
    w = int(opt.get('w', 640))
    os.makedirs(OUT, exist_ok=True)
    if 'files' in opt:
        tiles = [(p, os.path.basename(p)) for p in pos]
        page = grid(tiles, int(opt.get('cols', 3)), w, opt.get('title'))
        out = opt.get('out', os.path.join(OUT, 'sheet.jpg'))
    else:
        if not pos:
            sys.exit(__doc__)
        course, holes = pos[0], [int(h) for h in pos[1:]]
        views = opt.get('views', 'tee,land,green').split(',')
        names = hole_names(course)
        if not holes:
            holes = list(range(1, len(names) + 1)) or list(range(1, 10))
        tiles = []
        for n in holes:
            nm = names[n - 1] if n - 1 < len(names) else ''
            for v in views:
                tiles.append((os.path.join(OUT, f'{course}_v{n}_{v}.png'), f'{n} {nm}: {v}'))
        page = grid(tiles, int(opt.get('cols', len(views))), w, opt.get('title', course))
        out = opt.get('out', os.path.join(OUT, f'{course}_sheet.jpg'))
    page.save(out, quality=88)
    print(out, page.size)


if __name__ == '__main__':
    main(sys.argv[1:])
