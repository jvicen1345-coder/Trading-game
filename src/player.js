/* HEATSEEKER — the player avatar: WASD movement, collision, look. */
window.HS = window.HS || {};
(function(HS){
'use strict';

const RADIUS = 1.15;
const WALK   = 15.5;
const SPRINT = 26;

/* Outfits unlock as the career climbs — visible progress on the street. */
HS.OUTFITS = [
  { id:0, name:'Hoodie',        body:0x4A5260, legs:0x2E3440, skin:0xC9A084, tie:null     },
  { id:1, name:'Cheap Suit',    body:0x3C4454, legs:0x2A303C, skin:0xC9A084, tie:0x8A4A4A },
  { id:2, name:'Tailored Suit', body:0x232A38, legs:0x1C222E, skin:0xC9A084, tie:0xE8B85C },
  { id:3, name:'Power Suit',    body:0x14181F, legs:0x101419, skin:0xC9A084, tie:0xFF5B67 },
  { id:4, name:'Custom Italian',body:0x0E1116, legs:0x0B0E12, skin:0xC9A084, tie:0x8B6BFF }
];

HS.Player = function(THREE, scene, city){
  const P = { x:0, z:0, vx:0, vz:0, angle:0, moving:false, sprinting:false, speedScale:1 };

  const group = new THREE.Group();

  const mkBox = (w,h,d,col) => new THREE.Mesh(
    new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({ color:col })
  );

  const legL = mkBox(0.62, 1.9, 0.62, 0x2E3440); legL.position.set(-0.38, 0.95, 0);
  const legR = mkBox(0.62, 1.9, 0.62, 0x2E3440); legR.position.set( 0.38, 0.95, 0);
  const torso= mkBox(1.72, 2.1, 1.0,  0x4A5260); torso.position.y = 2.95;
  const head = mkBox(0.98, 0.98, 0.92, 0xC9A084); head.position.y = 4.5;
  const hair = mkBox(1.02, 0.26, 0.96, 0x2A2018); hair.position.y = 5.02;
  const tie  = mkBox(0.22, 1.15, 0.06, 0xE8B85C); tie.position.set(0, 2.95, 0.53);
  const armL = mkBox(0.44, 1.75, 0.5, 0x4A5260); armL.position.set(-1.06, 3.0, 0);
  const armR = mkBox(0.44, 1.75, 0.5, 0x4A5260); armR.position.set( 1.06, 3.0, 0);

  [legL, legR, torso, head, hair, tie, armL, armR].forEach(m => {
    m.castShadow = true; group.add(m);
  });
  group.scale.setScalar(1.25);
  scene.add(group);

  /* soft contact shadow so the avatar never looks like it floats */
  const blobGeo = new THREE.CircleGeometry(1.9, 18);
  const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({
    color:0x000000, transparent:true, opacity:0.30, depthWrite:false
  }));
  blob.rotation.x = -Math.PI/2;
  blob.position.y = 0.36;
  scene.add(blob);

  P.setOutfit = function(idx){
    const o = HS.OUTFITS[HS.clamp(idx, 0, HS.OUTFITS.length - 1)];
    torso.material.color.setHex(o.body);
    armL.material.color.setHex(o.body);
    armR.material.color.setHex(o.body);
    legL.material.color.setHex(o.legs);
    legR.material.color.setHex(o.legs);
    head.material.color.setHex(o.skin);
    tie.visible = o.tie !== null;
    if(o.tie !== null) tie.material.color.setHex(o.tie);
  };
  P.setOutfit(0);

  P.setPos = function(x, z){ P.x = x; P.z = z; P.vx = P.vz = 0; sync(); };

  /* ---------- collision ---------- */
  const colliders = city.colliders;

  /* Push a circle out of any box it has entered, along the shallowest axis. */
  function resolve(x, z){
    for(let i = 0; i < colliders.length; i++){
      const b = colliders[i];
      if(x + RADIUS < b.x0 || x - RADIUS > b.x1 || z + RADIUS < b.z0 || z - RADIUS > b.z1) continue;
      const cx = HS.clamp(x, b.x0, b.x1);
      const cz = HS.clamp(z, b.z0, b.z1);
      let dx = x - cx, dz = z - cz;
      const d2 = dx*dx + dz*dz;
      if(d2 > RADIUS*RADIUS) continue;

      if(d2 > 1e-6){
        const d = Math.sqrt(d2);
        x = cx + dx / d * RADIUS;
        z = cz + dz / d * RADIUS;
      } else {
        // dead centre: eject through the nearest wall
        const dl = x - b.x0, dr = b.x1 - x, dt = z - b.z0, db = b.z1 - z;
        const m = Math.min(dl, dr, dt, db);
        if(m === dl)      x = b.x0 - RADIUS;
        else if(m === dr) x = b.x1 + RADIUS;
        else if(m === dt) z = b.z0 - RADIUS;
        else              z = b.z1 + RADIUS;
      }
    }
    return [x, z];
  }

  let walkPhase = 0;

  P.update = function(dt, input, canMove){
    let ix = 0, iz = 0;
    if(canMove){
      if(input.up)    iz -= 1;
      if(input.down)  iz += 1;
      if(input.left)  ix -= 1;
      if(input.right) ix += 1;
    }
    const len = Math.hypot(ix, iz);
    P.moving = len > 0;
    P.sprinting = P.moving && !!input.sprint;

    const target = P.sprinting ? SPRINT : WALK;
    let tvx = 0, tvz = 0;
    if(P.moving){
      tvx = ix / len * target * P.speedScale;
      tvz = iz / len * target * P.speedScale;
    }
    // snappy but not instant
    const k = P.moving ? 14 : 18;
    P.vx = HS.damp(P.vx, tvx, k, dt);
    P.vz = HS.damp(P.vz, tvz, k, dt);

    let nx = P.x + P.vx * dt;
    let nz = P.z + P.vz * dt;

    const lim = city.half + 3;
    nx = HS.clamp(nx, -lim, lim);
    nz = HS.clamp(nz, -lim, lim);

    const r = resolve(nx, nz);
    P.x = r[0]; P.z = r[1];

    if(P.moving){
      const a = Math.atan2(P.vx, P.vz);
      let diff = a - P.angle;
      while(diff >  Math.PI) diff -= Math.PI*2;
      while(diff < -Math.PI) diff += Math.PI*2;
      P.angle += diff * (1 - Math.exp(-14 * dt));
      walkPhase += dt * (P.sprinting ? 15 : 10);
    } else {
      walkPhase = HS.damp(walkPhase % (Math.PI*2), 0, 8, dt);
    }
    sync();
  };

  function sync(){
    group.position.set(P.x, 0, P.z);
    group.rotation.y = P.angle;
    blob.position.set(P.x, 0.36, P.z);

    const sw = Math.sin(walkPhase) * 0.55;
    legL.rotation.x =  sw;
    legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.8;
    armR.rotation.x =  sw * 0.8;
    const bob = Math.abs(Math.sin(walkPhase)) * 0.10;
    torso.position.y = 2.95 + bob;
    head.position.y  = 4.5 + bob;
    hair.position.y  = 5.02 + bob;
    tie.position.y   = 2.95 + bob;
  }

  P.group = group;
  return P;
};

})(window.HS);
