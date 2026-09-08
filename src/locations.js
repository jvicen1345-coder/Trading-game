/* HEATSEEKER — what happens inside each building. */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* Desk terms by rank: how much book you get, and what slice of the upside is yours. */
const DESK = [
  { capital:0,       commission:0,    target:0.10, vol:0.0034, trend:0.90, chop:0.32 },
  { capital:5000,    commission:0.08, target:0.10, vol:0.0034, trend:0.90, chop:0.32 },
  { capital:25000,   commission:0.12, target:0.12, vol:0.0038, trend:0.86, chop:0.36 },
  { capital:90000,   commission:0.16, target:0.14, vol:0.0044, trend:0.80, chop:0.40 },
  { capital:260000,  commission:0.20, target:0.16, vol:0.0050, trend:0.72, chop:0.45 },
  { capital:700000,  commission:0.25, target:0.18, vol:0.0056, trend:0.64, chop:0.49 },
  { capital:1800000, commission:0.30, target:0.20, vol:0.0062, trend:0.58, chop:0.52 },
  { capital:5000000, commission:0.35, target:0.22, vol:0.0068, trend:0.52, chop:0.55 },
  { capital:12000000,commission:0.40, target:0.24, vol:0.0074, trend:0.48, chop:0.58 }
];
HS.DESK = DESK;

const SYMS = ['VLT','NRG','QNT','BTX','ARC','HLX'];

