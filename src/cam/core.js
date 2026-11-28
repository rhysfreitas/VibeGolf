// The camera link's pure core: no DOM, no WebRTC objects, nothing but maths and strings, so node can
// test it and every page can share it. It must also run on the iPhone 6's Safari 12, so it is written as
// a plain script in ES2017 at most (no ?. or ??, no class fields, no top-level await) and loads three ways:
//   - camera.html:  <script src="src/cam/core.js"></script>          → self.CamCore
//   - game modules: import './core.js'; const C = self.CamCore;       (no import/export inside, so it parses as either)
//   - node tests:   vm.runInNewContext(source, { self: ctx })         → ctx.CamCore
//
// What's in it:
//   b64u      base64url bytes <-> text (no btoa, so the same code runs in node's vm)
//   pack      a WebRTC offer or answer cut to the few hundred bytes that matter (ICE credentials, DTLS
//             fingerprint, codecs, candidates), and rebuilt into an SDP the other browser accepts. The offer
//             rides in the camera page's link (#o=…), the answer goes back as a QR code. Nothing is hosted.
//   intervals frame-interval statistics (how evenly frames arrive)
//   clock     the offset between two devices' clocks from ping/pong over the data channel
//   blob      a white ball on a darker background in a small luminance/saturation frame
//   fitDrop   g from a dropped ball's track: the timing check (a drop's speed is known exactly; a ramp's isn't)
(function (root) {
  'use strict';

  // ---------- base64url ----------
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var INV = {};
  for (var i = 0; i < A.length; i++) INV[A.charAt(i)] = i;
  INV['+'] = 62; INV['/'] = 63;
  function b64uEncode(bytes) {
    var out = '', n = bytes.length, j;
    for (j = 0; j + 2 < n; j += 3) {
      var v = (bytes[j] << 16) | (bytes[j + 1] << 8) | bytes[j + 2];
      out += A.charAt(v >> 18 & 63) + A.charAt(v >> 12 & 63) + A.charAt(v >> 6 & 63) + A.charAt(v & 63);
    }
    if (n - j === 1) { var a = bytes[j] << 16; out += A.charAt(a >> 18 & 63) + A.charAt(a >> 12 & 63); }
    else if (n - j === 2) { var b = (bytes[j] << 16) | (bytes[j + 1] << 8); out += A.charAt(b >> 18 & 63) + A.charAt(b >> 12 & 63) + A.charAt(b >> 6 & 63); }
    return out;
  }
  function b64uDecode(s) {
    s = String(s).replace(/[=\s]/g, '');
    var out = [], acc = 0, bits = 0;
    for (var k = 0; k < s.length; k++) {
      var c = INV[s.charAt(k)];
      if (c === undefined) throw new Error('bad code');
      acc = (acc << 6) | c; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
    }
    return new Uint8Array(out);
  }

  // ---------- SDP pack ----------
  // Codecs we offer and accept (the iPhone 6 encodes H.264 in hardware; VP8 is the fallback).
  var CODECS = [null,
    { name: 'VP8' },
    { name: 'H264', fmtp: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f', pl: '42e01f' },
    { name: 'H264', fmtp: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f', pl: '42001f' },
    { name: 'H264', fmtp: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640c1f', pl: '640c1f' }];
  // Header extensions worth keeping: bandwidth estimation and BUNDLE demux.
  var EXT = ['http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
    'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
    'urn:ietf:params:rtp-hdrext:sdes:mid'];
  var SETUP = ['actpass', 'active', 'passive'];
  var VERSION = 1;

  function codecId(name, fmtp) {
    name = name.toUpperCase();
    if (name === 'VP8') return 1;
    if (name !== 'H264') return 0;
    var f = (fmtp || '').toLowerCase();
    var pm = /packetization-mode=(\d)/.exec(f), pl = /profile-level-id=([0-9a-f]{6})/.exec(f);
    if (!pm || pm[1] !== '1' || !pl) return 0;
    for (var k = 2; k < CODECS.length; k++) if (CODECS[k].pl === pl[1]) return k;
    return 0;
  }

  // SDP text → { sections: [{ kind, mid, dir, pts:[{pt, id}], ext:{}, ssrc, sctp, maxMsg }], ufrag, pwd, fp, setup, cands }
  function parseSdp(sdp) {
    var lines = String(sdp).split(/\r?\n/), out = { sections: [], cands: [] }, sec = null, rtp = {}, fmtp = {};
    function close() {
      if (!sec) return;
      if (sec.kind === 'video') {
        sec.pts = [];
        for (var q = 0; q < sec.order.length; q++) {
          var pt = sec.order[q], r = rtp[pt];
          if (!r) continue;
          var id = codecId(r, fmtp[pt]);
          if (id) sec.pts.push({ pt: pt, id: id });
        }
      }
      out.sections.push(sec); rtp = {}; fmtp = {};
    }
    for (var k = 0; k < lines.length; k++) {
      var l = lines[k], m;
      if ((m = /^m=(\w+) \d+ [^ ]+(.*)$/.exec(l))) {
        close();
        sec = { kind: m[1], mid: '', dir: 'sendrecv', order: m[2].trim().split(/\s+/).map(Number), ext: {}, ssrc: 0 };
        continue;
      }
      if (!sec) continue;
      if ((m = /^a=mid:(.+)$/.exec(l))) sec.mid = m[1].trim();
      else if ((m = /^a=(sendrecv|sendonly|recvonly|inactive)$/.exec(l))) sec.dir = m[1];
      else if ((m = /^a=rtpmap:(\d+) ([^/]+)\//.exec(l))) rtp[+m[1]] = m[2];
      else if ((m = /^a=fmtp:(\d+) (.*)$/.exec(l))) fmtp[+m[1]] = m[2];
      else if ((m = /^a=extmap:(\d+)(?:\/\w+)? (\S+)/.exec(l))) { var e = EXT.indexOf(m[2]); if (e >= 0) sec.ext[e] = +m[1]; }
      else if ((m = /^a=ssrc:(\d+) /.exec(l))) { if (!sec.ssrc) sec.ssrc = +m[1]; }
      else if ((m = /^a=ssrc-group:FID (\d+)/.exec(l))) sec.ssrc = +m[1];
      else if ((m = /^a=sctp-port:(\d+)/.exec(l))) sec.sctp = +m[1];
      else if ((m = /^a=max-message-size:(\d+)/.exec(l))) sec.maxMsg = +m[1];
      else if ((m = /^a=ice-ufrag:(.+)$/.exec(l))) out.ufrag = out.ufrag || m[1].trim();
      else if ((m = /^a=ice-pwd:(.+)$/.exec(l))) out.pwd = out.pwd || m[1].trim();
      else if ((m = /^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/.exec(l))) out.fp = out.fp || m[1];
      else if ((m = /^a=setup:(\w+)/.exec(l))) out.setup = out.setup || m[1];
      else if ((m = /^a=candidate:\S+ (\d) (\w+) \d+ (\S+) (\d+) typ (\w+)/.exec(l))) {
        // the first section's candidates serve the whole bundle
        if (out.sections.length === 0 && m[1] === '1' && m[2].toLowerCase() === 'udp') out.cands.push({ addr: m[3], port: +m[4], type: m[5] });
      }
    }
    close();
    return out;
  }

  function ipv4(s) {
    var p = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
    return p ? [+p[1], +p[2], +p[3], +p[4]] : null;
  }
  function mdnsUuid(s) {
    var p = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(s);
    if (!p) return null;
    var hex = (p[1] + p[2] + p[3] + p[4] + p[5]).toLowerCase(), b = [];
    for (var k = 0; k < 32; k += 2) b.push(parseInt(hex.substr(k, 2), 16));
    return b;
  }
  function ipv6(s) {
    if (s.indexOf(':') < 0 || /[^0-9a-f:]/i.test(s)) return null;
    var halves = s.split('::'), head = halves[0] ? halves[0].split(':') : [], tail = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
    if (halves.length > 2) return null;
    var fill = 8 - head.length - tail.length, words = head.slice();
    if (halves.length === 1 && fill !== 0) return null;
    for (var k = 0; k < fill; k++) words.push('0');
    words = words.concat(tail);
    var b = [];
    for (var w = 0; w < 8; w++) { var v = parseInt(words[w], 16) || 0; b.push(v >> 8, v & 255); }
    return b;
  }

  // Candidate kinds in the packed form.
  var C_HOST4 = 0, C_SRFLX4 = 1, C_MDNS = 2, C_HOST6 = 3, C_SRFLX6 = 4;

  // Pack an offer or answer. type: 'offer' | 'answer'. Returns base64url text.
  function pack(sdp, type) {
    var s = parseSdp(sdp);
    if (!s.ufrag || !s.pwd || !s.fp) throw new Error('SDP has no ICE credentials or fingerprint');
    var bytes = [VERSION];
    var vid = null, dat = null;
    for (var k = 0; k < s.sections.length; k++) {
      if (s.sections[k].kind === 'video' && !vid) vid = s.sections[k];
      if (s.sections[k].kind === 'application' && !dat) dat = s.sections[k];
    }
    if (!vid) throw new Error('SDP has no video');
    if (!vid.pts.length) throw new Error('No codec both sides can use (need H.264 or VP8)');
    var setup = SETUP.indexOf(s.setup || 'actpass');
    bytes.push((type === 'answer' ? 1 : 0) | ((setup < 0 ? 0 : setup) << 1) | (dat ? 8 : 0) | (vid === s.sections[0] ? 0 : 16));
    function str(t) { bytes.push(t.length); for (var q = 0; q < t.length; q++) bytes.push(t.charCodeAt(q) & 255); }
    str(s.ufrag); str(s.pwd);
    var fp = s.fp.split(':');
    if (fp.length !== 32) throw new Error('fingerprint is not sha-256');
    for (var f = 0; f < 32; f++) bytes.push(parseInt(fp[f], 16));
    str(vid.mid); str(dat ? dat.mid : '');
    bytes.push(vid.pts.length);
    for (var p = 0; p < vid.pts.length; p++) bytes.push(vid.pts[p].pt, vid.pts[p].id);
    for (var x = 0; x < EXT.length; x++) bytes.push(vid.ext[x] || 0);
    var ss = vid.ssrc >>> 0;
    bytes.push(ss >>> 24 & 255, ss >>> 16 & 255, ss >>> 8 & 255, ss & 255);
    if (dat) {
      var port = dat.sctp || 5000, mm = dat.maxMsg || 65536;
      bytes.push(port >> 8, port & 255, mm >>> 24 & 255, mm >>> 16 & 255, mm >>> 8 & 255, mm & 255);
    }
    // candidates: IPv4 first, at most 8
    var cs = [];
    for (var c = 0; c < s.cands.length; c++) {
      var cd = s.cands[c], srflx = cd.type === 'srflx', a;
      if (cd.type !== 'host' && !srflx) continue;
      if ((a = ipv4(cd.addr))) cs.push({ k: srflx ? C_SRFLX4 : C_HOST4, a: a, port: cd.port, o: 0 });
      else if (!srflx && (a = mdnsUuid(cd.addr))) cs.push({ k: C_MDNS, a: a, port: cd.port, o: 1 });
      else if ((a = ipv6(cd.addr))) cs.push({ k: srflx ? C_SRFLX6 : C_HOST6, a: a, port: cd.port, o: 2 });
    }
    cs.sort(function (u, v) { return u.o - v.o; });
    cs = cs.slice(0, 8);
    bytes.push(cs.length);
    for (var d = 0; d < cs.length; d++) {
      bytes.push(cs[d].k);
      for (var e2 = 0; e2 < cs[d].a.length; e2++) bytes.push(cs[d].a[e2]);
      bytes.push(cs[d].port >> 8, cs[d].port & 255);
    }
    return b64uEncode(bytes);
  }

  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }

  // Rebuild an SDP from packed text. Returns { type, sdp, info } (info: what was in it, for the page).
  function unpack(text) {
    var b = b64uDecode(text), i = 0;
    function u8() { if (i >= b.length) throw new Error('code is cut short'); return b[i++]; }
    function str() { var n = u8(), t = ''; for (var q = 0; q < n; q++) t += String.fromCharCode(u8()); return t; }
    if (u8() !== VERSION) throw new Error('code from a different version');
    var flags = u8(), answer = !!(flags & 1), setup = SETUP[(flags >> 1) & 3] || 'actpass', hasData = !!(flags & 8), dataFirst = !!(flags & 16);
    var ufrag = str(), pwd = str(), fp = [];
    for (var f = 0; f < 32; f++) fp.push(hex2(u8()));
    var vmid = str(), dmid = str();
    var npt = u8(), pts = [];
    for (var p = 0; p < npt; p++) { var pt = u8(), id = u8(); if (CODECS[id]) pts.push({ pt: pt, id: id }); }
    var ext = [];
    for (var x = 0; x < EXT.length; x++) ext.push(u8());
    var ssrc = ((u8() << 24) >>> 0) + (u8() << 16) + (u8() << 8) + u8();
    var sctp = 5000, maxMsg = 65536;
    if (hasData) { sctp = (u8() << 8) | u8(); maxMsg = ((u8() << 24) >>> 0) + (u8() << 16) + (u8() << 8) + u8(); }
    var n = u8(), cands = [];
    for (var c = 0; c < n; c++) {
      var k = u8(), len = k === C_HOST4 || k === C_SRFLX4 ? 4 : 16, a = [];
      for (var q = 0; q < len; q++) a.push(u8());
      var port = (u8() << 8) | u8(), addr;
      if (len === 4) addr = a.join('.');
      else if (k === C_MDNS) {
        var h = a.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('');
        addr = h.substr(0, 8) + '-' + h.substr(8, 4) + '-' + h.substr(12, 4) + '-' + h.substr(16, 4) + '-' + h.substr(20, 12) + '.local';
      } else {
        var w = [];
        for (var z = 0; z < 16; z += 2) w.push(((a[z] << 8) | a[z + 1]).toString(16));
        addr = w.join(':');
      }
      cands.push({ kind: k, addr: addr, port: port, type: k === C_SRFLX4 || k === C_SRFLX6 ? 'srflx' : 'host' });
    }
    if (!pts.length) throw new Error('code has no codec');
    var L = [];
    L.push('v=0', 'o=- ' + (answer ? '2' : '1') + String(ssrc || 1000 + cands.length) + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0');
    var mids = hasData ? (dataFirst ? [dmid, vmid] : [vmid, dmid]) : [vmid];
    L.push('a=group:BUNDLE ' + mids.join(' '));
    L.push('a=msid-semantic: WMS' + (answer ? ' cam' : ''));
    var first = cands[0], cline = first && (first.kind === C_HOST4 || first.kind === C_SRFLX4) ? 'c=IN IP4 ' + first.addr : first && first.kind !== C_MDNS ? 'c=IN IP6 ' + first.addr : 'c=IN IP4 0.0.0.0';
    var mport = first ? first.port : 9;
    function common(mid) {
      L.push('a=ice-ufrag:' + ufrag, 'a=ice-pwd:' + pwd, 'a=fingerprint:sha-256 ' + fp.join(':'), 'a=setup:' + setup, 'a=mid:' + mid);
    }
    function candLines() {
      for (var q = 0; q < cands.length; q++) {
        var cd = cands[q], pref = cd.type === 'host' ? 126 : 100;
        var prio = pref * 16777216 + (65535 - q) * 256 + 255;
        L.push('a=candidate:' + (q + 1) + ' 1 udp ' + prio + ' ' + cd.addr + ' ' + cd.port + ' typ ' + cd.type + (cd.type === 'srflx' ? ' raddr 0.0.0.0 rport 0' : '') + ' generation 0');
      }
    }
    function video() {
      L.push('m=video ' + mport + ' UDP/TLS/RTP/SAVPF ' + pts.map(function (v) { return v.pt; }).join(' '), cline, 'a=rtcp:9 IN IP4 0.0.0.0');
      candLines(); common(vmid);
      for (var y = 0; y < EXT.length; y++) if (ext[y]) L.push('a=extmap:' + ext[y] + ' ' + EXT[y]);
      L.push(answer ? 'a=sendonly' : 'a=recvonly');
      if (answer) L.push('a=msid:cam v0');
      L.push('a=rtcp-mux', 'a=rtcp-rsize');
      for (var v = 0; v < pts.length; v++) {
        var cd2 = CODECS[pts[v].id], t = pts[v].pt;
        L.push('a=rtpmap:' + t + ' ' + cd2.name + '/90000', 'a=rtcp-fb:' + t + ' goog-remb');
        if (ext[1]) L.push('a=rtcp-fb:' + t + ' transport-cc');
        L.push('a=rtcp-fb:' + t + ' ccm fir', 'a=rtcp-fb:' + t + ' nack', 'a=rtcp-fb:' + t + ' nack pli');
        if (cd2.fmtp) L.push('a=fmtp:' + t + ' ' + cd2.fmtp);
      }
      if (answer && ssrc) L.push('a=ssrc:' + ssrc + ' cname:cam', 'a=ssrc:' + ssrc + ' msid:cam v0');
    }
    function data(withCands) {
      L.push('m=application ' + (withCands ? mport : 9) + ' UDP/DTLS/SCTP webrtc-datachannel', withCands ? cline : 'c=IN IP4 0.0.0.0');
      if (withCands) candLines();
      common(dmid);
      L.push('a=sctp-port:' + sctp, 'a=max-message-size:' + maxMsg);
    }
    if (hasData && dataFirst) { data(true); video(); } else { video(); if (hasData) data(false); }
    return {
      type: answer ? 'answer' : 'offer', sdp: L.join('\r\n') + '\r\n',
      info: { codecs: pts.map(function (v) { return CODECS[v.id].name + (CODECS[v.id].pl ? ' ' + CODECS[v.id].pl : ''); }), cands: cands.map(function (v) { return v.type + ' ' + v.addr + ':' + v.port; }), ssrc: ssrc, data: hasData }
    };
  }

  // ---------- frame intervals ----------
  // times: frame times in ms (ascending). Returns fps, interval mean/sd/p95/max, and how many intervals
  // were long enough to mean a frame went missing (over 1.5× the median).
  function intervals(times) {
    var d = [];
    for (var k = 1; k < times.length; k++) { var g = times[k] - times[k - 1]; if (g > 0) d.push(g); }
    if (!d.length) return { n: 0, fps: 0, mean: 0, sd: 0, p95: 0, max: 0, median: 0, gaps: 0 };
    var sum = 0; for (var a = 0; a < d.length; a++) sum += d[a];
    var mean = sum / d.length, v = 0;
    for (var b = 0; b < d.length; b++) v += (d[b] - mean) * (d[b] - mean);
    var s = d.slice().sort(function (x, y) { return x - y; });
    var med = s[Math.floor(s.length / 2)], gaps = 0;
    for (var c = 0; c < d.length; c++) if (d[c] > 1.5 * med) gaps++;
    var span = times[times.length - 1] - times[0];
    return { n: d.length, fps: span > 0 ? d.length * 1000 / span : 0, mean: mean, sd: Math.sqrt(v / d.length), p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], max: s[s.length - 1], median: med, gaps: gaps };
  }

  // Frame times seen late and unevenly (a frame counter read at each screen refresh: up to ~16 ms late)
  // put back on the camera's own steady clock. A camera sensor takes frames at a fixed period, so each
  // frame's index (counting any the page never saw: an interval of about two periods is one frame lost)
  // against its time is a straight line; fitting it gives every frame's real time to within the camera's
  // own steadiness. Returns { times, period, rmsMs (how far the seen times sat off the line), lost, ok }
  // (ok false: the frames didn't come steadily, so the line isn't to be trusted).
  function steady(times) {
    var n = times.length;
    if (n < 4) return { times: times.slice(), period: NaN, rmsMs: NaN, lost: 0, ok: false };
    // the period: start from the whole span as if no frame were lost (the median interval is biased by
    // the screen refresh), count lost frames with it, then take the span over the frame count again
    var span = times[n - 1] - times[0], T = span / (n - 1), idx, lost;
    for (var it = 0; it < 3; it++) {
      idx = [0]; lost = 0;
      for (var j = 1; j < n; j++) {
        var step = Math.max(1, Math.round((times[j] - times[j - 1]) / T));
        lost += step - 1; idx.push(idx[j - 1] + step);
      }
      T = span / idx[n - 1];
    }
    var fit = function (use) {
      var m = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (var q = 0; q < n; q++) { if (!use[q]) continue; m++; sx += idx[q]; sy += times[q]; sxx += idx[q] * idx[q]; sxy += idx[q] * times[q]; }
      var den = m * sxx - sx * sx, b = den ? (m * sxy - sx * sy) / den : T, a = (sy - b * sx) / m;
      return { a: a, b: b };
    };
    var use = times.map(function () { return true; }), f = fit(use), r2 = 0, i2;
    for (i2 = 0; i2 < n; i2++) r2 += Math.pow(times[i2] - (f.a + f.b * idx[i2]), 2);
    var sd = Math.sqrt(r2 / n);
    // one pass dropping far-off points (a stall), then refit
    var cut = Math.max(3 * sd, 1);
    for (i2 = 0; i2 < n; i2++) use[i2] = Math.abs(times[i2] - (f.a + f.b * idx[i2])) <= cut;
    f = fit(use);
    var out = [], rr = 0;
    for (i2 = 0; i2 < n; i2++) { out.push(f.a + f.b * idx[i2]); rr += Math.pow(times[i2] - out[i2], 2); }
    var rms = Math.sqrt(rr / n);
    // reading at screen refreshes puts a frame up to ~16 ms late (about ±5 ms about the line); much more
    // than that and the frames weren't coming steadily, so the line isn't the camera's clock
    return { times: out, period: f.b, rmsMs: rms, lost: lost, ok: rms <= 8 };
  }

  // A rolling window of frame times, for live readouts.
  function frameWindow(ms) {
    var t = [];
    return {
      push: function (x) { t.push(x); while (t.length > 2 && t[t.length - 1] - t[0] > ms) t.shift(); },
      stats: function () { return intervals(t); },
      times: function () { return t.slice(); }
    };
  }

  // ---------- clock offset ----------
  // samples: [{ t0, t1, t2 }]: t0 sent (here), t1 the other side's clock when it answered, t2 received (here).
  // offset = their clock − ours, from the sample with the shortest round trip.
  function clock(samples) {
    var best = null;
    for (var k = 0; k < samples.length; k++) {
      var s = samples[k], rtt = s.t2 - s.t0;
      if (rtt < 0) continue;
      if (!best || rtt < best.rtt) best = { rtt: rtt, offset: s.t1 - (s.t0 + s.t2) / 2 };
    }
    return best || { rtt: NaN, offset: NaN };
  }

  // ---------- ball finding ----------
  // lum, sat: Uint8 arrays w×h (0–255). bg: a background luminance frame (or null). Finds the largest
  // patch of bright, unsaturated pixels that differ from the background: a white ball against something
  // darker. Returns { x, y, n, w, h } in pixels (x, y the patch's centroid) or null.
  function blob(lum, sat, bg, w, h, o) {
    o = o || {};
    var T = o.lum || 170, S = o.sat || 70, D = o.diff || 40, minN = o.min || 4;
    var N = w * h, mask = new Uint8Array(N), lab = new Int32Array(N), k;
    for (k = 0; k < N; k++) mask[k] = lum[k] >= T && sat[k] <= S && (!bg || Math.abs(lum[k] - bg[k]) >= D) ? 1 : 0;
    var best = null, stack = new Int32Array(N), id = 0;
    for (k = 0; k < N; k++) {
      if (!mask[k] || lab[k]) continue;
      id++;
      var top = 0, n = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
      stack[top++] = k; lab[k] = id;
      while (top) {
        var q = stack[--top], qx = q % w, qy = (q - qx) / w;
        n++; sx += qx; sy += qy;
        if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
        if (qx > 0 && mask[q - 1] && !lab[q - 1]) { lab[q - 1] = id; stack[top++] = q - 1; }
        if (qx < w - 1 && mask[q + 1] && !lab[q + 1]) { lab[q + 1] = id; stack[top++] = q + 1; }
        if (qy > 0 && mask[q - w] && !lab[q - w]) { lab[q - w] = id; stack[top++] = q - w; }
        if (qy < h - 1 && mask[q + w] && !lab[q + w]) { lab[q + w] = id; stack[top++] = q + w; }
      }
      if (n >= minN && (!best || n > best.n)) best = { x: sx / n + 0.5, y: sy / n + 0.5, n: n, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    return best;
  }

  // RGBA bytes → luminance and saturation (0–255).
  function lumSat(rgba, N) {
    var lum = new Uint8Array(N), sat = new Uint8Array(N);
    for (var k = 0, j = 0; k < N; k++, j += 4) {
      var r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
      var mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      lum[k] = (r * 77 + g * 150 + b * 29) >> 8;
      sat[k] = mx ? Math.round(255 * (mx - mn) / mx) : 0;
    }
    return { lum: lum, sat: sat };
  }

  // ---------- the drop test ----------
  // pts: [{ t (ms), y (px, down = +) }] for the ball, from rest in the hand through the fall to the floor.
  // pxPerM: the scale (tapped on a tape measure, or from the ball's size). Finds the flight (after the
  // release, before the first bounce), fits y = a + b·t + c·t², and gives g = 2c / scale. A ball dropped
  // falls at 9.81 m/s² whatever the camera, so the error in g is the error in the frame times and scale.
  function fitDrop(pts, pxPerM) {
    var res = { ok: false, frames: 0 };
    if (!pts || pts.length < 6) { res.why = 'too few frames with the ball in them'; return res; }
    // rest: the median y of the first few points; release: the last point still within 1.5 px of rest
    // before the ball starts moving down for good.
    var ys = pts.slice(0, Math.min(5, pts.length)).map(function (p) { return p.y; }).sort(function (a, b) { return a - b; });
    var rest = ys[Math.floor(ys.length / 2)], r = -1;
    for (var k = 0; k < pts.length - 2; k++) {
      if (pts[k].y - rest <= 1.5 && pts[k + 1].y - rest > 1.5 && pts[k + 2].y > pts[k + 1].y) { r = k; break; }
    }
    if (r < 0) { res.why = 'never saw the ball start to fall'; return res; }
    // flight: strictly increasing y after the release, until it stops increasing (the floor)
    var fl = [];
    for (var j = r + 1; j < pts.length; j++) {
      if (fl.length && pts[j].y <= fl[fl.length - 1].y) break;
      fl.push(pts[j]);
    }
    if (fl.length >= 3) fl.pop(); // the last one may be squashed on the floor
    res.frames = fl.length;
    if (fl.length < 4) { res.why = 'only ' + fl.length + ' frames in the air (need 4)'; return res; }
    var t0 = fl[0].t, S = [0, 0, 0, 0, 0], Y = [0, 0, 0];
    for (var q = 0; q < fl.length; q++) {
      var t = (fl[q].t - t0) / 1000, y = fl[q].y;
      S[0] += 1; S[1] += t; S[2] += t * t; S[3] += t * t * t; S[4] += t * t * t * t;
      Y[0] += y; Y[1] += t * y; Y[2] += t * t * y;
    }
    var sol = solve3([[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]], Y);
    if (!sol) { res.why = 'fit failed'; return res; }
    var rss = 0;
    for (var e = 0; e < fl.length; e++) {
      var tt = (fl[e].t - t0) / 1000, yy = sol[0] + sol[1] * tt + sol[2] * tt * tt;
      rss += (fl[e].y - yy) * (fl[e].y - yy);
    }
    var rms = Math.sqrt(rss / fl.length);
    res.ok = true;
    res.g = 2 * sol[2] / pxPerM;
    res.err = res.g / 9.81 - 1;
    res.rmsPx = rms;
    // the residual as a timing error: px off the curve ÷ px/s of the ball at the middle of the flight
    var tm = (fl[fl.length - 1].t - t0) / 2000, vmid = sol[1] + 2 * sol[2] * tm;
    res.rmsMs = vmid > 0 ? 1000 * rms / vmid : NaN;
    res.flightMs = fl[fl.length - 1].t - t0;
    res.speed = (sol[1] + 2 * sol[2] * (fl[fl.length - 1].t - t0) / 1000) / pxPerM; // m/s at the last flight frame
    return res;
  }
  function solve3(M, v) {
    var a = [M[0].concat([v[0]]), M[1].concat([v[1]]), M[2].concat([v[2]])];
    for (var c = 0; c < 3; c++) {
      var p = c;
      for (var r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      if (Math.abs(a[p][c]) < 1e-12) return null;
      var tmp = a[c]; a[c] = a[p]; a[p] = tmp;
      for (var r2 = 0; r2 < 3; r2++) {
        if (r2 === c) continue;
        var f = a[r2][c] / a[c][c];
        for (var k = c; k < 4; k++) a[r2][k] -= f * a[c][k];
      }
    }
    return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
  }

  root.CamCore = {
    b64u: { encode: b64uEncode, decode: b64uDecode },
    parseSdp: parseSdp, pack: pack, unpack: unpack,
    intervals: intervals, frameWindow: frameWindow, clock: clock, steady: steady,
    blob: blob, lumSat: lumSat, fitDrop: fitDrop,
    BALL_M: 0.04267
  };
})(typeof self !== 'undefined' ? self : this);
