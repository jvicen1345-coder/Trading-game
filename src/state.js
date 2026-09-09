/* MARKET MAKER - game state: stats, clock, economy, career, save/load. */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* v3: the week is six days now, so every stored day number and every
   contract expiry derived from it means something different. There is no
   honest migration from a seven day week, so v2 saves are left behind. */
const SAVE_KEY = 'marketmaker_save_v3';

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

/* Where you sleep decides how well you sleep, and at the bottom of the
   ladder it decides whether you get to trade at all. `bad` is the chance a
   night goes wrong whatever time you turned in; `cut` is the chance the
   power is off in the morning and the session is gone. Cheap rooms are
   cheap for a reason, and that is the whole incentive to climb. */
HS.HOUSING = [
  { id:0, name:"Parents' Basement", landmark:'home_basement', rent:0,     deposit:0,
    quality:0.86, bad:0,    cut:0,    buy:false,
    desc:'Damp, low ceiling, a poster of a yacht you do not own.' },
  { id:1, name:'Rooming House',     landmark:'home_studio',    rent:150,   deposit:400,
    quality:0.78, bad:0.25, cut:0.08, buy:false,
    desc:'A bed, a chair, a shared bathroom down the hall, and walls like paper.' },
  { id:2, name:'Share House',       landmark:'home_studio',    rent:320,   deposit:900,
    quality:0.86, bad:0.15, cut:0.04, buy:false,
    desc:'Three strangers, one kitchen, and somebody who does not believe in headphones.' },
  { id:3, name:'Rented Studio',     landmark:'home_studio',    rent:900,   deposit:1800,
    quality:0.94, bad:0.06, cut:0.01, buy:false,
    desc:'Four hundred square feet and your name on the lease.' },
  { id:4, name:'Riverside Loft',    landmark:'home_loft',      rent:5200,  deposit:180000,
    quality:1.00, bad:0,    cut:0,    buy:true,
    desc:'Exposed brick, river light, a doorman who knows you.' },
  { id:5, name:'Sky Penthouse',     landmark:'home_penthouse', rent:24000, deposit:2400000,
    quality:1.06, bad:0,    cut:0,    buy:true,
    desc:'The whole skyline, below you, where it belongs.' }
];
HS.FIRST_RENTAL = 1;                     /* what the basement throws you into */

HS.BAD_NIGHTS = [
  'The couple through the wall argued until four. You heard all of it.',
  'A radiator you cannot turn off, banging every twenty minutes.',
  'Somebody came in at two and played music like the building was theirs.',
  'Sirens on this street, all night, every night.',
  'Your neighbour watches television at a volume that suggests a grievance.'
];
HS.BLACKOUTS = [
  'The whole floor is dark. The landlord is not answering and the super shrugs.',
  'A breaker somewhere gave up in the night, and nobody here owns the panel.',
  'The bill went unpaid by someone, and the company does not much care which of you it was.',
  'Half the block is out. A man in a van says maybe this afternoon, maybe tomorrow.'
];

/* ------------------------------------------------------------------
   THE CHANNEL
   A day trader has no salary, so the audience is the salary. Followers are
   reach and subscribers are money, and the only way to grow either is to
   put your screen in front of strangers while you trade.

   The catch is deliberate: an audience rewards size and drama, not
   discipline, so the channel quietly pays you to take the trade you should
   not. Every green day compounds and every red day in public costs more
   than the green one paid.
   ------------------------------------------------------------------ */
HS.STREAM = {
  unlockRank: 2,              // solo only, once you are Consistent
  liveEnergy: 8,              // on top of the session itself
  postEnergy: 6,              // the evening recap
  subFee: 9,                  // per subscriber, per week
  churn: 0.06,                // baseline weekly bleed
  churnBad: 0.22,             // after a losing week
  viralAt: 0.18,              // a session return that gets you shared around
  viralMul: 3.4
};

/* Followers earned by streaming one session, given its return on the day.
   A bad day empties the room, but it can only empty it of people who were
   already in it, so a run of losses cannot bury a channel before it starts.
   Showing up at all is worth a few viewers either way. At any real size a
   red day still costs more than a green day pays, which is the point. */
