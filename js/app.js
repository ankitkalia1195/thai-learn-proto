/* Bangkok, Slowly - story learning app. Plain script (works from file://). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- persistence ---------- */
  var KEY = 'thailearn:story:v1';
  var P = { xp: 0, seen: {}, done: {}, plays: {}, best: {}, stars: {}, qdone: {}, mistakes: [], set: { rom: true, en: true, auto: true, gender: 'm', voices: true, paused: false } };
  function load() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (j && typeof j === 'object') { P.xp = +j.xp || 0; P.seen = j.seen || {}; P.done = j.done || {}; P.plays = j.plays || {}; P.best = j.best || {}; P.stars = j.stars || {}; P.qdone = j.qdone || {}; P.mistakes = j.mistakes || []; P.set = Object.assign(P.set, j.set || {}); }
    } catch (e) { /* private mode / corrupt */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { } }
  load();

  /* ---------- data normalisation ---------- */
  var STORY = null;
  var PUNCT = /[\s!?.,…“”"'’‘()\-—~]/g;
  function strip(s) { return String(s || '').replace(PUNCT, ''); }
  function normWords(words, th, rom, en) {
    var ok = Array.isArray(words) && words.length && words.every(function (w) { return w && w.th; });
    if (ok && strip(words.map(function (w) { return w.th; }).join('')) !== strip(th)) ok = false;
    if (ok) return { exact: true, words: words.map(function (w) { return { th: w.th, rom: w.rom || '', en: w.en || '', type: w.type || 'phrase', note: w.note || '' }; }) };
    return { exact: false, words: [{ th: th, rom: rom || '', en: en || '', type: 'phrase', note: '' }] };
  }
  function normLine(l, defSpeaker) {
    var w = normWords(l.words, l.th, l.rom, l.en);
    return { speaker: l.speaker || defSpeaker || 'nok', th: l.th || '', rom: l.rom || '', en: l.en || '', words: w.words, exact: w.exact, grammar: l.grammar || '', related: l.related || [] };
  }
  /* gender substitution on learner (option) text.
     Female: ครับ -> ค่ะ, but question particles (ไหม, เท่าไหร่, ที่ไหน ...) take คะ (rom 'ka' not 'kha'). */
  var QP = '(?:ไหม|มั้ย|หรือเปล่า|หรือ|เหรอ|เปล่า|ไหน|อะไร|ไหร่|นะ|เท่าไร|เท่าไหร่|ใคร|ทำไม|ยังไง|กี่โมง|กี่บาท|กี่คน)';
  var QEND = new RegExp(QP + '$'), QKRAP = new RegExp('(' + QP + ')ครับ(?!ผม)', 'g');
  var KRAP = /khr[aáàâǎāã]p/gi;
  function gTh(s) { return String(s).replace(QKRAP, '$1คะ').replace(/ครับผม|ครับ/g, 'ค่ะ').replace(/ผม/g, 'ฉัน'); }
  function gRom(th, rom) {
    var flags = [], re = /ครับผม|ครับ/g, m, i = 0;
    while ((m = re.exec(th))) flags.push(m[0] === 'ครับ' && QEND.test(th.slice(0, m.index)));
    return String(rom || '').replace(KRAP, function () { return flags[i++] ? 'ka' : 'kha'; }).replace(/\bph[oòóôǒõ]m\b/gi, 'chan');
  }
  function gendOption(o) {
    if (P.set.gender !== 'f') return o;
    var c = Object.assign({}, o), acc = '';
    c.th = gTh(o.th); c.rom = gRom(o.th, o.rom);
    if (Array.isArray(o.words)) c.words = o.words.map(function (w) {
      var x = Object.assign({}, w), q = w.th === 'ครับ' && QEND.test(acc);
      acc += w.th;
      x.th = q ? 'คะ' : gTh(w.th); x.rom = q ? String(w.rom || '').replace(KRAP, 'ka') : gRom(w.th, w.rom || '');
      if (x.en) x.en = x.en.replace(/\bmale\b/gi, 'female'); if (x.note) x.note = x.note.replace(/\bmale\b/gi, 'female'); return x;
    });
    return c;
  }
  function normOption(o, scSpeaker) {
    var g = gendOption(o), line = normLine(g, 'you');
    line.speaker = 'you';
    var reply = null;
    if (o.reply && o.reply.th) reply = normLine(o.reply, o.reply.speaker || scSpeaker);
    else if (o.replyTh) reply = normLine({ speaker: o.replySpeaker, th: o.replyTh, rom: o.replyRom, en: o.replyEn, words: o.replyWords }, o.replySpeaker || scSpeaker);
    return { line: line, good: !!o.good, note: o.note || '', reply: reply };
  }
  function normScene(s) {
    var opts = null;
    if (s.choice && s.choice.options) {
      var raw = s.choice.options;
      if (P.set.gender === 'f') { var f = raw.filter(function (o) { return o.good || !/ค่ะ/.test(o.th); }); if (f.some(function (o) { return o.good; }) && f.length >= 2) raw = f; }
      opts = raw.map(function (o) { return normOption(o, s.speaker); });
    }
    return {
      id: s.id, place: s.place || '', speaker: s.speaker || 'nok', narration: s.narration || '',
      lines: (s.lines || []).map(function (l) { return normLine(l, s.speaker); }),
      choice: opts ? { prompt: s.choice.prompt || '', options: opts } : null
    };
  }
  function buildStory() {
    var raw = window.STORY_RAW || { title: 'Story', chapters: [] };
    STORY = { title: raw.title, chapters: raw.chapters.map(function (c) { return { id: c.id, title: c.title, summary: c.summary || '', place: c.place || '', scenes: c.scenes.map(normScene) }; }) };
  }
  function placeKey(p) {
    p = (p || '').toLowerCase();
    if (/7-eleven|seven|convenience/.test(p)) return 'seven';
    if (/car|grab|taxi|expressway|ride|tuk/.test(p)) return 'taxi';
    if (/market|stall|street food|fruit|ploy/.test(p)) return 'market';
    if (/river|temple|festival|lantern|wat\b|promenade/.test(p)) return 'temple';
    if (/restaurant|kitchen|eat/.test(p)) return 'restaurant';
    if (/airport|gate|bts|platform|station|arrival/.test(p)) return 'airport';
    return 'condo';
  }
  function exprFor(th, en) { return /!/.test(th + (en || '')) ? 'happy' : 'neutral'; }
  function castName(id) { var c = Chars.CAST[id]; return id === 'you' ? 'You' : (c ? c.name : id); }
  function level() { return Math.floor(P.xp / 100) + 1; }

  /* ---------- state ---------- */
  var S = { rev: {}, sxp: 0, screen: 'intro', token: 0, timer: null, autoPaused: false, reg: [], wbw: 0, prevFocus: null, bannerDismissed: false };
  var screenEl = $('#screen'), sheet = $('#sheet'), backdrop = $('#backdrop'), overlay = $('#overlay');

  function cancelAuto() { if (S.timer) { clearTimeout(S.timer); S.timer = null; } var cd = document.querySelector('.cd.run'); if (cd) cd.classList.remove('run'); }
  function leaveAudio() { S.token++; cancelAuto(); TTS.stop(); }
  function regLine(l) { S.reg.push(l); return S.reg.length - 1; }
  function stars(n) { var o = ''; for (var i = 1; i <= 3; i++) o += i <= n ? '★' : '<span class="off">★</span>'; return o; }

  function gain(n, why, quiet) {
    if (!n) return;
    P.xp += n; save();
    var x = $('#xp'); if (x) x.textContent = P.xp;
    refreshSide();
    if (quiet) return;
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = '+' + n + ' XP' + (why ? ' ' + why : '');
    overlay.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1500);
  }
  function toastMsg(text, cls) {
    var t = document.createElement('div'); t.className = 'toast' + (cls ? ' ' + cls : ''); t.textContent = text;
    overlay.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1900);
  }
  /* ---- per-scene scoring: sxp = this run's net XP; first play pays live, replays pay only the improvement over the best run ---- */
  function playsOf(id) { return P.plays[id] != null ? +P.plays[id] : (P.done[id] ? 1 : 0); }
  function revealCost() { return [3, 2, 1, 0][Math.min(3, S.sc ? playsOf(S.sc.id) : 0)]; }
  function earn(n, why) { if (!n) return; S.sxp += n; if (fresh()) gain(n, why); }
  function spend(n) {
    var a = Math.min(n, P.xp); if (!a) return 0;
    P.xp -= a; S.sxp -= a; save();
    var x = $('#xp'); if (x) x.textContent = P.xp; refreshSide();
    toastMsg('\u2212' + a + ' XP (English revealed)', 'neg'); return a;
  }
  function revKey(k) { return S.sc.id + '#' + playsOf(S.sc.id) + '#' + P.set.gender + '#' + k; }
  function enShown(k) { return !!(S.rev[revKey(k)] || S.wrongs.indexOf(k) >= 0 || (S.phase === 'replied' && S.pickK === k)); }
  function mistake(line) {
    P.mistakes.push({ th: line.th, rom: line.rom, en: line.en, ts: Date.now() });
    if (P.mistakes.length > 60) P.mistakes.shift(); save();
  }
  function banner() {
    if (S.bannerDismissed || TTS.status() !== 'no-thai' || $('.banner')) return;
    var b = document.createElement('div'); b.className = 'banner'; b.setAttribute('role', 'status');
    b.innerHTML = 'No Thai voice found on this device, so audio is off. Install one in system settings (iOS: Settings > Accessibility > Spoken Content > Voices; Android: Text-to-speech output). The story still works silently.<button data-act="dismiss-banner" aria-label="Dismiss">&#10005;</button>';
    overlay.appendChild(b);
  }

  /* ---------- side panel ---------- */
  function refreshSide() {
    var side = $('#side'); if (!side) return;
    var words = '';
    if (S.screen === 'scene' && S.sc) {
      var seen = {}, items = [];
      S.sc.lines.forEach(function (l) { l.words.forEach(function (w) { if (!seen[w.th] && w.type !== 'phrase') { seen[w.th] = 1; items.push(w); } }); });
      if (items.length) words = '<h3 style="margin-top:14px">Words in this scene</h3><ul>' + items.slice(0, 14).map(function (w) { return '<li><b lang="th">' + esc(w.th) + '</b><em style="font-style:normal;color:#5a4a8a">' + esc(w.en) + '</em><span>' + esc(w.rom) + '</span></li>'; }).join('') + '</ul>';
    }
    var pct = P.xp % 100;
    side.innerHTML = '<h3>' + esc(STORY.title) + '</h3><p>Level ' + level() + ' &middot; ' + P.xp + ' XP</p><div class="lvl"><i style="width:' + pct + '%"></i></div>' +
      '<p>' + Object.keys(P.done).length + ' scenes finished. Tap any speech bubble for audio, word breakdown and grammar.</p>' + words;
  }

  /* ---------- screens: intro / chapters ---------- */
  function showIntro() {
    leaveAudio(); S.screen = 'intro';
    var hero = ['nok', 'you', 'daeng', 'palek', 'ploy'].map(function (id) { return Chars.render(id, 'happy'); }).join('');
    screenEl.innerHTML = '<div class="screen" style="background:linear-gradient(#3b2e78,#1c1830)">' +
      '<div class="hero" aria-hidden="true">' + hero + '</div>' +
      '<h1>' + esc(STORY.title) + '</h1>' +
      '<p class="sub">Move to Bangkok and learn real, polite Thai one scene at a time. Listen, choose what to say, build the sentence, and tap any bubble to see every word.</p>' +
      '<div class="card"><div class="lbl">I speak as</div><div class="seg" role="group" aria-label="Speaker gender">' +
      '<button data-act="set-gender" data-v="m" aria-pressed="' + (P.set.gender === 'm') + '">ครับ / ผม</button>' +
      '<button data-act="set-gender" data-v="f" aria-pressed="' + (P.set.gender === 'f') + '">ค่ะ / ฉัน</button></div>' +
      '<p style="margin-top:8px">Sound: your device\'s Thai voice will play after you tap Start.</p></div>' +
      '<button class="btn primary" data-act="start" style="margin-top:auto">Start the story</button></div>';
    refreshSide();
  }
  function showChapters() {
    leaveAudio(); S.screen = 'chapters'; S.sc = null;
    var cards = STORY.chapters.map(function (c, i) {
      var n = c.scenes.filter(function (s) { return P.done[s.id]; }).length, st = P.stars[c.id] || 0;
      return '<div class="card"><div class="meta"><span>Chapter ' + (i + 1) + '</span><span class="stars" aria-label="' + st + ' of 3 stars">' + stars(st) + '</span></div>' +
        '<h3>' + esc(c.title) + '</h3><p>' + esc(c.summary) + '</p>' +
        '<div class="meta"><span>' + n + ' / ' + c.scenes.length + ' scenes</span></div>' +
        '<div class="row" style="margin-top:10px"><button class="btn primary small" data-act="play-ch" data-ci="' + i + '">' + (n === 0 ? 'Play' : n === c.scenes.length ? 'Replay' : 'Continue') + '</button>' +
        '<button class="btn small" data-act="quiz-ch" data-ci="' + i + '">Recap quiz</button></div></div>';
    }).join('');
    screenEl.innerHTML = '<div class="screen" style="background:linear-gradient(#3b2e78,#1c1830)"><div class="row" style="align-items:center"><h2 style="flex:3">Chapters</h2><span class="stars" style="flex:2;text-align:right;color:#fff">Lv ' + level() + ' &middot; <span id="xp">' + P.xp + '</span> XP</span><button class="btn small" style="flex:0 0 auto" data-act="settings" aria-label="Settings">&#9881;</button></div>' + cards + '</div>';
    refreshSide();
  }

  /* ---------- scene ---------- */
  function startChapter(ci, si) {
    S.ci = ci; var ch = STORY.chapters[ci];
    if (si == null) { si = 0; for (var i = 0; i < ch.scenes.length; i++) { if (!P.done[ch.scenes[i].id]) { si = i; break; } } }
    S.stat = { first: 0, total: 0, xp0: P.xp };
    showScene(si);
  }
  function fresh() { return !(S.sc && P.done[S.sc.id]); }
  function pauseHTML() { var p = !!P.set.paused; return '<button id="pausebtn" data-act="toggle-pause" aria-label="' + (p ? 'Resume auto-play' : 'Pause auto-play') + '">' + (p ? '&#9654;' : '&#10074;&#10074;') + '</button>'; }
  function showScene(si) {
    leaveAudio();
    var ch = STORY.chapters[S.ci];
    if (si >= ch.scenes.length) { showQuiz(S.ci); return; }
    S.screen = 'scene'; S.si = si; S.sc = ch.scenes[si]; S.perfect = true; S.sxp = 0;
    var sc = S.sc, b = [];
    if (sc.narration) b.push({ t: 'narr' });
    sc.lines.forEach(function (l, i) { b.push({ t: 'line', i: i }); });
    if (sc.choice) b.push({ t: 'choice' });
    if (!b.length) b.push({ t: 'narr' });
    S.beats = b; S.bi = 0;
    screenEl.innerHTML = '<div class="scene" id="scene" data-place="' + placeKey(sc.place) + '"><section class="stage" id="stage"><div class="bg"></div><div class="bg-fx"></div>' +
      '<div class="char left" id="cL"></div><div class="char right" id="cR"></div><div class="bl" id="bl"></div>' +
      '<div class="hud"><button data-act="back" aria-label="Back to chapters">&#8592;</button>' +
      '<span class="chip grow" title="' + esc(sc.place) + '">' + (S.ci + 1) + '.' + (si + 1) + '/' + ch.scenes.length + ' &middot; ' + esc(sc.place) + '</span>' +
      '<span class="chip">&#9733; <span id="xp">' + P.xp + '</span></span>' + pauseHTML() +
      '<button data-act="settings" aria-label="Settings">&#9881;</button></div></section>' +
      '<section class="tray" id="panel" aria-live="polite"></section></div>';
    S.stage = { L: { id: 'you', expr: 'neutral' }, R: { id: sc.speaker, expr: 'neutral' } };
    S.phase = null;
    enterBeat();
    refreshSide(); banner();
  }
  function setChar(el, id, expr, speaking) {
    if (!el) return;
    if (!id) { el.style.display = 'none'; el.dataset.id = ''; return; }
    el.style.display = '';
    var key = id + '|' + expr;
    if (el.dataset.id !== id) { el.dataset.id = id; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = Chars.render(id, expr); }
    el.classList.toggle('speaking', !!speaking);
  }
  function stage(L, R, speak) {
    if (L) Object.assign(S.stage.L, L); if (R) Object.assign(S.stage.R, R);
    setChar($('#cL'), S.stage.L.id, S.stage.L.expr, speak === 'L');
    setChar($('#cR'), S.stage.R.id, S.stage.R.expr, speak === 'R');
  }
  /* a comic speech balloon placed on the stage by layout(); side = 'L' (learner) | 'R' (other character) */
  function sbHTML(l, side, cls, forceEn) {
    return '<div class="sb ' + (side === 'L' ? 'player ' : '') + (cls || '') + '" data-side="' + side + '" role="button" tabindex="0" data-act="info" data-ref="' + regLine(l) + '" aria-label="Open word breakdown"><span class="who">' + esc(castName(l.speaker)) + '</span><span lang="th">' + esc(l.th) + '</span>' +
      (P.set.rom ? '<small class="rom">' + esc(l.rom) + '</small>' : '') + ((forceEn || l.speaker !== 'you' || P.set.en) && l.en ? '<small class="en">' + esc(l.en) + '</small>' : '') + '<span class="info" aria-hidden="true">i</span></div>';
  }
  function render(bl, tray, compact) {
    var sc = $('#scene'); if (!sc) return;
    sc.dataset.ratio = compact === true ? 0.28 : (compact || 0.46);
    $('#bl').innerHTML = bl;
    var p = $('#panel'); p.innerHTML = tray || ''; p.hidden = !tray; p.scrollTop = 0;
    layout();
  }
  var HUDB = 60, TAIL = 12;
  /* size the characters, then place every balloon above its speaker's head (tail tip at the hair line, never on the face) */
  function layout() {
    var st = $('#stage'); if (!st || S.screen !== 'scene') return;
    var ratio = +$('#scene').dataset.ratio || 0.46, W = st.clientWidth, H = st.clientHeight;
    if (!W || !H) return;
    var chH = Math.max(80, Math.min(H * ratio, W * 0.46 * 1.8, H - HUDB - 110)), chW = chH * 200 / 360;
    st.style.setProperty('--chh', chH + 'px');
    var top = H - chH, cx = { L: W * 0.03 + chW / 2, R: W - W * 0.03 - chW / 2 };
    var sbs = [].slice.call(st.querySelectorAll('.sb')), pair = sbs.length > 1, npcTop = null;
    sbs.forEach(function (el) {
      var side = el.dataset.side, cast = Chars.CAST[S.stage[side].id] || {}, hy = cast.headY || 0.14;
      var tipY = top + hy * chH, bottomY = top + 0.12 * chH - TAIL, avail = bottomY - HUDB, w = pair ? (W - 30) / 2 : Math.min(W - 20, 380);
      var fs = el.classList.contains('compactb') ? Math.min(19, Math.max(15, W * 0.047)) : Math.min(26, Math.max(19, W * 0.06));
      if (pair) fs = Math.min(fs, Math.max(15, W * 0.046));
      el.style.width = w + 'px'; el.style.maxHeight = 'none'; el.style.overflow = ''; el.style.fontSize = fs + 'px';
      while (el.offsetHeight > avail && fs > 12) { fs -= 1; el.style.fontSize = fs + 'px'; }
      if (el.offsetHeight > avail) { el.style.maxHeight = avail + 'px'; el.style.overflowY = 'auto'; }
      var left = pair ? (side === 'L' ? 10 : W - 10 - w) : clamp(cx[side] - w / 2, 10, W - 10 - w);
      el.style.left = left + 'px'; el.style.bottom = (H - bottomY) + 'px';
      el.style.setProperty('--tx', clamp(cx[side] - left, 26, w - 26) + 'px'); el.style.setProperty('--tl', (tipY - bottomY + 4) + 'px');
      if (el.classList.contains('npc')) npcTop = bottomY - el.offsetHeight;
    });
    var ol = $('#ol');
    if (ol) {
      var f = 18, lim = (npcTop != null ? npcTop : top) - 12;
      ol.style.top = HUDB + 'px'; ol.style.bottom = (H - lim) + 'px'; ol.style.fontSize = f + 'px';
      while (ol.scrollHeight > ol.clientHeight + 1 && f > 12) { f -= 1; ol.style.fontSize = f + 'px'; }
    }
  }
  window.addEventListener('resize', layout);
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout); } catch (e) { }

  function isLast() { return S.bi >= S.beats.length - 1; }
  function nextLabel() { return isLast() ? (S.si >= STORY.chapters[S.ci].scenes.length - 1 ? 'Finish chapter &rarr;' : 'Next scene &rarr;') : 'Next &rarr;'; }
  function nextBtn() { return '<button class="btn primary nextbtn" data-act="next"><span>' + nextLabel() + '</span><i class="cd" aria-hidden="true"></i></button>'; }

  /* ---- auto-advance: one timer, guarded by beat token; learner turns never schedule ---- */
  function autoOn() { return P.set.auto && !P.set.paused && !S.autoPaused && sheet.hidden && S.screen === 'scene' && !document.hidden; }
  function readMs(text) { return clamp(2600 + String(text || '').length * 55, 3000, 6000); }
  function scheduleAuto(ms) {
    cancelAuto(); if (!autoOn()) return;
    var tok = S.token, bi = S.bi;
    var cd = $('#panel .cd'); if (cd) { cd.style.animationDuration = ms + 'ms'; void cd.offsetWidth; cd.classList.add('run'); }
    S.timer = setTimeout(function () { S.timer = null; if (tok === S.token && bi === S.bi && autoOn()) next(); }, ms);
  }
  function beatText() { var b = S.beats && S.beats[S.bi]; if (!b) return ''; if (b.t === 'narr') return S.sc.narration || S.sc.place; var l = S.sc.lines[b.i]; return l.th + (P.set.en ? l.en : ''); }

  function drawNarr() {
    var sc = S.sc;
    stage({ expr: 'neutral' }, { id: sc.speaker, expr: 'neutral' }, null);
    render('<div class="caption"><span class="lbl">Narrator</span>' + esc(sc.narration || sc.place) + '</div>', '<div class="actions">' + nextBtn() + '</div>');
  }
  function drawLine(l) {
    S.reg = [];
    if (l.speaker === 'you') stage({ expr: exprFor(l.th, l.en) }, null, 'L');
    else stage({ expr: 'neutral' }, { id: l.speaker, expr: exprFor(l.th, l.en) }, 'R');
    render(sbHTML(l, l.speaker === 'you' ? 'L' : 'R', ''),
      '<div class="actions two"><button class="btn playbtn" data-act="replay" aria-label="Play again">&#128266;</button>' + nextBtn() + '</div>');
  }
  function enterBeat() {
    S.token++; cancelAuto(); TTS.stop(); S.autoPaused = false; S.speaking = false; S.reg = []; S.tBeat = Date.now();
    var b = S.beats[S.bi], sc = S.sc;
    if (b.t === 'narr') {
      drawNarr(); scheduleAuto(readMs(beatText()));
    } else if (b.t === 'line') {
      var l = sc.lines[b.i], key = sc.id + ':' + b.i;
      if (!P.seen[key]) { P.seen[key] = 1; gain(1, '', true); }
      drawLine(l);
      speakLine(l, true);
    } else if (b.t === 'choice') {
      S.phase = 'pick'; S.wrongs = []; S.pickK = null; S.order = shuffle(sc.choice.options.map(function (_, i) { return i; }));
      renderChoice();
    }
  }
  function speakLine(line, auto) {
    var tok = S.token; cancelAuto(); S.speaking = true;
    return TTS.say(line.th, { speakerId: line.speaker }).then(function (r) {
      if (tok !== S.token) return r;
      S.speaking = false;
      if (!auto) return r;
      if (!r.spoken && (r.reason === 'canceled' || r.reason === 'interrupted')) return r;
      scheduleAuto(r.spoken ? 1500 : readMs(beatText()));
      return r;
    });
  }
  function next() {
    if (S.screen !== 'scene' || Date.now() - (S.tBeat || 0) < 300) return;
    if (S.bi < S.beats.length - 1) { S.bi++; S.phase = null; enterBeat(); } else finishScene();
  }
  function togglePause() {
    P.set.paused = !P.set.paused; save();
    var pb = $('#pausebtn'); if (pb) pb.outerHTML = pauseHTML();
    if (P.set.paused) { cancelAuto(); return; }
    S.autoPaused = false;
    var b = S.screen === 'scene' && S.beats && S.beats[S.bi];
    if (b && (b.t === 'line' || b.t === 'narr') && !S.phase && !S.speaking) scheduleAuto(b.t === 'narr' ? readMs(beatText()) : 1500);
  }
  function finishScene() {
    leaveAudio();
    var sc = S.sc;
    var first = fresh(), prevBest = P.best[sc.id] || 0;
    if (sc.choice && S.perfect) earn(20, 'perfect scene');
    if (sc.choice) {
      if (!first) {
        var d = Math.max(0, S.sxp - prevBest);
        if (d > 0) gain(d, 'improvement (best ' + prevBest + ' \u2192 ' + S.sxp + ')'); else toastMsg('Scene score ' + S.sxp + ' XP (best ' + prevBest + '). Beat it to earn more.');
      }
      P.best[sc.id] = Math.max(prevBest, S.sxp);
    }
    P.plays[sc.id] = playsOf(sc.id) + 1;
    P.done[sc.id] = true; save();
    showScene(S.si + 1);
  }

  /* choice phase: balloons on the stage */
  function lastNpcLine() { var ls = S.sc.lines; for (var i = ls.length - 1; i >= 0; i--) if (ls[i].speaker !== 'you') return ls[i]; return null; }
  function optHTML(k, ref) {
    var o = S.sc.choice.options[k], hint = S.wrongs.length >= 2, shown = enShown(k), c = revealCost();
    var cls = 'opt' + (S.wrongs.indexOf(k) >= 0 ? ' wrong dis' : '') + (hint && o.good ? ' hint' : '') + (shown ? ' en-on' : '');
    var rv = (!shown && o.line.en) ? '<button class="rev" data-act="reveal" data-k="' + k + '" aria-label="Reveal English translation' + (c ? ', costs ' + c + ' XP' : ', free') + '"><span>Reveal English ' + (c ? '\u2212' + c + ' XP' : '(free)') + '</span></button>' : '';
    return '<div class="' + cls + '" data-k="' + k + '"><button class="main" data-act="pick" data-k="' + k + '"><span lang="th">' + esc(o.line.th) + '</span>' +
      (P.set.rom ? '<small>' + esc(o.line.rom) + '</small>' : '') + (shown && o.line.en ? '<small class="en">' + esc(o.line.en) + '</small>' : '') + '</button>' +
      '<button class="i" data-act="info" data-ref="' + ref + '" data-k="' + k + '" aria-label="Word breakdown">i</button>' + rv + '</div>';
  }
  function reveal(k) {
    if (S.screen !== 'scene' || S.phase !== 'pick' || !S.sc.choice.options[k]) return;
    var key = revKey(k); if (S.rev[key]) return;
    S.rev[key] = 1; var c = revealCost(); if (c) spend(c);
    var old = $('#ol .opt[data-k="' + k + '"]');
    if (old) { var ib = old.querySelector('.i'); var tmp = document.createElement('div'); tmp.innerHTML = optHTML(k, ib ? ib.dataset.ref : regLine(S.sc.choice.options[k].line)); old.replaceWith(tmp.firstChild); layout(); }
    if (!sheet.hidden && S.infoK === k) openInfo(S.infoLine, k);
  }
  function renderChoice() {
    var sc = S.sc, ch = sc.choice, last = lastNpcLine(), hint = S.wrongs.length >= 2;
    S.reg = [];
    var opts = S.order.map(function (k) { return optHTML(k, regLine(ch.options[k].line)); }).join('');
    stage({ expr: 'thinking' }, last ? { id: last.speaker, expr: 'neutral' } : null, null);
    render((last ? sbHTML(last, 'R', 'compactb npc') : '') + '<div class="opts-layer" id="ol"><div class="prompt-cap">' + esc(ch.prompt) + '</div>' +
      '<div class="opts">' + opts + '</div>' + (S.wrongs.length ? '<div class="note bad" role="status"><b>Not quite.</b>Try another option' + (hint ? ' (the good ones are highlighted)' : '') + '.</div>' : '') + '</div>', '', true);
  }
  function pick(k) {
    var sc = S.sc, o = sc.choice.options[k];
    if (S.phase !== 'pick' || S.wrongs.indexOf(k) >= 0) return;
    S.pickK = k; S.stat.total += (S.wrongs.length === 0 ? 1 : 0);
    if (o.good) {
      var pts = S.wrongs.length === 0 ? 10 : (S.wrongs.length === 1 ? 5 : 0);
      if (S.wrongs.length === 0) S.stat.first++; else S.perfect = false;
      earn(pts, pts ? 'nice!' : '');
    } else { S.wrongs.push(k); S.perfect = false; mistake(o.line); }
    S.phase = 'replied';
    renderReplied();
  }
  function renderReplied(silent) {
    var sc = S.sc, o = sc.choice.options[S.pickK], good = o.good;
    S.reg = []; S.token++; cancelAuto(); S.autoPaused = true; S.speaking = false;
    var buildable = good && o.line.exact && o.line.words.length >= 2 && o.line.words.length <= 12;
    var rid = o.reply ? o.reply.speaker : sc.speaker;
    var seqTok = S.token;
    stage({ expr: good ? 'happy' : 'worried' }, { id: rid, expr: 'neutral' }, 'L');
    render(sbHTML(o.line, 'L', 'compactb', true) + (o.reply ? sbHTML(o.reply, 'R', 'compactb') : ''),
      '<div class="note ' + (good ? 'good' : 'bad') + '" role="status"><b>' + (good ? '&#10003; Good choice' : '&#10007; Not the best choice') + '</b>' + esc(o.note) + '</div>' +
      '<div class="actions">' + (good ? (buildable ? '<button class="btn primary" data-act="build-go">Build the sentence &rarr;</button>' : '<button class="btn primary" data-act="next">' + nextLabel() + '</button>')
        : '<button class="btn primary" data-act="retry">Try again</button>') + '</div>', 0.38);
    if (silent) return;
    // audio: learner line (Alex's voice), then the reply in its speaker's voice
    TTS.say(o.line.th, { speakerId: 'you' }).then(function (r) {
      if (seqTok !== S.token) return;
      if (!o.reply) return;
      if (!r.spoken && (r.reason === 'canceled' || r.reason === 'interrupted')) return;
      stage({ expr: good ? 'happy' : 'worried' }, { id: rid, expr: good ? 'happy' : 'surprised' }, 'R');
      return TTS.say(o.reply.th, { speakerId: rid });
    });
  }
  function retry() { S.phase = 'pick'; S.token++; TTS.stop(); renderChoice(); }

  /* build-the-sentence */
  function startBuild() {
    var o = S.sc.choice.options[S.pickK], words = o.line.words, tiles = words.map(function (w, i) { return { id: i, w: w }; }), order;
    var target = words.map(function (w) { return w.th; }).join('|'), tries = 0;
    do { order = shuffle(tiles); tries++; } while (order.map(function (t) { return t.w.th; }).join('|') === target && tries < 20);
    S.build = { opt: o, tiles: order, target: words.map(function (w) { return w.th; }), placed: [], fails: 0, bad: [], shown: false, done: false };
    S.phase = 'build'; S.token++; TTS.stop(); S.stat.total++;
    renderBuild();
  }
  function renderBuild() {
    var B = S.build, o = B.opt;
    var tileHTML = function (t, inSlot, cls) {
      return '<button class="tile ' + (cls || '') + '" data-act="' + (inSlot ? 'unplace' : 'tile') + '" data-id="' + t.id + '" lang="th">' + esc(t.w.th) + (P.set.rom && t.w.rom ? '<small>' + esc(t.w.rom) + '</small>' : '') + '</button>';
    };
    var byId = {}; B.tiles.forEach(function (t) { byId[t.id] = t; });
    var slots = B.placed.map(function (id, i) { return tileHTML(byId[id], !B.done, B.done ? 'ok' : (B.bad.indexOf(i) >= 0 ? 'bad' : '')); }).join('') || '<span class="hintx">Tap the words in order</span>';
    var bank = B.tiles.map(function (t) { return B.placed.indexOf(t.id) >= 0 ? '' : tileHTML(t, false, ''); }).join('');
    stage({ expr: B.done ? 'happy' : 'thinking' }, null, null);
    var acts = B.done
      ? '<button class="btn primary" data-act="next">' + nextLabel() + '</button>'
      : '<div class="row"><button class="btn small" data-act="clear">Clear</button>' + (B.fails >= 2 ? '<button class="btn small" data-act="show-ans">Show answer</button>' : '') + '</div><button class="btn primary" data-act="check"' + (B.placed.length < B.tiles.length ? ' disabled' : '') + '>Check</button>';
    render('<div class="caption"><span class="lbl">Build the sentence</span>' + esc(o.line.en || 'Put the words in order') + '</div>',
      '<div class="slots" aria-label="Your sentence">' + slots + '</div>' + (B.done ? '' : '<div class="bank" aria-label="Word tiles">' + bank + '</div>') +
      (B.bad.length ? '<div class="note bad" role="status"><b>Not yet.</b>The red tiles are in the wrong place. Tap a tile to remove it.</div>' : '') +
      (B.done ? '<div class="note good" role="status"><b>&#10003; ' + (B.shown ? 'Here is the answer' : 'Sentence built!') + '</b><span lang="th">' + esc(o.line.th) + '</span> &middot; ' + esc(o.line.en) + '</div>' : '') +
      '<div class="actions">' + acts + '</div>', true);
  }
  function buildCheck() {
    var B = S.build; if (B.done) return;
    var byId = {}; B.tiles.forEach(function (t) { byId[t.id] = t; });
    var seq = B.placed.map(function (id) { return byId[id].w.th; }), bad = [];
    seq.forEach(function (th, i) { if (th !== B.target[i]) bad.push(i); });
    if (!bad.length && seq.length === B.target.length) {
      B.done = true; B.bad = [];
      var pts = B.shown ? 0 : (B.fails === 0 ? 15 : 8);
      if (B.fails === 0 && !B.shown) S.stat.first++; else S.perfect = false;
      earn(pts, 'built it!'); renderBuild();
      TTS.say(B.opt.line.th, { speakerId: 'you' });
    } else { B.fails++; B.bad = bad; S.perfect = false; if (B.fails === 1) mistake(B.opt.line); renderBuild(); }
  }
  function showAnswer() {
    var B = S.build, used = {}; B.placed = [];
    B.target.forEach(function (th) { for (var i = 0; i < B.tiles.length; i++) { var t = B.tiles[i]; if (!used[t.id] && t.w.th === th) { used[t.id] = 1; B.placed.push(t.id); break; } } });
    B.shown = true; B.bad = []; buildCheck();
  }

  /* ---------- recap quiz ---------- */
  function poolFor(ci) {
    var out = [], seen = {};
    STORY.chapters[ci].scenes.forEach(function (sc, si) {
      var add = function (l) { if (l && l.th && l.en && strip(l.th).length > 1 && !seen[l.th]) { seen[l.th] = 1; out.push({ line: l, si: si }); } };
      sc.lines.forEach(add);
      if (sc.choice) sc.choice.options.forEach(function (o) { if (o.good) add(o.line); add(o.reply); });
    });
    return out;
  }
  function makeQuestions(ci, n) {
    var pool = poolFor(ci), picks = shuffle(pool).slice(0, n), qs = [];
    picks.forEach(function (p, i) {
      var type = i % 2 === 0 ? 'listen' : 'reverse', field = type === 'listen' ? 'en' : 'th';
      var ans = p.line[field];
      var others = shuffle(pool.filter(function (x) { return x !== p && x.line[field] !== ans; }));
      others.sort(function (a, b) { return (a.si === p.si ? 0 : 1) - (b.si === p.si ? 0 : 1); });
      var ds = [], seenA = {}; seenA[ans] = 1;
      others.forEach(function (x) { var v = x.line[field]; if (ds.length < 3 && !seenA[v]) { seenA[v] = 1; ds.push(v); } });
      var options = shuffle([{ text: ans, correct: true }].concat(ds.map(function (d) { return { text: d, correct: false }; })));
      qs.push({ type: type, line: p.line, options: options });
    });
    return qs;
  }
  function showQuiz(ci) {
    leaveAudio(); S.screen = 'quiz'; S.ci = ci; S.sc = null;
    if (!S.stat) S.stat = { first: 0, total: 0, xp0: P.xp };
    S.qs = makeQuestions(ci, 6); S.qi = 0; S.qwrong = []; S.qfirst = 0;
    renderQuestion();
  }
  function renderQuestion() {
    var q = S.qs[S.qi]; S.reg = []; S.qwrong = []; S.qdone = false; S.token++; TTS.stop();
    if (!q) { showDone(); return; }
    screenEl.innerHTML = '<div class="screen quiz" style="background:linear-gradient(#3b2e78,#1c1830)"><div class="row" style="align-items:center;flex:0 0 auto"><button class="btn small" style="flex:0 0 auto" data-act="back" aria-label="Back to chapters">&#8592;</button><h2 style="flex:1">Recap &middot; ' + (S.qi + 1) + ' / ' + S.qs.length + '</h2><span class="stars" style="flex:0 0 auto;color:#fff">&#9733; <span id="xp">' + P.xp + '</span></span></div>' +
      '<div class="progressbar"><i style="width:' + (S.qi / S.qs.length * 100) + '%"></i></div><div class="qcard" id="qcard"></div></div>';
    drawQuestion();
    if (q.type === 'listen') TTS.say(q.line.th, { speakerId: q.line.speaker });
  }
  function drawQuestion() {
    var q = S.qs[S.qi], hint = S.qwrong.length >= 2, done = S.qdone;
    var head = q.type === 'listen'
      ? '<div class="lbl">What does this mean?</div><div class="qth" lang="th">' + esc(q.line.th) + '</div>' + (P.set.rom ? '<div class="qrom">' + esc(q.line.rom) + '</div>' : '') + '<button class="btn small" data-act="qplay" aria-label="Play audio">&#128266; Listen</button>'
      : '<div class="lbl">How do you say this in Thai?</div><div class="qth" style="font-size:22px">' + esc(q.line.en) + '</div>';
    var opts = q.options.map(function (o, i) {
      var cls = 'opt' + (S.qwrong.indexOf(i) >= 0 ? ' wrong dis' : '') + ((hint || done) && o.correct ? ' hint' : '') + (done ? ' dis' : '');
      var thai = q.type === 'reverse';
      return '<div class="' + cls + '" style="grid-template-columns:1fr"><button class="main" data-act="qpick" data-k="' + i + '">' + (thai ? '<span lang="th">' + esc(o.text) + '</span>' : esc(o.text)) + '</button></div>';
    }).join('');
    var fb = '';
    if (done) fb = '<div class="note ' + (S.qwrong.length === 0 ? 'good' : 'bad') + '" role="status"><b>' + (S.qwrong.length === 0 ? '&#10003; Correct' : (S.qwrong.length >= 2 ? 'The answer is highlighted' : '&#10003; Got it')) + '</b><span lang="th">' + esc(q.line.th) + '</span> &middot; ' + esc(q.line.en) + '</div>' +
      '<div class="row"><button class="btn small" data-act="qinfo">Word breakdown</button><button class="btn primary small" data-act="qnext">' + (S.qi >= S.qs.length - 1 ? 'Finish' : 'Next') + ' &rarr;</button></div>';
    else if (S.qwrong.length) fb = '<div class="note bad" role="status"><b>Not quite.</b>Try another answer.</div>';
    $('#qcard').innerHTML = head + '<div class="opts">' + opts + '</div>' + fb;
  }
  function qpick(i) {
    var q = S.qs[S.qi]; if (S.qdone || S.qwrong.indexOf(i) >= 0) return;
    var o = q.options[i];
    if (S.qwrong.length === 0) S.stat.total++;
    if (o.correct) {
      var pts = S.qwrong.length === 0 ? 10 : (S.qwrong.length === 1 ? 5 : 0);
      if (S.qwrong.length === 0) S.stat.first++; if (!P.qdone[STORY.chapters[S.ci].id]) gain(pts, '');
      S.qdone = true;
    } else {
      S.qwrong.push(i); mistake(q.line);
      if (S.qwrong.length >= 2) S.qdone = true;
    }
    drawQuestion();
    if (S.qdone && q.type === 'reverse') TTS.say(q.line.th, { speakerId: q.line.speaker });
  }
  function showDone() {
    leaveAudio(); S.screen = 'done';
    var ch = STORY.chapters[S.ci], st = S.stat || { first: 0, total: 0, xp0: P.xp };
    var ratio = st.total ? st.first / st.total : 1, n = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
    P.stars[ch.id] = Math.max(P.stars[ch.id] || 0, n); P.qdone[ch.id] = true; save();
    var hasNext = S.ci < STORY.chapters.length - 1;
    screenEl.innerHTML = '<div class="screen center" style="background:linear-gradient(#3b2e78,#1c1830);justify-content:center"><div class="bigstars stars">' + stars(n) + '</div><h1>Chapter ' + (S.ci + 1) + ' complete!</h1>' +
      '<p class="sub">' + esc(ch.title) + '</p><div class="card"><h3>+' + Math.max(0, P.xp - st.xp0) + ' XP this chapter</h3><p>' + st.first + ' of ' + st.total + ' answered right on the first try. Level ' + level() + ' &middot; ' + P.xp + ' XP total.</p></div>' +
      (hasNext ? '<button class="btn primary" data-act="play-ch" data-ci="' + (S.ci + 1) + '">Next chapter</button>' : '<p class="sub">You finished the whole story. Nice work!</p>') +
      '<button class="btn" data-act="chapters">All chapters</button></div>';
    S.stat = null; refreshSide();
  }

  /* ---------- bottom sheet ---------- */
  function openSheet(html) {
    S.prevFocus = document.activeElement; S.autoPaused = true; cancelAuto();
    sheet.innerHTML = html; sheet.hidden = false; backdrop.hidden = false;
    var c = $('.sheet-close', sheet); if (c) c.focus();
  }
  function closeSheet() {
    if (sheet.hidden) return;
    S.wbw++; TTS.stop(); sheet.hidden = true; backdrop.hidden = true; sheet.innerHTML = '';
    if (S.prevFocus && S.prevFocus.focus) { try { S.prevFocus.focus(); } catch (e) { } }
  }
  function openInfo(line, k) {
    S.infoLine = line; S.infoK = k == null ? null : k;
    var hideEn = k != null && S.screen === 'scene' && S.phase === 'pick' && !enShown(k), c = revealCost();
    var words = line.words.map(function (w, i) {
      return '<li class="w" data-act="play-word" data-i="' + i + '"><button class="w-play" aria-label="Play word ' + esc(w.th) + '">&#128266;</button>' +
        '<div><span class="w-th" lang="th">' + esc(w.th) + '</span>' + (P.set.rom && w.rom ? '<span class="w-rom">' + esc(w.rom) + '</span>' : '') + '</div>' +
        '<span class="tag tag-' + esc(w.type) + '">' + esc(w.type) + '</span><span class="w-en">' + (hideEn ? '' : esc(w.en)) + '</span>' +
        (w.note && !hideEn ? '<small class="w-note">' + esc(w.note) + '</small>' : '') + '</li>';
    }).join('');
    var rel = hideEn ? '' : (line.related || []).slice(0, 3).map(function (r) { return '<li class="w" style="grid-template-columns:1fr"><div><span class="w-th" lang="th">' + esc(r.th) + '</span><span class="w-rom">' + esc(r.rom || '') + '</span></div><span class="w-en">' + esc(r.en || '') + '</span></li>'; }).join('');
    openSheet('<div class="sheet-grab" aria-hidden="true"></div><button class="sheet-close" data-act="sheet-close" aria-label="Close">&#10005;</button>' +
      '<header><div id="sheet-title" class="th" lang="th">' + esc(line.th) + '</div>' + (P.set.rom ? '<div class="rom">' + esc(line.rom) + '</div>' : '') + (hideEn ? '<button class="btn small rev-sheet" data-act="reveal" data-k="' + k + '">Reveal English ' + (c ? '\u2212' + c + ' XP' : '(free)') + '</button>' : '<div class="en">' + esc(line.en) + '</div>') +
      '<div class="ctrls"><button class="btn small" data-act="play-sentence">&#9654; Play</button><button class="btn small" data-act="slow">&#128034; Slow</button><button class="btn small" data-act="play-words">Word by word</button></div></header>' +
      '<ol class="words">' + words + '</ol>' +
      (line.grammar && !hideEn ? '<section><h4>Grammar</h4><p class="g">' + esc(line.grammar) + '</p></section>' : '') +
      (rel ? '<section><h4>Related</h4><ol class="words">' + rel + '</ol></section>' : '') +
      (hideEn ? '<p class="g" style="color:var(--muted)">English meanings, grammar notes and related phrases unlock when you reveal English or pick an answer.</p>' : '') + (line.exact ? '' : '<p class="g" style="color:var(--muted)">Word-by-word breakdown is not available for this line yet.</p>'));
    banner();
  }
  function playWordsLoop() {
    var my = ++S.wbw, line = S.infoLine;
    (function () {
      return line.words.reduce(function (p, w, i) {
        return p.then(function () {
          if (my !== S.wbw) return;
          var rows = sheet.querySelectorAll('.w[data-i]'); rows.forEach(function (r) { r.classList.remove('is-playing'); });
          var row = sheet.querySelector('.w[data-i="' + i + '"]'); if (row) { row.classList.add('is-playing'); row.scrollIntoView({ block: 'nearest' }); }
          return TTS.say(w.th, { rate: 0.7, speakerId: line.speaker }).then(function () { return sleep(250); });
        });
      }, Promise.resolve()).then(function () { if (my === S.wbw) sheet.querySelectorAll('.w').forEach(function (r) { r.classList.remove('is-playing'); }); });
    })();
  }
  function voiceNote() {
    var v = TTS.voiceInfo(), t = '';
    if (v.count === 1) t = 'Only one Thai voice is installed on this device, so characters are told apart by pitch and speed only. Install more Thai voices (a female and a male one) in your system settings to give each character a distinct voice.';
    else if (v.count > 1 && !(v.female && v.male)) t = 'This device has ' + v.count + ' Thai voices but no clearly ' + (v.female ? 'male' : 'female') + ' one, so some characters use pitch shifts.';
    else if (v.count > 1) t = 'Thai voices found: ' + v.count + '. Each character gets a voice that fits (pitch and speed vary too).';
    return t ? '<p class="g" style="margin:-2px 0 6px;color:var(--muted);font-size:13px">' + t + '</p>' : '';
  }
  function openSettings() {
    var tg = function (k, label) { return '<div class="toggle"><span>' + label + '</span><button data-act="set-toggle" data-key="' + k + '" aria-pressed="' + !!P.set[k] + '">' + (P.set[k] ? 'On' : 'Off') + '</button></div>'; };
    openSheet('<div class="sheet-grab" aria-hidden="true"></div><button class="sheet-close" data-act="sheet-close" aria-label="Close">&#10005;</button>' +
      '<h3 id="sheet-title" style="margin:6px 0">Settings</h3>' + tg('rom', 'Romanisation') + tg('en', 'English translations') + tg('auto', 'Auto-advance after audio') + tg('voices', 'Character voices') + voiceNote() +
      '<div class="lbl" style="margin-top:8px">I speak as</div><div class="seg"><button data-act="set-gender" data-v="m" aria-pressed="' + (P.set.gender === 'm') + '">ครับ / ผม</button><button data-act="set-gender" data-v="f" aria-pressed="' + (P.set.gender === 'f') + '">ค่ะ / ฉัน</button></div>' +
      '<p class="g" style="margin-top:6px;color:var(--muted)">Changing this restarts the current scene. Female mode also hides the one option that deliberately mixes up ค่ะ for a male speaker.</p>' +
      '<button class="btn small" style="margin-top:10px;width:100%" data-act="reset">Reset all progress</button>');
  }

  /* ---------- events ---------- */
  function refreshCurrent() {
    if (S.screen === 'intro') showIntro(); else if (S.screen === 'chapters') showChapters();
    else if (S.screen === 'scene') {
      if (S.phase === 'pick') renderChoice(); else if (S.phase === 'replied') renderReplied(); else if (S.phase === 'build') renderBuild(); else { var t = S.token; enterBeat(); S.autoPaused = true; }
    } else if (S.screen === 'quiz') drawQuestion();
  }
  function onAct(act, el) {
    var d = el.dataset;
    switch (act) {
      case 'start': showChapters(); break;
      case 'chapters': showChapters(); break;
      case 'play-ch': startChapter(+d.ci); break;
      case 'quiz-ch': S.stat = { first: 0, total: 0, xp0: P.xp }; showQuiz(+d.ci); break;
      case 'back': showChapters(); break;
      case 'settings': openSettings(); break;
      case 'next': next(); break;
      case 'replay': S.autoPaused = true; cancelAuto(); var b = S.beats[S.bi]; if (b && b.t === 'line') speakLine(S.sc.lines[b.i], false); break;
      case 'toggle-pause': togglePause(); break;
      case 'info': var ln = S.reg[+d.ref]; if (ln) openInfo(ln, d.k != null ? +d.k : null); break;
      case 'reveal': reveal(+d.k); break;
      case 'pick': pick(+d.k); break;
      case 'retry': retry(); break;
      case 'build-go': startBuild(); break;
      case 'tile': var B = S.build; if (B && !B.done) { var t = B.tiles.filter(function (x) { return x.id === +d.id; })[0]; B.placed.push(+d.id); B.bad = []; renderBuild(); if (t) TTS.say(t.w.th, { rate: 0.7, speakerId: 'you' }); } break;
      case 'unplace': var B2 = S.build; if (B2 && !B2.done) { B2.placed = B2.placed.filter(function (x) { return x !== +d.id; }); B2.bad = []; renderBuild(); } break;
      case 'clear': S.build.placed = []; S.build.bad = []; renderBuild(); break;
      case 'check': buildCheck(); break;
      case 'show-ans': showAnswer(); break;
      case 'qpick': qpick(+d.k); break;
      case 'qplay': TTS.say(S.qs[S.qi].line.th, { speakerId: S.qs[S.qi].line.speaker }); break;
      case 'qinfo': openInfo(S.qs[S.qi].line); break;
      case 'qnext': S.qi++; renderQuestion(); break;
      case 'sheet-close': closeSheet(); break;
      case 'play-sentence': S.wbw++; TTS.say(S.infoLine.th, { rate: 0.85, speakerId: S.infoLine.speaker }); break;
      case 'slow': S.wbw++; TTS.say(S.infoLine.th, { rate: 0.6, speakerId: S.infoLine.speaker }); break;
      case 'play-words': playWordsLoop(); break;
      case 'play-word': S.wbw++; var w = S.infoLine.words[+d.i]; if (w) { sheet.querySelectorAll('.w').forEach(function (r) { r.classList.remove('is-playing'); }); el.classList.add('is-playing'); TTS.say(w.th, { rate: 0.7, speakerId: S.infoLine.speaker }).then(function () { el.classList.remove('is-playing'); }); } break;
      case 'set-toggle': P.set[d.key] = !P.set[d.key]; save(); if (d.key === 'voices') TTS.setCharacterVoices(P.set.voices); openSettings(); refreshCurrentSoft(); break;
      case 'set-gender':
        if (P.set.gender !== d.v) {
          P.set.gender = d.v; save(); syncYou(); buildStory();
          if (S.screen === 'scene') { closeSheet(); showScene(S.si); } else if (S.screen === 'intro') showIntro(); else if (!sheet.hidden) openSettings();
        } break;
      case 'reset': if (el.dataset.sure) { P.xp = 0; P.seen = {}; P.done = {}; P.plays = {}; P.best = {}; S.rev = {}; P.stars = {}; P.qdone = {}; P.mistakes = []; save(); closeSheet(); showChapters(); } else { el.dataset.sure = 1; el.textContent = 'Tap again to confirm'; } break;
      case 'dismiss-banner': S.bannerDismissed = true; el.parentNode.remove(); break;
    }
  }
  function refreshCurrentSoft() { /* sheet remains open; refresh the scene behind it without audio */
    if (S.screen === 'scene' && !S.phase) { var b = S.beats[S.bi]; if (b.t === 'narr') drawNarr(); else if (b.t === 'line') drawLine(S.sc.lines[b.i]); }
    else if (S.screen === 'scene' && S.phase === 'replied') renderReplied(true);
    else if (S.screen === 'scene' && S.phase === 'pick') renderChoice();
    else if (S.screen === 'scene' && S.phase === 'build') renderBuild();
    else if (S.screen === 'chapters') showChapters();
  }
  $('#phone').addEventListener('click', function (e) {
    if (e.target === backdrop) { closeSheet(); return; }
    var el = e.target.closest('[data-act]'); if (!el) return;
    if (el.dataset.act === 'play-word' && e.target.closest('.w-play') === null && false) return;
    onAct(el.dataset.act, el);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.tagName !== 'BUTTON') { e.preventDefault(); e.target.click(); return; }
    if (e.key === 'Tab' && !sheet.hidden) {
      var f = sheet.querySelectorAll('button'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });
  (function swipe() {
    var y0 = null;
    sheet.addEventListener('touchstart', function (e) { if (sheet.scrollTop <= 0) y0 = e.touches[0].clientY; else y0 = null; }, { passive: true });
    sheet.addEventListener('touchend', function (e) { if (y0 != null && e.changedTouches[0].clientY - y0 > 70) closeSheet(); y0 = null; }, { passive: true });
  })();
  TTS.onVoices(function () { banner(); });

  /* ---------- boot ---------- */
  function syncYou() { try { Chars.VOICES.you.gender = P.set.gender === 'f' ? 'f' : 'm'; Chars.VOICES.you.pitch = P.set.gender === 'f' ? 1.05 : 0.9; } catch (e) { } }
  syncYou(); TTS.setCharacterVoices(P.set.voices !== false);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { S.autoPaused = true; cancelAuto(); } });
  buildStory();
  window.ThaiStory = { P: P, S: S, story: function () { return STORY; }, strip: strip, makeQuestions: makeQuestions };
  showIntro();
})();
