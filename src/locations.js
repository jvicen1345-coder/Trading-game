/* MARKET MAKER — what happens inside each building. */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* Session terms. You always trade your own account; a path changes the
   buying power behind it, the fees, and whether anyone pays you a wage. */
HS.DESK = {
  intern:{ leverage:1.0, fee:0.65, target:0.06, vol:0.00095, trend:0.95, chop:0.30 },
  solo:  [null,
    { leverage:1.0, fee:0.75, target:0.08, vol:0.00105, trend:0.92, chop:0.33 },
    { leverage:1.4, fee:0.70, target:0.10, vol:0.00118, trend:0.86, chop:0.37 },
    { leverage:1.8, fee:0.60, target:0.12, vol:0.00130, trend:0.78, chop:0.42 },
    { leverage:2.2, fee:0.50, target:0.14, vol:0.00145, trend:0.70, chop:0.46 },
    { leverage:2.6, fee:0.42, target:0.16, vol:0.00158, trend:0.62, chop:0.50 },
    { leverage:3.0, fee:0.35, target:0.18, vol:0.00170, trend:0.55, chop:0.53 }],
  desk:  [null,
    { leverage:2.0, fee:0.55, target:0.08, vol:0.00105, trend:0.92, chop:0.33 },
    { leverage:2.5, fee:0.50, target:0.10, vol:0.00118, trend:0.86, chop:0.37 },
    { leverage:3.0, fee:0.45, target:0.12, vol:0.00130, trend:0.78, chop:0.42 },
    { leverage:3.5, fee:0.40, target:0.14, vol:0.00145, trend:0.70, chop:0.46 },
    { leverage:4.0, fee:0.35, target:0.16, vol:0.00158, trend:0.62, chop:0.50 },
    { leverage:4.5, fee:0.30, target:0.18, vol:0.00170, trend:0.55, chop:0.53 }],
  fund:  [null,
    { leverage:5.0, fee:0.30, target:0.10, vol:0.00135, trend:0.78, chop:0.42 },
    { leverage:6.0, fee:0.25, target:0.12, vol:0.00150, trend:0.68, chop:0.47 },
    { leverage:7.0, fee:0.22, target:0.14, vol:0.00165, trend:0.58, chop:0.51 },
    { leverage:8.0, fee:0.20, target:0.16, vol:0.00178, trend:0.50, chop:0.55 }]
};

HS.deskFor = function(S){
  if(!S.path) return HS.DESK.intern;
  const arr = HS.DESK[S.path];
  return arr[HS.clamp(S.rank, 1, arr.length - 1)] || arr[1];
};