HS.streamFollowers = function(S, ret){
  const here = S.stream.followers;
  const showUp = 12;
  if(ret >= 0){
    const gain = showUp + (40 + here * 0.16) * (0.35 + Math.min(3, ret / 0.05) * 0.55);
    return Math.round(ret >= HS.STREAM.viralAt ? gain * HS.STREAM.viralMul : gain);
  }
  const leave = here * Math.min(0.55, (-ret / 0.04) * 0.16);
  return Math.round(showUp - leave);
};

/* The recap turns reach into rent money. A good week converts far better
   than a bad one, and reputation is what makes people trust the pitch. */
HS.streamConvert = function(S, weekRet){
  const base = 0.020 + HS.clamp(weekRet, -0.1, 0.4) * 0.10 + S.rep * 0.00045;
  const pool = Math.max(0, S.stream.followers - S.stream.subs * 8);
  return Math.max(0, Math.round(pool * HS.clamp(base, 0.004, 0.075)));
};

HS.hasChannel = S => !!(S.stream && S.stream.on);
HS.canStream  = S => S.path === 'solo' && S.rank >= HS.STREAM.unlockRank;

/* ------------------------------------------------------------------
   THE FIRM
   The solo route is not really about trading alone. It is about proving
   the floor was wrong to be a floor, which means building one of your own
   out of people nobody else would hire.
   ------------------------------------------------------------------ */
HS.OFFICES = [
  { id:0, name:'No office',    seats:2,  price:0,        upkeep:0,
    desc:'A bedroom, a laptop, and whoever will answer a message.' },
  { id:1, name:'The Back Room', seats:5,  price:180000,   upkeep:2400,
    desc:'Above a laundrette, four desks, one window that does not open and a kettle.' },
  { id:2, name:'The High-Rise', seats:12, price:2600000,  upkeep:26000,
    desc:'Forty-first floor, your name in the lobby directory, and a view of the firm that did not want you.' }
];

/* Three things an employee can be good at, and they are rarely the same
   person. Tape earns on the book, Screen carries an audience, Nerve is
   what stops them folding on a red day. */
HS.ROLES = {
  trader:   { id:'trader',   name:'Trader',   blurb:'Runs part of your book' },
  streamer: { id:'streamer', name:'Streamer', blurb:'Fronts the channel while you trade' },
  bench:    { id:'bench',    name:'Bench',    blurb:'On the payroll, doing nothing' }
};

const RECRUIT_FIRST = ['Al','Justin','Margaret','Winston','Angela','Nancy','Teddy','Jimmy',
                       'Herbert','Barack','Gordon','Calvin','Grover','Chester','Millard'];
const RECRUIT_LAST  = ['Gorithm','Trudough','Hatcher','Churnwell','Merkup','Pelosini','Rosevelt',
                       'Charter','Hoovered','Obalance','Brownout','Cooldge','Clearing',
                       'Arbitrage','Fillmargin'];

/* Where you found them shapes what they are good at. The channel sends you
   people who can talk; the floor sends you people who can trade. */
HS.RECRUIT_SOURCES = {
  channel:  { name:'from the channel', tape:-8, screen:18, nerve:-4 },
  bar:      { name:'from the bar',     tape:2,  screen:6,  nerve:-2 },
  exchange: { name:'off the floor',    tape:16, screen:-10, nerve:8 }
};

/* How well you can read a stranger. Skill is the tape and reputation is the
   room, and both of them are how you tell talent from a good afternoon. Nerve
   is always the hardest, because nerve only shows on a bad day. */
HS.readSpread = function(S, stat){
  const base = HS.clamp(27 - S.skill * 0.19 - S.rep * 0.11, 3, 27);
  return Math.round(base * (stat === 'nerve' ? 1.9 : 1));
};

/* The band you are shown, which is the truth blurred by how good you are at
   this. It is drawn once and kept, so staring at somebody does not resample
   them. */
