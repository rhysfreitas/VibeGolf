// camera.html: a phone as a camera for the game. Opened from the game's QR code (the link carries the
// connection offer, #o=…), it starts the camera, answers with a QR code the game's camera reads, then
// sends its video and a data channel (stats now; putt tracks in Stage 1b) over one RTCPeerConnection.
// Opened with no offer, it tests the camera on its own. Runs on the iPhone 6's Safari 12: plain script,
// ES2017 at most (tests/cam-core.test.mjs checks).
(function () {
  'use strict';
  var C = self.CamCore, G = self.CamGrab;
  var $ = function (id) { return document.getElementById(id); };
  var ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
  var S = {
    pc: null, dc: null, stream: null, facing: 'environment', offer: null, linked: false,
    win: C.frameWindow(3000), method: '', stopFrames: null, out: null, outPrev: null, drop: null, lastDrop: null
  };
  var caps = G.caps();
  var epoch = (performance.timing && performance.timing.navigationStart) || (Date.now() - performance.now());
  var nowMs = function () { return epoch + performance.now(); };

  function show(id) {
    ['intro', 'pair', 'live'].forEach(function (k) { $(k).hidden = k !== id; });
  }
  function capsList(el) {
    el.innerHTML = G.CAP_NAMES.map(function (c) {
      return '<li class="' + (caps[c[0]] ? 'yes' : 'no') + '">' + c[1] + '</li>';
    }).join('') + (caps.recorderTypes.length ? '<li class="dim">Records ' + caps.recorderTypes.join(', ') + '</li>' : '') +
      '<li class="dim ua">' + caps.ua.replace(/</g, '') + '</li>';
  }
  function readOffer() {
    var m = /[#&?]o=([A-Za-z0-9_-]+)/.exec(location.hash + '&' + location.search);
    return m ? m[1] : null;
  }

  // ---------- the camera ----------
  function openCamera(facing) {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return Promise.reject(new Error('This browser has no camera access. On iPhone use Safari.'));
    var want = { audio: false, video: { facingMode: { ideal: facing }, frameRate: { ideal: 60 }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    return md.getUserMedia(want).catch(function (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
      return md.getUserMedia({ audio: false, video: { facingMode: facing } });
    }).then(function (stream) {
      if (S.stream) S.stream.getTracks().forEach(function (t) { t.stop(); });
      S.stream = stream; S.facing = facing;
      var v = $('video');
      v.srcObject = stream;
      var p = v.play(); if (p && p.catch) p.catch(function () { /* autoplay muted: retried on tap */ });
      S.win = C.frameWindow(3000);
      if (S.stopFrames) S.stopFrames();
      S.stopFrames = G.frames(v, function (t, info) { S.win.push(t); S.method = info.method; });
      return stream;
    });
  }
  function track() { return S.stream ? S.stream.getVideoTracks()[0] : null; }

  // ---------- the link ----------
  function waitIce(pc, ms) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === 'complete') return resolve();
      var done = false, fin = function () { if (!done) { done = true; resolve(); } };
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') fin(); });
      setTimeout(fin, ms);
    });
  }
  function pair(code) {
    var o;
    try { o = C.unpack(code); } catch (e) { return Promise.reject(new Error('The link is damaged (' + e.message + '). Scan the QR code again.')); }
    var pc = S.pc = new RTCPeerConnection({ iceServers: ICE });
    pc.ondatachannel = function (e) { setChannel(e.channel); };
    var state = function () {
      var s = pc.connectionState || pc.iceConnectionState;
      var on = s === 'connected' || s === 'completed';
      if (on && !S.linked) { S.linked = true; show('live'); }
      if (S.linked && (s === 'failed' || s === 'disconnected' || s === 'closed')) setLink(false, s === 'disconnected' ? 'Link interrupted…' : 'Link lost: scan the game\'s QR code again');
      else if (on) setLink(true, 'Linked to the game');
    };
    pc.addEventListener('connectionstatechange', state);
    pc.addEventListener('iceconnectionstatechange', state);
    return pc.setRemoteDescription({ type: 'offer', sdp: o.sdp }).then(function () {
      pc.addTrack(track(), S.stream);
      return pc.createAnswer();
    }).then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return waitIce(pc, 2500); })
      .then(function () { return C.pack(pc.localDescription.sdp, 'answer'); });
  }
  function setChannel(dc) {
    S.dc = dc;
    dc.onopen = function () { send({ t: 'hello', caps: caps, facing: S.facing, at: nowMs() }); };
    dc.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'ping') send({ t: 'pong', t0: m.t0, t1: nowMs() });
      else if (m.t === 'flip') flip();
    };
  }
  function send(m) { if (S.dc && S.dc.readyState === 'open') { try { S.dc.send(JSON.stringify(m)); } catch (e) { /* closed */ } } }
  function setLink(on, text) { $('linkDot').className = 'dot' + (on ? ' live' : S.linked ? ' warn' : ''); $('linkText').textContent = text; }

  function drawQR(canvas, text) {
    var qr = qrcode(0, 'M');
    qr.addData(text); qr.make();
    var n = qr.getModuleCount(), q = 4, side = Math.min(innerWidth, innerHeight) * 0.78;
    var cell = Math.max(3, Math.floor(side / (n + 2 * q))), px = cell * (n + 2 * q), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = px * dpr; canvas.height = px * dpr; canvas.style.width = px + 'px'; canvas.style.height = px + 'px';
    var cx = canvas.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, px, px); cx.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) cx.fillRect((c + q) * cell, (r + q) * cell, cell, cell);
  }

  // ---------- stats, every second ----------
  function fmt(x, d) { return isFinite(x) ? x.toFixed(d === undefined ? 1 : d) : '–'; }
  function outStats() {
    if (!S.pc || !S.pc.getStats) return;
    S.pc.getStats().then(function (rep) {
      rep.forEach(function (r) {
        if (r.type === 'outbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
          var prev = S.outPrev, now = { t: r.timestamp, frames: r.framesEncoded || 0, bytes: r.bytesSent || 0 };
          if (prev && now.t > prev.t) {
            S.out = { fps: 1000 * (now.frames - prev.frames) / (now.t - prev.t), kbps: 8 * (now.bytes - prev.bytes) / (now.t - prev.t),
              w: r.frameWidth, h: r.frameHeight, limit: r.qualityLimitationReason || '' };
          }
          S.outPrev = now;
        }
      });
    }).catch(function () { /* old Safari */ });
  }
  function tick() {
    var v = $('video'), st = S.win.stats(), set = {};
    var tr = track();
    if (tr && tr.getSettings) set = tr.getSettings();
    var how = S.method === 'callback' ? 'exact (frame callback)' : S.method === 'counter' ? 'frame counter, ±16 ms' : S.method === 'pixels' ? 'pixel change, ±16 ms' : '–';
    var rows = [
      ['Camera', (S.facing === 'user' ? 'front' : 'back') + (set.frameRate ? ' · asked 60, set ' + fmt(set.frameRate, 0) : '')],
      ['Frames', fmt(st.fps) + ' fps · ' + (v.videoWidth || '–') + '×' + (v.videoHeight || '–')],
      ['Timing', how],
      ['Intervals', 'sd ' + fmt(st.sd) + ' ms · p95 ' + fmt(st.p95, 0) + ' · max ' + fmt(st.max, 0)],
      ['Missed', st.n ? st.gaps + ' of ' + st.n + ' (' + fmt(100 * st.gaps / st.n, 1) + '%)' : '–']
    ];
    if (S.out) rows.push(['Sending', fmt(S.out.fps) + ' fps · ' + fmt(S.out.kbps, 0) + ' kbit/s' + (S.out.w ? ' · ' + S.out.w + '×' + S.out.h : '') + (S.out.limit && S.out.limit !== 'none' ? ' · held back by ' + S.out.limit : '')]);
    if (S.lastDrop && S.lastDrop.fit.ok) rows.push(['Drop test', 'g ' + fmt(S.lastDrop.fit.g, 2) + ' (' + (S.lastDrop.fit.err >= 0 ? '+' : '') + fmt(100 * S.lastDrop.fit.err, 1) + '%)']);
    $('stats').innerHTML = rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('');
    outStats();
    send({ t: 'stats', at: nowMs(), facing: S.facing, w: v.videoWidth, h: v.videoHeight, fps: st.fps, sd: st.sd, p95: st.p95, max: st.max, gaps: st.gaps, n: st.n, method: S.method, set: set, out: S.out });
  }

  // ---------- front / back ----------
  function flip() {
    var to = S.facing === 'user' ? 'environment' : 'user';
    var old = S.stream; S.stream = null; // keep the old track sending until the new one is ready
    openCamera(to).then(function () {
      if (old) old.getTracks().forEach(function (t) { t.stop(); });
      var snd = S.pc && S.pc.getSenders ? S.pc.getSenders()[0] : null;
      if (snd && snd.replaceTrack) return snd.replaceTrack(track());
    }).catch(function (e) { S.stream = old; alert(e.message || String(e)); });
  }

  // ---------- the drop test ----------
  var tap = null;
  function videoPoint(ev) {
    // where a tap on the preview falls in the video's own pixels (the preview is letterboxed)
    var v = $('video'), r = v.getBoundingClientRect(), vw = v.videoWidth, vh = v.videoHeight;
    var s = Math.min(r.width / vw, r.height / vh), ox = r.left + (r.width - vw * s) / 2, oy = r.top + (r.height - vh * s) / 2;
    var p = ev.changedTouches ? ev.changedTouches[0] : ev;
    return { x: (p.clientX - ox) / s, y: (p.clientY - oy) / s };
  }
  function dropStep(step) {
    var b = $('dropBody'), ov = $('overlay');
    $('drop').hidden = false;
    // while tapping the tape the sheet is a slim strip along the top, out of the way of the picture
    $('drop').className = 'sheet' + (step === 'scale' ? ' strip' : '');
    if (step === 'scale') {
      tap = { pts: [] };
      // (hold a tape upright where the ball will drop, at the same distance from the phone)
      b.innerHTML = '<p>Tape upright where you\'ll drop: tap its <b>0</b>, then its <input id="dropCm" type="number" value="100" min="20" max="200"> cm mark <span id="dropTaps" class="dim">(0/2)</span> · <button id="dropSkip" class="link">Skip</button> <button id="dropX2" class="x" aria-label="Close">×</button></p>';
      $('dropX2').onclick = closeDrop;
      $('dropSkip').onclick = function () { tap = null; dropStep('ready'); };
    } else if (step === 'ready') {
      b.innerHTML = '<p>Hold the ball still at about chest height in front of something <b>darker than the ball</b> (a door, a bin, the net). Press Go, then drop it during the countdown\'s "drop".</p>' +
        '<div class="row"><button id="dropGo" class="go">Go</button></div>';
      $('dropGo').onclick = function () { runDrop(); };
    }
    ov.hidden = false;
  }
  function onTap(ev) {
    if (!tap || $('drop').hidden) return;
    var p = videoPoint(ev);
    tap.pts.push(p);
    $('dropTaps').textContent = '(' + tap.pts.length + '/2)';
    drawOverlay(tap.pts, null);
    if (tap.pts.length === 2) {
      var d = Math.sqrt(Math.pow(tap.pts[1].x - tap.pts[0].x, 2) + Math.pow(tap.pts[1].y - tap.pts[0].y, 2));
      var cm = parseFloat($('dropCm').value) || 100;
      tap.pxPerM = d / (cm / 100);
      tap.done = true;
      setTimeout(function () { dropStep('ready'); }, 400);
    }
  }
  function drawOverlay(pts, trackPts) {
    var ov = $('overlay'), v = $('video'), r = v.getBoundingClientRect();
    var dpr = Math.min(2, devicePixelRatio || 1);
    ov.width = r.width * dpr; ov.height = r.height * dpr; ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px';
    var cx = ov.getContext('2d'), vw = v.videoWidth, vh = v.videoHeight;
    var s = Math.min(r.width / vw, r.height / vh), ox = (r.width - vw * s) / 2, oy = (r.height - vh * s) / 2;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, r.width, r.height);
    cx.fillStyle = '#ffd166'; cx.strokeStyle = '#2ec4a6'; cx.lineWidth = 2;
    (pts || []).forEach(function (p) { cx.beginPath(); cx.arc(ox + p.x * s, oy + p.y * s, 6, 0, 7); cx.fill(); });
    if (trackPts && trackPts.length) {
      cx.beginPath();
      trackPts.forEach(function (p, i) { var X = ox + p.x * s, Y = oy + p.y * s; if (i) cx.lineTo(X, Y); else cx.moveTo(X, Y); });
      cx.stroke();
    }
  }
  function beep(f) {
    try {
      var A = self.AudioContext || self.webkitAudioContext; if (!A) return;
      var ac = beep.ac || (beep.ac = new A()), o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; g.gain.value = 0.15; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.12);
    } catch (e) { /* no sound */ }
  }
  function runDrop() {
    var b = $('dropBody'), n = 3;
    beep(660); // unlocks audio on iOS (inside the tap)
    var count = function () {
      if (n > 0) { b.innerHTML = '<p class="huge">' + n + '</p>'; beep(660); n--; setTimeout(count, 700); return; }
      b.innerHTML = '<p class="huge">Drop</p>'; beep(990);
      G.dropTest($('video'), { ms: 3000, pxPerM: tap && tap.done ? tap.pxPerM : 0, onFrame: function (t) { drawOverlay(tap && tap.pts, t); } }).then(showDrop);
    };
    setTimeout(count, 300);
  }
  function showDrop(r) {
    S.lastDrop = r;
    var f = r.fit, b = $('dropBody');
    var lines = f.ok
      ? ['g = <b>' + fmt(f.g, 2) + '</b> m/s² (true 9.81: ' + (f.err >= 0 ? '+' : '') + fmt(100 * f.err, 1) + '%)',
        f.frames + ' frames in the air over ' + fmt(f.flightMs, 0) + ' ms',
        'Frame times off the curve: ±' + fmt(f.rmsMs, 1) + ' ms (' + fmt(f.rmsPx, 1) + ' px)',
        'Speed at the floor ' + fmt(f.speed, 2) + ' m/s'].concat(r.fitSteady && r.fitSteady.ok ? [
        'On the camera\'s steady clock: g ' + fmt(r.fitSteady.g, 2) + ' (' + (r.fitSteady.err >= 0 ? '+' : '') + fmt(100 * r.fitSteady.err, 1) + '%), ±' + fmt(r.fitSteady.rmsMs, 1) + ' ms; frames ' + fmt(r.steady.period, 2) + ' ms apart, seen ±' + fmt(r.steady.rmsMs, 1) + ' ms off it'] : r.steady && !r.steady.ok ? ['Frames didn\'t come steadily (±' + fmt(r.steady.rmsMs, 0) + ' ms off a steady clock), so the steady-clock fit was skipped'] : []).concat([
        'Scale from ' + (r.scaleFrom === 'tape' ? 'the tape' : 'the ball\'s size') + ' · frames by ' + r.method + ' · ' + r.w + '×' + r.h])
      : ['Didn\'t get a fit: ' + f.why + '.', 'Ball seen in ' + r.track.length + ' frames. Try a darker backdrop or more light.'];
    b.innerHTML = '<ul class="res">' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul><div class="row"><button id="dropAgain">Again</button><button id="dropDone" class="go">Done</button></div>';
    $('dropAgain').onclick = function () { dropStep('ready'); };
    $('dropDone').onclick = closeDrop;
    send({ t: 'drop', at: nowMs(), fit: f, fitSteady: r.fitSteady, steady: r.steady, method: r.method, scaleFrom: r.scaleFrom, w: r.w, h: r.h, track: r.track.map(function (p) { return [Math.round(p.t), +p.y.toFixed(1)]; }) });
  }
  function closeDrop() { $('drop').hidden = true; $('overlay').hidden = true; tap = null; }

  // ---------- start ----------
  capsList($('capsIntro')); capsList($('capsLive'));
  $('btnDrop').onclick = function () { dropStep('scale'); };
  $('dropX').onclick = closeDrop;
  $('btnFlip').onclick = flip;
  $('overlay').addEventListener('click', onTap);
  $('video').addEventListener('click', function () { var p = $('video').play(); if (p && p.catch) p.catch(function () {}); });
  $('btnCode').onclick = function () { var t = $('codeText'); t.hidden = !t.hidden; t.select(); };
  setInterval(tick, 1000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});

  S.offer = readOffer();
  if (!S.offer) {
    show('intro');
    $('btnSolo').onclick = function () {
      openCamera('environment').then(function () { show('live'); setLink(false, 'Camera only · not linked'); })
        .catch(function (e) { alert(e.message || String(e)); });
    };
    return;
  }
  show('pair');
  var start = function () {
    $('btnStart').hidden = true;
    $('pairMsg').textContent = 'Starting the camera…';
    openCamera('environment').then(function () {
      $('pairMsg').textContent = 'Making the answer code…';
      return pair(S.offer);
    }).then(function (code) {
      $('pairMsg').textContent = 'Camera ready.';
      $('qrBox').hidden = false;
      // the tail of the offer it answers, so the game ignores a stale code still on some screen
      var text = 'vgcam:a:' + code + '.' + S.offer.slice(-6);
      drawQR($('qr'), text);
      $('codeText').value = text;
    }).catch(function (e) {
      $('pairMsg').textContent = (e && e.name === 'NotAllowedError') ? 'Camera access was refused. Allow it for this site (Settings › Safari › Camera) and tap Start camera.' : (e.message || String(e));
      $('btnStart').hidden = false;
    });
  };
  $('btnStart').onclick = start;
  start();
})();
