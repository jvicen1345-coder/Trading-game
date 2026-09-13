/* MARKET MAKER - work that comes looking for you.
 *
 * The game had plenty of things to do and almost nothing to want. Every action
 * was spend energy, get a stat, and the only thing with a clock on it was the
 * daily target. So the days ran together: no reason to care about Tuesday in
 * particular, no reason to trade one way rather than another.
 *
 * A job fixes that by being three things at once. It asks for something
 * specific, it expires, and turning it down or missing it costs you. Nothing
 * here invents a new system: every goal is measured off the session result or
 * the state the game already keeps, so a job is a reason to use what is there
 * rather than another thing bolted on beside it.
 */
window.HS = window.HS || {};
(function(HS){
'use strict';

HS.JOB_SLOTS = 2;           /* how many you can carry at once */
HS.JOB_OFFER_CHANCE = 0.42; /* per morning, before reputation is counted */

/* Every goal is read off something the game already tracks. `session` kinds
   advance when a session closes; `standing` kinds are checked each morning. */
HS.JOB_KINDS = {
  green:  { when:'session', word:'green sessions',
            step:(S,j,r) => r.pnl > 0 ? 1 : 0 },
  target: { when:'session', word:'days on target',
            step:(S,j,r) => r.hitTarget ? 1 : 0 },
  single: { when:'session', word:'in one session', money:true,
            step:(S,j,r) => Math.max(j.prog, Math.max(0, r.pnl)) - j.prog },
  total:  { when:'session', word:'made', money:true,
            step:(S,j,r) => Math.max(0, r.pnl) },
  /* One red day and it is gone. The only kind you can fail without the clock. */
  clean:  { when:'session', word:'clean sessions',
            step:(S,j,r) => r.pnl > 0 ? 1 : 0,
            breaks:(S,j,r) => r.pnl < 0 || r.busted },
  /* Something held through a night and closed up. Rewards carrying paper. */
  carry:  { when:'session', word:'overnight closes',
            step:(S,j,r) => (r.carriedIn > 0 && r.pnl > 0) ? 1 : 0 },
  rep:    { when:'standing', word:'reputation',
            at:S => Math.round(S.rep) },
  follow: { when:'standing', word:'followers',
            at:S => Math.round((S.stream && S.stream.followers) || 0) }
};

/* The work itself. `from` is who is asking, `need` is the number, `days` is
   how long you have, and `pay` is what lands when it is done. Reputation is
   the cost of failing, always, because a job you took and dropped is worse
   than one you never took. */
HS.JOBS = [
  { id:'firstblood', kind:'green', need:2, days:3, minRank:1,
    from:'Marcus Vell', role:'a floor manager who owes somebody a favour',
    ask:'Two green sessions in three days. Nothing clever, just do not lose.',
    pay:{ cash:2200, rep:3 } },

  { id:'showme', kind:'target', need:2, days:4, minRank:1,
    from:'Marcus Vell', role:'a floor manager who owes somebody a favour',
    ask:'Hit your number twice this week. I want to put your name in front of ' +
        'somebody and I would rather not look stupid.',
    pay:{ cash:4000, rep:5 } },

  { id:'tidy', kind:'clean', need:3, days:5, minRank:2,
    from:'Harriet Doss', role:'compliance, and she is watching anyway',
    ask:'Three sessions, none of them red. One bad day and this conversation ' +
        'never happened.',
    pay:{ cash:6500, rep:7, skill:2 } },

  { id:'clientbook', kind:'single', need:12000, days:4, minRank:2,
    from:'a client who will not give a name', role:'money that wants a number',
    ask:'Twelve thousand in a single session. I do not care which way the ' +
        'tape goes, I care that you can do it on demand.',
    pay:{ cash:9000, rep:4 } },

  { id:'overnight', kind:'carry', need:2, days:6, minRank:3,
    from:'Winston Churnwell', role:'before you ever met him',
    ask:'Anybody can scalp. Carry something through a night, twice, and close ' +
        'it up. Then we can talk.',
    pay:{ cash:11000, rep:6, meet:'churnwell' } },

  { id:'grind', kind:'total', need:40000, days:6, minRank:3,
    from:'Ladder & Co.', role:'the firm that did not want you',
    ask:'Forty thousand inside a week. We are told you cannot. We would like ' +
        'to be able to say we asked.',
    pay:{ cash:15000, rep:9 } },

  { id:'nameknown', kind:'rep', need:45, days:8, minRank:2,
    from:'Nancy Pelosini', role:'before she works for you',
    ask:'Get your name to mean something. Forty five and people take the call.',
    pay:{ cash:5000, skill:3, meet:'pelosini' } },

  { id:'audience', kind:'follow', need:12000, days:8, minRank:2, path:'solo',
    from:'Justin Trudough', role:'somebody who wants to front your channel',
    ask:'Twelve thousand following you and the channel is worth somebody ' +
        'running. I am somebody.',
    pay:{ cash:6000, rep:5, meet:'trudough' } },

  { id:'steadyhand', kind:'clean', need:5, days:8, minRank:4,
    from:'Gordon Brownout', role:'risk, at a bank that no longer exists',
    ask:'Five sessions without a red one. Not luck. Method.',
    pay:{ cash:26000, rep:10, perk:1, meet:'brownout' } },

  { id:'bigday', kind:'single', need:60000, days:5, minRank:4,
    from:'a desk that clears for three funds', role:'they saw the tape',
    ask:'Sixty thousand in one session. Once. We want to see the shape of it.',
    pay:{ cash:42000, rep:12 } },

  { id:'quarter', kind:'total', need:250000, days:10, minRank:5,
    from:'Margaret Hatcher', role:'profitable at both firms that asked her to leave',
    ask:'A quarter of a million in ten days. I am not interested in people who ' +
        'need longer than that.',
    pay:{ cash:90000, rep:14, perk:1, meet:'hatcher' } },

  { id:'thelot', kind:'target', need:6, days:10, minRank:5,
    from:'Chester Arbitrage', role:'nobody knows where he was before this',
    ask:'Six days on your number inside ten. Do that and I will come and find ' +
        'you.',
    pay:{ cash:120000, rep:16, meet:'arbitrage' } }
];

HS.jobsOf = S => (S.jobs && S.jobs.active) || [];
HS.jobDone = (S, id) => !!(S.jobs && S.jobs.done && S.jobs.done.indexOf(id) >= 0);

/* Old saves have none of this, so everything goes through here first. */
HS.jobState = function(S){
  if(!S.jobs) S.jobs = { active:[], offer:null, done:[], failed:0, cooldown:0 };
  if(!S.jobs.done) S.jobs.done = [];
  if(!S.jobs.active) S.jobs.active = [];
  return S.jobs;
};

HS.jobTemplate = id => HS.JOBS.find(j => j.id === id);

/* What is left to do, in the job's own units. */
HS.jobProgress = function(S, j){
  const k = HS.JOB_KINDS[j.kind];
  const at = k.when === 'standing' ? k.at(S) : j.prog;
  return { at:at, need:j.need, done: at >= j.need,
           text: k.money ? HS.money(Math.round(at)) + ' of ' + HS.money(j.need)
                         : Math.min(at, j.need) + ' of ' + j.need + ' ' + k.word };
};

/* Somebody thinks of you. Reputation decides how often, because work goes to
   people other people have heard of. */
HS.jobOffer = function(S){
  const js = HS.jobState(S);
  if(js.offer || js.active.length >= HS.JOB_SLOTS || js.cooldown > 0) return null;
  const chance = HS.JOB_OFFER_CHANCE * (0.55 + Math.min(1, S.rep / 70));
  if(Math.random() > chance) return null;
  const pool = HS.JOBS.filter(t =>
    (t.minRank == null || S.rank >= t.minRank) &&
    (!t.path || t.path === S.path) &&
    !HS.jobDone(S, t.id) &&
    !js.active.some(a => a.id === t.id));
  if(!pool.length) return null;
  const t = pool[Math.floor(Math.random() * pool.length)];
  js.offer = { id:t.id, day:S.day };
  return t;
};

HS.jobAccept = function(S, id){
  const js = HS.jobState(S);
  const t = HS.jobTemplate(id);
  if(!t || js.active.length >= HS.JOB_SLOTS) return null;
  js.offer = null;
  const j = { id:t.id, kind:t.kind, need:t.need, prog:0, due:S.day + t.days };
  /* A standing job starts from wherever you already are, so nobody is asked
     to climb ground they have covered. */
  if(HS.JOB_KINDS[t.kind].when === 'standing') j.from = HS.JOB_KINDS[t.kind].at(S);
  js.active.push(j);
  return j;
};

HS.jobDecline = function(S){
  const js = HS.jobState(S);
  js.offer = null;
  js.cooldown = 2;            /* they go and ask somebody else for a day or two */
};

function payOut(S, t, ev){
  const p = t.pay || {};
  if(p.cash){ S.cash += p.cash; }
  if(p.rep){ S.rep = HS.clamp(S.rep + p.rep, 0, 100); }
  if(p.skill){ HS.addSkill(S, p.skill); }
  if(p.perk){ S.perkPoints = (S.perkPoints || 0) + p.perk; }
  /* Some of them introduce you to somebody, which is worth more than the cash
     because it puts a person on the board you could not otherwise reach yet. */
  if(p.meet && S.met && S.met.indexOf(p.meet) < 0) S.met = S.met.concat([p.meet]);
  const bits = [];
  if(p.cash) bits.push(HS.money(p.cash));
  if(p.rep) bits.push('+' + p.rep + ' reputation');
  if(p.skill) bits.push('+' + p.skill + ' skill');
  if(p.perk) bits.push(p.perk + ' perk point');
  ev.push({ kind:'good', text: t.from + ' paid up. ' + bits.join(', ') + '.' });
  if(p.meet){
    const c = HS.castOf && HS.castOf(p.meet);
    if(c) ev.push({ kind:'good', text: c.name + ' will take your call now.' });
  }
}

function finish(S, js, j, ev){
  const t = HS.jobTemplate(j.id);
  js.active = js.active.filter(a => a !== j);
  js.done = js.done.concat([j.id]);
  if(t) payOut(S, t, ev);
}

function drop(S, js, j, ev, why){
  const t = HS.jobTemplate(j.id);
  js.active = js.active.filter(a => a !== j);
  js.failed = (js.failed || 0) + 1;
  S.rep = HS.clamp(S.rep - 5, 0, 100);
  ev.push({ kind:'bad', text:(t ? t.from : 'Somebody') + ' will not be asking again. ' + why });
}

/* A session closed. Advance anything measured in sessions. */
HS.jobsAfterSession = function(S, res, ev){
  const js = HS.jobState(S);
  js.active.slice().forEach(j => {
    const k = HS.JOB_KINDS[j.kind];
    if(k.when !== 'session') return;
    if(k.breaks && k.breaks(S, j, res)){
      drop(S, js, j, ev, 'One red day was all it took.');
      return;
    }
    j.prog += k.step(S, j, res) || 0;
    if(j.prog >= j.need) finish(S, js, j, ev);
  });
};

/* A morning. Standing goals get checked, deadlines get older, and somebody
   might think of you. */
HS.jobsDaily = function(S, ev){
  const js = HS.jobState(S);
  if(js.cooldown > 0) js.cooldown--;
  js.active.slice().forEach(j => {
    const k = HS.JOB_KINDS[j.kind];
    if(k.when === 'standing' && k.at(S) >= j.need){ finish(S, js, j, ev); return; }
    if(S.day > j.due) drop(S, js, j, ev, 'The date went past.');
  });
  /* An offer nobody answered is an offer withdrawn. */
  if(js.offer && S.day - js.offer.day >= 3){
    js.offer = null;
    js.cooldown = 1;
  }
};

/* The line the HUD shows: whichever job is closest to its date. */
HS.jobUrgent = function(S){
  const a = HS.jobsOf(S);
  if(!a.length) return null;
  return a.slice().sort((x, y) => (x.due - y.due))[0];
};

})(window.HS);