function estimate(S, e, stat){
  const spread = HS.readSpread(S, stat);
  const off = Math.round((Math.random() - 0.5) * spread);
  const mid = HS.clamp(e[stat] + off, 3, 99);
  return { lo: Math.round(HS.clamp(mid - spread/2, 1, 99)),
           hi: Math.round(HS.clamp(mid + spread/2, 2, 100)), mid: Math.round(mid) };
}

/* What somebody is actually worth a week, given what they can actually do. */
HS.recruitWorth = e => Math.round((e.tape * 26 + e.screen * 20 + e.nerve * 14) * 0.9);

/* Candidate quality tracks your standing. A nobody attracts nobody. */
HS.rollRecruit = function(S, source){
  const src = HS.RECRUIT_SOURCES[source];
  const pull = Math.min(34, S.rep * 0.32 + Math.log10(1 + (S.stream ? S.stream.followers : 0)) * 6);
  const roll = () => HS.clamp(18 + pull + (Math.random() * 34 - 12), 5, 96);
  const e = {
    id: 'e' + Math.random().toString(36).slice(2, 8),
    name: RECRUIT_FIRST[Math.floor(Math.random()*RECRUIT_FIRST.length)] + ' ' +
          RECRUIT_LAST[Math.floor(Math.random()*RECRUIT_LAST.length)],
    from: source,
    tape:   Math.round(HS.clamp(roll() + src.tape, 5, 96)),
    screen: Math.round(HS.clamp(roll() + src.screen, 5, 96)),
    nerve:  Math.round(HS.clamp(roll() + src.nerve, 5, 96)),
    morale: 74, role:'trader', known:false
  };
  e.worth = HS.recruitWorth(e);
  e.wage = e.worth;
  /* They open above what they are worth, and they have a number below which
     they walk. A name on the street brings that number down. */
  e.ask   = Math.round(e.worth * (1.16 + Math.random() * 0.26));
  e.floor = Math.round(e.worth * (0.86 + Math.random() * 0.14) *
                       (1 - Math.min(0.18, S.rep / 400)));
  e.est = { tape: estimate(S, e, 'tape'), screen: estimate(S, e, 'screen'),
            nerve: estimate(S, e, 'nerve') };
  return e;
};

/* What you see on a card: the band while they are a stranger, the number once
   a bad week has told you the truth. */
HS.statText = function(e, stat){
  if(e.known || !e.est) return String(e[stat]);
  const b = e.est[stat];
  return b.lo + ' to ' + b.hi;
};

HS.teamSeats  = S => HS.OFFICES[S.office || 0].seats;
HS.teamOf     = S => S.team || [];
HS.streamerOf = S => HS.teamOf(S).find(e => e.role === 'streamer') || null;
HS.tradersOf  = S => HS.teamOf(S).filter(e => e.role === 'trader');
HS.teamWages  = S => HS.teamOf(S).reduce((n, e) => n + e.wage, 0);

/* ------------------------------------------------------------------
   THE RIVAL
   Ladder and Co. keeps posting numbers whether you look or not. Four
   quarters of beating them is the whole point of the solo route, and one
   bad quarter puts you back at nothing.
   ------------------------------------------------------------------ */
HS.QUARTER_DAYS = 12;                    // two game weeks
HS.QUARTERS_TO_WIN = 4;

/* What the floor is expected to return this quarter. It gets harder as you
   get bigger, because they are not standing still either. */
HS.rivalTarget = function(S){
  const base = 0.16 + (S.rank - 1) * 0.045;
  return +(base + (S.rival ? S.rival.seed * 0.06 : 0)).toFixed(4);
};

/* ------------------------------------------------------------------
   THE BLUE HOUSE
   Yoon Suk-Yield trades a system nobody on this side of the world uses.
   It reads the tape far better than you can and it will not let you size
   into anything. Precision instead of noise, which makes it exactly the
   wrong tool for a man with an audience.
   ------------------------------------------------------------------ */
