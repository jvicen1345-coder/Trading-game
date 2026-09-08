/* MARKET MAKER — renderer, camera, lighting, day/night. */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* Sky / light keyframes across a 24h day. */
const SKY = [
  { t:0,  sky:0x070A14, fog:0x070A14, sun:0x2E3E6B, amb:0x14203A, si:0.16, ai:0.34, night:1 },
  { t:5,  sky:0x14182C, fog:0x14182C, sun:0x4A4A7A, amb:0x1E2440, si:0.24, ai:0.40, night:1 },
  { t:7,  sky:0x6E5A62, fog:0x7C6560, sun:0xFFC08A, amb:0x574B5E, si:0.82, ai:0.58, night:0.30 },
  { t:8.5,sky:0x8AA0BE, fog:0x94A8C2, sun:0xFFEAC6, amb:0x8697B2, si:1.02, ai:0.66, night:0.06 },
  { t:10, sky:0x9CB4CE, fog:0xA4BACE, sun:0xFFF6E6, amb:0x94A6BC, si:1.14, ai:0.72, night:0 },
  { t:14, sky:0xA6C0D8, fog:0xAEC4DA, sun:0xFFFFFF, amb:0xA0B0C6, si:1.20, ai:0.74, night:0 },
  { t:17, sky:0x7E8AA6, fog:0x8A93AC, sun:0xFFE0B0, amb:0x76829C, si:0.86, ai:0.60, night:0 },
  { t:19, sky:0x6A4A50, fog:0x7A545A, sun:0xFF9060, amb:0x4E3E52, si:0.58, ai:0.48, night:0.45 },
  { t:21, sky:0x1A1E34, fog:0x1E2238, sun:0x3A466E, amb:0x1E2642, si:0.22, ai:0.38, night:1 },
  { t:24, sky:0x070A14, fog:0x070A14, sun:0x2E3E6B, amb:0x14203A, si:0.16, ai:0.34, night:1 }
];

function lerpHex(a, b, t){
  const ar=a>>16&255, ag=a>>8&255, ab=a&255;
  const br=b>>16&255, bg=b>>8&255, bb=b&255;
  return ((ar+(br-ar)*t)<<16 | (ag+(bg-ag)*t)<<8 | (ab+(bb-ab)*t)) & 0xFFFFFF;
}
function skyAt(hour){
  let i = 0;
  while(i < SKY.length - 2 && SKY[i+1].t <= hour) i++;
  const a = SKY[i], b = SKY[i+1];
  const t = HS.clamp((hour - a.t) / (b.t - a.t), 0, 1);
  return {
    sky: lerpHex(a.sky, b.sky, t),
    fog: lerpHex(a.fog, b.fog, t),
    sun: lerpHex(a.sun, b.sun, t),
    amb: lerpHex(a.amb, b.amb, t),
    si: HS.lerp(a.si, b.si, t),
    ai: HS.lerp(a.ai, b.ai, t),
    night: HS.lerp(a.night, b.night, t)
  };
}
HS.skyAt = skyAt;

