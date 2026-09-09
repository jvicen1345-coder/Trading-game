/* MARKET MAKER - game state: stats, clock, economy, career, save/load. */
window.HS = window.HS || {};
(function(HS){
'use strict';

const SAVE_KEY = 'marketmaker_save_v2';

/* Real seconds -> game minutes. Slow enough that a weekday has room in it. */
HS.MINUTES_PER_SECOND = 1.0;

HS.MARKET_OPEN  = 9.5;
HS.MARKET_CLOSE = 16.0;
HS.WAKE_HOUR    = 7.0;
HS.CURFEW_HOUR  = 3.0;
HS.MAX_ENERGY_CAP = 150;

/* Going to bed early is worth something. */
HS.REST = {
  refreshed:{ id:2, name:'Refreshed', pct:1.00, note:'Sharper reads and cheaper effort all day' },
  normal:   { id:1, name:'Rested',    pct:0.86, note:'A normal night' },
  poor:     { id:0, name:'Ragged',    pct:0.66, note:'You went to bed too late' }
};
HS.restFor = function(hour){
  // hour is the clock when you got into bed; after midnight counts as very late
  const late = hour < 5 ? hour + 24 : hour;
  if(late <= 21.5) return HS.REST.refreshed;
  if(late <= 23.5) return HS.REST.normal;
  return HS.REST.poor;
};

HS.HOUSING = [
  { id:0, name:"Parents' Basement", landmark:'home_basement', rent:0,
    quality:0.86, price:0,       desc:'Damp, low ceiling, a poster of a yacht you do not own.' },
  { id:1, name:'Rented Studio',     landmark:'home_studio',    rent:900,
    quality:0.94, price:14000,   desc:'Four hundred square feet and your name on the lease.' },
  { id:2, name:'Riverside Loft',    landmark:'home_loft',      rent:5200,
    quality:1.00, price:180000,  desc:'Exposed brick, river light, a doorman who knows you.' },
  { id:3, name:'Sky Penthouse',     landmark:'home_penthouse', rent:24000,
    quality:1.06, price:2400000, desc:'The whole skyline, below you, where it belongs.' }
];

/* ------------------------------------------------------------------
   CAREER
   Everyone starts as an intern. Friday of week one forces a choice
   between two visible paths; the third has to find you.
   ------------------------------------------------------------------ */
HS.INTERN = { i:0, name:'Intern', salary:120, outfit:0 };

HS.PATHS = {
  solo: {
    id:'solo', name:'Day Trader', accent:'#E8B85C', home:true,
    tagline:'Rough it alone',
    blurb:'Trade your own account from the bedroom. No salary, no boss, no floor to hide on. Every dollar is yours and so is every hole.',
    ranks:[
      { i:1, name:'Retail Account',   salary:0, outfit:0, need:{} },
      { i:2, name:'Consistent',       salary:0, outfit:1, need:{ skill:18, rep:10, cash:12000 } },
      { i:3, name:'Funded Trader',    salary:0, outfit:2, need:{ skill:32, rep:22, cash:55000 } },
      { i:4, name:'Prop Desk of One', salary:0, outfit:3, need:{ skill:52, rep:42, cash:900000 } },
      { i:5, name:'Whale',            salary:0, outfit:4, need:{ skill:68, rep:55, cash:2500000 } },
      { i:6, name:'THE LEGEND',       salary:0, outfit:4, need:{ skill:82, rep:64, cash:5000000 } }
    ]
  },
  desk: {
    id:'desk', name:'The Floor', accent:'#3ECFCF',
    tagline:'Climb the chain',
    blurb:'Stay at Ladder & Co. and work the ladder. A salary, a book that grows with your title, and a floor you might one day run.',
    ranks:[
      { i:1, name:'Junior Broker',  salary:520,   outfit:1, need:{} },
      { i:2, name:'Broker',         salary:1400,  outfit:2, need:{ skill:28, rep:24 } },
      { i:3, name:'Senior Broker',  salary:3600,  outfit:2, need:{ skill:44, rep:40 } },
      { i:4, name:'Vice President', salary:8200,  outfit:3, need:{ skill:52, rep:52, cash:150000 } },
      { i:5, name:'Partner',        salary:22000, outfit:4, need:{ skill:66, rep:66, cash:1500000 } },
      { i:6, name:'HEAD OF THE FLOOR', salary:0,  outfit:4, need:{ skill:82, rep:84, brokers:8, cash:6000000 } }
    ]
  },
  fund: {
    id:'fund', name:'The Fund', accent:'#FF5B67', hidden:true,
    tagline:'Take the meeting',
    blurb:'Kade\'s money, Kade\'s rules, and a mandate written loosely enough to cover almost anything. The city will learn your name the hard way.',
    ranks:[
      { i:1, name:'Analyst',        salary:9000, outfit:3, need:{} },
      { i:2, name:'Portfolio Mgr',  salary:0,    outfit:3, need:{ aum:8000000, rep:45 } },
      { i:3, name:'The Predator',   salary:0,    outfit:4, need:{ aum:45000000 } },
      { i:4, name:'THE VILLAIN',    salary:0,    outfit:4, need:{ aum:220000000 } }
    ]
  }
};

/* What has to be true before Ezra Kade thinks you are worth a meeting.
   He is looking for someone capable and already a little bent. */
HS.KADE_CRITERIA = { week:3, netWorth:400000, skill:55, heat:15 };

HS.kadeReady = function(S){
  const c = HS.KADE_CRITERIA;
  return !S.flags.kadeOffered && S.path && S.path !== 'fund' &&
         HS.weekOf(S.day) >= c.week &&
         HS.netWorth(S) >= c.netWorth &&
         S.skill >= c.skill &&
         S.heat >= c.heat;
};

/* Overheard lines that keep Kade in the corner of your eye from day one. */
HS.KADE_RUMOURS = [
  'Someone at the bar says Ezra Kade took a whole floor out at Bell Harrow. Nobody laughs.',
  '"Kade only calls once," the man next to you says, to nobody in particular.',
  'Two brokers stop talking when you sit down. You catch the word "Kade".',
  'The paper says an unnamed fund shorted the index into the close. Everyone knows whose.',
  'A woman at the end of the bar: "He does not hire. He collects."'
];

HS.newState = function(){
  return {
    version:2,
    day:1, hour:8.0,
    cash:400, loan:0, loanRate:0.04,
    rep:0, skill:5, heat:0, energy:66, maxEnergy:72,
    rest:1,
    path:null, rank:0, housing:0,
    contacts:0, tips:0,
    brokers:[], aum:0, investors:0,
    market:null,
    positions:[],
    perks:{}, perkPoints:0, perksSpent:0,
    room:{ bed:'bed_cot', desk:null, rig:null, seat:null, wall:null, floor:null },
    weekPnl:0, weekStartCash:400,
    workedToday:false, studiedToday:false, networkedToday:false,
    gymToday:false, reviewedToday:false, drinksToday:0,
    edge:null,
    rentDueDay:8,
    tutorial:{ step:0, done:false },
    stats:{ sessions:0, wins:0, bestDay:0, daysPlayed:1, netPeak:400 },
    flags:{},
    ended:null
  };
};

/* ---------- derived ---------- */
HS.rankOf = function(S){
  if(!S.path) return HS.INTERN;
  const p = HS.PATHS[S.path];
  return p.ranks.find(r => r.i === S.rank) || p.ranks[0];
};
HS.nextRank = function(S){
  if(!S.path) return null;
  const p = HS.PATHS[S.path];
  return p.ranks.find(r => r.i === S.rank + 1) || null;
};
HS.netWorth = function(S){
  let n = S.cash - S.loan;
  n += HS.HOUSING[S.housing].price * 0.85;
  n += S.aum * 0.02;
  n += S.brokers.length * 40000;
  (S.positions || []).forEach(p => { n += p.qty * p.entry * 100; });
  return n;
};

HS.meetsNeed = function(S, need){
  if(!need) return true;
  if(need.skill   != null && S.skill   < need.skill)   return false;
  if(need.rep     != null && S.rep     < need.rep)     return false;
  if(need.cash    != null && S.cash    < need.cash)    return false;
  if(need.brokers != null && S.brokers.length < need.brokers) return false;
  if(need.aum     != null && S.aum     < need.aum)     return false;
  return true;
};
HS.needText = function(S, need){
  if(!need) return [];
  const out = [];
  const add = (label, have, want, fmt) => {
    if(want == null) return;
    out.push({ label, ok: have >= want, text:(fmt ? fmt(have) : Math.floor(have)) + ' / ' + (fmt ? fmt(want) : want) });
  };
  add('Skill', S.skill, need.skill);
  add('Reputation', S.rep, need.rep);
  add('Cash', S.cash, need.cash, HS.money);
  add('Brokers', S.brokers.length, need.brokers);
  add('Assets under mgmt', S.aum, need.aum, HS.money);
  return out;
};

/* ---------- clock ---------- */
HS.advanceTime = function(S, hours){
  S.hour += hours;
  while(S.hour >= 24){ S.hour -= 24; HS.rollDay(S, []); }
};

HS.rollDay = function(S, ev){
  S.day++;
  S.stats.daysPlayed++;
  S.workedToday = S.studiedToday = S.networkedToday = false;
  S.gymToday = S.reviewedToday = false;
  S.drinksToday = 0;
  if(S.edge && S.edge.day < S.day) S.edge = null;

  const nightsSkipped = 1;
  HS.rollMarketNight(S, HS.isMonday(S.day) ? 3 : nightsSkipped);

  HS.settleExpired(S, S.day).forEach(r => {
    ev.push({ kind: r.pnl >= 0 ? 'good' : 'bad',
      text: HS.posName(r.pos, S.day) + ' expired ' +
            (r.value > 0 ? 'worth ' + r.value.toFixed(2) : 'worthless') +
            ', worth ' + HS.signed(r.pnl) });
  });

  if(HS.isMonday(S.day)){
    S.weekStartCash = S.cash;
    S.weekPnl = 0;
  }

  if(S.day >= S.rentDueDay){
    S.rentDueDay = S.day + 7;
    const rent = HS.HOUSING[S.housing].rent;
    if(rent > 0){
      S.cash -= rent;
      ev.push({ kind:'bill', text:'Rent due. ' + HS.money(rent) + ' out.' });
    }
    if(S.loan > 0){
      const rate = S.loanRate * (HS.hasPerk(S,'s3') ? 0.5 : 1);
      const interest = Math.round(S.loan * rate);
      S.loan += interest;
      ev.push({ kind:'bill', text:'Loan interest. ' + HS.money(interest) + ' added.' });
    }
  }

  if(S.brokers.length){
    let take = 0;
    S.brokers.forEach(b => {
      const gross = b.skill * 90 * (0.55 + Math.random() * 0.9);
      take += gross * 0.45 - b.salary;
      b.morale = HS.clamp(b.morale + (Math.random() < 0.5 ? -2 : 2), 10, 100);
    });
    S.cash += take;
    ev.push({ kind: take >= 0 ? 'good' : 'bad',
              text:'The floor cleared ' + HS.signed(take) + ' overnight.' });
  }

  if(S.aum > 0){
    const edge = 0.006 + S.skill * 0.00022;
    const ret = edge + HS.gauss() * 0.028 * (1 + S.heat * 0.004);
    const pnl = S.aum * ret;
    S.aum = Math.max(0, S.aum + pnl);
    S.cash += pnl * 0.2;
    if(ret > 0.03) S.heat = HS.clamp(S.heat + 1.5, 0, 100);
    ev.push({ kind: pnl >= 0 ? 'good' : 'bad',
              text:'Fund ' + (pnl >= 0 ? 'printed ' : 'bled ') + HS.money(Math.abs(pnl)) +
                   ' (' + HS.pct(ret) + ').' });
  }

  S.heat = HS.clamp(S.heat - (HS.hasPerk(S,'s5') ? 1.6 : 0.8), 0, 100);
  const nw = HS.netWorth(S);
  if(nw > S.stats.netPeak) S.stats.netPeak = nw;
};

/* ---------- helpers ---------- */
HS.addRep   = (S, n) => { S.rep   = HS.clamp(S.rep   + n, 0, 100); };
HS.addSkill = (S, n) => { S.skill = HS.clamp(S.skill + n, 0, 100); HS.syncPerkPoints(S); };
HS.addHeat  = (S, n) => { S.heat  = HS.clamp(S.heat  + n, 0, 100); };
HS.addEnergy= (S, n) => { S.energy= HS.clamp(S.energy + n, 0, S.maxEnergy || 100); };

/* Refreshed days make everything cost a little less. */
HS.energyCost = function(S, base){
  let m = S.rest === 2 ? 0.85 : S.rest === 0 ? 1.15 : 1;
  if(HS.roomBonus(S,'effort')) m *= 0.92;
  return Math.max(1, Math.round(base * m));
};

HS.DRINKS = [
  { name:'Small can',  energy:15 },
  { name:'Tall can',   energy:30 },
  { name:'The big one',energy:50 }
];
HS.drinkPrice = function(S, amount){
  const base = amount * amount * 0.5 + amount * 5;
  return Math.round(base * Math.pow(2.1, S.drinksToday));
};

/* ---------- persistence ---------- */
HS.save = function(S){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; }catch(e){ return false; }
};
HS.load = function(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const S = JSON.parse(raw);
    return (S && S.version === 2) ? S : null;
  }catch(e){ return null; }
};
HS.hasSave = function(){ try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; } };
HS.clearSave = function(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} };

})(window.HS);
