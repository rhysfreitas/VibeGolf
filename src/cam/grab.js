// Camera helpers that need a page: what this browser can do, a time for every new video frame, small
// luminance/saturation samples of a frame, and the drop test. Plain script in ES2017 at most, like core.js,
// because camera.html runs it on the iPhone 6's Safari 12; game modules load it with a bare import and read
// self.CamGrab. Needs core.js first (self.CamCore).
(function (root) {
  'use strict';
  var C = root.CamCore;

  // ---------- what this browser can do ----------
  function caps() {
    var n = root.navigator || {}, md = n.mediaDevices, V = root.HTMLVideoElement;
    var mr = typeof root.MediaRecorder === 'function', types = [];
    if (mr && root.MediaRecorder.isTypeSupported) {
      ['video/mp4', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm;codecs=h264', 'video/webm'].forEach(function (t) {
        try { if (root.MediaRecorder.isTypeSupported(t)) types.push(t); } catch (e) { /* no */ }
      });
    }
    var tc = root.RTCRtpTransceiver;
    return {
      secure: !!root.isSecureContext,
      getUserMedia: !!(md && md.getUserMedia),
      webrtc: typeof root.RTCPeerConnection === 'function',
      transceivers: !!(root.RTCPeerConnection && root.RTCPeerConnection.prototype.addTransceiver),
      codecPrefs: !!(tc && tc.prototype && tc.prototype.setCodecPreferences),
      mediaRecorder: mr, recorderTypes: types,
      frameCallback: !!(V && V.prototype && 'requestVideoFrameCallback' in V.prototype),
      playbackQuality: !!(V && V.prototype && 'getVideoPlaybackQuality' in V.prototype),
      bluetooth: !!n.bluetooth,
      wakeLock: !!n.wakeLock,
      barcode: typeof root.BarcodeDetector === 'function',
      battery: typeof n.getBattery === 'function',
      ua: n.userAgent || ''
    };
  }
  var CAP_NAMES = [['secure', 'Secure page'], ['getUserMedia', 'Camera (getUserMedia)'], ['webrtc', 'Peer link (RTCPeerConnection)'],
    ['mediaRecorder', 'Recording (MediaRecorder)'], ['frameCallback', 'Frame times (requestVideoFrameCallback)'], ['playbackQuality', 'Frame counter'],
    ['bluetooth', 'Web Bluetooth'], ['wakeLock', 'Keep screen on']];

  // ---------- a time for every new frame ----------
  // cb(t, info): t = performance.now() when the frame was seen (or its presentation time, where the browser
  // gives one). How it knows a frame is new: 'callback' (requestVideoFrameCallback: exact), 'counter' (the
  // decoded-frame count went up; seen at the next screen refresh, so up to ~16 ms late) or 'pixels' (a tiny
  // copy of the frame changed; the same lateness). Returns stop().
  function frames(video, cb) {
    var stopped = false, raf = root.requestAnimationFrame.bind(root);
    if (typeof video.requestVideoFrameCallback === 'function') {
      var step = function (now, meta) {
        if (stopped) return;
        cb(meta && meta.presentationTime ? meta.presentationTime : now, { method: 'callback', approx: false, meta: meta });
        video.requestVideoFrameCallback(step);
      };
      video.requestVideoFrameCallback(step);
      return function () { stopped = true; };
    }
    var count = function () {
      if (video.getVideoPlaybackQuality) { var q = video.getVideoPlaybackQuality(); if (q && q.totalVideoFrames) return q.totalVideoFrames; }
      if (typeof video.webkitDecodedFrameCount === 'number' && video.webkitDecodedFrameCount) return video.webkitDecodedFrameCount;
      return -1;
    };
    var last = -1, method = null, cv = null, cx = null, prev = null;
    var tick = function (now) {
      if (stopped) return;
      raf(tick);
      if (video.readyState < 2) return;
      var c = count();
      if (c >= 0 && method !== 'pixels') {
        method = 'counter';
        if (c !== last) { if (last >= 0) cb(now, { method: method, approx: true, n: c - last }); last = c; }
        return;
      }
      method = 'pixels';
      if (!cv) { cv = document.createElement('canvas'); cv.width = 16; cv.height = 9; cx = cv.getContext('2d'); }
      cx.drawImage(video, 0, 0, 16, 9);
      var d = cx.getImageData(0, 0, 16, 9).data, same = !!prev;
      if (prev) for (var k = 0; k < d.length; k += 4) if (d[k] !== prev[k] || d[k + 1] !== prev[k + 1]) { same = false; break; }
      if (!same) { if (prev) cb(now, { method: method, approx: true }); prev = new Uint8ClampedArray(d); }
    };
    raf(tick);
    return function () { stopped = true; };
  }

  // ---------- small samples of a frame ----------
  function sampler(maxSide) {
    var cv = document.createElement('canvas'), cx = cv.getContext('2d');
    return {
      grab: function (video) {
        var vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return null;
        var s = Math.min(1, maxSide / Math.max(vw, vh)), w = Math.max(1, Math.round(vw * s)), h = Math.max(1, Math.round(vh * s));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        cx.drawImage(video, 0, 0, w, h);
        var px = cx.getImageData(0, 0, w, h).data, ls = C.lumSat(px, w * h);
        return { lum: ls.lum, sat: ls.sat, w: w, h: h, scale: w / vw };
      }
    };
  }

  // ---------- the drop test ----------
  // Records the ball for `ms` after start, from the frames this page sees (the camera phone's own frames,
  // never the received stream). opts: { ms, maxSide, pxPerM (in full-video pixels; else the ball's size at
  // rest is the scale), onFrame(track) }. Resolves with { fit, track, method, w, h, scaleFrom }.
  function dropTest(video, opts) {
    opts = opts || {};
    var ms = opts.ms || 4000, sm = sampler(opts.maxSide || 320), track = [], t0 = -1, method = '', all = [];
    return new Promise(function (resolve) {
      var stop = frames(video, function (t, info) {
        method = info.method;
        if (t0 < 0) t0 = t;
        all.push(t);
        var f = sm.grab(video);
        if (!f) return;
        // no background frame: the ball held at rest would be in it. A darker backdrop does the job instead.
        var b = C.blob(f.lum, f.sat, null, f.w, f.h, opts.blob);
        if (b) track.push({ t: t, i: all.length - 1, x: b.x / f.scale, y: b.y / f.scale, d: Math.max(b.w, b.h) / f.scale });
        if (opts.onFrame) opts.onFrame(track);
        if (t - t0 > ms) {
          stop();
          var scaleFrom = opts.pxPerM ? 'tape' : 'ball', ppm = opts.pxPerM;
          if (!ppm) {
            var ds = track.slice(0, 5).map(function (p) { return p.d; }).sort(function (a, c) { return a - c; });
            ppm = ds.length ? ds[Math.floor(ds.length / 2)] / C.BALL_M : 0;
          }
          var fit = ppm ? C.fitDrop(track, ppm) : { ok: false, why: 'no scale (ball not found at rest)' };
          // where frame times are only approximate, also fit on the camera's steady clock
          var st = null, fitSteady = null;
          if (method !== 'callback' && ppm) {
            st = C.steady(all);
            if (st.ok) fitSteady = C.fitDrop(track.map(function (p) { return { t: st.times[p.i], y: p.y }; }), ppm);
          }
          resolve({ fit: fit, fitSteady: fitSteady, steady: st && { period: st.period, rmsMs: st.rmsMs, lost: st.lost, ok: st.ok },
            track: track, method: method, w: video.videoWidth, h: video.videoHeight, scaleFrom: scaleFrom, pxPerM: ppm });
        }
      });
    });
  }

  root.CamGrab = { caps: caps, CAP_NAMES: CAP_NAMES, frames: frames, sampler: sampler, dropTest: dropTest };
})(typeof self !== 'undefined' ? self : this);
