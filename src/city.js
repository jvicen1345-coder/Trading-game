/* Copyright (c) 2026 Jonathan Vicencio. All rights reserved. See LICENSE. */
/* MARKET MAKER - procedural city: layout, geometry, traffic. */
window.HS = window.HS || {};
(function(HS){
'use strict';

const GRID  = 11;     // blocks per side
const BLOCK = 46;     // block footprint
const ROAD  = 16;     // road width
const CELL  = BLOCK + ROAD;
const SIZE  = GRID * CELL;
const HALF  = SIZE / 2;

HS.CITY = { GRID, BLOCK, ROAD, CELL, SIZE, HALF };

/* Where the story happens. block:[i,j] indexes the street grid. */
const LANDMARKS = [
  { id:'home_basement', block:[1,9], name:"Parents' Basement",   short:'HOME', icon:'home',
    color:0x6E5B47, h:9,  w:26, d:22, accent:0xE8B85C },
  { id:'home_studio',   block:[3,8], name:'Rented Studio',       short:'HOME', icon:'home',
    color:0x5C6270, h:26, w:26, d:24, accent:0xE8B85C, hidden:true },
  { id:'home_loft',     block:[7,3], name:'Riverside Loft',      short:'HOME', icon:'home',
    color:0x4A5666, h:38, w:30, d:26, accent:0xE8B85C, hidden:true },
  { id:'home_penthouse',block:[5,1], name:'Sky Penthouse',       short:'HOME', icon:'home',
    color:0x2F3A4C, h:56, w:30, d:28, accent:0xE8B85C, hidden:true },

  { id:'brokerage', block:[4,6], name:'Ladder & Co. Brokerage',  short:'WORK', icon:'work',
    color:0x3A4658, h:38, w:34, d:30, accent:0x3ECFCF },
  { id:'exchange',  block:[5,5], name:'The Exchange',            short:'FLOOR', icon:'exchange',
    color:0x2A3242, h:52, w:38, d:34, accent:0x8B6BFF },
  { id:'bank',      block:[3,4], name:'First Federal Bank',      short:'BANK', icon:'bank',
    color:0x4C4638, h:34, w:32, d:28, accent:0x46C98A },
  { id:'bar',       block:[7,7], name:'The Ticker Bar',          short:'BAR', icon:'bar',
    color:0x54303A, h:16, w:28, d:24, accent:0xFF5B67 },
  { id:'school',    block:[1,7], name:'Vance Night School',      short:'LEARN', icon:'school',
    color:0x3E4A44, h:24, w:30, d:26, accent:0x9BD46B },
  { id:'realtor',   block:[8,4], name:'Kestrel Realty',          short:'HOMES', icon:'realty',
    color:0x4A4258, h:20, w:28, d:24, accent:0xE0A6FF },
  { id:'sec',       block:[9,9], name:'SEC Field Office',        short:'SEC', icon:'sec',
    color:0x3A3A3A, h:30, w:30, d:28, accent:0xFF8A3C },
  { id:'firm',      block:[6,3], name:'Your Firm',               short:'HQ', icon:'firm',
    color:0x2C3A38, h:46, w:36, d:32, accent:0xE8B85C, hidden:true },

  { id:'gym',       block:[7,5], name:'Ironside Gym',             short:'GYM', icon:'gym',
    color:0x3E3A4A, h:18, w:30, d:26, accent:0x6BD4C0 },
  { id:'store',     block:[5,7], name:'Kwik Corner',              short:'STORE', icon:'store',
    color:0x4A4630, h:12, w:24, d:20, accent:0xF0E06A }
];

/* block index -> world-space rectangle */
function blockRect(i, j){
  const x0 = -HALF + i * CELL + ROAD / 2;
  const z0 = -HALF + j * CELL + ROAD / 2;
  return { x0, z0, x1: x0 + BLOCK, z1: z0 + BLOCK, cx: x0 + BLOCK/2, cz: z0 + BLOCK/2 };
}
HS.blockRect = blockRect;

const FILLER_COLORS = [
  0x2E3644, 0x39424F, 0x434B58, 0x2A3140, 0x4A5260,
  0x353D4A, 0x3F3A44, 0x2F3A3E, 0x454052, 0x38424C
];

/* ------------------------------------------------------------------
   Layout: buildings, colliders, landmark doors.
   ------------------------------------------------------------------ */
HS.buildCity = function(seed){
  const rnd = HS.rng(seed);
  const buildings = [];   // {x,z,w,d,h,color,landmark}
  const colliders = [];   // {x0,z0,x1,z1}
  const landmarks = [];
  const lampPosts = [];
  const trees = [];
  const props = [];
  const tanks = [];

  const lmByBlock = {};
  LANDMARKS.forEach(l => { lmByBlock[l.block[0] + ',' + l.block[1]] = l; });

  for(let i = 0; i < GRID; i++){
    for(let j = 0; j < GRID; j++){
      const r = blockRect(i, j);
      const lm = lmByBlock[i + ',' + j];

      if(lm){
        // Landmark: one signature building, centred, with a door on the south face.
        const b = { x:r.cx, z:r.cz, w:lm.w, d:lm.d, h:lm.h, color:lm.color, landmark:lm.id };
        buildings.push(b);
        colliders.push({ x0:b.x-b.w/2, z0:b.z-b.d/2, x1:b.x+b.w/2, z1:b.z+b.d/2 });
        landmarks.push({
          id:lm.id, name:lm.name, short:lm.short, accent:lm.accent, hidden:!!lm.hidden,
          icon:lm.icon,
          x:b.x, z:b.z + b.d/2 + 4,          // door: just outside the south wall
          bx:b.x, bz:b.z, bh:b.h, bw:b.w, bd:b.d
        });
      } else {
        // Filler block: 1–4 lots of stacked boxes.
        const lots = rnd.pick([1, 2, 2, 4]);
        const cells = lots === 1 ? [[0,0,1,1]]
                    : lots === 2 ? (rnd.chance(0.5) ? [[0,0,1,.5],[0,.5,1,.5]] : [[0,0,.5,1],[.5,0,.5,1]])
                    : [[0,0,.5,.5],[.5,0,.5,.5],[0,.5,.5,.5],[.5,.5,.5,.5]];
        cells.forEach(c => {
          const pad = rnd.range(2.5, 5);
          const w = BLOCK * c[2] - pad * 2;
          const d = BLOCK * c[3] - pad * 2;
          if(w < 6 || d < 6) return;
          const x = r.x0 + BLOCK * c[0] + BLOCK * c[2] / 2;
          const z = r.z0 + BLOCK * c[1] + BLOCK * c[3] / 2;
          // taller towers toward the middle of the map (the financial district)
          const dist = Math.hypot(x, z) / HALF;
          const maxH = HS.lerp(54, 18, HS.clamp(dist, 0, 1));
          const h = rnd.range(9, maxH) * (rnd.chance(0.10) ? 1.25 : 1);
          buildings.push({ x, z, w, d, h, color: rnd.pick(FILLER_COLORS), landmark:null });
          if(h > 26 && rnd.chance(0.32)) tanks.push({ x, z, y:h + 0.32 });
          colliders.push({ x0:x-w/2, z0:z-d/2, x1:x+w/2, z1:z+d/2 });
          if(rnd.chance(0.3)) trees.push({ x: x + rnd.range(-w/2-3, w/2+3), z: z + d/2 + rnd.range(2,4) });
        });
      }

      // street lamps on the block's road-side corners
      lampPosts.push({ x:r.x0 - ROAD/2 + 2.5, z:r.z0 - ROAD/2 + 2.5 });

      // things you would actually trip over in this city
      const edge = () => {
        const side = rnd.int(0,3);
        if(side === 0) return { x: rnd.range(r.x0, r.x1), z: r.z0 - 3.4, rot: 0 };
        if(side === 1) return { x: rnd.range(r.x0, r.x1), z: r.z1 + 3.4, rot: Math.PI };
        if(side === 2) return { x: r.x0 - 3.4, z: rnd.range(r.z0, r.z1), rot: Math.PI/2 };
        return { x: r.x1 + 3.4, z: rnd.range(r.z0, r.z1), rot: -Math.PI/2 };
      };
      if(rnd.chance(0.30)) props.push(Object.assign({ kind:'cart' },   edge()));
      if(rnd.chance(0.22)) props.push(Object.assign({ kind:'stand' },  edge()));
      if(rnd.chance(0.26)) props.push(Object.assign({ kind:'subway' }, edge()));
      if(rnd.chance(0.34)) props.push(Object.assign({ kind:'steam' },  edge()));
      if(rnd.chance(0.45)) props.push(Object.assign({ kind:'hydrant' },edge()));
      if(rnd.chance(0.40)) props.push(Object.assign({ kind:'trash' },  edge()));
      if(rnd.chance(0.30)) props.push(Object.assign({ kind:'bench' },  edge()));
      if(rnd.chance(0.18)) props.push(Object.assign({ kind:'scaffold' },edge()));
    }
  }

  // Distant skyline: pure backdrop beyond the square grid, never reachable.
  const skyline = [];
  const MARGIN = 46;                     // clear of the outermost blocks
  let guard = 0;
  while(skyline.length < 300 && guard++ < 6000){
    const x = rnd.range(-HALF - 420, HALF + 420);
    const z = rnd.range(-HALF - 420, HALF + 420);
    if(Math.abs(x) < HALF + MARGIN && Math.abs(z) < HALF + MARGIN) continue;  // inside play area
    skyline.push({
      x, z,
      w: rnd.range(18, 42), d: rnd.range(18, 42),
      h: rnd.range(40, 175),
      color: rnd.pick([0x1E242E, 0x232935, 0x1A2028, 0x272E3A])
    });
  }

  return { seed, buildings, colliders, landmarks, lampPosts, trees, props, tanks, skyline, size:SIZE, half:HALF };
};

/* ------------------------------------------------------------------
   Textures, generated so the game ships with no image assets.
   ------------------------------------------------------------------ */
function makeWindowTextures(THREE){
  const S = 128, cols = 4, rows = 4;
  const wall = document.createElement('canvas'); wall.width = wall.height = S;
  const lit  = document.createElement('canvas'); lit.width  = lit.height  = S;
  const wc = wall.getContext('2d'), lc = lit.getContext('2d');

  wc.fillStyle = '#ffffff'; wc.fillRect(0,0,S,S);     // white = tinted by vertex colour
  lc.fillStyle = '#000000'; lc.fillRect(0,0,S,S);     // black = unlit

  const cw = S/cols, ch = S/rows;
  for(let y = 0; y < rows; y++){
    for(let x = 0; x < cols; x++){
      const px = x*cw + cw*0.22, py = y*ch + ch*0.20;
      const pw = cw*0.56, ph = ch*0.46;
      wc.fillStyle = 'rgba(0,0,0,.34)';               // recessed glass, darkens the tint
      wc.fillRect(px, py, pw, ph);
      const on = Math.random() < 0.55;
      if(on){
        const warm = Math.random() < 0.75;
        lc.fillStyle = warm ? 'rgb(255,206,130)' : 'rgb(180,220,255)';
        lc.globalAlpha = 0.55 + Math.random()*0.45;
        lc.fillRect(px, py, pw, ph);
        lc.globalAlpha = 1;
      }
    }
  }
  const mk = cv => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    return t;
  };
  return { wall: mk(wall), lit: mk(lit) };
}

/* ------------------------------------------------------------------
   Geometry: every building merged into one non-indexed buffer so the
   whole skyline costs two draw calls.
   ------------------------------------------------------------------ */
const FACES = [
  // [nx,ny,nz, corner offsets ...] built inline below
];

function pushWall(P, N, U, C, x, y, z, w, h, d, col, uUnit){
  const hw = w/2, hd = d/2;
  const y0 = y, y1 = y + h;
  const r = (col >> 16 & 255)/255, g = (col >> 8 & 255)/255, b = (col & 255)/255;
  const uW = w / uUnit, uD = d / uUnit, vH = h / uUnit;

  // side faces: +Z, -Z, +X, -X   (quad = 2 triangles, 6 verts)
  const quads = [
    { n:[0,0,1],  p:[[x-hw,y0,z+hd],[x+hw,y0,z+hd],[x+hw,y1,z+hd],[x-hw,y1,z+hd]], u:uW, v:vH },
    { n:[0,0,-1], p:[[x+hw,y0,z-hd],[x-hw,y0,z-hd],[x-hw,y1,z-hd],[x+hw,y1,z-hd]], u:uW, v:vH },
    { n:[1,0,0],  p:[[x+hw,y0,z+hd],[x+hw,y0,z-hd],[x+hw,y1,z-hd],[x+hw,y1,z+hd]], u:uD, v:vH },
    { n:[-1,0,0], p:[[x-hw,y0,z-hd],[x-hw,y0,z+hd],[x-hw,y1,z+hd],[x-hw,y1,z-hd]], u:uD, v:vH }
  ];
  for(const q of quads){
    const [a,b2,c,dd] = q.p;
    const uv = [[0,0],[q.u,0],[q.u,q.v],[0,q.v]];
    const tri = [0,1,2, 0,2,3];
    for(const k of tri){
      const p = q.p[k];
      P.push(p[0], p[1], p[2]);
      N.push(q.n[0], q.n[1], q.n[2]);
      U.push(uv[k][0], uv[k][1]);
      C.push(r, g, b);
    }
  }
}

function pushRoof(P, N, C, x, y, z, w, d, col){
  const hw = w/2, hd = d/2;
  const r = (col >> 16 & 255)/255 * 0.72, g = (col >> 8 & 255)/255 * 0.72, b = (col & 255)/255 * 0.72;
  const p = [[x-hw,y,z-hd],[x-hw,y,z+hd],[x+hw,y,z+hd],[x+hw,y,z-hd]];
  for(const k of [0,1,2, 0,2,3]){
    P.push(p[k][0], p[k][1], p[k][2]);
    N.push(0,1,0);
    C.push(r,g,b);
  }
}

function pushFlatQuad(P, N, C, x, y, z, w, d, col){
  pushRoof(P, N, C, x, y, z, w, d, col);
}

HS.buildCityMeshes = function(THREE, city){
  const group = new THREE.Group();
  const tex = makeWindowTextures(THREE);

  /* --- ground / asphalt --- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshLambertMaterial({ color: 0x101319 })
  );
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  group.add(ground);

  /* --- sidewalks: one merged slab per block --- */
  {
    const P = [], N = [], C = [];
    for(let i = 0; i < GRID; i++) for(let j = 0; j < GRID; j++){
      const r = blockRect(i, j);
      pushFlatQuad(P, N, C, r.cx, 0.32, r.cz, BLOCK + 5, BLOCK + 5, 0x3A3F49);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(C, 3));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors:true }));
    m.receiveShadow = true;
    group.add(m);
  }

  /* --- lane markings --- */
  {
    const P = [], N = [], C = [];
    const dash = 5, gap = 6;
    for(let i = 0; i <= GRID; i++){
      const c = -HALF + i * CELL;
      for(let t = -HALF; t < HALF; t += dash + gap){
        pushFlatQuad(P, N, C, c, 0.06, t + dash/2, 1.1, dash, 0x9C8A54);   // N/S road
        pushFlatQuad(P, N, C, t + dash/2, 0.06, c, dash, 1.1, 0x9C8A54);   // E/W road
      }
    }
    // crosswalk ladders on every approach to an intersection
    for(let i = 0; i <= GRID; i++){
      for(let j = 0; j <= GRID; j++){
        const cx = -HALF + i * CELL, cz = -HALF + j * CELL;
        for(let k = -2; k <= 2; k++){
          const o = k * 2.6;
          pushFlatQuad(P, N, C, cx + o, 0.07, cz + ROAD/2 + 1.6, 1.2, 3.4, 0x9E9887);
          pushFlatQuad(P, N, C, cx + o, 0.07, cz - ROAD/2 - 1.6, 1.2, 3.4, 0x9E9887);
          pushFlatQuad(P, N, C, cx + ROAD/2 + 1.6, 0.07, cz + o, 3.4, 1.2, 0x9E9887);
          pushFlatQuad(P, N, C, cx - ROAD/2 - 1.6, 0.07, cz + o, 3.4, 1.2, 0x9E9887);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(C, 3));
    group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors:true })));
  }

  /* --- buildings --- */
  const wallP = [], wallN = [], wallU = [], wallC = [];
  const roofP = [], roofN = [], roofC = [];
  for(const b of (city.skyline || [])){
    pushWall(wallP, wallN, wallU, wallC, b.x, 0, b.z, b.w, b.h, b.d, b.color, 8);
    pushRoof(roofP, roofN, roofC, b.x, b.h, b.z, b.w, b.d, b.color);
  }
  for(const b of city.buildings){
    pushWall(wallP, wallN, wallU, wallC, b.x, 0.32, b.z, b.w, b.h, b.d, b.color, 8);
    pushRoof(roofP, roofN, roofC, b.x, b.h + 0.32, b.z, b.w, b.d, b.color);
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallP, 3));
  wallGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(wallN, 3));
  wallGeo.setAttribute('uv',       new THREE.Float32BufferAttribute(wallU, 2));
  wallGeo.setAttribute('color',    new THREE.Float32BufferAttribute(wallC, 3));
  const wallMat = new THREE.MeshLambertMaterial({
    vertexColors:true, map:tex.wall,
    emissive:0xffffff, emissiveMap:tex.lit, emissiveIntensity:0
  });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.castShadow = walls.receiveShadow = true;
  group.add(walls);

  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofP, 3));
  roofGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(roofN, 3));
  roofGeo.setAttribute('color',    new THREE.Float32BufferAttribute(roofC, 3));
  const roofs = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ vertexColors:true }));
  roofs.castShadow = roofs.receiveShadow = true;
  group.add(roofs);

  /* --- street lamps --- */
  {
    const poleGeo = new THREE.CylinderGeometry(0.28, 0.28, 9, 5);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2A2E36 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, city.lampPosts.length);
    const bulbGeo = new THREE.SphereGeometry(0.85, 7, 5);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xFFD79A });
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, city.lampPosts.length);
    const m = new THREE.Matrix4();
    city.lampPosts.forEach((p, i) => {
      m.makeTranslation(p.x, 4.8, p.z); poles.setMatrixAt(i, m);
      m.makeTranslation(p.x, 9.4, p.z); bulbs.setMatrixAt(i, m);
    });
    poles.instanceMatrix.needsUpdate = bulbs.instanceMatrix.needsUpdate = true;
    group.add(poles); group.add(bulbs);
    group.userData.lampBulbs = bulbs;
  }

  /* --- trees --- */
  if(city.trees.length){
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 3.4, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4A3B2C });
    const leafGeo  = new THREE.ConeGeometry(2.4, 5.4, 6);
    const leafMat  = new THREE.MeshLambertMaterial({ color: 0x2E5A3A });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, city.trees.length);
    const leaves = new THREE.InstancedMesh(leafGeo,  leafMat,  city.trees.length);
    const m = new THREE.Matrix4();
    city.trees.forEach((t, i) => {
      m.makeTranslation(t.x, 2.0, t.z); trunks.setMatrixAt(i, m);
      m.makeTranslation(t.x, 6.0, t.z); leaves.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
    group.add(trunks); group.add(leaves);
  }

  /* --- street furniture --- */
  if(city.props && city.props.length){
    const mk = (geo, col, count) => new THREE.InstancedMesh(geo,
      new THREE.MeshLambertMaterial({ color: col }), Math.max(1, count));
    const by = k => city.props.filter(p => p.kind === k);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(),
          V = new THREE.Vector3(), SC = new THREE.Vector3(1,1,1),
          AY = new THREE.Vector3(0,1,0);
    const put = (mesh, i, p, y, sx, sy, sz) => {
      Q.setFromAxisAngle(AY, p.rot || 0);
      V.set(p.x, y, p.z);
      SC.set(sx||1, sy||1, sz||1);
      M.compose(V, Q, SC);
      mesh.setMatrixAt(i, M);
    };
    const add = m => { m.instanceMatrix.needsUpdate = true; m.castShadow = true; group.add(m); return m; };

    // hot dog carts: body, umbrella pole, canopy
    const carts = by('cart');
    if(carts.length){
      const body = mk(new THREE.BoxGeometry(2.4,1.5,1.4), 0xC9CCD2, carts.length);
      const pole = mk(new THREE.CylinderGeometry(0.08,0.08,2.6,5), 0x6A6A70, carts.length);
      const can  = mk(new THREE.ConeGeometry(1.7,0.7,8), 0xC24A4A, carts.length);
      carts.forEach((p,i)=>{ put(body,i,p,1.05); put(pole,i,p,2.0); put(can,i,p,3.3); });
      add(body); add(pole); add(can);
    }
    // newsstands
    const stands = by('stand');
    if(stands.length){
      const box = mk(new THREE.BoxGeometry(3.0,2.6,2.0), 0x2E4A6E, stands.length);
      const top = mk(new THREE.BoxGeometry(3.4,0.25,2.4), 0xD8D2C4, stands.length);
      stands.forEach((p,i)=>{ put(box,i,p,1.6); put(top,i,p,3.0); });
      add(box); add(top);
    }
    // subway entrances: railings and a dark mouth
    const subs = by('subway');
    if(subs.length){
      const rail = mk(new THREE.BoxGeometry(3.4,1.2,0.22), 0x3A6E4A, subs.length*2);
      const mouth= mk(new THREE.BoxGeometry(3.2,0.3,2.6), 0x0A0C10, subs.length);
      const glob = mk(new THREE.SphereGeometry(0.34,7,5), 0x7ED67E, subs.length);
      subs.forEach((p,i)=>{
        put(rail,i*2,p,1.0,1,1,1);
        put(rail,i*2+1,{x:p.x+Math.cos(p.rot||0)*0,z:p.z+2.4,rot:p.rot},1.0,1,1,1);
        put(mouth,i,p,0.5); put(glob,i,{x:p.x-1.9,z:p.z,rot:p.rot},1.9);
      });
      add(rail); add(mouth); add(glob);
    }
    // steam vents, whose plume animates
    const steams = by('steam');
    if(steams.length){
      const cone = mk(new THREE.CylinderGeometry(0.9,0.55,1.1,8), 0xC96A2A, steams.length);
      steams.forEach((p,i)=>put(cone,i,p,0.85));
      add(cone);
      const plumeGeo = new THREE.CylinderGeometry(1.5,0.7,7,7,1,true);
      const plumeMat = new THREE.MeshBasicMaterial({ color:0xD8DCE4, transparent:true,
        opacity:0.10, depthWrite:false, side:THREE.DoubleSide });
      const plume = new THREE.InstancedMesh(plumeGeo, plumeMat, steams.length);
      steams.forEach((p,i)=>put(plume,i,p,4.4));
      plume.instanceMatrix.needsUpdate = true;
      group.add(plume);
      group.userData.steam = { mesh:plume, mat:plumeMat };
    }
    const hyd = by('hydrant');
    if(hyd.length){
      const h1 = mk(new THREE.CylinderGeometry(0.28,0.34,1.0,6), 0xC24A4A, hyd.length);
      hyd.forEach((p,i)=>put(h1,i,p,0.85)); add(h1);
    }
    const tr = by('trash');
    if(tr.length){
      const t1 = mk(new THREE.BoxGeometry(1.5,1.0,1.2), 0x23262C, tr.length*2);
      tr.forEach((p,i)=>{ put(t1,i*2,p,0.85); put(t1,i*2+1,{x:p.x+1.3,z:p.z+0.4,rot:p.rot},0.75,0.8,0.8,0.8); });
      add(t1);
    }
    const be = by('bench');
    if(be.length){
      const seat = mk(new THREE.BoxGeometry(2.8,0.22,0.9), 0x6A4A32, be.length);
      const back = mk(new THREE.BoxGeometry(2.8,0.8,0.18), 0x6A4A32, be.length);
      be.forEach((p,i)=>{ put(seat,i,p,0.85); put(back,i,{x:p.x,z:p.z-0.35,rot:p.rot},1.3); });
      add(seat); add(back);
    }
    // sidewalk scaffolding, permanent as in life
    const sc = by('scaffold');
    if(sc.length){
      const deck = mk(new THREE.BoxGeometry(7.0,0.3,3.0), 0x8A7A5A, sc.length);
      const leg  = mk(new THREE.BoxGeometry(0.28,4.2,0.28), 0x6A6256, sc.length*4);
      sc.forEach((p,i)=>{
        put(deck,i,p,4.3);
        [[-3.2,-1.2],[3.2,-1.2],[-3.2,1.2],[3.2,1.2]].forEach((o,k)=>
          put(leg,i*4+k,{x:p.x+o[0],z:p.z+o[1],rot:p.rot},2.1));
      });
      add(deck); add(leg);
    }
  }

  /* --- rooftop water towers --- */
  if(city.tanks && city.tanks.length){
    const barrel = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1.5,1.7,3.0,9),
      new THREE.MeshLambertMaterial({ color:0x6A4A32 }), city.tanks.length);
    const cap = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1.8,1.0,9),
      new THREE.MeshLambertMaterial({ color:0x4A3626 }), city.tanks.length);
    const m = new THREE.Matrix4();
    city.tanks.forEach((t,i)=>{
      m.makeTranslation(t.x, t.y + 2.6, t.z); barrel.setMatrixAt(i, m);
      m.makeTranslation(t.x, t.y + 4.6, t.z); cap.setMatrixAt(i, m);
    });
    barrel.instanceMatrix.needsUpdate = cap.instanceMatrix.needsUpdate = true;
    barrel.castShadow = cap.castShadow = true;
    group.add(barrel); group.add(cap);
  }

  group.userData.wallMat = wallMat;
  group.userData.tex = tex;
  return group;
};

