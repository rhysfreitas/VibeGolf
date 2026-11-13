import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mock import *

C = 'rimeholm'
TITLE = 'Rimeholm'
NOTE = 'Today: every landing area leans 1.4–2.8%; every fairway 39–48 m wide; par 3s 165 and 180 yd; par 5s 520 and 540; it touches only two edges of real golf.'
ROWS = [('7 The Moulin (4)', '420', 'Landing area tipped to about 9.5% across, a powder bank low', 'hillside bench (bold)', '', 'ground'),
        ('4 The Crevasse Field (5)', '540 → 590', 'An 85 m snowfield with diagonal crevasses inside it; tee back', 'width, length', '', 'ground, tees'),
        ('8 The Mammoth (5)', '520 → 495', 'Tee forward: the reachable par 5', 'length', '', 'tees'),
        ('6 The Frozen Falls (3)', '180 → 215', 'Tee back: the long par 3, still uphill', 'length', '', 'tees'),
        ('3 The Longship (3)', '165 → 128', 'The green out on the lake, ringed by ice; no sand', 'bunker count: none', 'island green', 'green, sand'),
        ('1 The Ice Gate (extra)', '400', 'Drive through a 29 m gate; the fairway fans out below', 'width', 'the chute', 'ground'),
        ('9 The Aurora Hall (extra)', '410', 'A big finishing green, about 875 m²', 'green size', '', 'green')]

def moulin(pdf):
    A = Hole(C, 7); B = A.copy()
    B.tilt(150, 290, 0.095, half=34, edge=25, ramp=30)
    B.paint(B.rect(160, 285, -48, -31) & ~B.is_('void'), 'powder')
    hpage(pdf, A, B, '7 The Moulin', ['hillside bench', 'bold'],
          'drive to the high side, by the moulin, for a level-ish stance and the short way in. Bail left and the ball runs down to the low side or the powder, the ball below your feet for the second.',
          ['The landing area, 150–290 m out, is tipped to about 9.5% across (2.4% today), the high side on the right toward the moulin. The low side on the left runs off into a wide bank of powder.',
           'The line along the middle hardly moves, so the profile is nearly the same; the cross-sections show the lean.',
           'The line, the moulin and the green stay. The course\'s first strong lean.'],
          box=(-140, 80, -400, 40), cross=(200, 260), marks=[(230, 'bench, 9.5% across')])

def crevasse(pdf):
    A = Hole(C, 4); B = A.copy()
    zone = B.rect(70, 395, -65, 65)
    B.fill(zone & np.isnan(B.h), 'rough'); B.h[zone] = ndimage.gaussian_filter(np.nan_to_num(B.h, nan=np.nanmean(B.h)), 2)[zone]
    wide = B.rect(95, 395, -42.5, 42.5); B.paint(wide, 'fairway')
    B.paint(ndimage.binary_dilation(wide, iterations=6) & ~wide & zone, 'firstcut')
    for s, o, ln, rot in [(175, -18, 26, 35), (240, 20, 30, -38), (305, -12, 28, 40), (350, 26, 18, -30)]:
        B.carve(B.ellipse(s, o, ln, 3.2, rot))
    B.tee(-46, 0, '590 yd')
    hpage(pdf, A, B, '4 The Crevasse Field', ['dial: width', 'the long par 5'],
          'a wide snowfield that still asks for a line: pick the gap between the slots that suits your drive and your next shot. A ball into a slot is open air, as now.',
          ['The fairway becomes a snowfield 85 m wide from 95 to 395 m out (39–48 m today). The crevasses that run along its sides move inside it, as four diagonal slots about 6 m wide, alternating sides. The crevasse across the line in front of the green stays.',
           'A new back tee 46 m behind today\'s, 540 → about 590 yd.'],
          box=(-110, 110, -540, 90), prof=(-55, 500))

