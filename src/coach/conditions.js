// Coaching range: the condition catalogue (data only). The rules that detect each condition
// live in coach-logic.js under the same id; the mannequin lessons named here live in
// lessons.js. Keep the wording short: a headline, one line, a cue of a few words.
//
// A cause marked `strong` (ball position) is listed only when its data hint holds, and then
// first; so a readout never shows more than three.
//
// cause.check: { type: 'data' } (the hint in coach-logic decides), { type: 'ask', q } (a quick
// yes/no, only when the data can't separate causes), or { type: 'test', text } (a feel to try).

const D = (name, ...steps) => ({ name, steps });

export const CONDITIONS = {
  aimedOff: {
    id: 'aimedOff', group: 'setup', name: 'Aimed off',
    headline: "You're aimed off line", sub: 'The swing is sound, but it starts every ball the same way off target.',
    cue: 'Clubface at the target, then the feet', evidence: ['dir', 'ftp', 'path'],
    causes: [
      { id: 'aimBody', title: 'Body lined up off target', hint: null, check: { type: 'test', text: 'Lay a club along your toes and look behind you: where does it point?' }, lesson: 'aim-body', drill: D('Two-stick setup', 'One stick at the target, one along your toes.', 'Set the face first, then square your feet to the stick.', 'Hit five, re-checking each time.') },
      { id: 'aimFace', title: 'Face set first, body follows it', hint: null, check: { type: 'test', text: 'Pick a spot a foot in front of the ball and aim the face at it.' }, lesson: 'aim-body', drill: D('Spot aim', 'Pick a mark a foot ahead on the target line.', 'Aim the face at the mark, then set your feet.', 'Hit five.') },
      { id: 'aimBall', title: 'Ball position: too far back starts it right, too far forward left', hint: 'ballPos', strong: true, check: { type: 'test', text: 'Move the ball a ball width (forward if it starts right, back if it starts left) and hit three.' }, lesson: null, drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'For a 7 iron, the ball sits just ahead of centre.', 'Hit five, checking the stick each time.') },
    ],
  },
  overTheTop: {
    id: 'overTheTop', group: 'path', name: 'Over the top',
    headline: "You're coming over the top", sub: 'The club swings out-to-in across the ball: pulls, and slices when the face is open.',
    cue: 'Arms drop first, shoulders stay closed', evidence: ['path', 'dir', 'ftp', 'aoa'],
    causes: [
      { id: 'ottShoulders', title: 'Shoulders start the downswing', hint: 'steepAttack', check: { type: 'ask', q: 'Do your divots point left of the target?' }, lesson: 'ott-shoulders', drill: D('Pump drill', 'Swing to the top.', 'Drop the hands to hip height with your back still to the target, three times.', 'On the third, swing through and hit.') },
      { id: 'ottInside', title: 'Takeaway too far inside, then it re-routes', hint: null, check: { type: 'ask', q: 'Does the club go behind you early in the backswing?' }, lesson: 'ott-inside', drill: D('Clubhead outside the hands', 'Take it back to hip height.', 'Check the clubhead is outside your hands, toe up.', 'Hit five with that takeaway.') },
      { id: 'ottWeight', title: 'Weight stays on the trail side', hint: 'strikeMix', check: { type: 'data' }, lesson: 'ott-weight', drill: D('Step drill', 'Start with your feet together.', 'Step toward the target with the lead foot as you start down.', 'Hit five.') },
      { id: 'ottBall', title: 'Ball too far forward', hint: 'ballFwd', strong: true, check: { type: 'test', text: 'Move the ball back a ball width and hit three.' }, lesson: 'ballpos-fwd', drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'For a 7 iron, the ball sits just ahead of centre.', 'Hit five, checking the stick each time.') },
    ],
  },
  stuck: {
    id: 'stuck', group: 'path', name: 'Stuck / inside-out',
    headline: 'The club is coming too far from the inside', sub: 'An in-to-out path: pushes right, or hooks when the face shuts.',
    cue: 'Keep turning, chest to the target', evidence: ['path', 'dir', 'ftp'],
    causes: [
      { id: 'stuckHips', title: 'Hips stall, arms pass the body', hint: 'pushHook', check: { type: 'data' }, lesson: 'stuck-hips', drill: D('Belt buckle finish', 'Swing at 70%.', 'Finish with your belt buckle facing the target.', 'Hit five.') },
      { id: 'stuckShoulder', title: 'Trail shoulder drops under', hint: 'shallowAttack', check: { type: 'data' }, lesson: 'stuck-shoulder', drill: D('Level shoulders', 'Hold a stick across your chest.', 'Make practice swings keeping it turning level.', 'Hit five with that feel.') },
      { id: 'stuckBall', title: 'Ball too far back', hint: 'ballBack', strong: true, check: { type: 'test', text: 'Move the ball forward one ball width and hit three.' }, lesson: 'ballpos-back', drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'For a 7 iron, the ball sits just ahead of centre.', 'Hit five, checking the stick each time.') },
    ],
  },
  openFace: {
    id: 'openFace', group: 'face', name: 'Open face',
    headline: "The face is open at impact", sub: 'Open to the path, so the ball curves right: fades that turn into slices.',
    cue: 'Toe up after impact', evidence: ['ftp', 'face', 'path'],
    causes: [
      { id: 'openRotation', title: "Forearms don't rotate through impact", hint: 'goodContact', check: { type: 'data' }, lesson: 'open-rotation', drill: D('Toe up to toe up', 'Half swings, hip high to hip high.', 'Toe up on the way back, toe up on the way through.', 'Ten swings, then hit five.') },
      { id: 'openGrip', title: 'Weak grip', hint: null, check: { type: 'test', text: 'Look down at address: can you see two or three knuckles of your lead hand?' }, lesson: 'open-grip', drill: D('Grip check', 'Turn the lead hand until two to three knuckles show.', 'Trail palm faces the target.', 'Hit five soft half swings.') },
      { id: 'openWrist', title: 'Cupped lead wrist at the top', hint: 'highLaunch', check: { type: 'test', text: 'Stop at the top and look: is the back of your lead wrist flat or bent back?' }, lesson: 'open-wrist', drill: D('Flat wrist at the top', 'Swing to the top and stop.', 'Flatten the back of the lead wrist.', 'Hit five, holding that at the top.') },
    ],
  },
  closedFace: {
    id: 'closedFace', group: 'face', name: 'Closed face',
    headline: 'The face is closed at impact', sub: 'Closed to the path, so the ball curves left: draws that turn into hooks.',
    cue: 'Quiet hands, body keeps turning', evidence: ['ftp', 'face', 'path'],
    causes: [
      { id: 'closedBody', title: 'Body stalls so the hands flip over', hint: 'pathRight', check: { type: 'data' }, lesson: 'closed-body', drill: D('Chest through', 'Half swings.', 'Keep the chest turning so the hands never pass it.', 'Hit five.') },
      { id: 'closedGrip', title: 'Strong grip', hint: null, check: { type: 'test', text: 'At address, can you see four knuckles of your lead hand?' }, lesson: 'closed-grip', drill: D('Grip check', 'Turn both hands toward the target until two to three knuckles show.', 'Hit five soft half swings.') },
    ],
  },
  twoWay: {
    id: 'twoWay', group: 'control', name: 'Two-way miss',
    headline: "It's going both ways", sub: 'No single miss: the face and path change from swing to swing.',
    cue: 'Same smooth tempo every swing', evidence: ['face', 'path', 'dir'],
    causes: [
      { id: 'twoTiming', title: 'Hand timing, not the body', hint: 'faceWider', check: { type: 'data' }, lesson: null, drill: D('70% swings', 'Swing at 70% speed.', 'Pick one start line and hit five at it.', 'Only speed up when five in a row start on line.') },
      { id: 'twoGrip', title: 'Grip pressure changes', hint: null, check: { type: 'test', text: 'Hold the club at 4 out of 10 pressure and keep it the same all swing.' }, lesson: null, drill: D('Light grip', 'Grip at 4 out of 10.', 'Hit five, keeping the pressure the same.') },
    ],
  },
  distance: {
    id: 'distance', group: 'control', name: 'Distance spread',
    headline: 'Your distances are all over', sub: 'Same club, same swing, but the carry changes by more than it should from shot to shot.',
    cue: 'Same strike, same length, every swing', evidence: ['carryGap', 'smashSd', 'launchSd', 'speedSd'],
    causes: [
      { id: 'distStrike', title: 'The strike moves around the face', hint: 'strikeSpread', check: { type: 'data' }, lesson: null, drill: D('Gate drill', 'Two tees just wider than the clubhead, the ball between them.', 'Swing through without touching either.', 'Hit five, then spray the face to see where they landed.') },
      { id: 'distLow', title: 'The low point moves: a heavy one, then a thin one', hint: 'lowPointSpread', check: { type: 'data' }, lesson: 'flip-weight', drill: D('Line drill', 'Draw a line (or lay a towel edge) across the mat where the ball sits.', 'Make swings that brush the mat just after the line.', 'Hit five with the ball on the line.') },
      { id: 'distSpeed', title: 'Swing length and speed change', hint: 'speedSpread', check: { type: 'data' }, lesson: null, drill: D('Same count', 'Say "one" going back, "two" coming down.', 'Keep the same count and the same finish for five balls.') },
    ],
  },
  flip: {
    id: 'flip', group: 'lowPoint', name: 'Flip / adding loft',
    headline: 'Your hands are flipping through impact', sub: 'Extra loft at the ball: higher, spinnier, shorter, and it leaks right.',
    cue: 'Hands lead the clubhead into the ball', evidence: ['launch', 'spin', 'smash', 'aoa'],
    causes: [
      { id: 'flipWeight', title: 'Weight hangs back', hint: 'strikeMix', check: { type: 'data' }, lesson: 'flip-weight', drill: D('Lead-side finish', 'Swing at 70%.', 'Finish on the lead foot with only the trail toe down.', 'Hit five.') },
      { id: 'flipCast', title: 'Casting from the top', hint: 'lowSmash', check: { type: 'data' }, lesson: 'flip-cast', drill: D('Impact hold', 'Half swing back, hands to hip high.', 'Swing down slowly and freeze at the ball: hands over the lead thigh.', 'Hold for two, then hit three half shots with that feel.') },
      { id: 'flipBall', title: 'Ball too far forward', hint: 'ballFwd', strong: true, check: { type: 'ask', q: 'Is the ball forward of centre in your stance?' }, lesson: 'ballpos-fwd', drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'Move the ball to just ahead of centre.', 'Hit five.') },
    ],
  },
  steep: {
    id: 'steep', group: 'lowPoint', name: 'Steep',
    headline: "You're chopping down on it", sub: 'A steep attack angle: more spin, lower launch, deep divots.',
    cue: 'Shallow the club coming down', evidence: ['aoa', 'spin', 'launch'],
    causes: [
      { id: 'steepDive', title: 'Upper body dives at the ball', hint: null, check: { type: 'ask', q: 'Does your head drop toward the ball as you swing down?' }, lesson: 'steep-dive', drill: D('Hold your height', 'Make practice swings keeping your head at the same height.', 'Hit five with that feel.') },
      { id: 'steepOtt', title: 'Coming over the top', hint: 'pathLeft', check: { type: 'data' }, lesson: 'ott-shoulders', drill: D('Pump drill', 'Swing to the top.', 'Drop the hands to hip height three times.', 'Swing through and hit.') },
      { id: 'steepBall', title: 'Ball too far back', hint: 'ballBack', strong: true, check: { type: 'test', text: 'Move the ball forward one ball width and hit three.' }, lesson: 'ballpos-back', drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'For a 7 iron, the ball sits just ahead of centre.', 'Hit five, checking the stick each time.') },
    ],
  },
  fat: {
    id: 'fat', group: 'lowPoint', name: 'Fat',
    headline: "You're hitting it heavy", sub: 'The club reaches the ground before the ball: slow ball speed, short carry.',
    cue: 'Weight forward, brush the grass after the ball', evidence: ['smash', 'spin', 'launch'],
    causes: [
      { id: 'fatWeight', title: 'Weight hangs back', hint: 'strikeMix', check: { type: 'data' }, lesson: 'flip-weight', drill: D('Towel drill', 'Lay a towel a hand-width behind the ball.', 'Hit the ball without touching the towel.', 'Hit five.') },
      { id: 'fatCast', title: 'Casting', hint: 'highLaunch', check: { type: 'data' }, lesson: 'flip-cast', drill: D('Impact hold', 'Half swing, freeze at the ball with the hands ahead.', 'Hit three half shots with that feel.') },
      { id: 'fatSink', title: 'Sinking in the downswing', hint: null, check: { type: 'ask', q: 'Do you feel yourself drop down as you swing through?' }, lesson: 'steep-dive', drill: D('Hold your height', 'Practice swings keeping your head level.', 'Hit five.') },
      { id: 'fatBall', title: 'Ball too far forward', hint: 'ballFwd', strong: true, check: { type: 'test', text: 'Move the ball back a ball width and hit three.' }, lesson: 'ballpos-fwd', drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'For a 7 iron, the ball sits just ahead of centre.', 'Hit five, checking the stick each time.') },
    ],
  },
  driverDown: {
    id: 'driverDown', group: 'lowPoint', name: 'Driver hitting down',
    headline: "You're hitting down on the driver", sub: 'A downward attack adds spin and costs carry.',
    cue: 'Tee it up, ball off the lead heel, swing up', evidence: ['aoa', 'spin', 'launch'],
    causes: [
      { id: 'drvBall', title: 'Ball too far back for a driver', hint: null, check: { type: 'test', text: 'Tee the ball off your lead heel, half the ball above the crown.' }, lesson: 'ballpos-fwd', drill: D('Driver setup', 'Ball off the lead heel, tee it high.', 'Tilt your spine slightly away from the target.', 'Hit five.') },
      { id: 'drvTilt', title: 'No spine tilt at address', hint: null, check: { type: 'test', text: 'At address, is your lead shoulder higher than your trail shoulder?' }, lesson: 'setup-weight', drill: D('Tilt setup', 'Set up with the trail shoulder lower.', 'Hit five, keeping that tilt.') },
    ],
  },
  thin: {
    id: 'thin', group: 'strike', name: 'Thin or topped',
    headline: "You're catching it thin", sub: 'Low launch and low spin: the leading edge meets the ball, or it catches the top of it.',
    cue: 'Stay in your posture', evidence: ['launch', 'spin', 'smash'],
    causes: [
      { id: 'thinExtend', title: 'Hips move toward the ball (early extension)', hint: null, check: { type: 'ask', q: 'Do you sometimes hit it off the heel or shank it too?' }, lesson: 'thin-extension', drill: D('Chair drill', 'Set up with a chair or bag just touching your backside.', 'Keep touching it through impact.', 'Hit five.') },
      { id: 'thinStand', title: 'Standing up, arms pull in', hint: 'startLeft', check: { type: 'data' }, lesson: 'thin-standup', drill: D('Stay down', 'Keep your chest over the ball until halfway through.', 'Hit five.') },
      { id: 'thinBall', title: 'Ball too far forward', hint: 'ballFwd', strong: true, check: { type: 'test', text: 'Move the ball back a ball width and hit three.' }, lesson: 'ballpos-fwd', drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'For a 7 iron, the ball sits just ahead of centre.', 'Hit five, checking the stick each time.') },
    ],
  },
  offCentre: {
    id: 'offCentre', group: 'strike', name: 'Off-centre strike',
    headline: "You're missing the centre of the face", sub: 'Launch and spin look fine but ball speed is low for your swing.',
    cue: 'Strike check: spray the face', evidence: ['smash', 'launch', 'spin'],
    causes: [
      { id: 'offToe', title: 'Standing too far, arms pull in (toe)', hint: 'startLeft', check: { type: 'test', text: 'Spray the face or use impact tape: is the mark toward the toe?' }, lesson: 'thin-standup', drill: D('Two tees', 'Two tees just wider than the clubhead, ball between.', 'Swing through without touching either.', 'Hit five.') },
      { id: 'offHeel', title: 'Weight to the toes, hips toward the ball (heel)', hint: null, check: { type: 'test', text: 'Spray the face: is the mark toward the heel?' }, lesson: 'thin-extension', drill: D('Heels down', 'Feel your weight in your heels at address and through impact.', 'Hit five.') },
      { id: 'offBall', title: 'Ball too far forward', hint: 'ballFwd', strong: true, check: { type: 'test', text: 'Move the ball back a ball width and hit three.' }, lesson: 'ballpos-fwd', drill: D('Ball position stick', 'Lay a stick from the ball to between your feet.', 'For a 7 iron, the ball sits just ahead of centre.', 'Hit five, checking the stick each time.') },
    ],
  },
  shank: {
    id: 'shank', group: 'urgent', name: 'Shank',
    headline: 'That one came off the hosel', sub: 'A shank. One is not a pattern, but here is the quick fix.',
    cue: 'Stay back on your heels, feel a toe strike', evidence: ['dir', 'smash'],
    causes: [
      { id: 'shankToes', title: 'Weight onto the toes', hint: null, check: { type: 'data' }, lesson: 'thin-extension', drill: D('Toe strike feel', 'Set up with the ball off the toe of the club.', 'Hit five easy half shots.') },
    ],
  },
  fatigue: {
    id: 'fatigue', group: 'session', name: 'Fatigue',
    headline: 'Time for a breather', sub: 'Your club speed is dropping and contact is getting worse.',
    cue: 'Take a short break', evidence: ['clubSpeed', 'smash'],
    causes: [{ id: 'tired', title: 'Tired', hint: null, check: { type: 'data' }, lesson: null, drill: D('Reset', 'Two minutes off, some water.', 'Come back with three easy half swings.') }],
  },
};
