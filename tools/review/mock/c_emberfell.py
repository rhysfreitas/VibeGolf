import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mock import *

C = 'emberfell'
TITLE = 'Emberfell'
NOTE = 'Today: no bold hole; five plain holes (1, 2, 3, 5, 6); par 5s 520 and 510 yd; eight of nine greens with exactly two bunkers. The Terraces, the Cinder Cone\'s green and the Heart\'s play stay.'
ROWS = [('2 The Barranco (4)', '405', 'Gully deepened, landing shelf lifted level with the tee', 'valley carry (bold)', '', 'ground'),
        ('3 The Lava Tube (4)', '455 → 478', 'Left fairway lifted onto a 6 m flow front; tee back', 'table top (bold)', '', 'ground, tees'),
        ('1 Kipuka (5)', '520 → 490', 'Tee forward: the reachable par 5', 'length', '', 'tees'),
        ('6 The Lavafall (5)', '510 → 600', 'Tee back: the long par 5', 'length', '', 'tees'),
        ('8 The Cinder Cone (3)', '150 → 122', 'Tee forward; the green untouched', 'length', 'a true Short', 'tees'),
        ('9 The Heart, 4 The Crown', '', 'No sand by the green', 'bunker count: none', '', 'sand'),
        ('2 The Barranco', '', 'Cross bunker becomes a field of ash pots', 'bunker count: many', '', 'sand'),
        ('1 Kipuka (extra)', '', 'Banks either side: a half-pipe', 'half-pipe', '', 'ground')]

def barranco(pdf):
    A = Hole(C, 2); B = A.copy()
    B.reprofile([(105, along(A, 105)), (114, 3.4), (136, -3.5), (160, -14), (178, -14), (200, -5), (218, 2.6), (240, 3.0), (295, 3.6), (318, along(A, 318))], half=50, edge=30, smooth=10)
    hpage(pdf, A, B, '2 The Barranco', ['valley carry', 'bold'],
          'a drive that carries the barranco, about 215 m from the back tee, to a flat shelf. Short of it, the ball runs back to the floor of the gully and leaves a blind second up the bank.',
          ['The gully across the hole is deepened, its floor about 15 m below the tee (12 m today), and pulled back to 140–200 m out. The landing area beyond it, 215–300 m out, is lifted about 14 m to sit level with the tee (today it is the gully\'s far bank).',
           'The climb from the shelf to the green, the cross bunker, the green and the yardage stay. The sides of the gully are about 1 in 3.',
           'Emberfell\'s first bold hole, and it breaks the run of two ramps up on 2 and 3.'],
          box=(-80, 80, -410, 40), prof=(-10, 395), cross=(250,), marks=[(165, 'gully'), (255, 'shelf')])

def lavatube(pdf):
    A = Hole(C, 3); B = A.copy()
    zone = (B.X < -27) & (B.Z < -150) & (B.Z > -340) & ~np.isnan(B.h) & B.is_('fairway', 'fringe', 'firstcut', 'rough')
    zone = ndimage.binary_opening(zone, iterations=2)
    dist = ndimage.distance_transform_edt(~zone); w = 1 - smooth01((dist - 4) / 7)
    top = 10.5 + 0.03 * (B.S - 160)
    B.h = np.where(np.isnan(B.h), B.h, np.where(top > B.h, B.h + (top - B.h) * w, B.h))
    B.tee(-21, 0, '478 yd')
    nx, nz = B.at(245, -62)
    hpage(pdf, A, B, '3 The Lava Tube', ['table top', 'bold'],
          'carry the trench and the face of the flow front (left) for a flat lie and a short, open second; or take the main fairway (right) and cross the natural bridge for a longer second from below.',
          ['The channel, the fairway left of the trench, is lifted onto a flow front: a face about 6 m high at its near end (160 m out) and a top that rises gently and runs into the approach. Nothing changes on the main fairway.',
           'The back tee goes 21 m back, 455 → about 478 yd. Both fairways, the trench, its bridge and the green stay; the main fairway is still the forward tees\' lane.',
           'The profile follows the bold line, from the new back tee over the trench onto the flow front and on to the green.'],
          box=(-100, 100, -440, 40), cross=(200,), notes_new=[(nx - 12, nz, 'flow front +6 m')],
          path=[B.at(-21), B.at(245, -62), A.pin], path_title='Along the bold line')

def kipuka_tee(pdf):
    A = Hole(C, 1); B = A.copy(); B.tee(27, 0, '490 yd')
    hpage(pdf, A, B, '1 Kipuka', ['dial: length', 'reachable par 5'],
          'a good drive leaves a second that can reach the green in two. Still the gentle opener.',
          ['The back tee comes forward 27 m, onto today\'s second tee, 520 → about 490 yd. Nothing else moves.',
           'With the Lavafall at 600 the par 5s are 490 and 600, one reachable and one a real three-shotter (520 and 510 today).'],
          box=(-90, 140, -560, 40))