def mammoth_tee(pdf):
    A = Hole(C, 8); B = A.copy(); B.tee(23, 0, '495 yd')
    hpage(pdf, A, B, '8 The Mammoth', ['dial: length', 'reachable par 5'],
          'a good drive leaves a second that can reach the green.',
          ['The back tee comes forward 23 m, 520 → about 495 yd. Nothing else moves. With the Crevasse Field at 590 the par 5s are 495 and 590.'],
          box=(-80, 140, -520, 50))

def falls_tee(pdf):
    A = Hole(C, 6); B = A.copy(); B.tee(-32, 0, '215 yd')
    hpage(pdf, A, B, '6 The Frozen Falls', ['dial: length', 'the long par 3'],
          'a long iron or wood, still up 18 m onto the shelf.',
          ['A new back tee 32 m behind today\'s, 180 → about 215 yd. The tips tee moves back with it. Nothing else moves. With the Longship at 128 the par 3s are 128 and 215.'],
          box=(-80, 80, -200, 80), prof=(-40, A.len + 20))

def longship(pdf):
    A = Hole(C, 3); B = A.copy()
    ice = A.is_('ice'); lvl = np.nanmedian(A.h[ice])
    B.paint(A.is_('green', 'fringe', 'sand') & (A.S > 125), 'rough')
    ring = B.ellipse(117, 0, 27, 30); B.level_to(ring, lvl, edge=4); B.paint(ring & ~ice, 'ice')
    isl = B.ellipse(117, 0, 12.5, 12); B.level_to(isl, lvl + 1.0, edge=1.5)
    B.paint(ndimage.binary_dilation(isl, iterations=1), 'fringe'); B.paint(ndimage.binary_erosion(isl, iterations=1), 'green')
    B.paint(B.is_('sand'), 'rough')
    hpage(pdf, A, B, '3 The Longship', ['island green', 'no sand'],
          'a short iron down 12 m that has to stay on: the lake ice runs a ball away, so long is as bad as short.',
          [f'The green moves 34 m nearer, out onto the lake, about 470 m² (now {A.green_area()}), 1 m proud of the ice and ringed by it on every side. The tee stays; the hole becomes about 128 yd (165 today).',
           'No sand anywhere on the hole. The old green\'s place becomes snow. The longship stays frozen in the lake.'],
          box=(-70, 70, -190, 40), prof=(-10, 165), cross=(117,))

def icegate(pdf):
    A = Hole(C, 1); B = A.copy()
    for side in (-1, 1):
        w = B.rect(30, 85, 14.5, 36) if side > 0 else B.rect(30, 85, -36, -14.5)
        B.raise_mask(w, 13, edge=3); B.paint(w, 'rock')
    fan = B.rect(140, 270, -50, 50) & B.is_('rough', 'firstcut', 'fringe') & (np.abs(B.O) < 18 + (B.S - 140) * 0.23)
    B.paint(fan, 'fairway')
    hpage(pdf, A, B, '1 The Ice Gate (extra)', ['the chute', 'dial: width'],
          'thread the drive through the gate, then it is wide open below. Tight and wide on one hole.',
          ['Two ice walls about 13 m high close in either side of the line 30–85 m from the tee, leaving a gate 29 m wide. Below the drop, the fairway fans out to about 85 m at 260 m out (about 45 today).',
           'The drop and the green stay. The forward tees sit outside the gate (left), so they play past it.'],
          box=(-110, 90, -400, 40), cross=(60, 240), marks=[(57, 'gate 29 m')])

def aurora(pdf):
    A = Hole(C, 9); B = A.copy(); a0 = A.green_area(); B.scale_green(np.sqrt(875 / a0))
    hpage(pdf, A, B, '9 The Aurora Hall (extra)', ['dial: green size'],
          'the same climb to the longhouse, finishing on the biggest target of the nine.',
          [f'The green grows from about {a0} m² to about {B.green_area()} m² in the longhouse\'s yard. Its bunkers and surrounds would move out with it.',
           'The climb, the hourglass fairway and the longhouse stay.'],
          box=(-90, 90, -420, 40), detail=green_box(B, 16))

PAGES = (moulin, crevasse, mammoth_tee, falls_tee, longship, icegate, aurora)
