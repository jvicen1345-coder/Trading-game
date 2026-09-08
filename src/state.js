/* MARKET MAKER — game state: stats, clock, economy, career ladder, save/load. */
window.HS = window.HS || {};
(function(HS){
'use strict';

const SAVE_KEY = 'heatseeker_broker_save_v1';

/* Real seconds -> game minutes. One game hour is ~40 real seconds, so a
   weekday has room to do several things without feeling like a countdown. */
HS.MINUTES_PER_SECOND = 1.5;

/* The trading day. A work session *is* this window, compressed. */
HS.MARKET_OPEN  = 9.5;    // 9:30
HS.MARKET_CLOSE = 16.0;   // 4:00 pm
HS.WAKE_HOUR    = 7.0;
HS.CURFEW_HOUR  = 3.0;    // still outside at 3am and the night takes something

HS.MAX_ENERGY_CAP = 180;  // ceiling the gym can raise you to

HS.HOUSING = [
  { id:0, name:"Parents' Basement", landmark:'home_basement', rent:0,
    sleepPct:0.72, price:0,       desc:'Damp, low ceiling, a poster of a yacht you do not own.' },
  { id:1, name:'Rented Studio',     landmark:'home_studio',    rent:900,
    sleepPct:0.86, price:14000,   desc:'Four hundred square feet and your name on the lease.' },
  { id:2, name:'Riverside Loft',    landmark:'home_loft',      rent:5200,
    sleepPct:0.95, price:180000,  desc:'Exposed brick, river light, a doorman who knows you.' },
  { id:3, name:'Sky Penthouse',     landmark:'home_penthouse', rent:24000,
    sleepPct:1.00, price:2400000, desc:'The whole skyline, below you, where it belongs.' }
];

/* The ladder. Ranks 0-5 are shared; 6+ depend on the path taken. */
HS.RANKS = [
  { i:0, name:'Basement Nobody', salary:0,     outfit:0 },
  { i:1, name:'Cold Caller',     salary:180,   outfit:1, need:{} },
  { i:2, name:'Junior Broker',   salary:520,   outfit:1, need:{ skill:20, rep:15 } },
  { i:3, name:'Broker',          salary:1400,  outfit:2, need:{ skill:35, rep:30 } },
  { i:4, name:'Senior Broker',   salary:3600,  outfit:2, need:{ skill:50, rep:45 } },
  { i:5, name:'Vice President',  salary:8200,  outfit:3, need:{ skill:65, rep:60, cash:180000 } }
];

HS.PATHS = {
  legend: {
    id:'legend', name:'The Legend', accent:'#E8B85C',
    blurb:'Stay on the desk. Out-trade every human in the city until your name is the benchmark.',
    ranks:[
      { i:6, name:'Star Broker',       salary:22000,  outfit:3, need:{ skill:75, rep:72 } },
      { i:7, name:'Managing Director', salary:60000,  outfit:4, need:{ skill:85, rep:84, cash:1500000 } },
      { i:8, name:'THE LEGEND',        salary:0,      outfit:4, need:{ skill:92, rep:93, cash:6000000 } }
    ]
  },
  boss: {
    id:'boss', name:'The House', accent:'#3ECFCF',
    blurb:'Stop trading your own book. Open a floor, hire brokers, and take a cut of everything they touch.',
    ranks:[
      { i:6, name:'Founder',    salary:0, outfit:3, need:{ brokers:3 } },
      { i:7, name:'Floor Boss', salary:0, outfit:4, need:{ brokers:8,  cash:2000000 } },
      { i:8, name:'THE HOUSE',  salary:0, outfit:4, need:{ brokers:15, cash:12000000 } }
    ]
  },
  villain: {
    id:'villain', name:'The Villain', accent:'#FF5B67',
    blurb:'Raise a fund, lever it to the ceiling, and let the city hate you all the way to the top.',
    ranks:[
      { i:6, name:'Fund Manager', salary:0, outfit:3, need:{ aum:5000000 } },
      { i:7, name:'The Predator', salary:0, outfit:4, need:{ aum:35000000 } },
      { i:8, name:'THE VILLAIN',  salary:0, outfit:4, need:{ aum:200000000 } }
    ]
  }
};

/* Everything that opens up, and what opens it. Shown on the career screen. */
HS.UNLOCKS = [
  { by:'rank',  at:1, name:'A job at Ladder & Co.',   note:'Trade the firm\'s book for commission' },
  { by:'rank',  at:2, name:'LEAP contracts',          note:'A year of time value — barely any decay' },
  { by:'rank',  at:2, name:'Chart review',            note:'Read tomorrow\'s tape before the open' },
  { by:'rank',  at:3, name:'The Exchange',            note:'Trade your own money and keep all of it' },
  { by:'rank',  at:4, name:'0DTE contracts',          note:'Expire at the bell. All gamma, all theta' },
  { by:'rank',  at:5, name:'The fork',                note:'Choose Legend, House or Villain' },
  { by:'skill', at:25, name:'Delta',                  note:'See how much each contract moves with the tape' },
  { by:'skill', at:45, name:'Theta',                  note:'See what holding overnight actually costs' },
  { by:'skill', at:65, name:'Implied volatility',     note:'See what the chain thinks the future is worth' }
];

HS.newState = function(){
  return {
    version:1,
    day:1, hour:8.0,
    cash:240, loan:0, loanRate:0.04,
    rep:0, skill:5, heat:0, energy:88, maxEnergy:100,
    rank:0, path:null, housing:0,
    contacts:0, tips:0,
    brokers:[], aum:0, investors:0,
    workedToday:false, studiedToday:false, networkedToday:false,
    gymToday:false, reviewedToday:false, drinksToday:0,
    edge:null,                       // chart-review read on tomorrow's tape
    rentDueDay:8,
    stats:{ trades:0, wins:0, bestDay:0, daysPlayed:1, netPeak:240 },
    flags:{},
    log:[],
    ended:null
  };
};

/* ---------- derived ---------- */
HS.rankOf = function(S){
  if(S.rank <= 5) return HS.RANKS[S.rank];
  const p = HS.PATHS[S.path];
  if(!p) return HS.RANKS[5];
  return p.ranks.find(r => r.i === S.rank) || p.ranks[p.ranks.length - 1];
};
HS.nextRank = function(S){
  if(S.rank < 5) return HS.RANKS[S.rank + 1];
  if(S.rank === 5) return null;               // the branch point, handled separately
  const p = HS.PATHS[S.path];
  if(!p) return null;
  return p.ranks.find(r => r.i === S.rank + 1) || null;
};
HS.netWorth = function(S){
  let n = S.cash - S.loan;
  n += HS.HOUSING[S.housing].price * 0.85;
  n += S.aum * 0.02;                          // your stake in the fund
  n += S.brokers.length * 40000;              // franchise value of a seat
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
    out.push({ label, ok: have >= want, text: (fmt ? fmt(have) : Math.floor(have)) + ' / ' + (fmt ? fmt(want) : want) });
  };
  add('Skill', S.skill, need.skill);
  add('Reputation', S.rep, need.rep);
  add('Cash', S.cash, need.cash, HS.money);
  add('Brokers', S.brokers.length, need.brokers);
  add('Assets under mgmt', S.aum, need.aum, HS.money);
  return out;
};

/* ---------- clock ---------- */
/* Advance the clock; returns a list of events the caller should surface. */
HS.advanceTime = function(S, hours){
  const ev = [];
  S.hour += hours;
  while(S.hour >= 24){
    S.hour -= 24;
    HS.rollDay(S, ev);
  }
  return ev;
};

HS.rollDay = function(S, ev){
  S.day++;
  S.stats.daysPlayed++;
  S.workedToday = S.studiedToday = S.networkedToday = false;
  S.gymToday = S.reviewedToday = false;
  S.drinksToday = 0;
  if(S.edge && S.edge.day < S.day) S.edge = null;   // a read goes stale overnight

  // weekly rent + loan interest
  if(S.day >= S.rentDueDay){
    S.rentDueDay = S.day + 7;
    const rent = HS.HOUSING[S.housing].rent;
    if(rent > 0){
      S.cash -= rent;
      ev.push({ kind:'bill', text:'Rent due — ' + HS.money(rent) + ' out.' });
    }
    if(S.loan > 0){
      const interest = Math.round(S.loan * S.loanRate);
      S.loan += interest;
      ev.push({ kind:'bill', text:'Loan interest — ' + HS.money(interest) + ' added to your balance.' });
    }
  }

  // your floor earns while you sleep
  if(S.brokers.length){
    let take = 0;
    S.brokers.forEach(b => {
      const gross = b.skill * 90 * (0.55 + Math.random() * 0.9);
      const cut = gross * 0.45;
      take += cut - b.salary;
      b.morale = HS.clamp(b.morale + (Math.random() < 0.5 ? -2 : 2), 10, 100);
    });
    S.cash += take;
    ev.push({ kind: take >= 0 ? 'good' : 'bad',
              text:'The floor cleared ' + HS.signed(take) + ' overnight.' });
  }

  // the fund compounds — and draws attention
  if(S.aum > 0){
    const edge = 0.006 + S.skill * 0.00022;
    const ret = edge + HS.gauss() * 0.028 * (1 + S.heat * 0.004);
    const pnl = S.aum * ret;
    S.aum = Math.max(0, S.aum + pnl);
    S.cash += pnl * 0.2;                       // your 20% of the upside
    if(ret > 0.03) S.heat = HS.clamp(S.heat + 1.5, 0, 100);
    ev.push({ kind: pnl >= 0 ? 'good' : 'bad',
              text:'Fund ' + (pnl >= 0 ? 'printed ' : 'bled ') + HS.money(Math.abs(pnl)) +
                   ' (' + HS.pct(ret) + ').' });
  }

  // heat decays slowly if you keep your head down
  S.heat = HS.clamp(S.heat - 0.8, 0, 100);

  const nw = HS.netWorth(S);
  if(nw > S.stats.netPeak) S.stats.netPeak = nw;
};

/* ---------- money / stats helpers ---------- */
HS.addCash  = (S, n) => { S.cash += n; };
HS.addRep   = (S, n) => { S.rep   = HS.clamp(S.rep   + n, 0, 100); };
HS.addSkill = (S, n) => { S.skill = HS.clamp(S.skill + n, 0, 100); };
HS.addHeat  = (S, n) => { S.heat  = HS.clamp(S.heat  + n, 0, 100); };
HS.addEnergy= (S, n) => { S.energy= HS.clamp(S.energy + n, 0, S.maxEnergy || 100); };

HS.DRINKS = [
  { name:'Small can',  energy:15 },
  { name:'Tall can',   energy:30 },
  { name:'The big one',energy:50 }
];

/* Superlinear in how much you want, and doubles again with every can today. */
HS.drinkPrice = function(S, amount){
  const base = amount * amount * 0.5 + amount * 5;
  return Math.round(base * Math.pow(2.1, S.drinksToday));
};

/* ---------- persistence ---------- */
HS.save = function(S){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; }
  catch(e){ return false; }
};
HS.load = function(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const S = JSON.parse(raw);
    if(!S || S.version !== 1) return null;
    return S;
  }catch(e){ return null; }
};
HS.hasSave = function(){
  try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; }
};
HS.clearSave = function(){
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
};

})(window.HS);
