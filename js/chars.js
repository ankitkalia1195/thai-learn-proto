/* SVG characters (visual system by Agent 5) + cast table */
(function (global) {
  'use strict';
  var SKIN = { light: '#f6d2b0', tan: '#e0a878', brown: '#b9774d', dark: '#7a4a2e' };
  function characterSVG(o) {
    o = o || {};
    var skin = o.skin || 'tan', hair = o.hair || '#2a1f2d', outfit = o.outfit || '#7652d5', accent = o.accent || '#f2b84b',
      expression = o.expression || 'neutral', hairStyle = o.hairStyle || 'short';
    var s = SKIN[skin] || skin, ink = '#25213a';
    function brow(l, r) { return '<path d="' + l + '" /><path d="' + r + '" />'; }
    var Ex = {
      neutral: '<g fill="' + ink + '"><ellipse cx="80" cy="128" rx="5" ry="7"/><ellipse cx="120" cy="128" rx="5" ry="7"/></g><g stroke="' + ink + '" stroke-width="3" fill="none" stroke-linecap="round">' + brow('M70 113q10-4 20 0', 'M110 113q10-4 20 0') + '<path d="M88 156q12 6 24 0"/></g>',
      happy: '<g stroke="' + ink + '" stroke-width="4" fill="none" stroke-linecap="round"><path d="M72 130q8-10 16 0"/><path d="M112 130q8-10 16 0"/>' + brow('M70 111q10-5 20-1', 'M110 110q10-4 20 1') + '</g><path d="M84 150q16 20 32 0z" fill="' + ink + '"/><path d="M90 156q10 7 20 0" fill="#e86a7a"/><circle cx="68" cy="145" r="7" fill="#ff8aa0" opacity=".5"/><circle cx="132" cy="145" r="7" fill="#ff8aa0" opacity=".5"/>',
      surprised: '<g fill="#fff" stroke="' + ink + '" stroke-width="2.5"><ellipse cx="80" cy="128" rx="9" ry="11"/><ellipse cx="120" cy="128" rx="9" ry="11"/></g><g fill="' + ink + '"><circle cx="80" cy="128" r="4"/><circle cx="120" cy="128" r="4"/></g><g stroke="' + ink + '" stroke-width="3" fill="none" stroke-linecap="round">' + brow('M68 106q12-8 24-2', 'M108 104q12-6 24 2') + '</g><ellipse cx="100" cy="156" rx="7" ry="9" fill="' + ink + '"/>',
      worried: '<g fill="' + ink + '"><ellipse cx="80" cy="130" rx="5" ry="7"/><ellipse cx="120" cy="130" rx="5" ry="7"/></g><g stroke="' + ink + '" stroke-width="3" fill="none" stroke-linecap="round">' + brow('M68 116q12-2 22-12', 'M110 104q10 10 22 12') + '<path d="M88 160q12-8 24 0"/></g><path d="M134 118q4 8 0 12q-4-4 0-12z" fill="#7fc4f0"/>',
      thinking: '<g fill="' + ink + '"><ellipse cx="84" cy="127" rx="5" ry="7"/><ellipse cx="124" cy="127" rx="5" ry="7"/></g><g stroke="' + ink + '" stroke-width="3" fill="none" stroke-linecap="round">' + brow('M70 114q10-2 20 0', 'M110 106q10-6 20-2') + '<path d="M92 157q8 2 18-3"/></g><g fill="#fff" stroke="' + ink + '" stroke-width="2"><circle cx="150" cy="78" r="4"/><circle cx="162" cy="62" r="6"/></g>'
    }[expression] || '';
    var back = hairStyle === 'long' ? '<path d="M50 120q-6-70 50-72t50 72l4 120h-30V140H76v100H46z" fill="' + hair + '"/>' : '<path d="M52 118q-4-66 48-66t48 66z" fill="' + hair + '"/>';
    var fringe = '<path d="M56 112q2-48 44-48t44 48q-20-30-44-26-26 0-44 26z" fill="' + hair + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 360" role="img" aria-label="' + expression + ' character">' + back +
      '<path d="M92 170h16v26H92z" fill="' + s + '"/>' +
      '<path d="M20 360v-100q0-52 60-62h40q60 10 60 62v100z" fill="' + outfit + '"/>' +
      '<path d="M80 198l20 34 20-34z" fill="' + s + '"/><path d="M80 198l20 34-34 4z M120 198l-20 34 34 4z" fill="' + accent + '"/>' +
      '<path d="M20 300h160v14H20z" fill="' + accent + '" opacity=".9"/>' +
      '<ellipse cx="50" cy="140" rx="9" ry="14" fill="' + s + '"/><ellipse cx="150" cy="140" rx="9" ry="14" fill="' + s + '"/>' +
      '<ellipse cx="100" cy="132" rx="50" ry="56" fill="' + s + '"/>' + fringe + Ex + '</svg>';
  }
  function catSVG(o) {
    var ink = '#25213a', fur = '#f29b38', ex = (o && o.expression) || 'neutral';
    var eyes = ex === 'happy' ? '<path d="M76 190q8-10 16 0M108 190q8-10 16 0" stroke="' + ink + '" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<ellipse cx="84" cy="190" rx="6" ry="9" fill="' + ink + '"/><ellipse cx="116" cy="190" rx="6" ry="9" fill="' + ink + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 360" role="img" aria-label="cat">' +
      '<ellipse cx="100" cy="320" rx="70" ry="60" fill="' + fur + '"/><path d="M40 160l10-60 40 30zM160 160l-10-60-40 30z" fill="' + fur + '"/><path d="M155 108l-5-8-18 14z" fill="#fff"/>' +
      '<ellipse cx="100" cy="190" rx="62" ry="56" fill="' + fur + '"/>' + eyes +
      '<path d="M94 206h12l-6 8z" fill="#e86a7a"/><path d="M100 214q-8 10-18 6M100 214q8 10 18 6" stroke="' + ink + '" stroke-width="3" fill="none"/>' +
      '<path d="M60 205h-30M62 214l-28 8M140 205h30M138 214l28 8" stroke="' + ink + '" stroke-width="2"/>' +
      '<path d="M50 238q50 20 100 0v14q-50 20-100 0z" fill="#d94f4f"/><circle cx="100" cy="258" r="7" fill="#f2b84b"/></svg>';
  }
  var CAST = {
    you: { name: 'You', skin: 'light', hair: '#4a3222', outfit: '#7652d5', accent: '#f2b84b', hairStyle: 'short' },
    nok: { name: 'Nok', skin: 'tan', hair: '#1b1520', outfit: '#f3a8c0', accent: '#f2b84b', hairStyle: 'long' },
    daeng: { name: 'Uncle Daeng', skin: 'brown', hair: '#9a9aa3', outfit: '#d94f4f', accent: '#ffffff', hairStyle: 'short' },
    palek: { name: 'Auntie Lek', skin: 'brown', hair: '#8a8a92', outfit: '#2f8f6b', accent: '#f4d35e', hairStyle: 'long' },
    ploy: { name: 'Sister Ploy', skin: 'tan', hair: '#2a1f2d', outfit: '#e8742c', accent: '#fff4d6', hairStyle: 'short' },
    beam: { name: 'Beam', skin: 'light', hair: '#1b1520', outfit: '#2b9d57', accent: '#e8742c', hairStyle: 'short' },
    mamuang: { name: 'Mamuang', cat: true, headY: 0.27 }
  };
  /* voice profiles: gender picks a matching installed th-TH voice; pitch/rate are applied on top
     (and are the only difference when the device has a single Thai voice). 'you' follows the learner's setting. */
  var VOICES = {
    you:     { gender: 'm', pitch: 1.0,  rate: 1.0,  hints: [] },
    nok:     { gender: 'f', pitch: 1.15, rate: 1.05, hints: ['kanya', 'narisa', 'premwadee', 'google'] },
    daeng:   { gender: 'm', pitch: 0.7,  rate: 0.85, hints: ['pattara', 'niwat'] },
    palek:   { gender: 'f', pitch: 0.9,  rate: 0.85, hints: ['premwadee', 'narisa', 'kanya'] },
    ploy:    { gender: 'f', pitch: 1.3,  rate: 1.0,  hints: ['narisa', 'kanya', 'google'] },
    beam:    { gender: 'm', pitch: 1.15, rate: 1.15, hints: ['niwat', 'pattara'] },
    mamuang: { gender: 'f', pitch: 1.9,  rate: 1.15, hints: [], extreme: true }
  };
  function render(id, expression) {
    var c = CAST[id] || CAST.nok;
    if (c.cat) return catSVG({ expression: expression });
    return characterSVG({ skin: c.skin, hair: c.hair, outfit: c.outfit, accent: c.accent, hairStyle: c.hairStyle, expression: expression || 'neutral' });
  }
  global.Chars = { render: render, CAST: CAST, VOICES: VOICES };
})(window);
