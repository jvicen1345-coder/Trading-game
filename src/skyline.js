/* Copyright (c) 2026 Jonathan Vicencio. All rights reserved. See LICENSE. */
/* Title screen backdrop.
 *
 * The city seen from across the water at night: three parallax bands of
 * towers with lit windows, cloud drifting off the harbour, aircraft on
 * approach, birds, and the red beacons on the tall roofs. Canvas 2D, no
 * assets, and it only runs while the title card is on screen.
 */
(function(){
const HS = window.HS;
const clamp = HS.clamp;

/* Depth bands, far to near. Heights are a share of the skyline band, so
   the silhouette keeps its proportions on any window. */
const LAYERS = [
  { speed:2.2, gapMin:6, gapMax:26, wMin:22, wMax:54,  hMin:.30, hMax:.62,
    fill:'#222C46', roof:'#2C3856', step:8,  winA:.40, beacon:false },
  { speed:5.0, gapMin:8, gapMax:30, wMin:30, wMax:76,  hMin:.42, hMax:.86,
    fill:'#121A2E', roof:'#1A2440', step:10, winA:.72, beacon:true  },
  { speed:9.5, gapMin:10,gapMax:38, wMin:44, wMax:110, hMin:.50, hMax:1.0,
    fill:'#05080F', roof:'#0A0F1A', step:13, winA:.92, beacon:true  }
];

const WARM = ['#FFD79A','#FFC978','#F7E3BE','#FFE9C4'];
const COOL = ['#9FD8FF','#7FE4E0','#BFC9FF'];

HS.Skyline = function(canvas){
  const ctx = canvas.getContext('2d', { alpha:false });
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, band = 0, dpr = 1;
  let layers = [], stars = [], clouds = [], birds = [], planes = [], moon = null;
  let t = 0, last = 0, raf = 0, live = false, nextPlane = 4, nextFlock = 7;

  /* ---------------------------------------------------------------- build */

  function makeBuilding(rand, L, x){
    const w = Math.round(rand.range(L.wMin, L.wMax));
    const h = Math.round(band * rand.range(L.hMin, L.hMax) * rand.range(.72, 1));
    const b = { x:x, w:w, h:h, win:[], cap:null, beacon:false };

    /* Some towers are mostly dark. Offices empty out, floor by floor. */
    const density = rand.chance(.18) ? rand.range(.04, .12) : rand.range(.22, .62);
    const cool = rand.chance(.22);
    const pad = Math.max(3, L.step * .4);
    const cols = Math.floor((w - pad * 2) / L.step);
    const rows = Math.floor((h - pad * 2) / L.step);
    const ww = Math.max(1.5, L.step * .46), wh = Math.max(2, L.step * .54);

    for(let c = 0; c < cols; c++){
      for(let r = 0; r < rows; r++){
        if(!rand.chance(density)) continue;
        b.win.push({
          x: pad + c * L.step, y: pad + r * L.step, w:ww, h:wh,
          c: rand.pick(cool && rand.chance(.5) ? COOL : WARM),
          a: rand.range(.45, 1)
        });
      }
    }

    /* Roofline. Water towers and setbacks are the tells that say New York. */
    const roll = rand();
    if(roll < .22)      b.cap = { k:'tower', w:Math.min(16, w*.3), h:rand.range(10,17), x:rand.range(.18,.7) };
    else if(roll < .40) b.cap = { k:'setback', w:w*rand.range(.42,.68), h:rand.range(12,34) };
    else if(roll < .52) b.cap = { k:'mast', h:rand.range(16,46), x:rand.range(.35,.65) };
    if(L.beacon && h > band * .66) b.beacon = true;
    return b;
  }

  function buildLayer(i){
    const L = LAYERS[i];
    const lw = W + 320;                              /* tiles seamlessly at lw */
    const off = document.createElement('canvas');
    off.width = Math.ceil(lw * dpr); off.height = Math.ceil(H * dpr);
    const c = off.getContext('2d');
    c.scale(dpr, dpr);

    const rand = HS.rng(1471 + i * 977);
    const list = [];
    let x = -40;
    while(x < lw + 40){
      const b = makeBuilding(rand, L, x);
      list.push(b);
      x += b.w + rand.range(L.gapMin, L.gapMax) * .3;
    }

    /* Anything overhanging the seam gets a twin on the other side. */
    const draw = [];
    list.forEach(b => {
      draw.push(b);
      if(b.x + b.w > lw) draw.push(Object.assign({}, b, { x: b.x - lw, twin:true }));
    });

    draw.forEach(b => {
      const base = H, top = H - b.h;
      c.fillStyle = L.fill;
      c.fillRect(b.x, top, b.w, b.h);
      c.fillStyle = L.roof;
      c.fillRect(b.x, top, b.w, 2);

      if(b.cap && b.cap.k === 'setback'){
        const cw = b.cap.w, cx = b.x + (b.w - cw) / 2;
        c.fillStyle = L.fill; c.fillRect(cx, top - b.cap.h, cw, b.cap.h);
        c.fillStyle = L.roof; c.fillRect(cx, top - b.cap.h, cw, 2);
      } else if(b.cap && b.cap.k === 'tower'){
        const cw = b.cap.w, cx = b.x + b.w * b.cap.x, ch = b.cap.h;
        c.fillStyle = L.fill;
        c.fillRect(cx, top - ch, cw, ch * .68);
        c.fillRect(cx + cw * .12, top - ch * .32, cw * .1, ch * .32);
        c.fillRect(cx + cw * .78, top - ch * .32, cw * .1, ch * .32);
        c.beginPath();                                       /* conical lid */
        c.moveTo(cx - 1, top - ch); c.lineTo(cx + cw / 2, top - ch - 5);
        c.lineTo(cx + cw + 1, top - ch); c.closePath(); c.fill();
      } else if(b.cap && b.cap.k === 'mast'){
        c.strokeStyle = L.roof; c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(Math.round(b.x + b.w * b.cap.x) + .5, top);
        c.lineTo(Math.round(b.x + b.w * b.cap.x) + .5, top - b.cap.h);
        c.stroke();
      }

      c.globalAlpha = L.winA;
      b.win.forEach(w => {
        c.globalAlpha = L.winA * w.a;
        c.fillStyle = w.c;
        c.fillRect(b.x + w.x, base - b.h + w.y, w.w, w.h);
      });
      c.globalAlpha = 1;
    });

    /* A handful of windows keep their own clock: someone works late, a
       lamp goes off, a lift lands on a floor. */
    const blink = [];
    list.forEach(b => {
      if(!b.win.length || !rand.chance(.34)) return;
      const n = rand.int(1, 3);
      for(let k = 0; k < n; k++){
        const w = rand.pick(b.win);
        blink.push({ x:b.x + w.x, y:H - b.h + w.y, w:w.w, h:w.h, c:w.c,
                     p:rand.range(3.5, 14), ph:rand(), on:rand.range(.3, .7) });
      }
    });

    const beacons = [];
    list.forEach(b => {
      if(!b.beacon) return;
      let by = H - b.h;
      if(b.cap && b.cap.k === 'setback') by -= b.cap.h;
      if(b.cap && b.cap.k === 'mast') by -= b.cap.h;
      beacons.push({ x:b.x + b.w / 2, y:by - 1, ph:rand(), p:rand.range(1.3, 2.1) });
    });

    return { c:off, lw:lw, speed:LAYERS[i].speed, blink:blink, beacons:beacons };
  }

  function cloudSprite(rand){
    const s = 150;
    const off = document.createElement('canvas');
    off.width = s * 2; off.height = s;
    const c = off.getContext('2d');
    for(let i = 0; i < 9; i++){
      const cx = rand.range(s * .3, s * 1.7), cy = rand.range(s * .42, s * .68);
      const r = rand.range(s * .16, s * .34);
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(150,164,205,.34)');
      g.addColorStop(1, 'rgba(150,164,205,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    }
    return off;
  }

  function moonSprite(){
    const s = 128;
    const disc = document.createElement('canvas');            /* crescent alone */
    disc.width = s; disc.height = s;
    const d = disc.getContext('2d');
    d.fillStyle = '#E7EDF8';
    d.beginPath(); d.arc(s/2, s/2, s*.19, 0, 7); d.fill();
    d.globalCompositeOperation = 'destination-out';
    d.beginPath(); d.arc(s*.385, s*.435, s*.172, 0, 7); d.fill();

    const off = document.createElement('canvas');             /* halo behind it */
    off.width = s; off.height = s;
    const c = off.getContext('2d');
    const g = c.createRadialGradient(s/2, s/2, s*.17, s/2, s/2, s*.5);
    g.addColorStop(0, 'rgba(226,232,246,.17)');
    g.addColorStop(1, 'rgba(226,232,246,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.drawImage(disc, 0, 0);
    return off;
  }

  function rebuild(){
    const rand = HS.rng(8123);
    band = Math.min(H * .60, 430);
    layers = LAYERS.map((L, i) => buildLayer(i));

    stars = [];
    const n = Math.round(W * H / 5200);
    for(let i = 0; i < n; i++){
      stars.push({ x:rand() * W, y:rand() * (H - band * .8),
                   r:rand.range(.4, 1.15), a:rand.range(.18, .7),
                   p:rand.range(2.4, 7), ph:rand() });
    }

    const sprites = [cloudSprite(rand), cloudSprite(rand), cloudSprite(rand)];
    clouds = [];
    for(let i = 0; i < 7; i++){
      clouds.push({ s:rand.pick(sprites), x:rand() * (W + 400) - 200,
                    y:rand.range(-20, H - band * .9), sc:rand.range(.8, 2.4),
                    a:rand.range(.20, .55), v:rand.range(2.5, 8) });
    }
    moon = moonSprite();
    moon.x = clamp(W * .78 - 64, 12, W - 140);      /* stays in frame on a phone */
    moon.y = Math.max(40, H * .13);
  }

  function resize(){
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(r.width));
    H = Math.max(240, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }

  /* ----------------------------------------------------------------- move */

  function spawnPlane(){
    const rand = HS.rng((Math.random() * 1e9) | 0);
    const dir = rand.chance(.5) ? 1 : -1;
    planes.push({
      dir:dir, x: dir > 0 ? -60 : W + 60,
      y: rand.range(H * .10, Math.max(H * .12, H - band * 1.05)),
      v: rand.range(24, 52), s: rand.range(1.1, 2.1), ph:rand(),
      rise: rand.range(-.05, .05)
    });
    nextPlane = rand.range(8, 18);
  }

  function spawnFlock(){
    const rand = HS.rng((Math.random() * 1e9) | 0);
    const dir = rand.chance(.5) ? 1 : -1;
    const y0 = rand.range(H * .20, Math.max(H * .24, H - band * .95));
    const v = rand.range(34, 62), n = rand.int(5, 9);
    for(let i = 0; i < n; i++){
      birds.push({
        dir:dir, x: (dir > 0 ? -40 : W + 40) - dir * i * rand.range(12, 26),
        y: y0 + rand.range(-22, 22), v: v * rand.range(.94, 1.06),
        s: rand.range(.7, 1.25), ph: rand() * 6.283, fl: rand.range(6.5, 9.5),
        bob: rand.range(3, 9), bp: rand.range(.7, 1.5)
      });
    }
    nextFlock = rand.range(13, 26);
  }

  function step(dt){
    t += dt;
    clouds.forEach(c => {
      c.x += c.v * dt * .12;
      if(c.x > W + 220) c.x = -220 - Math.random() * 160;
    });
    nextPlane -= dt; if(nextPlane <= 0) spawnPlane();
    nextFlock -= dt; if(nextFlock <= 0) spawnFlock();

    planes.forEach(p => { p.x += p.dir * p.v * dt; p.y += p.rise * dt * 10; });
    planes = planes.filter(p => p.x > -140 && p.x < W + 140);
    birds.forEach(b => { b.x += b.dir * b.v * dt; });
    birds = birds.filter(b => b.x > -80 && b.x < W + 80);
  }

  /* ----------------------------------------------------------------- draw */

  function sky(){
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#05070C');
    g.addColorStop(.42, '#0A0D18');
    g.addColorStop(.74, '#141428');
    g.addColorStop(1,   '#2A2036');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const v = ctx.createRadialGradient(W * .5, H * .30, 0, W * .5, H * .30, Math.max(W, H) * .55);
    v.addColorStop(0, 'rgba(139,107,255,.13)');
    v.addColorStop(1, 'rgba(139,107,255,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  function drawStars(){
    stars.forEach(s => {
      const tw = .62 + .38 * Math.sin((t / s.p + s.ph) * 6.283);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = '#DCE6FF';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });
    ctx.globalAlpha = 1;
  }

  function drawClouds(){
    clouds.forEach(c => {
      ctx.globalAlpha = c.a;
      const w = c.s.width * c.sc, h = c.s.height * c.sc;
      ctx.drawImage(c.s, c.x, c.y, w, h);
    });
    ctx.globalAlpha = 1;
  }

  function drawBirds(){
    ctx.lineCap = 'round';
    birds.forEach(b => {
      const flap = Math.sin(t * b.fl + b.ph);
      const y = b.y + Math.sin(t * b.bp + b.ph) * b.bob;
      const s = b.s * 6, lift = flap * s * .85;
      const edge = Math.min(1, Math.min(b.x + 40, W + 40 - b.x) / 60);
      ctx.strokeStyle = 'rgba(196,208,232,' + (.78 * edge) + ')';
      ctx.lineWidth = Math.max(1.1, b.s * 1.5);
      ctx.beginPath();
      ctx.moveTo(b.x - s * 1.7, y - lift);
      ctx.quadraticCurveTo(b.x - s * .5, y + s * .25, b.x, y);
      ctx.quadraticCurveTo(b.x + s * .5, y + s * .25, b.x + s * 1.7, y - lift);
      ctx.stroke();
    });
  }

  function lamp(x, y, rgb, a, r){
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    g.addColorStop(.35, 'rgba(' + rgb + ',' + (a * .55) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  function drawPlanes(){
    planes.forEach(p => {
      const s = p.s * 8, d = p.dir;
      const fade = Math.min(1, Math.min(p.x + 70, W + 70 - p.x) / 90);

      const tail = ctx.createLinearGradient(p.x - d * s * 30, 0, p.x, 0);
      tail.addColorStop(0, 'rgba(188,202,232,0)');
      tail.addColorStop(1, 'rgba(188,202,232,' + (.13 * fade) + ')');
      ctx.strokeStyle = tail; ctx.lineWidth = s * .22; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - d * s * 30, p.y + s * .08);
      ctx.lineTo(p.x - d * s * 1.7, p.y);
      ctx.stroke();

      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(154,168,198,.78)';
      ctx.beginPath();                                        /* fuselage */
      ctx.ellipse(p.x, p.y, s * 1.6, s * .26, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();                                        /* swept wings */
      ctx.moveTo(p.x + d * s * .35, p.y - s * .12);
      ctx.lineTo(p.x - d * s * .95, p.y - s * 1.15);
      ctx.lineTo(p.x - d * s * .45, p.y - s * 1.15);
      ctx.lineTo(p.x + d * s * .2, p.y + s * .12);
      ctx.lineTo(p.x - d * s * .45, p.y + s * 1.15);
      ctx.lineTo(p.x - d * s * .95, p.y + s * 1.15);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();                                        /* fin */
      ctx.moveTo(p.x - d * s * 1.1, p.y);
      ctx.lineTo(p.x - d * s * 1.55, p.y - s * .62);
      ctx.lineTo(p.x - d * s * 1.0, p.y - s * .04);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;

      /* Port red, starboard green, and the white strobe that gives an
         aircraft away long before you can make out its shape. */
      lamp(p.x - d * s * .8, p.y - s * 1.16, '255,91,103', .95 * fade, s * .46);
      lamp(p.x - d * s * .8, p.y + s * 1.16, '63,214,140', .95 * fade, s * .46);
      if(((t * 1.1 + p.ph) % 1) < .09)
        lamp(p.x - d * s * .6, p.y, '255,255,255', fade, s * .9);
    });
  }

  /* Air between the bands. Distance washes a skyline out, and it is the
     cheapest way to make three flat layers read as depth. */
  function scrim(rgb, a){
    const top = H - band * 1.2;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, 'rgba(' + rgb + ',0)');
    g.addColorStop(.55, 'rgba(' + rgb + ',' + (a * .8) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',' + a + ')');
    ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
  }

  function haze(top, a, tint){
    const g = ctx.createLinearGradient(0, top - 90, 0, top + 40);
    g.addColorStop(0, 'rgba(' + tint + ',0)');
    g.addColorStop(1, 'rgba(' + tint + ',' + a + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, top - 90, W, 130);
  }

  function drawLayer(i){
    const L = layers[i];
    const off = (t * L.speed) % L.lw;
    ctx.drawImage(L.c, -off, 0, L.lw, H);
    ctx.drawImage(L.c, -off + L.lw, 0, L.lw, H);

    L.blink.forEach(b => {
      const on = ((t / b.p + b.ph) % 1) < b.on;
      if(!on) return;
      ctx.fillStyle = b.c;
      const x = b.x - off;
      ctx.fillRect(x, b.y, b.w, b.h);
      ctx.fillRect(x + L.lw, b.y, b.w, b.h);
    });

    L.beacons.forEach(b => {
      const pulse = Math.max(0, Math.sin((t / b.p + b.ph) * 6.283));
      if(pulse < .04) return;
      const x = b.x - off;
      [x, x + L.lw].forEach(px => {
        if(px < -12 || px > W + 12) return;
        const g = ctx.createRadialGradient(px, b.y, 0, px, b.y, 7);
        g.addColorStop(0, 'rgba(255,91,103,' + (.75 * pulse) + ')');
        g.addColorStop(1, 'rgba(255,91,103,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, b.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,140,146,' + pulse + ')';
        ctx.fillRect(px - .9, b.y - 1.8, 1.8, 1.8);
      });
    });
  }

  function frame(){
    sky();
    drawStars();
    ctx.globalAlpha = .85; ctx.drawImage(moon, moon.x, moon.y); ctx.globalAlpha = 1;
    drawClouds();
    drawBirds();
    drawPlanes();

    haze(H - band * .62, .18, '58,44,86');
    drawLayer(0);
    scrim('30,34,62', .40);
    haze(H - band * .40, .22, '74,52,74');
    drawLayer(1);
    scrim('22,24,46', .30);
    haze(H - band * .22, .26, '96,60,58');
    drawLayer(2);

    const g = ctx.createLinearGradient(0, H - 90, 0, H);   /* street glow */
    g.addColorStop(0, 'rgba(232,184,92,0)');
    g.addColorStop(1, 'rgba(232,184,92,.10)');
    ctx.fillStyle = g; ctx.fillRect(0, H - 90, W, 90);

    const vg = ctx.createRadialGradient(W/2, H*.45, Math.min(W,H)*.22, W/2, H*.45, Math.max(W,H)*.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  function loop(now){
    if(!live) return;
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    frame();
    raf = requestAnimationFrame(loop);
  }

  function onResize(){ resize(); if(!live) frame(); }

  return {
    start(){
      if(live) return;
      resize();
      if(still){ t = 6; step(0); frame(); window.addEventListener('resize', onResize); return; }
      live = true; last = performance.now();
      spawnFlock(); nextPlane = 3;
      window.addEventListener('resize', onResize);
      raf = requestAnimationFrame(loop);
    },
    stop(){
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    }
  };
};
})();