HS.World = function(THREE, canvas, city){
  const W = {};

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0A0E18, 150, 560);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 2600);
  /* Overhead, angled back — the "3D from above" read. */
  const CAM_OFF = new THREE.Vector3(0, 96, 42);
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let camZoom = 1;

  const hemi = new THREE.HemisphereLight(0x9AAAC0, 0x2A2E36, 0.65);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x404860, 0.4);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xFFF3DC, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 1; sc.far = 400; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
  sun.shadow.bias = -0.0016;
  scene.add(sun);
  scene.add(sun.target);

  /* a soft lamp on the player so the avatar never vanishes at night */
  const playerLight = new THREE.PointLight(0xFFE2B0, 0, 34, 2);
  playerLight.position.y = 7;
  scene.add(playerLight);

  const cityGroup = HS.buildCityMeshes(THREE, city);
  scene.add(cityGroup);
  const traffic = HS.buildTraffic(THREE, city, city.seed);
  scene.add(traffic);

  const wallMat = cityGroup.userData.wallMat;
  const lampBulbs = cityGroup.userData.lampBulbs;

  /* Fake lamplight: additive discs on the ground, one draw call for the lot. */
  const lampPools = (function(){
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g2 = cv.getContext('2d');
    const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0,   'rgba(255,225,170,1)');
    grad.addColorStop(0.4, 'rgba(255,205,140,0.42)');
    grad.addColorStop(1,   'rgba(255,190,120,0)');
    g2.fillStyle = grad; g2.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);

    const geo = new THREE.PlaneGeometry(22, 22);
    const mat = new THREE.MeshBasicMaterial({
      map:tex, transparent:true, opacity:0, depthWrite:false,
      blending:THREE.AdditiveBlending
    });
    const mesh = new THREE.InstancedMesh(geo, mat, city.lampPosts.length);
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationX(-Math.PI/2);
    city.lampPosts.forEach((p, i) => {
      m.copy(rot); m.setPosition(p.x, 0.45, p.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    return { mesh, mat };
  })();

  /* ---------- landmark beacons ---------- */
  const beacons = [];
  const ringGeo = new THREE.RingGeometry(2.6, 3.7, 30);
  const glowGeo = new THREE.RingGeometry(3.7, 7.5, 30);
  const chevGeo = new THREE.OctahedronGeometry(1.25);
  city.landmarks.forEach(lm => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: lm.accent, transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false
    });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI/2;
    ring.position.y = 0.42;
    g.add(ring);

    // soft falloff halo on the pavement
    const glowMat = new THREE.MeshBasicMaterial({
      color: lm.accent, transparent:true, opacity:0.10, side:THREE.DoubleSide,
      depthWrite:false, blending:THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI/2;
    glow.position.y = 0.40;
    g.add(glow);

    // floating marker so the door is findable from across a block
    const chevMat = new THREE.MeshBasicMaterial({ color: lm.accent, transparent:true, opacity:0.9 });
    const chev = new THREE.Mesh(chevGeo, chevMat);
    chev.position.y = 8;
    g.add(chev);

    g.position.set(lm.x, 0, lm.z);
    g.visible = !lm.hidden;
    scene.add(g);
    beacons.push({ lm, group:g, ring, chev, mat, glowMat, chevMat });
  });

  W.setLandmarkVisible = function(id, vis){
    const b = beacons.find(b => b.lm.id === id);
    if(b) b.group.visible = vis;
  };
  W.setLandmarkAccent = function(id, hex){
    const b = beacons.find(b => b.lm.id === id);
    if(b){ b.mat.color.setHex(hex); b.glowMat.color.setHex(hex); b.chevMat.color.setHex(hex); }
  };

  /* ---------- resize ---------- */
  function resize(){
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  W.resize = resize;
  resize();

  /* ---------- per-frame ---------- */
  let elapsed = 0;
  W.update = function(dt, hour, px, pz, snap){
    elapsed += dt;
    const s = skyAt(hour);

    if(!scene.background) scene.background = new THREE.Color();
    scene.background.setHex(s.sky);
    scene.fog.color.setHex(s.fog);
    sun.color.setHex(s.sun);
    sun.intensity = s.si;
    hemi.intensity = 0.28 + s.ai * 0.5;
    hemi.color.setHex(s.sky);
    ambient.color.setHex(s.amb);
    ambient.intensity = s.ai * 0.55;

    // windows light up after dusk
    wallMat.emissiveIntensity = s.night * 0.95;
    if(lampBulbs) lampBulbs.visible = s.night > 0.25;
    lampPools.mat.opacity = s.night * 0.72;
    lampPools.mesh.visible = s.night > 0.05;

    // sun arcs east→west; keep the shadow frustum on the player
    const ang = (hour / 24) * Math.PI * 2 - Math.PI/2;
    sun.position.set(px + Math.cos(ang) * 130, 60 + Math.sin(ang) * 90, pz - 70);
    if(sun.position.y < 12) sun.position.y = 12;
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();

    playerLight.position.set(px, 7, pz);
    playerLight.intensity = s.night * 0.85;

    traffic.userData.update(dt, s.night > 0.3);

    // beacons: slow spin + breathing pulse
    const pulse = 0.55 + Math.sin(elapsed * 2.4) * 0.28;
    for(const b of beacons){
      if(!b.group.visible) continue;
      b.ring.rotation.z += dt * 0.7;
      b.mat.opacity = pulse;
      b.glowMat.opacity = 0.06 + pulse * 0.10;
      b.chev.rotation.y += dt * 1.6;
      b.chev.position.y = 8 + Math.sin(elapsed * 2.2) * 0.7;
      b.chevMat.opacity = 0.55 + pulse * 0.4;
    }

    // camera follow
    camTarget.set(px, 0, pz);
    camPos.set(px + CAM_OFF.x * camZoom, CAM_OFF.y * camZoom, pz + CAM_OFF.z * camZoom);
    if(snap) camera.position.copy(camPos);
    else camera.position.lerp(camPos, 1 - Math.exp(-7 * dt));
    camera.lookAt(camTarget.x, 2.5, camTarget.z - 4);

    return s;
  };

  /* Drop shadows if the machine cannot afford them. */
  let lowQuality = false;
  W.setLowQuality = function(){
    if(lowQuality) return;
    lowQuality = true;
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
    scene.traverse(o => { if(o.material){
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true);
    }});
    hemi.intensity += 0.12;
  };
  W.isLowQuality = () => lowQuality;

  W.setZoom = function(z){ camZoom = HS.clamp(z, 0.65, 1.7); };
  W.getZoom = () => camZoom;
  W.render = function(){ renderer.render(scene, camera); };
  W.scene = scene;
  W.camera = camera;
  W.renderer = renderer;
  W.beacons = beacons;

  /* project a world point to screen pixels (for DOM labels) */
  const proj = new THREE.Vector3();
  W.project = function(x, y, z){
    proj.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return {
      x: (proj.x * 0.5 + 0.5) * w,
      y: (-proj.y * 0.5 + 0.5) * h,
      visible: proj.z < 1
    };
  };

  return W;
};

})(window.HS);