/* ------------------------------------------------------------------
   Traffic + pedestrians: agents circulating the road grid.
   ------------------------------------------------------------------ */
HS.buildTraffic = function(THREE, city, seed){
  const rnd = HS.rng(seed ^ 0x9E3779B9);
  const CARS = 46, PEDS = 40;
  const cars = [], peds = [];

  const laneOffset = ROAD * 0.22;
  for(let i = 0; i < CARS; i++){
    const axis = rnd.chance(0.5) ? 'x' : 'z';       // travels along this axis
    const line = rnd.int(0, GRID);                  // which road
    const dir  = rnd.chance(0.5) ? 1 : -1;
    const c = -HALF + line * CELL + dir * laneOffset * (axis === 'x' ? 1 : -1);
    cars.push({
      axis, dir, cross:c,
      t: rnd.range(-HALF, HALF),
      speed: rnd.range(13, 22),
      // roughly half the traffic is a cab
      color: rnd.chance(0.5) ? 0xF2C10E
           : rnd.pick([0xC24A4A, 0x3E6FB0, 0xD8D2C4, 0x2E2E33, 0x4A8A5E, 0x8A4AA8])
    });
  }
  for(let i = 0; i < PEDS; i++){
    const axis = rnd.chance(0.5) ? 'x' : 'z';
    const line = rnd.int(0, GRID);
    const dir  = rnd.chance(0.5) ? 1 : -1;
    const side = rnd.chance(0.5) ? 1 : -1;
    peds.push({
      axis, dir, cross: -HALF + line * CELL + side * (ROAD/2 + 1.6),
      t: rnd.range(-HALF, HALF),
      speed: rnd.range(2.4, 4.2),
      color: rnd.pick([0x9AA3B0, 0xB08A6A, 0x6A7A9A, 0xA88A9A, 0x7A8A7A])
    });
  }

  const carGeo = new THREE.BoxGeometry(2.4, 1.5, 4.6);
  const carMesh = new THREE.InstancedMesh(carGeo, new THREE.MeshLambertMaterial(), CARS);
  const lampGeo = new THREE.BoxGeometry(2.0, 0.35, 0.3);
  const lampMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color:0xFFF0C0 }), CARS);
  const pedGeo = new THREE.CylinderGeometry(0.40, 0.44, 1.9, 6);
  const pedMesh = new THREE.InstancedMesh(pedGeo, new THREE.MeshLambertMaterial(), PEDS);

  const col = new THREE.Color();
  cars.forEach((c,i) => carMesh.setColorAt(i, col.setHex(c.color)));
  peds.forEach((p,i) => pedMesh.setColorAt(i, col.setHex(p.color)));
  if(carMesh.instanceColor) carMesh.instanceColor.needsUpdate = true;
  if(pedMesh.instanceColor) pedMesh.instanceColor.needsUpdate = true;
  carMesh.castShadow = pedMesh.castShadow = true;

  const group = new THREE.Group();
  group.add(carMesh); group.add(lampMesh); group.add(pedMesh);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
        v = new THREE.Vector3(), s = new THREE.Vector3(1,1,1),
        AXIS_Y = new THREE.Vector3(0,1,0);

  function place(mesh, i, x, y, z, rotY){
    q.setFromAxisAngle(AXIS_Y, rotY);
    v.set(x, y, z);
    m.compose(v, q, s);
    mesh.setMatrixAt(i, m);
  }

  group.userData.update = function(dt, night){
    for(let i = 0; i < cars.length; i++){
      const c = cars[i];
      c.t += c.speed * c.dir * dt;
      if(c.t >  HALF + 8) c.t = -HALF - 8;
      if(c.t < -HALF - 8) c.t =  HALF + 8;
      const x = c.axis === 'x' ? c.t : c.cross;
      const z = c.axis === 'x' ? c.cross : c.t;
      const rot = c.axis === 'x' ? (c.dir > 0 ? Math.PI/2 : -Math.PI/2) : (c.dir > 0 ? 0 : Math.PI);
      place(carMesh, i, x, 1.05, z, rot);
      place(lampMesh, i, x + (c.axis==='x' ? c.dir*2.4 : 0), 1.05, z + (c.axis==='z' ? c.dir*2.4 : 0), rot);
    }
    carMesh.instanceMatrix.needsUpdate = true;
    lampMesh.instanceMatrix.needsUpdate = true;
    lampMesh.visible = night;

    for(let i = 0; i < peds.length; i++){
      const p = peds[i];
      p.t += p.speed * p.dir * dt;
      if(p.t >  HALF + 4) p.t = -HALF - 4;
      if(p.t < -HALF - 4) p.t =  HALF + 4;
      const x = p.axis === 'x' ? p.t : p.cross;
      const z = p.axis === 'x' ? p.cross : p.t;
      const bob = Math.sin(p.t * 2.2) * 0.09;
      place(pedMesh, i, x, 1.35 + bob, z, 0);
    }
    pedMesh.instanceMatrix.needsUpdate = true;
  };

  return group;
};

})(window.HS);
