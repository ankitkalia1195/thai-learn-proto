/* TTS helper: one utterance at a time, Promise-based, never rejects, no alert().
   say(text, {rate, speakerId}) picks a per-character voice from installed th-TH voices. */
(function (global) {
  'use strict';
  var ok = 'speechSynthesis' in global && typeof SpeechSynthesisUtterance !== 'undefined';
  var voice = null, token = 0, listeners = [], cache = {}, perChar = true;

  var FEMALE = /female|kanya|narisa|premwadee|achara|nuch|google|[-_]thf|ผู้หญิง/i;
  var MALE = /\bmale\b|pattara|niwat|[-_]thm|ผู้ชาย/i;
  function genderOf(v) { var n = (v.name || '') + ' ' + (v.voiceURI || ''); if (FEMALE.test(n)) return 'f'; if (MALE.test(n)) return 'm'; return ''; }

  function allVoices() { try { return ok ? speechSynthesis.getVoices() : []; } catch (e) { return []; } }
  function thVoices() {
    return allVoices().filter(function (v) { return /^th([-_]|$)/i.test(v.lang); })
      .sort(function (a, b) { return (b.localService ? 1 : 0) - (a.localService ? 1 : 0); });
  }
  function pick() {
    if (!ok) return null;
    var th = thVoices();
    voice = th[0] || null;
    return voice;
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  /* choose {voice, pitch, rate} for a speaker; cached per speaker id */
  function profileFor(id) {
    var prof = (global.Chars && global.Chars.VOICES && global.Chars.VOICES[id]) || null;
    if (!perChar || !prof) return { voice: voice, pitch: 1, rate: 1 };
    var th = thVoices(), key = id + '|' + prof.gender + '|' + th.length;
    if (cache[key]) return cache[key];
    var pool = th.filter(function (v) { return genderOf(v) === prof.gender; }), matched = pool.length > 0, v;
    if (!matched) {
      /* no voice of the right gender: use an untagged one if any, else the default; shift pitch instead */
      pool = th.filter(function (v) { return !genderOf(v); });
      if (!pool.length) pool = th;
    }
    v = null;
    (prof.hints || []).some(function (h) {
      return pool.some(function (c) { if (c.name.toLowerCase().indexOf(h) >= 0) { v = c; return true; } return false; });
    });
    if (!v && pool.length) v = pool[hash(id) % pool.length];
    var p = prof.pitch || 1;
    /* a real voice of the right gender already carries most of the difference */
    var pitch = (matched && !prof.extreme) ? 1 + (p - 1) * 0.6 : p;
    var r = { voice: v, pitch: Math.max(0.1, Math.min(2, pitch)), rate: prof.rate || 1, matched: matched };
    cache[key] = r; return r;
  }
  function voiceInfo() {
    var th = thVoices();
    return { count: th.length, female: th.some(function (v) { return genderOf(v) === 'f'; }), male: th.some(function (v) { return genderOf(v) === 'm'; }), perChar: perChar };
  }
  if (ok) {
    try { speechSynthesis.addEventListener('voiceschanged', function () { cache = {}; pick(); listeners.forEach(function (f) { f(); }); }); } catch (e) {}
    pick();
  }
  /* voicesLoaded false => we cannot yet claim there is no Thai voice */
  function status() {
    if (!ok) return 'unsupported';
    if (pick()) return 'ok';
    return allVoices().length ? 'no-thai' : 'unknown';
  }
  function say(text, opts) {
    opts = opts || {};
    return new Promise(function (res) {
      var st = status();
      if (st === 'unsupported' || st === 'no-thai') { res({ spoken: false, reason: 'no-voice' }); return; }
      try { speechSynthesis.cancel(); } catch (e) {}
      var pf = opts.speakerId ? profileFor(opts.speakerId) : { voice: voice, pitch: 1, rate: 1 };
      var rate = Math.max(0.3, Math.min(2, (opts.rate || 0.85) * pf.rate));
      var my = ++token, u = new SpeechSynthesisUtterance(text), done = false, wd;
      u.lang = 'th-TH'; u.rate = rate; u.pitch = pf.pitch;
      if (pf.voice || voice) u.voice = pf.voice || voice;
      function fin(r) { if (!done) { done = true; clearTimeout(wd); res(r); } }
      wd = setTimeout(function () {
        if (my === token) { try { speechSynthesis.cancel(); } catch (e) {} }
        fin({ spoken: true, reason: 'timeout' });
      }, Math.max(1200, text.length * 380 / rate) + 1500);
      u.onend = function () { fin({ spoken: true, reason: 'end' }); };
      u.onerror = function (e) { fin({ spoken: false, reason: (e && e.error) || 'error' }); };
      try {
        speechSynthesis.speak(u);
        if (speechSynthesis.paused) speechSynthesis.resume();
      } catch (e) { fin({ spoken: false, reason: 'error' }); }
    });
  }
  function stop() { token++; if (ok) { try { speechSynthesis.cancel(); } catch (e) {} } }
  global.TTS = {
    say: say, stop: stop, status: status, voiceInfo: voiceInfo, profileFor: profileFor,
    setCharacterVoices: function (on) { perChar = !!on; cache = {}; },
    onVoices: function (f) { listeners.push(f); }
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
})(window);
