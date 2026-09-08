/* MARKET MAKER — HUD, panels, toasts, minimap. */
window.HS = window.HS || {};
(function(HS){
'use strict';
const $ = HS.$;

HS.UI = function(game){
  const U = {};
  let panelOpen = false;

  /* ---------------- HUD ---------------- */
  U.syncHud = function(){
    const S = game.S;
    const r = HS.rankOf(S);

    $('hudCash').textContent = HS.money(S.cash);
    $('hudCash').style.color = S.cash < 0 ? 'var(--red)' : 'var(--text)';
    $('hudRank').textContent = r.name;
    $('hudDay').textContent  = 'Day ' + S.day + ' · ' + HS.dayName(S.day);
    $('hudClock').textContent = HS.clockStr(S.hour);

    bar('barEnergy', S.energy, 100);
    bar('barSkill',  S.skill, 100);
    bar('barRep',    S.rep, 100);
    bar('barHeat',   S.heat, 100);
    $('valEnergy').textContent = Math.round(S.energy);
    $('valSkill').textContent  = Math.round(S.skill);
    $('valRep').textContent    = Math.round(S.rep);
    $('valHeat').textContent   = Math.round(S.heat);

    $('rowHeat').classList.toggle('danger', S.heat >= 60);
    $('rowEnergy').classList.toggle('danger', S.energy <= 20);

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
    panelOpen = true;
    U.syncHud();
  };
  U.closePanel = function(){
    $('panel').classList.remove('show');
    panelOpen = false;
  };
  U.isPanelOpen = () => panelOpen;

  /* ---------------- modal (story beats, confirms) ---------------- */
  U.modal = function(opts){
    const m = $('modal');
    $('modalTitle').textContent = opts.title || '';
    $('modalTitle').className = 'modal-title ' + (opts.tone || '');
    $('modalBody').innerHTML = opts.body || '';
    const acts = $('modalActions');
    acts.innerHTML = '';
    (opts.actions || [{ label:'OK', onClick:()=>U.closeModal() }]).forEach(a => {
      const b = HS.el('button', 'btn' + (a.ghost ? ' ghost' : ''), a.label);
      b.addEventListener('click', () => { HS.Audio.click(); a.onClick(); });
      acts.appendChild(b);
    });
    m.classList.add('show');
  };
  U.closeModal = function(){ $('modal').classList.remove('show'); };
  U.isModalOpen = () => $('modal').classList.contains('show');

  /* ---------------- minimap ---------------- */
  const mm = $('minimap'), mx = mm.getContext('2d');
  let mmSize = 0;
  U.resizeMinimap = function(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = mm.clientWidth;
    mm.width = mm.height = Math.max(1, Math.round(s * dpr));
    mx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mmSize = s;
  };
  U.drawMinimap = function(city, px, pz, angle){
    if(!mmSize) U.resizeMinimap();
    const S = mmSize, half = city.half + 24;
    const toMap = (x, z) => [ (x + half) / (half*2) * S, (z + half) / (half*2) * S ];

    mx.clearRect(0, 0, S, S);
    mx.fillStyle = '#0A0D13';
    mx.fillRect(0, 0, S, S);

    // street grid
    const C = HS.CITY;
    mx.strokeStyle = 'rgba(255,255,255,.10)';
    mx.lineWidth = 1;
    mx.beginPath();
    for(let i = 0; i <= C.GRID; i++){
      const w = -city.half + i * C.CELL;
      const a = toMap(w, -half), b = toMap(w, half);
      mx.moveTo(a[0], a[1]); mx.lineTo(b[0], b[1]);
      const c = toMap(-half, w), d = toMap(half, w);
      mx.moveTo(c[0], c[1]); mx.lineTo(d[0], d[1]);
    }
    mx.stroke();

    // landmarks
    city.landmarks.forEach(lm => {
      if(!game.isLandmarkActive(lm.id)) return;
      const [x, y] = toMap(lm.x, lm.z);
      mx.fillStyle = game.landmarkColor(lm.id);
      mx.beginPath(); mx.arc(x, y, 3.1, 0, Math.PI*2); mx.fill();
    });

    // player
    const [x, y] = toMap(px, pz);
    mx.save();
    mx.translate(x, y); mx.rotate(-angle);
    mx.fillStyle = '#FFFFFF';
    mx.beginPath();
    mx.moveTo(0, -5); mx.lineTo(3.4, 4); mx.lineTo(0, 2); mx.lineTo(-3.4, 4);
    mx.closePath(); mx.fill();
    mx.restore();
  };

  return U;
};

})(window.HS);
