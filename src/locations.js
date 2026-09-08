/* MARKET MAKER — what happens inside each building. */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* Desk terms by rank. `vol` is per tick; over a session it implies roughly a
   40%-80% annualised vol, which is what the options chain is priced off. */
const DESK = [
  { capital:0,        commission:0,    target:0.08, vol:0.00090, trend:0.95, chop:0.30 },
  { capital:8000,     commission:0.10, target:0.08, vol:0.00090, trend:0.95, chop:0.30 },
  { capital:30000,    commission:0.14, target:0.10, vol:0.00105, trend:0.90, chop:0.34 },
  { capital:100000,   commission:0.18, target:0.12, vol:0.00120, trend:0.84, chop:0.38 },
  { capital:280000,   commission:0.22, target:0.14, vol:0.00135, trend:0.76, chop:0.43 },
  { capital:750000,   commission:0.26, target:0.16, vol:0.00150, trend:0.68, chop:0.47 },
  { capital:1900000,  commission:0.30, target:0.18, vol:0.00162, trend:0.60, chop:0.50 },
  { capital:5200000,  commission:0.35, target:0.20, vol:0.00172, trend:0.54, chop:0.53 },
  { capital:13000000, commission:0.40, target:0.22, vol:0.00182, trend:0.48, chop:0.56 }
];
HS.DESK = DESK;

const SYMS = ['VLT','NRG','QNT','BTX','ARC','HLX'];

/* Energy prices. Deliberately small — a day should hold several of these. */
const E = {
  work:14, prop:16, fund:16, review:8, gym:12,
  classA:8, classB:12, classC:18,
  network:8, round:6, favour:4, tip:6, raise:12
};
HS.ENERGY = E;

