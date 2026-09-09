/* Copyright (c) 2026 Jonathan Vicencio. All rights reserved. See LICENSE. */
/* MARKET MAKER - shared helpers. Classic script, no modules (must run from file://). */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* ---------- math ---------- */
HS.clamp = (v,a,b) => v < a ? a : v > b ? b : v;
HS.lerp  = (a,b,t) => a + (b - a) * t;
HS.damp  = (a,b,lambda,dt) => HS.lerp(a, b, 1 - Math.exp(-lambda * dt));
HS.smoothstep = t => t*t*(3-2*t);

/* Deterministic PRNG so a seed always rebuilds the same city. */
HS.rng = function(seed){
  let s = seed >>> 0;
  const f = function(){
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  f.range = (a,b) => a + f() * (b - a);
  f.int   = (a,b) => Math.floor(f.range(a, b + 1));
  f.pick  = arr => arr[Math.floor(f() * arr.length)];
  f.chance= p => f() < p;
  return f;
};

/* Box–Muller, shared spare. Used by the market sim. */
let spare = null;
HS.gauss = function(){
  if(spare !== null){ const s = spare; spare = null; return s; }
  let u, v, s2;
  do { u = Math.random()*2-1; v = Math.random()*2-1; s2 = u*u + v*v; }
  while(s2 >= 1 || s2 === 0);
  const m = Math.sqrt(-2 * Math.log(s2) / s2);
  spare = v * m;
  return u * m;
};

/* ---------- formatting ---------- */
HS.money = function(n){
  const neg = n < 0; n = Math.abs(n);
  let s;
  if(n >= 1e9)      s = (n/1e9).toFixed(n >= 1e10 ? 1 : 2) + 'B';
  else if(n >= 1e6) s = (n/1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
  else if(n >= 1e5) s = Math.round(n/1e3) + 'K';
  else              s = Math.round(n).toLocaleString('en-US');
  return (neg ? '-$' : '$') + s;
};
HS.moneyFull = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
HS.signed = n => (n >= 0 ? '+' : '') + HS.money(n);
HS.pct = n => (n >= 0 ? '+' : '') + (n*100).toFixed(1) + '%';
HS.pick = arr => arr[Math.floor(Math.random() * arr.length)];

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Weekend'];
HS.dayName = d => DAYS[(d - 1) % 6];   /* weekday/calendar helpers live in tape.js */
HS.clockStr = function(hour){
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ':' + String(m).padStart(2,'0') + ' ' + ap;
};

/* ---------- dom ---------- */
HS.$ = id => document.getElementById(id);
HS.el = function(tag, cls, html){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html != null) e.innerHTML = html;
  return e;
};

})(window.HS);