HS.Locations = function(game){
  const L = {};
  const S = () => game.S;
  const ui = () => game.ui;

  /* ---------- shared helpers ---------- */
  function need(cond, why){ return cond ? null : why; }
  function stat(k, v, tone){
    return '<div class="stat"><span class="k">' + k + '</span><span class="v ' + (tone||'') + '">' + v + '</span></div>';
  }
  function para(t){ return '<p class="pbody">' + t + '</p>'; }

  function deskFor(rank){ return DESK[HS.clamp(rank, 0, DESK.length - 1)]; }

  /* Run a trading session and apply its consequences. */
  function runSession(o){
    const s = S();
    const d = deskFor(s.rank);
    const sym = SYMS[Math.floor(Math.random() * (o.symbolPool || 2 + Math.min(4, s.rank)))] || 'VLT';
    ui().closePanel();
    game.setPaused(true);

    HS.Market.run({
      symbol: sym,
      capital: o.capital,
      leverage: o.leverage || 1,
      fee: o.fee != null ? o.fee : 0.0006,
      vol: d.vol, trendStr: d.trend, chop: d.chop,
      duration: o.duration || 45,
      target: o.target != null ? o.target : d.target,
      skill: s.skill,
      tip: !!o.tip,
      news: s.rank >= 2 ? [9, 16] : null,
      shock: 0.03 + s.rank * 0.004,
      title: o.title, sub: o.sub
    }, res => {
      game.setPaused(false);
      o.onDone(res, d);
    });
  }

  /* ---------------------------------------------------------------
     HOME
     --------------------------------------------------------------- */
  function homePanel(){
    const s = S();
    const h = HS.HOUSING[s.housing];
    const canSleep = true;
    const body =
      para(h.desc) +
      '<div class="stats-grid">' +
        stat('Net worth', HS.money(HS.netWorth(s))) +
        stat('Weekly rent', h.rent ? HS.money(h.rent) : 'free') +
        stat('Rest quality', h.sleepEnergy + '%') +
        stat('Rent due', 'Day ' + s.rentDueDay) +
      '</div>';

    const actions = [
      { label:'Sleep until morning', detail:'Wake at 7:00 with ' + h.sleepEnergy + '% energy',
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

  /* ---------------------------------------------------------------
     BROKERAGE — the day job
     --------------------------------------------------------------- */
  L.brokerage = function(){
    const s = S();
    const d = deskFor(s.rank);
    const isOpen = s.hour >= 8 && s.hour < 18 && !HS.isWeekend(s.day);
    const nr = HS.nextRank(s);

    if(s.rank === 0){
      return {
        title:'Ladder & Co. Brokerage', sub:'GROUND FLOOR', accent:'#3ECFCF',
        body: para('A wall of phones, a wall of noise. A man in a bad tie looks you up and down and asks if you can take rejection for nine hours a day.') +
              para('<b>You can.</b>'),
        actions:[{ label:'Ask for a job', detail:'Start at the bottom: cold calling',
          onClick: () => {
            ui().closePanel();
            game.promoteTo(1, 'They hand you a headset and a list of names. You are a Cold Caller.');
          }}]
      };
    }

    const body =
      para('The floor hums. Your desk is ' + (s.rank >= 4 ? 'by the window' : 'near the printer') + '.') +
      '<div class="stats-grid">' +
        stat('Your desk', HS.money(d.capital)) +
        stat('Your cut', Math.round(d.commission*100) + '% of profit') +
        stat('Day rate', HS.money(HS.rankOf(s).salary)) +
        stat('Session target', HS.pct(d.target)) +
      '</div>' +
      para('<span class="dim">The firm\'s capital, the firm\'s risk. Lose money here and it costs you standing, not savings.</span>');

    const actions = [];
    actions.push({
      label:'Work a session', detail:'Trade the firm\'s book for your commission',
      cost:'2h · 22 energy',
      disabled: !isOpen || s.workedToday || s.energy < 22,
      why: !isOpen ? (HS.isWeekend(s.day) ? 'Closed — it is the weekend' : 'Open 8:00 to 18:00')
           : s.workedToday ? 'You have already worked today'
           : 'Not enough energy',
      onClick: () => runSession({
        capital: d.capital,
        title: 'LADDER & CO. — ' + HS.rankOf(S()).name.toUpperCase(),
        sub: 'Firm capital · you keep ' + Math.round(d.commission*100) + '% of the upside',
        onDone: (res, dd) => game.finishWorkSession(res, dd)
      })
    });

    if(nr){
      const needs = HS.needText(s, nr.need);
      const ok = HS.meetsNeed(s, nr.need);
      actions.push({
        label:'Ask for a promotion', detail:'Next: ' + nr.name,
        disabled: !ok,
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

  /* ---------------------------------------------------------------
     THE EXCHANGE — your own risk, and the branch point
     --------------------------------------------------------------- */
  L.exchange = function(){
    const s = S();
    const locked = s.rank < 3;
    if(locked){
      return {
        title:'The Exchange', sub:'MEMBERS ONLY', accent:'#8B6BFF',
        body: para('Two guards, a brass door, and a members\' board you are not on. The floor beyond is where the real size trades.') +
              para('<span class="dim">Reach <b>Broker</b> at Ladder &amp; Co. to be admitted.</span>'),
        actions:[]
      };
    }

    const d = deskFor(s.rank);
    const stake = Math.max(2000, Math.floor(s.cash * 0.5));
    const body =
      para('Open outcry, ten thousand voices. Down here you can put up your own money and keep every cent you make on it.') +
      '<div class="stats-grid">' +
        stat('Your stake', HS.money(stake)) +
        stat('Leverage', (1 + Math.min(3, Math.floor(s.rank/2))) + 'x') +
        stat('You keep', '100%') +
        stat('Your money', 'at risk', 'bad') +
      '</div>';

    const actions = [];
    actions.push({
      label:'Trade your own book', detail:'Half your cash, all of the upside — and the downside',
      cost:'2h · 26 energy',
      disabled: s.cash < 4000 || s.energy < 26,
      why: s.cash < 4000 ? 'You need at least $4,000 to take a seat' : 'Not enough energy',
      onClick: () => runSession({
        capital: stake,
        leverage: 1 + Math.min(3, Math.floor(s.rank/2)),
        fee: 0.0009,
        tip: S().tips > 0,
        title:'THE EXCHANGE — PROP SESSION',
        sub: S().tips > 0 ? 'Your capital · running on a tip' : 'Your capital, your risk, your profit',
        onDone: res => game.finishPropSession(res, stake)
      })
    });

    if(s.rank === 5 && !s.path){
      const ok = HS.meetsNeed(s, { skill:70, rep:65, cash:400000 });
      const needs = HS.needText(s, { skill:70, rep:65, cash:400000 });
      actions.push({
        label:'Make your move', detail:'Choose what you become', tone:'gold',
        disabled: !ok,
        why: needs.filter(n=>!n.ok).map(n=>n.label+' '+n.text).join(' · '),
        onClick: () => { ui().closePanel(); game.offerBranch(); }
      });
    }
    return { title:'The Exchange', sub:'THE FLOOR', accent:'#8B6BFF', body, actions };
  };

  /* ---------------------------------------------------------------
     BANK
     --------------------------------------------------------------- */
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
          s.cash += amt; s.loan += amt;
          HS.Audio.cash();
          ui().toast('Borrowed ' + HS.money(amt) + '.', '');
          game.openPanelFor('bank');
        }
      });
    });
    if(s.loan > 0){
      const pay = Math.min(s.cash, s.loan);
      actions.push({
        label:'Repay ' + HS.money(pay), detail:'Clear what you can today',
        disabled: pay < 1,
        why:'You have nothing to repay with',
        onClick: () => {
          s.cash -= pay; s.loan -= pay;
          HS.Audio.cash();
          ui().toast('Repaid ' + HS.money(pay) + '.', 'good');
          game.openPanelFor('bank');
        }
      });
    }
    return { title:'First Federal Bank', sub:'CREDIT', accent:'#46C98A', body, actions };
  };

  /* ---------------------------------------------------------------
     THE TICKER BAR — reputation and contacts
     --------------------------------------------------------------- */
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
      cost: HS.money(netCost) + ' · 2h · 16 energy',
      disabled: !isOpen || s.cash < netCost || s.energy < 16 || s.networkedToday,
      why: !isOpen ? 'The bar is shut' : s.networkedToday ? 'You have worked this room today'
           : s.cash < netCost ? 'You cannot cover the tab' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.network(netCost); }
    });
    const roundCost = 1200 + s.rank * 3400;
    actions.push({
      label:'Buy the whole floor a round', detail:'Loud, expensive, extremely effective',
      cost: HS.money(roundCost) + ' · 2h · 12 energy',
      disabled: !isOpen || s.cash < roundCost || s.energy < 12,
      why: !isOpen ? 'The bar is shut' : 'You cannot cover that tab',
      onClick: () => { ui().closePanel(); game.buyRound(roundCost); }
    });
    if(s.contacts > 0){
      actions.push({
        label:'Call in a favour', detail:'A contact tells you what they are seeing — no questions, no heat',
        cost:'1h · 6 energy · 1 contact',
        disabled: !isOpen || s.energy < 6,
        why:'The bar is shut',
        onClick: () => { ui().closePanel(); game.callFavour(); }
      });
    }
    if(s.path === 'villain' || s.rank >= 5){
      actions.push({
        label:'Meet a man about a number', detail:'Someone who sees order flow before it prints',
        cost:'2h · 10 energy · heat',
        tone:'red',
        disabled: !isOpen || s.energy < 10,
        why:'The bar is shut',
        onClick: () => { ui().closePanel(); game.buyTip(); }
      });
    }
    return { title:'The Ticker Bar', sub:'AFTER HOURS', accent:'#FF5B67', body, actions };
  };

  /* ---------------------------------------------------------------
     NIGHT SCHOOL — skill
     --------------------------------------------------------------- */
  L.school = function(){
    const s = S();
    const isOpen = s.hour >= 16 && s.hour < 23;
    const courses = [
      { name:'Evening seminar',   skill:2.5, cash:180,   energy:14, hours:2, min:0  },
      { name:'Certification',     skill:5.5, cash:2200,  energy:22, hours:3, min:25 },
      { name:'Quant masterclass', skill:9.0, cash:18000, energy:30, hours:4, min:50 }
    ];
    const body =
      para('Strip lights, plastic chairs, and the only people in this city who will explain anything to you honestly.') +
      '<div class="stats-grid">' +
        stat('Skill', Math.round(s.skill) + ' / 100') +
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

  /* ---------------------------------------------------------------
     REALTOR — housing
     --------------------------------------------------------------- */
  L.realtor = function(){
    const s = S();
    const next = HS.HOUSING[s.housing + 1];
    const body =
      para('Glossy boards, a woman who smiles with her teeth only, and the exact square footage of everything you are not yet.') +
      '<div class="stats-grid">' +
        stat('Living in', HS.HOUSING[s.housing].name) +
        stat('Weekly rent', HS.HOUSING[s.housing].rent ? HS.money(HS.HOUSING[s.housing].rent) : 'free') +
      '</div>' +
      (next ? para('<b>' + next.name + '</b> — ' + next.desc) : para('<span class="dim">There is nothing above the penthouse.</span>'));

    const actions = [];
    if(next){
      actions.push({
        label:'Take ' + next.name, detail:'Rest to ' + next.sleepEnergy + '% · rent ' + HS.money(next.rent) + '/week',
        cost: HS.money(next.price),
        disabled: s.cash < next.price,
        why:'You cannot cover the deposit',
        onClick: () => { ui().closePanel(); game.moveHouse(); }
      });
    }
    return { title:'Kestrel Realty', sub:'PROPERTY', accent:'#E0A6FF', body, actions };
  };

  /* ---------------------------------------------------------------
     SEC — consequences
     --------------------------------------------------------------- */
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
        cost: HS.money(fee),
        disabled: s.cash < fee, why:'You cannot afford that retainer',
        onClick: () => { ui().closePanel(); game.lawyerUp(fee); }
      });
      actions.push({
        label:'Cooperate fully', detail:'Heat down 45 · reputation down 12',
        cost:'3h',
        onClick: () => { ui().closePanel(); game.cooperate(); }
      });
    } else {
      actions.push({ label:'Nothing to discuss', detail:'They have no file on you', disabled:true, why:'Come back when you are interesting' });
    }
    return { title:'SEC Field Office', sub:'ENFORCEMENT', accent:'#FF8A3C', body, actions };
  };

  /* ---------------------------------------------------------------
     YOUR FIRM — path-specific endgame
     --------------------------------------------------------------- */
  L.firm = function(){
    const s = S();
    if(!s.path) return { title:'Empty Lot', sub:'', accent:'#E8B85C', body:para('Nothing here yet.'), actions:[] };
    if(s.path === 'boss')    return firmBoss();
    if(s.path === 'villain') return firmVillain();
    return firmLegend();
  };

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
      label:'Hire a broker', detail:'One more seat on the floor',
      cost: HS.money(hireCost),
      disabled: s.cash < hireCost,
      why:'You cannot cover the signing cost',
      onClick: () => { ui().closePanel(); game.hireBroker(hireCost); }
    }];
    if(s.brokers.length){
      const trainCost = 6000 * s.brokers.length;
      actions.push({
        label:'Run a training week', detail:'+4 skill and +10 morale across the floor',
        cost: HS.money(trainCost) + ' · 4h',
        disabled: s.cash < trainCost, why:'Too expensive right now',
        onClick: () => { ui().closePanel(); game.trainFloor(trainCost); }
      });
      actions.push({
        label:'Squeeze the floor', detail:'Double tomorrow\'s take · morale down hard',
        tone:'red',
        onClick: () => { ui().closePanel(); game.squeezeFloor(); }
      });
    }
    return { title:'Your Firm', sub:'THE HOUSE', accent:'#3ECFCF', body, actions };
  }

  function firmVillain(){
    const s = S();
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
      cost:'3h · 20 energy · needs reputation',
      disabled: s.energy < 20 || s.rep < 40,
      why: s.rep < 40 ? 'Nobody writes a cheque to a nobody' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.raiseCapital(raise); }
    }];
    actions.push({
      label:'Trade the fund', detail:'Put the book to work yourself',
      cost:'2h · 26 energy',
      disabled: s.aum < 100000 || s.energy < 26,
      why: s.aum < 100000 ? 'Raise capital first' : 'Not enough energy',
      onClick: () => runSession({
        capital: Math.floor(S().aum * 0.3),
        leverage: 3, fee:0.0008,
        tip: S().tips > 0,
        title:'FUND BOOK — DEPLOY',
        sub: S().tips > 0 ? 'Running on a tip · the tape is transparent to you' : 'Thirty percent of the fund',
        onDone: res => game.finishFundSession(res)
      })
    });
    actions.push({
      label:'Front-run the flow', detail:'Trade ahead of your own clients',
      cost:'heat +18', tone:'red',
      onClick: () => { ui().closePanel(); game.frontRun(); }
    });
    return { title:'Your Fund', sub:'THE VILLAIN', accent:'#FF5B67', body, actions };
  }

  function firmLegend(){
    const s = S();
    const d = deskFor(s.rank);
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
        cost:'3h · 28 energy',
        disabled: s.energy < 28 || s.cash < 20000,
        why: s.cash < 20000 ? 'You need real capital to work with' : 'Not enough energy',
        onClick: () => runSession({
          capital: stake, leverage:2, fee:0.0005,
          tip: S().tips > 0,
          title:'YOUR BOOK', sub:'No commission, no excuses',
          onDone: res => game.finishPropSession(res, stake, true)
        })
      }]
    };
  }

  return L;
};

})(window.HS);
