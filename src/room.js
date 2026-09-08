/* MARKET MAKER — your room. Buy and fit things; each one does something small
   now and leaves a hook for more later. */
window.HS = window.HS || {};
(function(HS){
'use strict';

HS.ROOM_SLOTS = [
  { id:'bed',  name:'Bed' },
  { id:'desk', name:'Desk' },
  { id:'rig',  name:'Screens' },
  { id:'seat', name:'Seating' },
  { id:'wall', name:'Wall' },
  { id:'floor',name:'Floor' }
];

/* effect keys: sleep (rest quality), review (chart-review accuracy),
   study (class discount), effort (energy costs), morning (free energy). */
HS.ROOM_ITEMS = {
  bed: [
    { id:'bed_cot',    name:'Camp cot',        price:0,      sleep:0.00, desc:'It is technically a bed.' },
    { id:'bed_frame',  name:'Proper frame',    price:900,    sleep:0.04, desc:'Slats, a mattress, no springs in your back.' },
    { id:'bed_king',   name:'King mattress',   price:9000,   sleep:0.08, desc:'You sleep like a person with options.' },
    { id:'bed_suite',  name:'Hotel suite bed', price:60000,  sleep:0.12, desc:'Linen that costs more than your first month of rent.' }
  ],
  desk: [
    { id:'desk_door',  name:'Door on crates',  price:120,    review:3,  desc:'A door. On crates.' },
    { id:'desk_oak',   name:'Oak desk',        price:3200,   review:7,  study:0.10, desc:'Heavy enough to feel serious at.' },
    { id:'desk_stand', name:'Standing desk',   price:12000,  review:11, effort:1, desc:'You think better upright. Probably.' }
  ],
  rig: [
    { id:'rig_laptop', name:'Old laptop',      price:300,    review:2,  desc:'One screen, one fan, one prayer.' },
    { id:'rig_dual',   name:'Dual monitors',   price:2400,   review:8,  desc:'Chart on one, chain on the other.' },
    { id:'rig_six',    name:'Six-screen wall', price:26000,  review:15, desc:'The kind of thing people photograph.' }
  ],
  seat: [
    { id:'seat_stool', name:'Kitchen stool',   price:40,     desc:'Your back will remember this.' },
    { id:'seat_chair', name:'Mesh chair',      price:1100,   effort:1, desc:'Lumbar support and a small amount of dignity.' },
    { id:'seat_thron', name:'Leather recliner',price:14000,  effort:2, sleep:0.02, desc:'You have fallen asleep in it twice.' }
  ],
  wall: [
    { id:'wall_poster',name:'Yacht poster',    price:20,     desc:'Aspirational. Faintly humiliating.' },
    { id:'wall_charts',name:'Printed charts',  price:600,    review:5, desc:'Annotated in three colours of pen.' },
    { id:'wall_art',   name:'Real painting',   price:48000,  desc:'Bought at auction. Nobody asks about it.' }
  ],
  floor: [
    { id:'floor_bare', name:'Bare boards',     price:0,      desc:'Cold in the morning.' },
    { id:'floor_rug',  name:'Thick rug',       price:750,    sleep:0.02, desc:'The room stops echoing.' },
    { id:'floor_coffee',name:'Coffee station', price:2600,   morning:12, desc:'You wake up and it is already made.' }
  ]
};

HS.roomItem = function(slot, id){
  return (HS.ROOM_ITEMS[slot] || []).find(i => i.id === id) || null;
};

/* Total of one effect across everything fitted. */
HS.roomBonus = function(S, key){
  if(!S || !S.room) return 0;
  let total = 0;
  HS.ROOM_SLOTS.forEach(sl => {
    const it = HS.roomItem(sl.id, S.room[sl.id]);
    if(it && it[key]) total += it[key];
  });
  return total;
};

HS.roomOwned = function(S){
  return HS.ROOM_SLOTS.filter(sl => S.room[sl.id]).length;
};

/* Simple isometric drawing of the room as currently fitted. */
HS.drawRoom = function(cv, S, tier){
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);

  const cx = W/2, cy = H*0.60, sx = Math.min(W,H)*0.052, sy = sx*0.52;
  const GW = 7, GH = 6;
  const iso = (gx, gy, gz) => [ cx + (gx-gy)*sx, cy + (gx+gy)*sy - (gz||0)*sx*0.9 ];

  const wallCol  = ['#2A2F3C','#333A4A','#3A4152','#454D61'][tier] || '#2A2F3C';
  const floorCol = ['#3A3128','#443A2E','#4E4436','#584C3C'][tier] || '#3A3128';

  // floor
  ctx.beginPath();
  let p = iso(0,0); ctx.moveTo(p[0],p[1]);
  p = iso(GW,0); ctx.lineTo(p[0],p[1]);
  p = iso(GW,GH); ctx.lineTo(p[0],p[1]);
  p = iso(0,GH); ctx.lineTo(p[0],p[1]);
  ctx.closePath();
  ctx.fillStyle = floorCol; ctx.fill();
  const rug = S.room.floor === 'floor_rug';
  if(rug){
    ctx.beginPath();
    p = iso(1.4,1.4); ctx.moveTo(p[0],p[1]);
    p = iso(5.6,1.4); ctx.lineTo(p[0],p[1]);
    p = iso(5.6,4.6); ctx.lineTo(p[0],p[1]);
    p = iso(1.4,4.6); ctx.lineTo(p[0],p[1]);
    ctx.closePath(); ctx.fillStyle = '#6A3E44'; ctx.fill();
  }
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
  for(let i=0;i<=GW;i++){ const a=iso(i,0),b=iso(i,GH);
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); }
  for(let j=0;j<=GH;j++){ const a=iso(0,j),b=iso(GW,j);
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); }

  // two walls
  const wall = (from, to, h) => {
    ctx.beginPath();
    let a = iso(from[0],from[1]); ctx.moveTo(a[0],a[1]);
    a = iso(to[0],to[1]); ctx.lineTo(a[0],a[1]);
    a = iso(to[0],to[1],h); ctx.lineTo(a[0],a[1]);
    a = iso(from[0],from[1],h); ctx.lineTo(a[0],a[1]);
    ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = wallCol; wall([0,0],[GW,0],3.2);
  ctx.fillStyle = shade(wallCol,-14); wall([0,0],[0,GH],3.2);

  // a box helper for furniture
  function box(gx,gy,w,d,h,col){
    const top = shade(col, 18), left = shade(col,-4), right = shade(col,-18);
    const P = (x,y,z)=>iso(x,y,z);
    ctx.fillStyle = top; ctx.beginPath();
    let a=P(gx,gy,h); ctx.moveTo(a[0],a[1]);
    a=P(gx+w,gy,h); ctx.lineTo(a[0],a[1]);
    a=P(gx+w,gy+d,h); ctx.lineTo(a[0],a[1]);
    a=P(gx,gy+d,h); ctx.lineTo(a[0],a[1]);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = left; ctx.beginPath();
    a=P(gx,gy+d,h); ctx.moveTo(a[0],a[1]);
    a=P(gx+w,gy+d,h); ctx.lineTo(a[0],a[1]);
    a=P(gx+w,gy+d,0); ctx.lineTo(a[0],a[1]);
    a=P(gx,gy+d,0); ctx.lineTo(a[0],a[1]);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = right; ctx.beginPath();
    a=P(gx+w,gy,h); ctx.moveTo(a[0],a[1]);
    a=P(gx+w,gy+d,h); ctx.lineTo(a[0],a[1]);
    a=P(gx+w,gy+d,0); ctx.lineTo(a[0],a[1]);
    a=P(gx+w,gy,0); ctx.lineTo(a[0],a[1]);
    ctx.closePath(); ctx.fill();
  }

  // bed
  const bed = S.room.bed;
  if(bed){
    const big = bed === 'bed_king' || bed === 'bed_suite';
    box(0.3, 3.2, big ? 2.6 : 1.9, 2.4, 0.5, bed === 'bed_cot' ? '#4A4A52' : '#4E5A6E');
    box(0.3, 3.2, big ? 2.6 : 1.9, 0.5, 0.95, '#5C6A80');
  }
  // desk + screens
  if(S.room.desk){
    box(4.2, 0.4, 2.4, 1.1, 0.85, S.room.desk === 'desk_oak' ? '#5A4028' : '#3E4450');
    const rig = S.room.rig;
    if(rig){
      const n = rig === 'rig_laptop' ? 1 : rig === 'rig_dual' ? 2 : 3;
      for(let i=0;i<n;i++) box(4.35 + i*0.72, 0.5, 0.6, 0.14, 0.55 + 0.85, '#12161F');
    }
  }
  if(S.room.seat) box(4.9, 1.8, 0.9, 0.9, S.room.seat==='seat_thron'?0.7:0.55, '#3A3F4C');
  if(S.room.wall){
    ctx.fillStyle = S.room.wall === 'wall_art' ? '#7A5A3A'
                  : S.room.wall === 'wall_charts' ? '#D8D2C4' : '#7A6A4A';
    const a = iso(1.6,0,1.6), b = iso(3.2,0,1.6), c = iso(3.2,0,2.6), d = iso(1.6,0,2.6);
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]);
    ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]); ctx.closePath(); ctx.fill();
  }
  if(S.room.floor === 'floor_coffee') box(0.4, 0.5, 0.7, 0.7, 0.8, '#2E3A44');
};

function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const r = HS.clamp((n>>16&255)+amt, 0, 255);
  const g = HS.clamp((n>>8&255)+amt, 0, 255);
  const b = HS.clamp((n&255)+amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

})(window.HS);