const E = {
  work:12, review:7, gym:11,
  classA:7, classB:11, classC:16,
  network:7, round:5, favour:3, tip:5, raise:10
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
  const cost = (s, base) => HS.energyCost(s, base);

  function marketWhy(s){
    if(HS.isWeekend(s.day)) return 'The market is shut — it is the weekend';
    if(s.hour >= HS.MARKET_CLOSE - 0.4) return 'The bell has rung. Come back tomorrow';
    return null;
  }
  function sessionShape(s){
    const start = Math.max(s.hour, HS.MARKET_OPEN);
    const frac = HS.clamp((HS.MARKET_CLOSE - start) / (HS.MARKET_CLOSE - HS.MARKET_OPEN), 0, 1);
    return { frac, duration: Math.round(140 * HS.clamp(frac, 0.3, 1)) };
  }

  function runSession(o){
    const s = S();
    const d = HS.deskFor(s);
    const shape = sessionShape(s);
    ui().closePanel();
    game.setPaused(true);
    HS.Market.run({
      state: s,
      symbol: HS.weekTicker(s.day),
      startEquity: s.cash + o.bookValue,
      duration: shape.duration,
      target: d.target,
      vol: d.vol, trendStr: d.trend, chop: d.chop,
      leverage: d.leverage, feePerContract: d.fee,
      skill: s.skill, rank: s.rank,
      edge: s.edge && s.edge.day === s.day ? s.edge : null,
      news: [22, 40], shock: 0.016 + s.rank * 0.003,
      title: o.title, sub: o.sub
    }, res => {
      game.setPaused(false);
      s.edge = null;
      game.finishSession(res);
    });
  }
  HS._runSession = runSession;

  /* Everything the player currently holds, marked. */
  function bookNow(s){
    let v = 0;
    (s.positions||[]).forEach(p => {
      v += p.qty * HS.markPosition(s, p, s.day, 0,
            HS.impliedFromTape(0.0012, 1100)).mid * HS.CONTRACT_SIZE;
    });
    return v;
  }
  HS._bookNow = bookNow;

  function tradeAction(s, label, detail, title, sub){
    const why = marketWhy(s);
    const shape = sessionShape(s);
    return {
      label, detail,
      cost:'to the bell · ' + cost(s, E.work) + ' energy',
      disabled: !!why || s.workedToday || s.energy < cost(s, E.work),
      why: why || (s.workedToday ? 'You have traded today' : 'Not enough energy'),
      onClick: () => runSession({ bookValue: bookNow(s), title, sub })
    };
  }

  function reviewAction(s){
    return {
      label:'Chart review', detail:'Look for a crossover before the open',
      cost:'1h · ' + cost(s, E.review) + ' energy',
      disabled: s.reviewedToday || s.energy < cost(s, E.review),
      why: s.reviewedToday ? 'Already done today' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.chartReview(); }
    };
  }

  /* ------------------------------- HOME ------------------------------- */
  function homePanel(){
    const s = S();
    const h = HS.HOUSING[s.housing];
    const rest = HS.restFor(s.hour);
    const wake = Math.round(HS.clamp(rest.pct * h.quality + HS.roomBonus(s,'sleep'), 0, 1.1) * s.maxEnergy);
    const body =
      para(h.desc) +
      '<div class="stats-grid">' +
        stat('Net worth', HS.money(HS.netWorth(s))) +
        stat('Weekly rent', h.rent ? HS.money(h.rent) : 'free') +
        stat('If you sleep now', rest.name, rest.id === 2 ? 'good' : rest.id === 0 ? 'bad' : '') +
        stat('You would wake with', wake) +
      '</div>' +
      para('<span class="dim">' + rest.note + '. Turning in before half nine leaves you refreshed — sharper reads, and everything costs less effort.</span>');

    const actions = [
      { label:'Sleep', detail:'Wake at 7:00 with ' + wake + ' energy · ' + rest.name,
        cost:'ends the day',
        onClick: () => { ui().closePanel(); game.sleep(); } },
      { label:'Your room', detail: HS.roomOwned(s) + ' of ' + HS.ROOM_SLOTS.length + ' fitted',
        onClick: () => { ui().closePanel(); game.openRoom(); } }
    ];
    if(s.path === 'solo'){
      actions.splice(0, 0, tradeAction(s, 'Trade from your desk',
        'Your own account, your own room, nobody to blame',
        'HOME DESK', 'Your account · ' + HS.PATHS.solo.name));
      actions.push(reviewAction(s));
    }
    actions.push({ label:'Save game', detail:'Write your progress to this browser',
      onClick: () => { HS.save(s); ui().toast('Progress saved.', 'good'); HS.Audio.cash(); } });
    return { title:h.name, sub:'HOME', accent:'#E8B85C', body, actions };
  }
  L.home_basement = L.home_studio = L.home_loft = L.home_penthouse = homePanel;

  /* ---------------------------- BROKERAGE ----------------------------- */
  L.brokerage = function(){
    const s = S();

    if(!s.path && !s.flags.hired){
      return {
        title:'Ladder & Co.', sub:'GROUND FLOOR', accent:'#3ECFCF',
        body: para('A wall of phones, a wall of noise. A woman with a clipboard looks you up and down and asks whether you can take rejection for nine hours a day.') +
              para('<b>You can.</b>') +
              para('<span class="dim">They are taking interns for the week. It pays badly and it is the only door open to you.</span>'),
        actions:[{ label:'Take the internship', detail:'One week. $600 advance, $120 a day.',
          onClick: () => { ui().closePanel(); game.takeInternship(); }}]
      };
    }

    if(s.path === 'solo'){
      return {
        title:'Ladder & Co.', sub:'YOU DO NOT WORK HERE', accent:'#3ECFCF',
        body: para('The security desk has your name on a list, and not the good one. You chose the bedroom over the floor.') +
              para('<span class="dim">Your trading happens at home now.</span>'),
        actions:[]
      };
    }
    if(s.path === 'fund'){
      return {
        title:'Ladder & Co.', sub:'FORMER EMPLOYER', accent:'#3ECFCF',
        body: para('People you used to eat lunch with look at the floor when you pass. Word travelled fast about who you work for now.'),
        actions:[]
      };
    }

    const d = HS.deskFor(s);
    const nr = HS.nextRank(s);
    const isIntern = !s.path;
    const why = marketWhy(s);
    const body =
      para(isIntern
        ? 'You have a headset, a spare terminal and a supervisor who checks on you twice a day.'
        : 'The floor hums. Your desk is ' + (s.rank >= 4 ? 'by the window' : 'near the printer') + '.') +
      '<div class="stats-grid">' +
        stat('Buying power', d.leverage.toFixed(1) + 'x your cash') +
        stat('Day rate', HS.money(HS.rankOf(s).salary)) +
        stat('Commission', '$' + d.fee.toFixed(2) + '/contract') +
        stat('Market', why ? 'closed' : 'open until 4:00', why ? 'bad' : 'good') +
      '</div>';

    const actions = [ tradeAction(s, 'Trade the session',
      isIntern ? 'The training account, on the firm\'s terminals' : 'Options, on the firm\'s buying power',
      isIntern ? 'LADDER & CO. — INTERN' : 'LADDER & CO. — ' + HS.rankOf(s).name.toUpperCase(),
      d.leverage.toFixed(1) + 'x buying power') ];

    actions.push(reviewAction(s));   // interns learn this on day two

    if(nr){
      const needs = HS.needText(s, nr.need);
      actions.push({
        label:'Ask for a promotion', detail:'Next: ' + nr.name,
        disabled: !HS.meetsNeed(s, nr.need),
        why: needs.filter(n => !n.ok).map(n => n.label + ' ' + n.text).join(' · '),
        onClick: () => { ui().closePanel(); game.promoteTo(nr.i); }
      });
    }
    if(s.path === 'desk' && s.rank >= 4){
      const hireCost = 12000 + s.brokers.length * 9000;
      actions.push({
        label:'Hire onto your team', detail:'They trade overnight, you take 45%',
        cost: HS.money(hireCost),
        disabled: s.cash < hireCost, why:'You cannot cover the signing cost',
        onClick: () => { ui().closePanel(); game.hireBroker(hireCost); }
      });
    }
    return { title:'Ladder & Co.', sub: isIntern ? 'INTERNSHIP' : 'YOUR EMPLOYER',
             accent:'#3ECFCF', body, actions };
  };

  /* ----------------------------- EXCHANGE ----------------------------- */
  L.exchange = function(){
    const s = S();
    const body =
      para('Open outcry, ten thousand voices, and a members\' board you are not on.') +
      '<div class="stats-grid">' +
        stat('Week\'s name', HS.weekTicker(s.day)) +
        stat('Last', HS.tickerPrice(s, HS.weekTicker(s.day)).toFixed(2)) +
      '</div>' +
      para('<span class="dim">The Exchange sets the tape everyone else trades. You can read the board here for free.</span>');
    const rows = Object.keys(HS.TICKERS).map(sym => {
      const t = s.market.tickers[sym];
      const ch = (t.price - t.prevClose) / t.prevClose;
      return '<div class="tally"><span class="k">' + sym + ' · ' + HS.TICKERS[sym].name + '</span>' +
             '<span class="v" style="color:' + (ch>=0?'var(--green)':'var(--red)') + '">' +
             t.price.toFixed(2) + '  ' + HS.pct(ch) + '</span></div>';
    }).join('');
    return { title:'The Exchange', sub:'THE BOARD', accent:'#8B6BFF',
             body: body + '<div class="tallies">' + rows + '</div>', actions:[] };
  };

  /* ------------------------------- GYM -------------------------------- */
  L.gym = function(){
    const s = S();
    const isOpen = s.hour >= 6 && s.hour < 22;
    const atCap = s.maxEnergy >= HS.MAX_ENERGY_CAP;
    const price = Math.round(40 + (s.maxEnergy - 100) * 12);
    const body =
      para('Rubber, chalk and a man at the desk who has never once asked what you do for a living.') +
      '<div class="stats-grid">' +
        stat('Stamina', Math.round(s.maxEnergy) + ' / ' + HS.MAX_ENERGY_CAP) +
        stat('Energy now', Math.round(s.energy)) +
        stat('Hours', '06:00 – 22:00') +
      '</div>' +
      para('<span class="dim">Training raises the ceiling, not the tank. Capacity is how you fit more into a day.</span>');
    return {
      title:'Ironside Gym', sub:'STAMINA', accent:'#6BD4C0', body,
      actions:[{
        label:'Train', detail:'+5 permanent stamina',
        cost: HS.money(price) + ' · 1.5h · ' + cost(s, E.gym) + ' energy',
        disabled: !isOpen || atCap || s.cash < price || s.energy < cost(s,E.gym) || s.gymToday,
        why: !isOpen ? 'The gym is shut' : atCap ? 'You are as fit as this city gets'
             : s.gymToday ? 'You have already trained today'
             : s.cash < price ? 'You cannot cover the day pass' : 'Not enough energy',
        onClick: () => { ui().closePanel(); game.trainGym(price); }
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
      '</div>';
    const actions = HS.DRINKS.map(dk => {
      const price = HS.drinkPrice(s, dk.energy);
      return {
        label: dk.name, detail:'+' + dk.energy + ' energy',
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
    const maxLoan = Math.floor((4000 + s.rep * 900 + s.rank * 30000) * (1 + s.skill/120));
    const room = Math.max(0, maxLoan - s.loan);
    const rate = s.loanRate * (HS.hasPerk(s,'s3') ? 0.5 : 1);
    const body =
      para('Marble, silence, and a man who has read your file.') +
      '<div class="stats-grid">' +
        stat('Cash', HS.money(s.cash)) +
        stat('Outstanding loan', s.loan ? HS.money(s.loan) : 'none', s.loan ? 'bad' : '') +
        stat('Credit line', HS.money(room)) +
        stat('Weekly interest', (rate*100).toFixed(1) + '%') +
      '</div>';
    const actions = [];
    [0.25, 0.5, 1].forEach(f => {
      const amt = Math.floor(room * f / 500) * 500;
      if(amt < 500) return;
      actions.push({ label:'Borrow ' + HS.money(amt), detail:'Added to your loan balance',
        onClick: () => { s.cash += amt; s.loan += amt; HS.Audio.cash();
          ui().toast('Borrowed ' + HS.money(amt) + '.', ''); game.openPanelFor('bank'); } });
    });
    if(s.loan > 0){
      const pay = Math.min(s.cash, s.loan);
      actions.push({ label:'Repay ' + HS.money(pay), detail:'Clear what you can today',
        disabled: pay < 1, why:'You have nothing to repay with',
        onClick: () => { s.cash -= pay; s.loan -= pay; HS.Audio.cash();
          ui().toast('Repaid ' + HS.money(pay) + '.', 'good'); game.openPanelFor('bank'); } });
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
    const netCost = 100 + s.rank * 240;
    actions.push({
      label:'Work the room', detail:'Shake hands, remember names, buy the odd drink',
      cost: HS.money(netCost) + ' · 2h · ' + cost(s,E.network) + ' energy',
      disabled: !isOpen || s.cash < netCost || s.energy < cost(s,E.network) || s.networkedToday,
      why: !isOpen ? 'The bar is shut' : s.networkedToday ? 'You have worked this room today'
           : s.cash < netCost ? 'You cannot cover the tab' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.network(netCost); }
    });
    const roundCost = 1000 + s.rank * 3200;
    actions.push({
      label:'Buy the whole floor a round', detail:'Loud, expensive, extremely effective',
      cost: HS.money(roundCost) + ' · 2h · ' + cost(s,E.round) + ' energy',
      disabled: !isOpen || s.cash < roundCost || s.energy < cost(s,E.round),
      why: !isOpen ? 'The bar is shut' : 'You cannot cover that tab',
      onClick: () => { ui().closePanel(); game.buyRound(roundCost); }
    });
    if(s.contacts > 0){
      actions.push({
        label:'Call in a favour', detail:'A contact tells you what they are seeing — no heat',
        cost: HS.freeFavour(s) ? 'free' : '1h · ' + cost(s,E.favour) + ' energy · 1 contact',
        disabled: !isOpen, why:'The bar is shut',
        onClick: () => { ui().closePanel(); game.callFavour(); }
      });
    }
    if(s.path){
      actions.push({
        label:'Meet a man about a number', detail:'Someone who sees order flow before it prints',
        cost:'2h · ' + cost(s,E.tip) + ' energy · heat', tone:'red',
        disabled: !isOpen || s.energy < cost(s,E.tip), why:'The bar is shut',
        onClick: () => { ui().closePanel(); game.buyTip(); }
      });
    }
    return { title:'The Ticker Bar', sub:'AFTER HOURS', accent:'#FF5B67', body, actions };
  };

  /* ------------------------------ SCHOOL ------------------------------ */
  L.school = function(){
    const s = S();
    const isOpen = s.hour >= 16 && s.hour < 23;
    const disc = 1 - HS.roomBonus(s, 'study');
    const courses = [
      { name:'Evening seminar',   skill:2.5, cash:Math.round(160*disc),   energy:E.classA, hours:2, min:0  },
      { name:'Certification',     skill:5.5, cash:Math.round(2000*disc),  energy:E.classB, hours:3, min:24 },
      { name:'Quant masterclass', skill:9.0, cash:Math.round(16000*disc), energy:E.classC, hours:4, min:48 }
    ];
    const body =
      para('Strip lights, plastic chairs, and the only people in this city who will explain anything to you honestly.') +
      '<div class="stats-grid">' +
        stat('Skill', Math.round(s.skill) + ' / 100') +
        stat('Perk points', s.perkPoints) +
        stat('Hours', '16:00 – 23:00') +
      '</div>';
    const actions = courses.map(c => ({
      label: c.name, detail:'+' + c.skill + ' skill',
      cost: HS.money(c.cash) + ' · ' + c.hours + 'h · ' + cost(s,c.energy) + ' energy',
      disabled: !isOpen || s.cash < c.cash || s.energy < cost(s,c.energy) || s.skill < c.min,
      why: !isOpen ? 'Classes run 16:00 to 23:00'
           : s.skill < c.min ? 'Needs skill ' + c.min
           : s.cash < c.cash ? 'You cannot afford the fee' : 'Not enough energy',
      onClick: () => { ui().closePanel(); game.study(c); }
    }));
    actions.push({ label:'Open your perk trees', detail: s.perkPoints + ' point(s) to spend',
      onClick: () => { ui().closePanel(); game.openPerks(); } });
    return { title:'Vance Night School', sub:'LEARN', accent:'#9BD46B', body, actions };
  };

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
      actions.push({ label:'Take ' + next.name,
        detail:'Better rest and a bigger room · rent ' + HS.money(next.rent) + '/week',
        cost: HS.money(next.price),
        disabled: s.cash < next.price, why:'You cannot cover the deposit',
        onClick: () => { ui().closePanel(); game.moveHouse(); } });
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
      '</div>';
    const actions = [];
    if(s.heat >= 10){
      const fee = Math.round(Math.max(4000, s.cash * 0.12) * HS.probeMul(s));
      actions.push({ label:'Retain a serious lawyer', detail:'Heat down 25 · reputation untouched',
        cost: HS.money(fee), disabled: s.cash < fee, why:'You cannot afford that retainer',
        onClick: () => { ui().closePanel(); game.lawyerUp(fee); } });
      actions.push({ label:'Cooperate fully', detail:'Heat down 45 · reputation down 12', cost:'3h',
        onClick: () => { ui().closePanel(); game.cooperate(); } });
    } else {
      actions.push({ label:'Nothing to discuss', detail:'They have no file on you',
        disabled:true, why:'Come back when you are interesting' });
    }
    return { title:'SEC Field Office', sub:'ENFORCEMENT', accent:'#FF8A3C', body, actions };
  };

  /* ------------------------------- FUND ------------------------------- */
  L.firm = function(){
    const s = S();
    if(s.path !== 'fund'){
      return { title:'Kade Capital', sub:'BY APPOINTMENT', accent:'#FF5B67',
        body: para('Black glass, no signage, one name on the buzzer. Nobody goes in and nobody comes out while you are watching.') +
              para('<span class="dim">You have heard the name. You have not been asked.</span>'),
        actions:[] };
    }
    const why = marketWhy(s);
    const body =
      para('Glass, silence, and one terminal per analyst. Nobody here says the word "client".') +
      '<div class="stats-grid">' +
        stat('Assets under mgmt', HS.money(s.aum)) +
        stat('Investors', s.investors) +
        stat('Your cut', '20% of gains') +
        stat('Heat', Math.round(s.heat) + ' / 100', s.heat >= 60 ? 'bad' : '') +
      '</div>';
    const raise = Math.round(Math.max(600000, s.aum * 0.5) * HS.raiseMul(s));
    const actions = [
      { label:'Raise capital', detail:'Bring in ' + HS.money(raise) + ' of other people\'s money',
        cost:'3h · ' + cost(s,E.raise) + ' energy',
        disabled: s.energy < cost(s,E.raise) || s.rep < 35,
        why: s.rep < 35 ? 'Nobody writes a cheque to a nobody' : 'Not enough energy',
        onClick: () => { ui().closePanel(); game.raiseCapital(raise); } },
      tradeAction(s, 'Trade the fund book', 'Kade\'s money on your conviction',
                  'KADE CAPITAL', 'The fund book'),
      reviewAction(s),
      { label:'Front-run the flow', detail:'Trade ahead of your own clients',
        cost:'heat +18', tone:'red',
        onClick: () => { ui().closePanel(); game.frontRun(); } }
    ];
    return { title:'Kade Capital', sub:'THE FUND', accent:'#FF5B67', body, actions };
  };

  return L;
};

})(window.HS);
