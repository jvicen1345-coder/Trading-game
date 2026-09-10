/* MARKET MAKER - HUD, panels, toasts, minimap. */
window.HS = window.HS || {};
(function(HS){
'use strict';
const $ = HS.$;

HS.UI = function(game){
  const U = {};

  /* ---------------- HUD ---------------- */
  U.syncHud = function(){
    const S = game.S;
    const r = HS.rankOf(S);

    $('hudCash').textContent = HS.money(S.cash);
    $('hudCash').style.color = S.cash < 0 ? 'var(--red)' : 'var(--text)';
    $('hudRank').textContent = r.name;
    $('hudDay').textContent  = 'Day ' + S.day + ' · ' + HS.dayName(S.day);
    $('hudClock').textContent = HS.clockStr(S.hour);

    bar('barEnergy', S.energy, S.maxEnergy || 100);
    bar('barSkill',  S.skill, 100);
    bar('barRep',    S.rep, 100);
    bar('barHeat',   S.heat, 100);
    $('valEnergy').textContent = Math.round(S.energy) + (S.maxEnergy > 100 ? '/' + Math.round(S.maxEnergy) : '');
    $('valSkill').textContent  = Math.round(S.skill);
    $('valRep').textContent    = Math.round(S.rep);
    $('valHeat').textContent   = Math.round(S.heat);

    $('rowHeat').classList.toggle('danger', S.heat >= 60);
    $('rowEnergy').classList.toggle('danger', S.energy <= S.maxEnergy * 0.2);

    const loanRow = $('hudLoan');
    loanRow.style.display = S.loan > 0 ? '' : 'none';
    if(S.loan > 0) $('hudLoanVal').textContent = HS.money(S.loan);

    $('hudObjective').textContent = game.objectiveText();
  };
  function bar(id, v, max){
    const el = $(id);
    if(el) el.style.width = HS.clamp(v / max * 100, 0, 100).toFixed(1) + '%';
  }

  /* ---------------- interaction prompt ---------------- */
  let promptLm = null;
  U.setPrompt = function(lm){
    const el = $('prompt');
    if(!lm){ el.classList.remove('show'); promptLm = null; return; }
    if(promptLm !== lm){
      promptLm = lm;
      $('promptName').textContent = lm.name;
    }
    el.classList.add('show');
  };

  /* ---------------- toasts ---------------- */
  U.toast = function(text, kind){
    const el = HS.el('div', 'toast ' + (kind || ''), text);
    $('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3400);
    while($('toasts').children.length > 5) $('toasts').firstChild.remove();
  };

  /* ---------------- generic panel ---------------- */
  /* opts: { title, sub, accent, body(HTMLElement|string), actions:[{label,detail,cost,disabled,why,onClick,tone}] } */
  U.openPanel = function(opts){
    const p = $('panel');
    $('panelTitle').textContent = opts.title || '';
    $('panelSub').textContent = opts.sub || '';
    $('panelTitle').style.color = opts.accent || 'var(--gold)';

    const body = $('panelBody');
    body.innerHTML = '';
    if(opts.body){
      if(typeof opts.body === 'string') body.innerHTML = opts.body;
      else body.appendChild(opts.body);
    }

    const acts = $('panelActions');
    acts.innerHTML = '';
    (opts.actions || []).forEach(a => {
      const btn = HS.el('button', 'act' + (a.tone ? ' ' + a.tone : ''));
      btn.innerHTML =
        '<span class="act-main">' + a.label + '</span>' +
        (a.detail ? '<span class="act-detail">' + a.detail + '</span>' : '') +
        (a.cost ? '<span class="act-cost">' + a.cost + '</span>' : '');
      if(a.disabled){
        btn.classList.add('locked');
        btn.disabled = true;
        if(a.why) btn.appendChild(HS.el('span', 'act-why', a.why));
      } else {
        btn.addEventListener('click', () => { HS.Audio.click(); a.onClick(); });
      }
      acts.appendChild(btn);
    });

    p.classList.add('show');
    U.syncHud();
  };
  U.closePanel = function(){ $('panel').classList.remove('show'); };
  /* Read the DOM rather than a flag, so the two can never disagree. */
  U.isPanelOpen = () => $('panel').classList.contains('show');

  /* ---------------- modal (story beats, confirms) ---------------- */
  U.modal = function(opts){
    const m = $('modal');
    $('modalTitle').textContent = opts.title || '';
    $('modalTitle').className = 'modal-title ' + (opts.tone || '');
    $('modalSub').textContent = opts.sub || '';
    $('modalSub').style.display = opts.sub ? '' : 'none';
    $('modalBody').innerHTML = opts.body || '';
    /* A line-up of faces needs more width than a paragraph does. */
    m.querySelector('.card').classList.toggle('wide', !!opts.wide);

    const list = opts.actions || [{ label:'OK', onClick:()=>U.closeModal() }];
    const acts = $('modalActions');
    acts.innerHTML = '';
    /* A choice that carries a price or a reason it is closed to you gets the
       same block a panel action does. A plain yes or no stays a button. */
    const rich = list.some(a => a.detail || a.cost || a.disabled);
    acts.className = rich ? 'acts' : '';
    list.forEach(a => {
      if(!rich){
        const b = HS.el('button', 'btn' + (a.ghost ? ' ghost' : ''), a.label);
        b.addEventListener('click', () => { HS.Audio.click(); a.onClick(); });
        acts.appendChild(b);
        return;
      }
      const b = HS.el('button', 'act' + (a.disabled ? ' locked' : '') + (a.tone ? ' ' + a.tone : ''));
      b.innerHTML = '<span class="act-main">' + a.label + '</span>' +
        (a.detail ? '<span class="act-detail">' + a.detail + '</span>' : '') +
        (a.cost ? '<span class="act-cost">' + a.cost + '</span>' : '') +
        (a.disabled && a.why ? '<span class="act-why">' + a.why + '</span>' : '');
      if(!a.disabled) b.addEventListener('click', () => { HS.Audio.click(); a.onClick(); });
      acts.appendChild(b);
    });
    m.classList.add('show');
  };
  U.closeModal = function(){ $('modal').classList.remove('show'); };
  U.isModalOpen = () => $('modal').classList.contains('show');

  /* ---------------- minimap ---------------- */
  /* The camera never rotates, so map-up is always screen-up: +x right, +z down. */
  const mm = $('minimap'), mx = mm.getContext('2d');
  let mmSize = 0, mmPulse = 0;

  U.resizeMinimap = function(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = mm.clientWidth;
    mm.width = mm.height = Math.max(1, Math.round(s * dpr));
    mx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mmSize = s;
  };

  /* Tiny glyphs, drawn in a 10x10 box centred on (0,0). */
  const GLYPH = {
    home(c){ c.beginPath(); c.moveTo(0,-4.4); c.lineTo(4.4,-0.6); c.lineTo(2.9,-0.6);
             c.lineTo(2.9,4.2); c.lineTo(-2.9,4.2); c.lineTo(-2.9,-0.6); c.lineTo(-4.4,-0.6);
             c.closePath(); c.fill(); },
    work(c){ c.fillRect(-4.2,-1.6,8.4,5.6); c.fillRect(-1.9,-3.9,3.8,1.6);
             c.clearRect(-0.7,0.4,1.4,1.4); },
    exchange(c){ c.fillRect(-4.4,2.6,8.8,1.6);            // stepped floor
                 c.fillRect(-3.4,-0.4,1.9,3); c.fillRect(-0.9,-2.4,1.9,5);
                 c.fillRect(1.6,-4.2,1.9,6.8); },
    bank(c){ c.beginPath(); c.moveTo(0,-4.3); c.lineTo(4.6,-1.4); c.lineTo(-4.6,-1.4);
             c.closePath(); c.fill();
             c.fillRect(-3.6,-0.4,1.5,3.6); c.fillRect(-0.7,-0.4,1.5,3.6);
             c.fillRect(2.2,-0.4,1.5,3.6); c.fillRect(-4.4,3.4,8.8,1.3); },
    bar(c){ c.beginPath(); c.moveTo(-4,-3.8); c.lineTo(4,-3.8); c.lineTo(0.9,0.2);
            c.lineTo(0.9,3.4); c.lineTo(2.9,3.4); c.lineTo(2.9,4.5); c.lineTo(-2.9,4.5);
            c.lineTo(-2.9,3.4); c.lineTo(-0.9,3.4); c.lineTo(-0.9,0.2); c.closePath(); c.fill(); },
    school(c){ c.beginPath(); c.moveTo(0,-4.2); c.lineTo(5,-1.7); c.lineTo(0,0.8);
               c.lineTo(-5,-1.7); c.closePath(); c.fill();
               c.fillRect(-2.7,0.1,5.4,3.9); },
    realty(c){ c.beginPath(); c.arc(-1.4,-1.4,2.6,0,Math.PI*2); c.fill();
               c.fillRect(0.2,0.0,4.2,1.5); c.fillRect(3.0,1.5,1.4,1.9); },
    sec(c){ c.beginPath(); c.moveTo(0,-4.5); c.lineTo(4.2,-2.6); c.lineTo(4.2,1.2);
            c.quadraticCurveTo(4.2,4.0,0,4.8); c.quadraticCurveTo(-4.2,4.0,-4.2,1.2);
            c.lineTo(-4.2,-2.6); c.closePath(); c.fill(); },
    firm(c){ c.beginPath();
             for(let i=0;i<10;i++){ const a=-Math.PI/2 + i*Math.PI/5, r = i%2 ? 2.1 : 4.9;
               c[i?'lineTo':'moveTo'](Math.cos(a)*r, Math.sin(a)*r); }
             c.closePath(); c.fill(); },
    gym(c){ c.fillRect(-1.8,-1.3,3.6,2.6);                 // bar
            c.fillRect(-4.6,-2.8,1.8,5.6); c.fillRect(2.8,-2.8,1.8,5.6);   // plates
            c.fillRect(-2.9,-2.0,1.1,4.0); c.fillRect(1.8,-2.0,1.1,4.0); },
    store(c){ c.beginPath(); c.moveTo(-2.6,-4.3); c.lineTo(2.6,-4.3); c.lineTo(2.0,4.4);
              c.lineTo(-2.0,4.4); c.closePath(); c.fill();
              c.clearRect(-1.2,-2.0,2.4,1.1); }
  };

  U.drawMinimap = function(city, px, pz, angle, dt){
    if(!mmSize) U.resizeMinimap();
    mmPulse += (dt || 0.016);
    const S = mmSize, half = city.half + 26;
    const toMap = (x, z) => [ (x + half) / (half*2) * S, (z + half) / (half*2) * S ];

    mx.clearRect(0, 0, S, S);
    mx.fillStyle = '#080B11';
    mx.fillRect(0, 0, S, S);

    // city blocks, so the grid reads as a place rather than graph paper
    const C = HS.CITY;
    mx.fillStyle = 'rgba(255,255,255,.055)';
    for(let i = 0; i < C.GRID; i++) for(let j = 0; j < C.GRID; j++){
      const r = HS.blockRect(i, j);
      const a = toMap(r.x0, r.z0), b = toMap(r.x1, r.z1);
      mx.fillRect(a[0], a[1], b[0]-a[0], b[1]-a[1]);
    }

    const targetId = game.objectiveTarget();

    // landmark badges
    city.landmarks.forEach(lm => {
      if(!game.isLandmarkActive(lm.id)) return;
      const [x, y] = toMap(lm.x, lm.z);
      const col = game.landmarkColor(lm.id);
      const isTarget = lm.id === targetId;

      if(isTarget){                                   // pulsing halo on the objective
        const t = 0.5 + Math.sin(mmPulse * 3.4) * 0.5;
        mx.beginPath(); mx.arc(x, y, 11 + t*4, 0, Math.PI*2);
        mx.fillStyle = 'rgba(232,184,92,' + (0.10 + t*0.16).toFixed(3) + ')';
        mx.fill();
        mx.beginPath(); mx.arc(x, y, 10.5, 0, Math.PI*2);
        mx.strokeStyle = '#E8B85C'; mx.lineWidth = 1.6; mx.stroke();
      }

      mx.save();
      mx.translate(x, y);
      mx.beginPath();
      const R = 7.6;
      mx.moveTo(-R+2.4,-R); mx.arcTo(R,-R,R,R,2.4); mx.arcTo(R,R,-R,R,2.4);
      mx.arcTo(-R,R,-R,-R,2.4); mx.arcTo(-R,-R,R,-R,2.4); mx.closePath();
      mx.fillStyle = col; mx.globalAlpha = isTarget ? 1 : 0.92; mx.fill();
      mx.globalAlpha = 1;
      mx.fillStyle = '#080B11';
      mx.scale(0.92, 0.92);
      const g = GLYPH[lm.icon];
      if(g) g(mx); else { mx.beginPath(); mx.arc(0,0,2.4,0,Math.PI*2); mx.fill(); }
      mx.restore();
    });

    // player: arrow along the actual heading. World +z is map-down, so this
    // matches what the (never-rotating) camera shows on screen.
    const [x, y] = toMap(px, pz);
    const dx = Math.sin(angle), dy = Math.cos(angle);
    const nx = -dy, ny = dx;                                  // left normal
    const tip = 7.5, back = 4.4, wide = 4.2;
    mx.beginPath();
    mx.moveTo(x + dx*tip,               y + dy*tip);
    mx.lineTo(x - dx*back + nx*wide,    y - dy*back + ny*wide);
    mx.lineTo(x - dx*1.6,               y - dy*1.6);
    mx.lineTo(x - dx*back - nx*wide,    y - dy*back - ny*wide);
    mx.closePath();
    mx.fillStyle = '#FFFFFF';
    mx.strokeStyle = '#080B11'; mx.lineWidth = 1.4;
    mx.fill(); mx.stroke();
  };

  return U;
};

})(window.HS);