HS.Locations = function(game){
  const L = {};
  const S = () => game.S;
  const ui = () => game.ui;

  function stat(k, v, tone){
    return '<div class="stat"><span class="k">' + k + '</span><span class="v ' + (tone||'') + '">' + v + '</span></div>';
  }
  function para(t){ return '<p class="pbody">' + t + '</p>'; }
  const deskFor = r => DESK[HS.clamp(r, 0, DESK.length - 1)];

  /* How much of the trading day is left if you start now. */
  function sessionShape(s){
    const start = Math.max(s.hour, HS.MARKET_OPEN);
    const frac = HS.clamp((HS.MARKET_CLOSE - start) / (HS.MARKET_CLOSE - HS.MARKET_OPEN), 0, 1);
    return { start, frac, duration: Math.round(78 * HS.clamp(frac, 0.3, 1)) };
  }
  function marketOpenNow(s){
    return !HS.isWeekend(s.day) && s.hour < HS.MARKET_CLOSE - 0.4;
  }
  function marketWhy(s){
    if(HS.isWeekend(s.day)) return 'The market is shut — it is the weekend';
    if(s.hour >= HS.MARKET_CLOSE - 0.4) return 'The bell has rung. Come back tomorrow';
    return null;
  }

  /* Run a session and hand the result back to the game. */
  function runSession(o){
    const s = S();
    const d = deskFor(s.rank);
    const shape = sessionShape(s);
    const sym = SYMS[Math.floor(Math.random() * Math.min(SYMS.length, 2 + s.rank))];
    ui().closePanel();
    game.setPaused(true);

    HS.Market.run({
      symbol: sym,
      capital: o.capital,
      duration: shape.duration,
      target: o.target != null ? o.target : d.target,
      vol: d.vol, trendStr: d.trend, chop: d.chop,
      skill: s.skill, rank: s.rank,
      edge: s.edge && s.edge.day === s.day ? s.edge : null,
      feePerContract: o.fee != null ? o.fee : 0.65,
      news: s.rank >= 2 ? [18, 34] : null,
      shock: 0.018 + s.rank * 0.003,
      title: o.title, sub: o.sub
    }, res => {
      game.setPaused(false);
      s.edge = null;                       // the read is spent
      o.onDone(res, d, shape);
    });
  }

  /* ------------------------------- HOME ------------------------------- */
  function homePanel(){
    const s = S();
    const h = HS.HOUSING[s.housing];
    const wake = Math.round(h.sleepPct * s.maxEnergy);
    const body =
      para(h.desc) +
      '<div class="stats-grid">' +
        stat('Net worth', HS.money(HS.netWorth(s))) +
        stat('Weekly rent', h.rent ? HS.money(h.rent) : 'free') +
        stat('Wake with', wake + ' energy') +
        stat('Rent due', 'Day ' + s.rentDueDay) +
      '</div>';
    const actions = [
      { label:'Sleep until morning', detail:'Wake at 7:00 with ' + wake + ' energy',
        cost:'ends the day',
        onClick: () => { ui().closePanel(); game.sleep(); } },
      { label:'Save game', detail:'Write your progress to this browser',
        onClick: () => { HS.save(s); ui().toast('Progress saved.', 'good'); HS.Audio.cash(); } }
    ];
    if(s.rank === 0){
      actions.push({ label:'Stare at the ceiling', detail:'Nothing changes down here',
        onClick: () => ui().toast('You are 24. The pipes drip. Go get a job.', '') });
    }
    return { title:h.name, sub:'HOME', accent:'#E8B85C', body, actions };
  }
  L.home_basement = L.home_studio = L.home_loft = L.home_penthouse = homePanel;

  /* ---------------------------- BROKERAGE ----------------------------- */
  L.brokerage = function(){
    const s = S();
    const d = deskFor(s.rank);
    const nr = HS.nextRank(s);

    if(s.rank === 0){
      return {
        title:'Ladder & Co. Brokerage', sub:'GROUND FLOOR', accent:'#3ECFCF',
        body: para('A wall of phones, a wall of noise. A man in a bad tie looks you up and down and asks if you can take rejection for nine hours a day.') + para('<b>You can.</b>'),
        actions:[{ label:'Ask for a job', detail:'Start at the bottom: cold calling',
          onClick: () => { ui().closePanel();
            game.promoteTo(1, 'They hand you a headset and a list of names. You are a Cold Caller.'); }}]
      };
    }

    const shape = sessionShape(s);
    const why = marketWhy(s);
    const body =
      para('The floor hums. Your desk is ' + (s.rank >= 4 ? 'by the window' : 'near the printer') + '.') +
      '<div class="stats-grid">' +
        stat('Your desk', HS.money(d.capital)) +
        stat('Your cut', Math.round(d.commission*100) + '% of profit') +
        stat('Day rate', HS.money(HS.rankOf(s).salary)) +
        stat('Session target', HS.pct(d.target)) +
        stat('Market', why ? 'closed' : HS.clockStr(Math.max(s.hour, HS.MARKET_OPEN)) + ' – 4:00 PM',
             why ? 'bad' : 'good') +
        stat('Day left', Math.round(shape.frac*100) + '%', shape.frac < 0.5 ? 'bad' : '') +
      '</div>' +
      para('<span class="dim">The firm\'s capital, the firm\'s risk. Lose money here and it costs you standing, not savings.</span>');

    const actions = [];
    actions.push({
      label: shape.frac > 0.85 ? 'Trade the open' : 'Trade what is left of the day',
      detail:'Options on the firm\'s book, for your commission',
      cost:'to the bell · ' + E.work + ' energy',
      disabled: !!why || s.workedToday || s.energy < E.work,
      why: why || (s.workedToday ? 'You have already traded today' : 'Not enough energy'),
      onClick: () => runSession({
        capital: d.capital,
        title: 'LADDER & CO. — ' + HS.rankOf(S()).name.toUpperCase(),
        sub: 'Firm capital · you keep ' + Math.round(d.commission*100) + '% of the upside',
        onDone: (res, dd) => game.finishWorkSession(res, dd)
      })
    });

    if(s.rank >= 2){
      actions.push({
        label:'Chart review', detail:'Sit with the daily charts and look for a crossover',
        cost:'1h · ' + E.review + ' energy',
        disabled: s.reviewedToday || s.energy < E.review,
        why: s.reviewedToday ? 'You have already done today\'s review' : 'Not enough energy',
        onClick: () => { ui().closePanel(); game.chartReview(); }
      });
    }

    if(nr){
      const needs = HS.needText(s, nr.need);
      actions.push({
        label:'Ask for a promotion', detail:'Next: ' + nr.name,
        disabled: !HS.meetsNeed(s, nr.need),
        why: needs.filter(n => !n.ok).map(n => n.label + ' ' + n.text).join(' · '),
        onClick: () => { ui().closePanel(); game.promoteTo(nr.i); }
      });
    } else if(s.rank === 5){
      actions.push({
        label:'Talk about your future', detail:'They cannot promote you any further here',
        onClick: () => ui().modal({
          title:'A CONVERSATION',
          body:'<p>The managing partner leans back. "You have gone as far as this building goes. What happens next is your call — and you make it down at the Exchange, not up here."</p>',
          actions:[{ label:'Understood', onClick:()=>ui().closeModal() }]
        })
      });
    }
    return { title:'Ladder & Co. Brokerage', sub:'YOUR EMPLOYER', accent:'#3ECFCF', body, actions };
  };

  /* ----------------------------- EXCHANGE ----------------------------- */
  L.exchange = function(){
    const s = S();
    if(s.rank < 3){
      return {
        title:'The Exchange', sub:'MEMBERS ONLY', accent:'#8B6BFF',
        body: para('Two guards, a brass door, and a members\' board you are not on. The floor beyond is where the real size trades.') +
              para('<span class="dim">Reach <b>Broker</b> at Ladder &amp; Co. to be admitted.</span>'),
        actions:[]
      };
    }
    const why = marketWhy(s);
    const stake = Math.max(2000, Math.floor(s.cash * 0.5));
    const body =
      para('Open outcry, ten thousand voices. Down here you put up your own money and keep every cent you make on it.') +
      '<div class="stats-grid">' +
        stat('Your stake', HS.money(stake)) +
        stat('You keep', '100%') +
        stat('Your money', 'at risk', 'bad') +
        stat('Market', why ? 'closed' : 'open', why ? 'bad' : 'good') +
      '</div>';

    const actions = [{
      label:'Trade your own book', detail:'Half your cash on the options chain',
      cost:'to the bell · ' + E.prop + ' energy',
      disabled: !!why || s.cash < 4000 || s.energy < E.prop,
      why: why || (s.cash < 4000 ? 'You need at least $4,000 to take a seat' : 'Not enough energy'),
      onClick: () => runSession({
        capital: stake, fee: 0.85,
        title:'THE EXCHANGE — YOUR BOOK',
        sub:'Your capital, your risk, your profit',
        onDone: res => game.finishPropSession(res, stake)
      })
    }];

    if(s.rank === 5 && !s.path){
      const req = { skill:70, rep:65, cash:400000 };
      actions.push({
        label:'Make your move', detail:'Choose what you become', tone:'gold',
        disabled: !HS.meetsNeed(s, req),
        why: HS.needText(s, req).filter(n=>!n.ok).map(n=>n.label+' '+n.text).join(' · '),
        onClick: () => { ui().closePanel(); game.offerBranch(); }
      });
    }
    return { title:'The Exchange', sub:'THE FLOOR', accent:'#8B6BFF', body, actions };
  };

  /* ------------------------------- GYM -------------------------------- */
  L.gym = function(){
    const s = S();
    const isOpen = s.hour >= 6 && s.hour < 22;
    const atCap = s.maxEnergy >= HS.MAX_ENERGY_CAP;
    const cost = Math.round(40 + (s.maxEnergy - 100) * 14);
    const body =
      para('Rubber, chalk and a man at the desk who has never once asked what you do for a living.') +
      '<div class="stats-grid">' +
        stat('Stamina', Math.round(s.maxEnergy) + ' / ' + HS.MAX_ENERGY_CAP) +
        stat('Energy now', Math.round(s.energy)) +
        stat('Hours', '06:00 – 22:00') +
      '</div>' +
      para('<span class="dim">Training raises the ceiling, not the tank. Every session adds permanent capacity — which is how you fit more into a day.</span>');

    return {
      title:'Ironside Gym', sub:'STAMINA', accent:'#6BD4C0', body,
      actions:[{
        label:'Train', detail:'+4 permanent stamina',
        cost: HS.money(cost) + ' · 1.5h · ' + E.gym + ' energy',
        disabled: !isOpen || atCap || s.cash < cost || s.energy < E.gym || s.gymToday,
        why: !isOpen ? 'The gym is shut' : atCap ? 'You are as fit as this city gets'
             : s.gymToday ? 'You have already trained today'
             : s.cash < cost ? 'You cannot cover the day pass' : 'Not enough energy',
        onClick: () => { ui().closePanel(); game.trainGym(cost); }
      }]
    };
  };

  /* ------------------------------ STORE ------------------------------- */
  L.store = function(){
    const s = S();
    const room = Math.max(0, s.maxEnergy - s.energy);
    const body =
      para('Strip light, a humming cooler, and a clerk who has seen every kind of man buy his third can of the day.') +
      '<div class="stats-grid">' +
        stat('Energy', Math.round(s.energy) + ' / ' + Math.round(s.maxEnergy)) +
        stat('Bought today', s.drinksToday) +
        stat('Room left', Math.round(room)) +
      '</div>' +
      para('<span class="dim">The price climbs steeply with the size of the can — and with every one you have already had today.</span>');

    const actions = HS.DRINKS.map(dk => {
      const gain = Math.min(dk.energy, room);
      const price = HS.drinkPrice(s, dk.energy);
      return {
        label: dk.name, detail:'+' + dk.energy + ' energy' + (gain < dk.energy ? ' (only ' + Math.round(gain) + ' fits)' : ''),
        cost: HS.money(price) + ' · 15 min',
        disabled: s.cash < price || room < 1,
        why: room < 1 ? 'You are already full' : 'You cannot afford it',
        onClick: () => { ui().closePanel(); game.buyDrink(dk, price); }
      };
    });
    return { title:'Kwik Corner', sub:'24 HOURS', accent:'#F0E06A', body, actions };
  };

  /* ------------------------------- BANK ------------------------------- */
  L.bank = function(){
    const s = S();
    const maxLoan = Math.floor((5000 + s.rep * 900 + s.rank * 26000) * (1 + s.skill/120));
    const room = Math.max(0, maxLoan - s.loan);
    const body =
      para('Marble, silence, and a man who has read your file.') +
      '<div class="stats-grid">' +
        stat('Cash', HS.money(s.cash)) +
        stat('Outstanding loan', s.loan ? HS.money(s.loan) : 'none', s.loan ? 'bad' : '') +
        stat('Credit line', HS.money(room)) +
        stat('Weekly interest', Math.round(s.loanRate*100) + '%') +
      '</div>' +
      para('<span class="dim">Interest compounds every seven days. The bank is patient and it is not your friend.</span>');

    const actions = [];
    [0.25, 0.5, 1].forEach(f => {
      const amt = Math.floor(room * f / 1000) * 1000;
      if(amt < 1000) return;
      actions.push({
        label:'Borrow ' + HS.money(amt), detail:'Added to your loan balance',
        onClick: () => {
          s.cash += amt; s.loan += amt; HS.Audio.cash();
          ui().toast('Borrowed ' + HS.money(amt) + '.', '');
          game.openPanelFor('bank');
        }
      });
    });
    if(s.loan > 0){
      const pay = Math.min(s.cash, s.loan);
      actions.push({
        label:'Repay ' + HS.money(pay), detail:'Clear what you can today',
        disabled: pay < 1, why:'You have nothing to repay with',
        onClick: () => {
          s.cash -= pay; s.loan -= pay; HS.Audio.cash();
          ui().toast('Repaid ' + HS.money(pay) + '.', 'good');
          game.openPanelFor('bank');
        }
      });
    }
    return { title:'First Federal Bank', sub:'CREDIT', accent:'#46C98A', body, actions };
  };

  /* -------------------------------- BAR ------------------------------- */
  L.bar = function(){
    const s = S();
    const isOpen = s.hour >= 17 || s.hour < 3;
    const body =
      para('Low light, loud men, and every rumour in the city arriving about an hour before it is true.') +
      '<div class="stats-grid">' +
        stat('Reputation', Math.round(s.rep) + ' / 100') +
        stat('Contacts', s.contacts) +
        stat('Tips in pocket', s.tips) +
        stat('Hours', '17:00 – 03:00') +
      '</div>';

    const actions = [];
    const netCost = 120 + s.rank * 260;
    actions.push({
      label:'Work the room', detail:'Shake hands, remember names, buy the odd drink',
      cost: HS.money(netCost) + ' · 2h · ' + E.network + ' energy',
      disabled: !isOpen || s.cash < netCost || s.energy < E.network || s.networkedToday,
      why: !isOpen ? 'The bar is shut' : s.networkedToday ? 'You have worked this room today'
           : s.cash < netCost ? 'You cannot cover the tab' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.network(netCost); }
    });
    const roundCost = 1200 + s.rank * 3400;
    actions.push({
      label:'Buy the whole floor a round', detail:'Loud, expensive, extremely effective',
      cost: HS.money(roundCost) + ' · 2h · ' + E.round + ' energy',
      disabled: !isOpen || s.cash < roundCost || s.energy < E.round,
      why: !isOpen ? 'The bar is shut' : 'You cannot cover that tab',
      onClick: () => { ui().closePanel(); game.buyRound(roundCost); }
    });
    if(s.contacts > 0){
      actions.push({
        label:'Call in a favour', detail:'A contact tells you what they are seeing — no heat',
        cost:'1h · ' + E.favour + ' energy · 1 contact',
        disabled: !isOpen || s.energy < E.favour, why:'The bar is shut',
        onClick: () => { ui().closePanel(); game.callFavour(); }
      });
    }
    if(s.path === 'villain' || s.rank >= 5){
      actions.push({
        label:'Meet a man about a number', detail:'Someone who sees order flow before it prints',
        cost:'2h · ' + E.tip + ' energy · heat', tone:'red',
        disabled: !isOpen || s.energy < E.tip, why:'The bar is shut',
        onClick: () => { ui().closePanel(); game.buyTip(); }
      });
    }
    return { title:'The Ticker Bar', sub:'AFTER HOURS', accent:'#FF5B67', body, actions };
  };

  /* ------------------------------ SCHOOL ------------------------------ */
  L.school = function(){
    const s = S();
    const isOpen = s.hour >= 16 && s.hour < 23;
    const courses = [
      { name:'Evening seminar',   skill:2.5, cash:180,   energy:E.classA, hours:2, min:0  },
      { name:'Certification',     skill:5.5, cash:2200,  energy:E.classB, hours:3, min:25 },
      { name:'Quant masterclass', skill:9.0, cash:18000, energy:E.classC, hours:4, min:50 }
    ];
    const body =
      para('Strip lights, plastic chairs, and the only people in this city who will explain anything to you honestly.') +
      '<div class="stats-grid">' +
        stat('Skill', Math.round(s.skill) + ' / 100') +
        stat('Next unlock', nextSkillUnlock(s)) +
        stat('Hours', '16:00 – 23:00') +
      '</div>';
    const actions = courses.map(c => ({
      label: c.name, detail:'+' + c.skill + ' skill',
      cost: HS.money(c.cash) + ' · ' + c.hours + 'h · ' + c.energy + ' energy',
      disabled: !isOpen || s.cash < c.cash || s.energy < c.energy || s.skill < c.min,
      why: !isOpen ? 'Classes run 16:00 to 23:00'
           : s.skill < c.min ? 'Needs skill ' + c.min
           : s.cash < c.cash ? 'You cannot afford the fee' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.study(c); }
    }));
    return { title:'Vance Night School', sub:'LEARN', accent:'#9BD46B', body, actions };
  };

  function nextSkillUnlock(s){
    if(s.skill < 25) return 'Δ at 25';
    if(s.skill < 45) return 'Θ at 45';
    if(s.skill < 65) return 'IV at 65';
    return 'all unlocked';
  }

  /* ----------------------------- REALTOR ------------------------------ */
  L.realtor = function(){
    const s = S();
    const next = HS.HOUSING[s.housing + 1];
    const body =
      para('Glossy boards, a woman who smiles with her teeth only, and the exact square footage of everything you are not yet.') +
      '<div class="stats-grid">' +
        stat('Living in', HS.HOUSING[s.housing].name) +
        stat('Weekly rent', HS.HOUSING[s.housing].rent ? HS.money(HS.HOUSING[s.housing].rent) : 'free') +
      '</div>' +
      (next ? para('<b>' + next.name + '</b> — ' + next.desc)
            : para('<span class="dim">There is nothing above the penthouse.</span>'));
    const actions = [];
    if(next){
      actions.push({
        label:'Take ' + next.name,
        detail:'Wake with ' + Math.round(next.sleepPct*100) + '% of your stamina · rent ' + HS.money(next.rent) + '/week',
        cost: HS.money(next.price),
        disabled: s.cash < next.price, why:'You cannot cover the deposit',
        onClick: () => { ui().closePanel(); game.moveHouse(); }
      });
    }
    return { title:'Kestrel Realty', sub:'PROPERTY', accent:'#E0A6FF', body, actions };
  };

  /* -------------------------------- SEC ------------------------------- */
  L.sec = function(){
    const s = S();
    const body =
      para('Grey carpet, grey suits, and a room designed so that everything you say sounds like an admission.') +
      '<div class="stats-grid">' +
        stat('Heat', Math.round(s.heat) + ' / 100', s.heat >= 60 ? 'bad' : '') +
        stat('Status', s.heat >= 80 ? 'Under investigation' : s.heat >= 45 ? 'Person of interest' : 'Not on the board',
             s.heat >= 45 ? 'bad' : 'good') +
      '</div>' +
      para('<span class="dim">Heat rises when you trade on things you should not know. At 100 they stop asking politely.</span>');
    const actions = [];
    if(s.heat >= 10){
      const fee = Math.max(5000, Math.floor(s.cash * 0.12));
      actions.push({
        label:'Retain a serious lawyer', detail:'Heat down 25 · reputation untouched',
        cost: HS.money(fee), disabled: s.cash < fee, why:'You cannot afford that retainer',
        onClick: () => { ui().closePanel(); game.lawyerUp(fee); }
      });
      actions.push({
        label:'Cooperate fully', detail:'Heat down 45 · reputation down 12', cost:'3h',
        onClick: () => { ui().closePanel(); game.cooperate(); }
      });
    } else {
      actions.push({ label:'Nothing to discuss', detail:'They have no file on you',
        disabled:true, why:'Come back when you are interesting' });
    }
    return { title:'SEC Field Office', sub:'ENFORCEMENT', accent:'#FF8A3C', body, actions };
  };

  /* ------------------------------- FIRM ------------------------------- */
  L.firm = function(){
    const s = S();
    if(!s.path) return { title:'Empty Lot', sub:'', accent:'#E8B85C', body:para('Nothing here yet.'), actions:[] };
    if(s.path === 'boss')    return firmBoss();
    if(s.path === 'villain') return firmVillain();
    return firmLegend();
  };

  function reviewAction(s){
    return {
      label:'Chart review', detail:'Look for a crossover before the open',
      cost:'1h · ' + E.review + ' energy',
      disabled: s.reviewedToday || s.energy < E.review,
      why: s.reviewedToday ? 'Already done today' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.chartReview(); }
    };
  }

  function firmBoss(){
    const s = S();
    const payroll = s.brokers.reduce((a,b) => a + b.salary, 0);
    const body =
      para('Your floor. Forty phones, your name on the door, and a cut of every ticket that crosses it.') +
      '<div class="stats-grid">' +
        stat('Brokers', s.brokers.length) +
        stat('Daily payroll', HS.money(payroll)) +
        stat('Avg skill', s.brokers.length ? Math.round(s.brokers.reduce((a,b)=>a+b.skill,0)/s.brokers.length) : '—') +
        stat('Avg morale', s.brokers.length ? Math.round(s.brokers.reduce((a,b)=>a+b.morale,0)/s.brokers.length) : '—') +
      '</div>' +
      para('<span class="dim">Your brokers trade overnight. You take 45% of what they clear, and you pay them either way.</span>');
    const hireCost = 12000 + s.brokers.length * 9000;
    const actions = [{
      label:'Hire a broker', detail:'One more seat on the floor', cost: HS.money(hireCost),
      disabled: s.cash < hireCost, why:'You cannot cover the signing cost',
      onClick: () => { ui().closePanel(); game.hireBroker(hireCost); }
    }, reviewAction(s)];
    if(s.brokers.length){
      const trainCost = 6000 * s.brokers.length;
      actions.push({
        label:'Run a training week', detail:'+4 skill and +10 morale across the floor',
        cost: HS.money(trainCost) + ' · 4h',
        disabled: s.cash < trainCost, why:'Too expensive right now',
        onClick: () => { ui().closePanel(); game.trainFloor(trainCost); }
      });
      actions.push({
        label:'Squeeze the floor', detail:'Double tomorrow\'s take · morale down hard', tone:'red',
        onClick: () => { ui().closePanel(); game.squeezeFloor(); }
      });
    }
    return { title:'Your Firm', sub:'THE HOUSE', accent:'#3ECFCF', body, actions };
  }

  function firmVillain(){
    const s = S();
    const why = marketWhy(s);
    const body =
      para('Glass, silence, and one Bloomberg per analyst. Nobody here says the word "client".') +
      '<div class="stats-grid">' +
        stat('Assets under mgmt', HS.money(s.aum)) +
        stat('Investors', s.investors) +
        stat('Your cut', '20% of gains') +
        stat('Heat', Math.round(s.heat) + ' / 100', s.heat >= 60 ? 'bad' : '') +
      '</div>' +
      para('<span class="dim">The fund compounds overnight. Big months attract money — and the wrong kind of attention.</span>');
    const raise = Math.max(500000, Math.floor(s.aum * 0.5));
    const actions = [{
      label:'Raise capital', detail:'Bring in ' + HS.money(raise) + ' of other people\'s money',
      cost:'3h · ' + E.raise + ' energy',
      disabled: s.energy < E.raise || s.rep < 40,
      why: s.rep < 40 ? 'Nobody writes a cheque to a nobody' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.raiseCapital(raise); }
    }, {
      label:'Trade the fund', detail:'Put the book to work yourself',
      cost:'to the bell · ' + E.fund + ' energy',
      disabled: !!why || s.aum < 100000 || s.energy < E.fund,
      why: why || (s.aum < 100000 ? 'Raise capital first' : 'Not enough energy'),
      onClick: () => runSession({
        capital: Math.floor(S().aum * 0.3), fee: 0.5,
        title:'FUND BOOK — DEPLOY',
        sub:'Thirty percent of the fund, on the chain',
        onDone: res => game.finishFundSession(res)
      })
    }, reviewAction(s), {
      label:'Front-run the flow', detail:'Trade ahead of your own clients',
      cost:'heat +18', tone:'red',
      onClick: () => { ui().closePanel(); game.frontRun(); }
    }];
    return { title:'Your Fund', sub:'THE VILLAIN', accent:'#FF5B67', body, actions };
  }

  function firmLegend(){
    const s = S();
    const d = deskFor(s.rank);
    const why = marketWhy(s);
    const body =
      para('Your own office at the top of the street. No floor to run, no investors to lie to — just you and the tape.') +
      '<div class="stats-grid">' +
        stat('Book', HS.money(d.capital)) +
        stat('Reputation', Math.round(s.rep) + ' / 100') +
        stat('Skill', Math.round(s.skill) + ' / 100') +
        stat('You keep', '100%') +
      '</div>';
    const stake = Math.max(10000, Math.floor(s.cash * 0.6));
    return {
      title:'Your Office', sub:'THE LEGEND', accent:'#E8B85C', body,
      actions:[{
        label:'Trade the day', detail:'Your own capital, no leash',
        cost:'to the bell · ' + E.prop + ' energy',
        disabled: !!why || s.energy < E.prop || s.cash < 20000,
        why: why || (s.cash < 20000 ? 'You need real capital to work with' : 'Not enough energy'),
        onClick: () => runSession({
          capital: stake, fee: 0.4,
          title:'YOUR BOOK', sub:'No commission, no excuses',
          onDone: res => game.finishPropSession(res, stake, true)
        })
      }, reviewAction(s)]
    };
  }

  return L;
};

})(window.HS);
