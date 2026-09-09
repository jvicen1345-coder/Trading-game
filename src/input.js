/* MARKET MAKER - keyboard/touch input. */
window.HS = window.HS || {};
(function(HS){
'use strict';

HS.Input = function(){
  const I = { up:false, down:false, left:false, right:false, sprint:false, interact:false };
  const keys = {};
  I.keys = keys;

  const MAP = {
    'w':'up','arrowup':'up',
    's':'down','arrowdown':'down',
    'a':'left','arrowleft':'left',
    'd':'right','arrowright':'right',
    'shift':'sprint'
  };

  /* An analogue stick sits alongside the keys rather than replacing them, so a
     player can use a pad and a keyboard in the same session and neither one
     cancels the other out. */
  let padX = 0, padY = 0, padSprint = false;

  function apply(){
    I.up    = !!keys.up    || padY < -0.3;
    I.down  = !!keys.down  || padY >  0.3;
    I.left  = !!keys.left  || padX < -0.3;
    I.right = !!keys.right || padX >  0.3;
    I.sprint = !!keys.sprint || padSprint;
    I.axisX = padX; I.axisY = padY;
  }

  I.setAxis = function(x, y, sprint){
    padX = x; padY = y; padSprint = !!sprint;
    apply();
  };

  I.onKey = null;        // (key, event) => true if consumed
  I.enabled = true;

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if(I.onKey && I.onKey(k, e)) { e.preventDefault(); return; }
    const m = MAP[k];
    if(m){ keys[m] = true; apply(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    const m = MAP[k];
    if(m){ keys[m] = false; apply(); }
  });
  window.addEventListener('blur', () => {
    for(const k in keys) keys[k] = false;
    apply();
  });

  /* virtual stick for touch devices */
  I.bindStick = function(zone, knob){
    let id = null, ox = 0, oy = 0;
    const R = 46;
    const set = (dx, dy) => {
      const d = Math.hypot(dx, dy);
      const c = d > R ? R / d : 1;
      knob.style.transform = 'translate(' + (dx*c) + 'px,' + (dy*c) + 'px)';
      const nx = dx / R, ny = dy / R;
      keys.left  = nx < -0.32; keys.right = nx > 0.32;
      keys.up    = ny < -0.32; keys.down  = ny > 0.32;
      keys.sprint = d > R * 0.86;
      apply();
    };
    const clear = () => {
      knob.style.transform = 'translate(0,0)';
      keys.left = keys.right = keys.up = keys.down = keys.sprint = false;
      apply();
    };
    zone.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = zone.getBoundingClientRect();
      ox = r.left + r.width/2; oy = r.top + r.height/2;
      set(t.clientX - ox, t.clientY - oy);
      e.preventDefault();
    }, { passive:false });
    zone.addEventListener('touchmove', e => {
      for(const t of e.changedTouches) if(t.identifier === id){
        set(t.clientX - ox, t.clientY - oy); e.preventDefault();
      }
    }, { passive:false });
    const end = e => {
      for(const t of e.changedTouches) if(t.identifier === id){ id = null; clear(); }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  };

  return I;
};

})(window.HS);