def lavafall_tee(pdf):
    A = Hole(C, 6); B = A.copy(); B.tee(-82, 0, '600 yd')
    hpage(pdf, A, B, '6 The Lavafall', ['dial: length', 'the long par 5'],
          'three full shots, falling away toward the lavafall the whole way.',
          ['A new back tee 82 m behind today\'s, on the ground beside the lava pool, 510 → about 600 yd. Nothing else moves.',
           'The new tee needs a pad and its view checked (nothing overhead within 45 m, the landing area in frame). The tips tee moves back with it.'],
          box=(-100, 150, -520, 110), prof=(-90, A.len + 20))

def cone_tee(pdf):
    A = Hole(C, 8); B = A.copy(); B.tee(26, 0, '122 yd')
    hpage(pdf, A, B, '8 The Cinder Cone', ['dial: length', 'a true Short'],
          'a short iron or wedge up into the crater green; the green itself, which you like, is untouched.',
          ['The back tee comes forward 26 m, 150 → about 122 yd. The crater, the green and its surrounds stay exactly as they are.',
           'Emberfell\'s par 3s become 122 and 240 yd.'],
          box=(-80, 80, -160, 40))

def heart_sand(pdf):
    A = Hole(C, 9); B = A.copy()
    gs = ndimage.binary_dilation(A.is_('green'), iterations=22) & A.is_('sand')
    B.fill(gs, 'rough'); smooth_fill(B, gs, 7)
    hpage(pdf, A, B, '9 The Heart', ['dial: bunker count', 'none'],
          'the same approach to the island green, with only the lava round it.',
          ['The two bunkers by the green go; the ground there becomes rough. The lava all round is hazard enough. The beach lane\'s sand down the right of the fairway stays (it is part of the decision).'],
          box=(-160, 80, -420, 40), detail=green_box(A, 22))

def crown_sand(pdf):
    A = Hole(C, 4); B = A.copy()
    gs = ndimage.binary_dilation(A.is_('green'), iterations=25) & A.is_('sand')
    B.fill(gs, 'rough'); smooth_fill(B, gs, 7)
    hpage(pdf, A, B, '4 The Crown', ['dial: bunker count', 'none'],
          'the same drop shot to the crescent green, with no sand round it.',
          ['The green\'s bunkers go; the drop and the crescent green do the work. The green keeps its shape.'],
          box=(-80, 80, -270, 40), detail=green_box(A, 22))

def barranco_pots(pdf):
    A = Hole(C, 2); B = A.copy()
    cross = A.is_('sand') & (A.S > 280) & (A.S < 320) & (np.abs(A.O) < 40)
    B.paint(cross, 'fairway'); smooth_fill(B, cross, 9)
    rng = np.random.default_rng(4)
    for k in range(11):
        s = 278 + rng.uniform(0, 42); o = rng.uniform(-30, 30)
        m = B.ellipse(s, o, rng.uniform(2.5, 3.8), rng.uniform(2.5, 3.6), rng.uniform(0, 90)); B.h[m] -= 1.0; B.paint(m, 'sand')
    hpage(pdf, A, B, '2 The Barranco: the climb', ['dial: bunker count', 'many'],
          'a second up the climb past a field of small ash pots, instead of over one long cross bunker.',
          ['The single cross bunker at about 300 m becomes eleven small, sunk ash pots, 5–8 m across, scattered across the climb. Goes with either version of the Barranco (with or without the valley carry).'],
          box=(-80, 80, -410, 40), detail=(-55, 55, -340, -255))

def kipuka_pipe(pdf):
    A = Hole(C, 1); B = A.copy()
    bank = smooth01((np.abs(B.O) - 30) / 32) * 6.5
    ws = smooth01((B.S - 40) / 40) * (1 - smooth01((B.S - 400) / 40))
    keep = B.is_('water') | np.isnan(B.h)
    B.h = np.where(keep, B.h, B.h + bank * ws)
    hpage(pdf, A, B, '1 Kipuka (extra)', ['half-pipe'],
          'a loose drive is fed back to the middle by the banks: a helper for an opener.',
          ['The ground either side of the fairway rises into banks about 6 m high, 60 m off the line: the forest\'s bank on the left, the flow\'s levee on the right. The line itself doesn\'t change, so the profile is the same; the cross-sections show it.'],
          box=(-90, 140, -560, 40), cross=(180, 330), marks=[(250, 'banks both sides')])

PAGES = (barranco, lavatube, kipuka_tee, lavafall_tee, cone_tee, heart_sand, crown_sand, barranco_pots, kipuka_pipe)