HS.BLUE = {
  followers: 5000,        // he finds you, not the other way around
  subs: 150,
  usable: 30,             // below this the method is worse than trading blind
  sizeCap: 0.28,          // it will never let you swing
  accuracy: 14,           // added to a chart read, on top of your own skill
  ceiling: 92             // and it is never a certainty, however good you get
};
HS.metYoon    = S => !!(S.blue && S.blue.met);
HS.blueReady  = S => HS.metYoon(S) && S.blue.skill >= HS.BLUE.usable;
HS.usingBlue  = S => HS.blueReady(S) && S.blue.on;
HS.yoonDue    = function(S){
  return S.path === 'solo' && !HS.metYoon(S) && S.stream && S.stream.on &&
         S.stream.followers >= HS.BLUE.followers && S.stream.subs >= HS.BLUE.subs;
};

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
      { i:1, name:'Retail Account',  salary:0, outfit:0, need:{} },
      { i:2, name:'Consistent',      salary:0, outfit:1, need:{ skill:18, rep:10, cash:12000 } },
      { i:3, name:'Funded Trader',   salary:0, outfit:2, need:{ skill:32, rep:22, cash:55000 } },
      { i:4, name:'The Back Room',   salary:0, outfit:3, need:{ skill:48, rep:40, office:1, team:3 } },
      { i:5, name:'The High-Rise',   salary:0, outfit:4, need:{ skill:62, rep:55, office:2, team:7 } },
      { i:6, name:'THE WOLF',        salary:0, outfit:4, need:{ skill:74, rep:66, quarters:4 } }
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
    version:3,
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
    weekEdge:null,
    blackout:false,
    stream:{ on:false, live:false, followers:0, subs:0, streamed:0, viral:0, lastPaid:0, delegated:false },
    team:[], office:0, checkedIn:0,
    rival:null,
    blue:{ met:false, skill:0, on:false },
    rentDueDay:7,          // Monday of week two, when you get a place of your own
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
  /* A place you bought is an asset. A place you rent is not, whatever the
     deposit was. */
  const home = HS.HOUSING[S.housing];
  if(home.buy) n += home.deposit * 0.85;
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
  if(need.office != null && (S.office || 0) < need.office) return false;
  if(need.team != null && HS.teamOf(S).length < need.team) return false;
  if(need.quarters != null && (!S.rival || S.rival.streak < need.quarters)) return false;
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
  add('Office', (S.office || 0), need.office);
  add('Team', HS.teamOf(S).length, need.team);
  add('Quarters won', (S.rival ? S.rival.streak : 0), need.quarters);
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
    S.rentDueDay = S.day + HS.WEEK_DAYS;
    const rent = HS.HOUSING[S.housing].rent;
    if(rent > 0){
      S.cash -= rent;
      ev.push({ kind:'bill', text:'Rent due. ' + HS.money(rent) + ' out.' });
    }

    /* Payroll, and what the desks earned for you. A trader's take scales off
       their tape read; morale decides whether they bothered. */
    if(HS.teamOf(S).length){
      const wages = HS.teamWages(S) + HS.OFFICES[S.office || 0].upkeep;
      S.cash -= wages;
      ev.push({ kind:'bill', text:'Payroll and upkeep. ' + HS.money(wages) + ' out.' });
      let desk = 0;
      HS.tradersOf(S).forEach(e => {
        const heart = 0.45 + (e.morale / 100) * 0.75;
        const edge = (e.tape / 100) * heart;
        desk += S.cash * 0.012 * edge * (0.4 + Math.random() * 1.5) -
                S.cash * 0.006 * (1 - e.nerve / 100);
      });
      /* A week that went against them is the only real interview. Whatever you
         thought you were buying, now you know. */
      if(desk < 0){
        const surprised = HS.teamOf(S).filter(e => !e.known);
        surprised.forEach(e => { e.known = true; });
        if(surprised.length) ev.push({ kind:'', text:'A bad week on the desks. You find out ' +
          'what ' + (surprised.length === 1 ? surprised[0].name + ' is' : 'your people are') +
          ' actually made of.' });
      }
      if(HS.tradersOf(S).length){
        desk = Math.round(desk);
        S.cash += desk;
        ev.push({ kind: desk >= 0 ? 'good' : 'bad',
                  text:'The desks cleared ' + HS.signed(desk) + ' this week.' });
      }
      /* Nobody works hard for somebody who never comes in. */
      const seen = S.day - (S.checkedIn || 0) <= HS.WEEK_DAYS + 1;
      HS.teamOf(S).forEach(e => {
        e.morale = HS.clamp(e.morale + (seen ? 3 : -11), 0, 100);
      });
      const gone = HS.teamOf(S).filter(e => e.morale <= 6);
      if(gone.length){
        S.team = HS.teamOf(S).filter(e => e.morale > 6);
        ev.push({ kind:'bad', text: gone.map(e => e.name).join(' and ') +
                  ' walked. Nobody had spoken to them in weeks.' });
      }
    }

    /* Subscriptions land the same morning the rent does, which is the whole
       point of them. They also bleed, and they bleed hardest after a week
       your audience watched you lose. */
    const st = S.stream;
    if(st && st.on && st.subs > 0){
      const take = st.subs * HS.STREAM.subFee;
      S.cash += take;
      st.lastPaid = take;
      ev.push({ kind:'good', text:st.subs + ' subscribers paid. ' + HS.money(take) + ' in.' });
      /* Handed over, the channel runs on your streamer's face rather than
         your results, which is steadier and never spectacular. */
      const sm = HS.streamerOf(S);
      if(sm && st.delegated){
        const carry = (sm.screen / 100) * (0.5 + sm.morale / 160);
        const grew = Math.round(st.followers * 0.09 * carry + 60 * carry);
        st.followers += grew;
        st.subs += HS.streamConvert(S, S.weekPnl / Math.max(1, S.weekStartCash));
        ev.push({ kind:'good', text: sm.name + ' put the week out. ' +
                  grew.toLocaleString() + ' new followers.' });
      }
      const bad = S.weekPnl < 0;
      const lost = Math.round(st.subs * (bad ? HS.STREAM.churnBad : HS.STREAM.churn));
      if(lost > 0){
        st.subs = Math.max(0, st.subs - lost);
        ev.push({ kind:'bad', text: (bad ? 'A red week on camera. ' : '') +
                  lost + ' subscriber' + (lost === 1 ? '' : 's') + ' cancelled.' });
      }
    }
    if(S.loan > 0){
      const rate = S.loanRate * (HS.hasPerk(S,'s3') ? 0.5 : 1);
      const interest = Math.round(S.loan * rate);
      S.loan += interest;
      ev.push({ kind:'bill', text:'Loan interest. ' + HS.money(interest) + ' added.' });
    }
  }

  /* ---- the quarter against Ladder and Co. ---- */
  if(S.path === 'solo' && S.rank >= 3){
    if(!S.rival){
      S.rival = { start:S.day, startWorth:HS.netWorth(S), streak:0, seed:Math.random(),
                  last:null, quarters:0 };
    } else if(S.day - S.rival.start >= HS.QUARTER_DAYS){
      const r = S.rival;
      const now = HS.netWorth(S);
      const mine = (now - r.startWorth) / Math.max(1, r.startWorth);
      const theirs = HS.rivalTarget(S);
      const won = mine > theirs;
      r.streak = won ? r.streak + 1 : 0;
      r.quarters++;
      r.last = { mine, theirs, won, streak:r.streak };
      ev.push({ kind: won ? 'good' : 'bad',
        text: won ? 'Quarter closed. You beat the floor by ' + HS.pct(mine - theirs) +
                    '. ' + r.streak + ' of ' + HS.QUARTERS_TO_WIN + '.'
                  : 'Quarter closed. Ladder returned ' + HS.pct(theirs) + ' against your ' +
                    HS.pct(mine) + '. The streak is gone.' });
      r.start = S.day; r.startWorth = now; r.seed = Math.random();
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
    if(!S || S.version !== 3) return null;
    return S;
  }catch(e){ return null; }
};
HS.hasSave = function(){ try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; } };
HS.clearSave = function(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} };

})(window.HS);
