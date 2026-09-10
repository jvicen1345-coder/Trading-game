/* MARKET MAKER - gamepad.
 *
 * A DualSense reports through the standard mapping, so this works for an Xbox
 * pad or anything else that does too. Three jobs:
 *
 *   1. The left stick walks, which is the one thing a keyboard was worse at.
 *   2. Buttons become the keys the rest of the game already listens for, so
 *      nothing else in the codebase has to know a pad exists.
 *   3. Lists get a cursor, because a panel full of choices is unusable
 *      otherwise and that is most of this game.
 */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* Standard mapping, and the face buttons named the way a PlayStation owner
   would name them. */
const B = { cross:0, circle:1, square:2, triangle:3,
            l1:4, r1:5, l2:6, r2:7, share:8, options:9, l3:10, r3:11,
            up:12, down:13, left:14, right:15, ps:16 };

const DEAD = 0.24;          // stick slop
const REPEAT_FIRST = 380;   // ms before a held direction repeats
const REPEAT_NEXT = 130;

HS.Pad = function(game, input){
  const P = {};
  let prev = [], connected = false, since = {}, cursor = -1, lastList = '';

  function pads(){
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for(let i = 0; i < list.length; i++) if(list[i] && list[i].connected) return list[i];
    return null;
  }

  /* Send the key the rest of the game is already waiting for. */
  function key(k, shift){
    window.dispatchEvent(new KeyboardEvent('keydown',
      { key:k, shiftKey:!!shift, bubbles:true, cancelable:true }));
  }

  /* ---------------- the cursor ----------------
     Whatever is on top gets it: a modal, then an overlay, then a panel, then
     the pause menu. Inside the trading session nothing needs a cursor, since
     every action there has its own button. */
  function listOf(){
    const vis = el => el && el.offsetParent !== null;
    /* Selectors are taken in the order given, not the order the DOM happens to
       hold them, so the way out of a panel is the last thing you land on
       rather than the first. */
    const grab = (sels, tag) => {
      const n = [];
      sels.forEach(sel => [...document.querySelectorAll(sel)].forEach(e => {
        if(vis(e) && !e.disabled && !e.classList.contains('locked') && n.indexOf(e) < 0) n.push(e);
      }));
      return n.length ? { id:tag, items:n } : null;
    };
    /* A card inside the trading session is still a list of choices. Without
       this the pad falls through to the market bindings and Cross buys a
       contract instead of dismissing the card that is covering the screen,
       which makes the teaching cards on the first day impossible to get past. */
    if(HS.$('mkBreak').classList.contains('show'))
      return grab(['#mkBreak button'], 'mkbreak');
    if(HS.$('modal').classList.contains('show'))
      return grab(['#modalBody .mug', '#modalBody .act',
                   '#modalActions .act', '#modalActions button'], 'modal');
    for(const id of ['help','room','perks','bigmap'])
      if(HS.$(id).classList.contains('show')) return grab(['#' + id + ' button'], id);
    if(HS.$('menu').classList.contains('show')) return grab(['#menu button'], 'menu');
    if(HS.$('panel').classList.contains('show'))
      return grab(['#panelActions .act', '#panelClose'], 'panel');
    return null;
  }

  function paint(list){
    document.querySelectorAll('.gp-on').forEach(e => e.classList.remove('gp-on'));
    if(!list || cursor < 0) return;
    const el = list.items[cursor];
    if(!el) return;
    el.classList.add('gp-on');
    if(el.scrollIntoView) el.scrollIntoView({ block:'nearest' });
  }

  function move(list, d){
    if(!list) return;
    cursor = (Math.max(0, cursor) + d + list.items.length) % list.items.length;
    HS.Audio.click();
    paint(list);
  }

  /* ---------------- reading the pad ---------------- */
  const held = (g, i) => !!(g.buttons[i] && g.buttons[i].pressed);
  const hit  = (g, i) => held(g, i) && !prev[i];

  /* A direction you keep pushing should keep moving, but not instantly. */
  function repeat(name, on, now, fn){
    if(!on){ since[name] = 0; return; }
    if(!since[name]){ since[name] = now + REPEAT_FIRST; fn(); return; }
    if(now >= since[name]){ since[name] = now + REPEAT_NEXT; fn(); }
  }

  P.poll = function(){
    const g = pads();
    if(!g){
      if(connected){ connected = false; document.body.classList.remove('pad'); }
      return;
    }
    if(!connected){
      connected = true;
      document.body.classList.add('pad');
      if(game.ui) game.ui.toast('Controller connected.', 'good');
    }
    const now = performance.now();
    const card = HS.$('mkBreak').classList.contains('show');
    const market = HS.$('market').classList.contains('show') && !card;
    const list = market ? null : listOf();
    if(list && list.id !== lastList){ lastList = list.id; cursor = 0; paint(list); }
    if(!list){ lastList = ''; if(cursor >= 0){ cursor = -1; paint(null); } }

    /* ---- walking ---- */
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    const mag = Math.hypot(ax, ay);
    if(!list && !market){
      input.setAxis(Math.abs(ax) > DEAD ? ax : 0,
                    Math.abs(ay) > DEAD ? ay : 0,
                    held(g, B.r2) || held(g, B.l3) || mag > 0.92);
    } else input.setAxis(0, 0, false);

    /* ---- a cursor over a list of choices ---- */
    if(list){
      /* Left and right walk the same list as up and down. Most of these are
         stacked, but a line-up of faces runs across, and reaching for the
         D-pad direction the row actually points in should not do nothing. */
      const up = held(g, B.up)   || held(g, B.left)  || ay < -0.55 || ax < -0.55;
      const dn = held(g, B.down) || held(g, B.right) || ay >  0.55 || ax >  0.55;
      repeat('u', up, now, () => move(list, -1));
      repeat('d', dn, now, () => move(list, 1));
      if(hit(g, B.cross)){
        const el = list.items[HS.clamp(cursor, 0, list.items.length - 1)];
        if(el) el.click();
      }
      if(hit(g, B.circle) || hit(g, B.options)) key('Escape');
    }

    /* ---- the trading session, where everything has its own button ---- */
    else if(market){
      if(hit(g, B.cross))    key('b');
      if(hit(g, B.square))   key('s');
      if(hit(g, B.circle))   key(' ');
      if(hit(g, B.triangle)) key('Tab');
      /* Up and down walk the rungs, left and right pick the side. Holding a
         trigger to get a put was a thing nobody found and nobody wants to do
         with one hand on the stick. */
      const rung = n => key(String(n), P.put);
      repeat('u', held(g, B.up)   || ay < -0.55, now,
        () => { P.rung = Math.max(1, (P.rung || 3) - 1); rung(P.rung); });
      repeat('d', held(g, B.down) || ay > 0.55, now,
        () => { P.rung = Math.min(5, (P.rung || 3) + 1); rung(P.rung); });
      if(hit(g, B.left)  && P.put){ P.put = false; rung(P.rung || 3); }
      if(hit(g, B.right) && !P.put){ P.put = true;  rung(P.rung || 3); }
      if(hit(g, B.l1)) size(-1);
      if(hit(g, B.r1)) size(1);
      /* the book you are already carrying */
      if(hit(g, B.r2) || hit(g, B.l2)) tab();
      if(hit(g, B.options)) key('Escape');
    }

    /* ---- out in the city ---- */
    else {
      if(hit(g, B.cross))    key('e');
      if(hit(g, B.circle))   key('Escape');
      if(hit(g, B.square))   key('p');
      if(hit(g, B.triangle)) key('Tab');
      if(hit(g, B.options))  key('Escape');
      if(hit(g, B.l1))       key('[');
      if(hit(g, B.r1))       key(']');
      if(hit(g, B.share))    key('h');
    }

    prev = g.buttons.map(b => b.pressed);
  };

  /* CHAIN and BOOK are tabs rather than keys, so the pad clicks them. */
  function tab(){
    const chain = HS.$('mkTabChain'), book = HS.$('mkTabBook');
    if(!chain || !book) return;
    (chain.classList.contains('sel') ? book : chain).click();
  }

  /* Size is a row of buttons rather than a key, so it gets nudged directly. */
  function size(d){
    const row = [...document.querySelectorAll('#mkQty .mk-size')];
    if(!row.length) return;
    let i = row.findIndex(b => b.classList.contains('sel'));
    i = Math.max(0, Math.min(row.length - 1, (i < 0 ? 1 : i) + d));
    row[i].click();
  }

  P.put = false;
  P.connected = () => connected;
  return P;
};

})(window.HS);
