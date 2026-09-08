/* MARKET MAKER — perk constellations. Three trees, prerequisite-linked,
   bought with points earned from skill and rank. */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* x,y are layout coordinates inside a tree column (0..1). */
HS.PERK_TREES = [
  { id:'tape', name:'THE TAPE', accent:'#3ECFCF',
    blurb:'Seeing what the market is about to do.',
    perks:[
      { id:'t1', name:'Tape Sense',    x:0.5, y:0.06, req:{skill:10},
        desc:'The regime bias leaks through at any skill level.' },
      { id:'t2', name:'Pattern Recall',x:0.22,y:0.32, needs:['t1'], req:{skill:24},
        desc:'Chart review is 10 points more reliable.' },
      { id:'t3', name:'Volatility Ear',x:0.78,y:0.32, needs:['t1'], req:{skill:34},
        desc:'Implied volatility is always shown on the chain.' },
      { id:'t4', name:'Regime Radar',  x:0.22,y:0.60, needs:['t2'], req:{skill:52},
        desc:'The tape\'s state is labelled on the chart, always.' },
      { id:'t5', name:'Greek Fluency', x:0.78,y:0.60, needs:['t3'], req:{skill:58},
        desc:'Delta and theta are always shown, whatever your skill.' },
      { id:'t6', name:'The Read',      x:0.5, y:0.88, needs:['t4','t5'], req:{skill:82},
        desc:'Chart review is never wrong again.' }
    ]},
  { id:'risk', name:'RISK', accent:'#FF5B67',
    blurb:'How much you can carry, and what it costs you.',
    perks:[
      { id:'r1', name:'Position Sizing',x:0.5, y:0.06, req:{rank:1},
        desc:'Carry 30% more size on every trade.' },
      { id:'r2', name:'Tight Fills',    x:0.22,y:0.32, needs:['r1'],
        desc:'Commission cut by a third.' },
      { id:'r3', name:'Iron Stomach',   x:0.78,y:0.32, needs:['r1'],
        desc:'You can bleed to 25% of the book before they pull you.' },
      { id:'r4', name:'Margin Line',    x:0.22,y:0.60, needs:['r2'], req:{rank:3},
        desc:'Writing options ties up a third less margin.' },
      { id:'r5', name:'Second Slot',    x:0.78,y:0.60, needs:['r3'], req:{rank:3},
        desc:'Hold two LEAPs at once instead of one.' },
      { id:'r6', name:'Whale Hands',    x:0.5, y:0.88, needs:['r4','r5'], req:{rank:5},
        desc:'Another 60% of size on top of everything else.' }
    ]},
  { id:'street', name:'THE STREET', accent:'#E8B85C',
    blurb:'People, money, and staying out of the file.',
    perks:[
      { id:'s1', name:'Small Talk',   x:0.5, y:0.06, req:{rep:8},
        desc:'Working a room earns 50% more reputation.' },
      { id:'s2', name:'Rolodex',      x:0.22,y:0.32, needs:['s1'],
        desc:'Favours from contacts cost no time and no energy.' },
      { id:'s3', name:'Good Credit',  x:0.78,y:0.32, needs:['s1'],
        desc:'Loan interest halved.' },
      { id:'s4', name:'Name on the Door',x:0.22,y:0.60, needs:['s2'], req:{rep:46},
        desc:'Raise 40% more capital every time you ask.' },
      { id:'s5', name:'Discretion',   x:0.78,y:0.60, needs:['s3'], req:{rep:40},
        desc:'Heat cools twice as fast overnight.' },
      { id:'s6', name:'Untouchable',  x:0.5, y:0.88, needs:['s4','s5'], req:{rep:72},
        desc:'Investigations cost half as much and add no heat.' }
    ]}
];

const ALL = {};
HS.PERK_TREES.forEach(t => t.perks.forEach(p => { p.tree = t.id; ALL[p.id] = p; }));
HS.PERK = ALL;

HS.hasPerk = function(S, id){ return !!(S && S.perks && S.perks[id]); };

/* Points come from skill and from rank, so both kinds of progress pay. */
HS.perkPointsEarned = function(S){
  return Math.floor(S.skill / 8) + (S.path ? S.rank + 1 : 0);
};
HS.syncPerkPoints = function(S){
  S.perkPoints = Math.max(0, HS.perkPointsEarned(S) - (S.perksSpent || 0));
};

HS.perkReqText = function(S, p){
  const out = [];
  if(p.req){
    if(p.req.skill != null) out.push({ label:'Skill ' + p.req.skill, ok: S.skill >= p.req.skill });
    if(p.req.rep   != null) out.push({ label:'Reputation ' + p.req.rep, ok: S.rep >= p.req.rep });
    if(p.req.rank  != null) out.push({ label:'Rank ' + p.req.rank, ok: S.rank >= p.req.rank });
  }
  (p.needs || []).forEach(n => out.push({ label: ALL[n].name, ok: HS.hasPerk(S, n) }));
  return out;
};
HS.canBuyPerk = function(S, p){
  if(HS.hasPerk(S, p.id)) return false;
  if(S.perkPoints < 1) return false;
  return HS.perkReqText(S, p).every(r => r.ok);
};
HS.buyPerk = function(S, id){
  const p = ALL[id];
  if(!p || !HS.canBuyPerk(S, p)) return false;
  S.perks[id] = 1;
  S.perksSpent = (S.perksSpent || 0) + 1;
  HS.syncPerkPoints(S);
  return true;
};

/* ---- effect lookups, so callers never test perk ids by hand ---- */
HS.sizeMul     = S => (HS.hasPerk(S,'r1') ? 1.3 : 1) * (HS.hasPerk(S,'r6') ? 1.6 : 1);
HS.feeMul      = S => HS.hasPerk(S,'r2') ? 0.67 : 1;
HS.bustFloor   = S => HS.hasPerk(S,'r3') ? 0.25 : 0.40;
HS.marginMul   = S => HS.hasPerk(S,'r4') ? 0.67 : 1;
HS.leapSlots   = S => HS.hasPerk(S,'r5') ? 2 : 1;
HS.reviewBonus = S => HS.hasPerk(S,'t6') ? 100 : (HS.hasPerk(S,'t2') ? 10 : 0);
HS.alwaysIv    = S => HS.hasPerk(S,'t3');
HS.alwaysGreeks= S => HS.hasPerk(S,'t5');
HS.alwaysRegime= S => HS.hasPerk(S,'t4');
HS.readFloor   = S => HS.hasPerk(S,'t1') ? 0.35 : 0;
HS.networkMul  = S => HS.hasPerk(S,'s1') ? 1.5 : 1;
HS.freeFavour  = S => HS.hasPerk(S,'s2');
HS.raiseMul    = S => HS.hasPerk(S,'s4') ? 1.4 : 1;
HS.probeMul    = S => HS.hasPerk(S,'s6') ? 0.5 : 1;

})(window.HS);
