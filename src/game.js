/* MARKET MAKER — main controller: loop, interaction, consequences, endings. */
window.HS = window.HS || {};
(function(HS){
'use strict';
const $ = HS.$;

HS.Game = function(){
  const G = {};
  let world, player, input, city, ui, locs;
  let paused = true, started = false;
  let nearest = null, lastT = 0, walkSfx = 0;
  let perfFrames = 0, perfTime = 0, perfChecked = false;
  let collapsing = false;

  G.S = HS.newState();

  /* ================= boot ================= */
  G.boot = function(){
    city   = HS.buildCity(20260908);
    world  = HS.World(THREE, $('scene'), city);
    player = HS.Player(THREE, world.scene, city);
    input  = HS.Input();
    ui     = HS.UI(G);
    locs   = HS.Locations(G);
    G.ui = ui; G.world = world; G.city = city; G.player = player;

    HS.Audio.loadPref();
    $('btnSound').classList.toggle('off', !HS.Audio.on);

    input.onKey = handleKey;
    if('ontouchstart' in window){
      document.body.classList.add('touch');
      input.bindStick($('stick'), $('stickKnob'));
    }

    window.addEventListener('resize', () => { world.resize(); ui.resizeMinimap(); });
    ui.resizeMinimap();

    wireButtons();
    refreshLandmarks();
    placeAtHome(true);
    world.update(0, G.S.hour, player.x, player.z, true);
    lastT = performance.now();
    requestAnimationFrame(frame);
  };

  function wireButtons(){
    $('btnSound').addEventListener('click', () => {
      HS.Audio.init(); HS.Audio.setOn(!HS.Audio.on);
      $('btnSound').classList.toggle('off', !HS.Audio.on);
      if(HS.Audio.on) HS.Audio.click();
    });
    $('btnPause').addEventListener('click', () => togglePause());
    $('panelClose').addEventListener('click', () => { HS.Audio.exit(); ui.closePanel(); });
    $('btnResume').addEventListener('click', () => { HS.Audio.click(); closeMenu(); });
    $('btnSaveQuit').addEventListener('click', () => {
      HS.save(G.S); ui.toast('Saved.', 'good'); closeMenu();
    });
    $('btnHelp').addEventListener('click', () => { $('help').classList.add('show'); });
    $('btnCareer').addEventListener('click', () => { HS.Audio.click(); showCareer(); });
    $('helpClose').addEventListener('click', () => { $('help').classList.remove('show'); });
    $('interactBtn').addEventListener('click', () => tryEnter());
  }

  /* ================= start / load ================= */
  G.startNew = function(){
    G.S = HS.newState();
    HS.clearSave();
    started = true; paused = false;
    refreshLandmarks();
    placeAtHome(true);
    ui.syncHud();
    intro();
  };
  G.startLoaded = function(S){
    G.S = S;
    started = true; paused = false;
    refreshLandmarks();
    placeAtHome(true);
    ui.syncHud();
    ui.toast('Welcome back.', 'good');
  };

  function intro(){
    ui.modal({
      title:'DAY ONE',
      body:'<p>You are twenty-four years old and you live in your parents\' basement.</p>' +
           '<p>You have <b>' + HS.money(G.S.cash) + '</b>, a suit that does not fit, and a conviction — ' +
           'entirely unsupported by evidence — that you are going to own this city.</p>' +
           '<p class="dim">Ladder &amp; Co. is hiring. It is marked on your map. Walk there and ask for a job.</p>',
      actions:[{ label:'Get up', onClick:()=>{ ui.closeModal(); HS.Audio.enter(); } }]
    });
  }

  function placeAtHome(snap){
    const lm = homeLandmark();
    player.setPos(lm.x, lm.z + 8);
    player.setOutfit(HS.rankOf(G.S).outfit);
    if(snap) world.update(0, G.S.hour, player.x, player.z, true);
  }
  function homeLandmark(){
    const id = HS.HOUSING[G.S.housing].landmark;
    return city.landmarks.find(l => l.id === id);
  }

  /* ================= landmark visibility ================= */
  G.isLandmarkActive = function(id){
    const S = G.S;
    if(id.startsWith('home_')) return HS.HOUSING[S.housing].landmark === id;
    if(id === 'firm') return !!S.path;
    if(id === 'sec') return S.heat >= 25;
    if(id === 'gym' || id === 'store') return true;
    return true;
  };
  G.landmarkColor = function(id){
    const lm = city.landmarks.find(l => l.id === id);
    return lm ? '#' + lm.accent.toString(16).padStart(6,'0') : '#fff';
  };
  function refreshLandmarks(){
    city.landmarks.forEach(lm => world.setLandmarkVisible(lm.id, G.isLandmarkActive(lm.id)));
  }
  G.refreshLandmarks = refreshLandmarks;

  /* ================= loop ================= */
  function frame(now){
    requestAnimationFrame(frame);
    const dt = Math.min(0.06, (now - lastT) / 1000);
    lastT = now;

    const S = G.S;
    const free = started && !paused && !ui.isPanelOpen() && !ui.isModalOpen() && !menuOpen();

    player.update(dt, input, free);

    if(free){
      // clock
      S.hour += dt * HS.MINUTES_PER_SECOND / 60;
      while(S.hour >= 24){ S.hour -= 24; rollDay(); }

      // walking is free — energy is spent on actions, not on getting there
      if(player.moving){
        walkSfx -= dt;
        if(walkSfx <= 0){ HS.Audio.step(); walkSfx = player.sprinting ? 0.26 : 0.38; }
      }
      checkCollapse();
      ui.syncHud();
    }

    // after a couple of seconds, decide whether this machine can carry shadows
    if(!perfChecked && started){
      perfFrames++; perfTime += dt;
      if(perfTime > 2.5){
        perfChecked = true;
        const avg = perfTime / perfFrames;
        if(avg > 0.030){
          world.setLowQuality();
          ui.toast('Shadows off — keeping the frame rate up.', '');
        }
      }
    }

    world.update(dt, S.hour, player.x, player.z, false);
    world.render();
    ui.drawMinimap(city, player.x, player.z, player.angle, dt);
    updateProximity();
  }

  function updateProximity(){
    let best = null, bestD = 1e9;
    for(const lm of city.landmarks){
      if(!G.isLandmarkActive(lm.id)) continue;
      const d = Math.hypot(player.x - lm.x, player.z - lm.z);
      if(d < 7.5 && d < bestD){ best = lm; bestD = d; }
    }
    if(best !== nearest){
      nearest = best;
      ui.setPrompt(best);
    }
  }

  function tryEnter(){
    if(!nearest || paused || ui.isPanelOpen() || ui.isModalOpen() || menuOpen()) return;
    HS.Audio.enter();
    G.openPanelFor(nearest.id);
  }

  G.openPanelFor = function(id){
    const f = locs[id];
    if(!f) return;
    const p = f();
    ui.openPanel(p);
  };

  /* ================= keys ================= */
  function handleKey(k, e){
    if(k === 'escape'){
      if(ui.isModalOpen()) return true;
      if($('help').classList.contains('show')){ $('help').classList.remove('show'); return true; }
      if(ui.isPanelOpen()){ HS.Audio.exit(); ui.closePanel(); return true; }
      togglePause(); return true;
    }
    if(!started) return false;
    if(ui.isModalOpen()) return false;
    if(k === 'e' || k === 'enter'){
      if(ui.isPanelOpen()){ ui.closePanel(); return true; }
      tryEnter(); return true;
    }
    if(k === 'm'){
      HS.Audio.init(); HS.Audio.setOn(!HS.Audio.on);
      $('btnSound').classList.toggle('off', !HS.Audio.on);
      return true;
    }
    if(k === 'h'){ $('help').classList.toggle('show'); return true; }
    if(k === '['){ world.setZoom(world.getZoom() * 1.12); return true; }
    if(k === ']'){ world.setZoom(world.getZoom() / 1.12); return true; }
    return false;
  }

  function menuOpen(){ return $('menu').classList.contains('show'); }
  function togglePause(){
    if(!started) return;
    if(menuOpen()) closeMenu();
    else {
      $('menu').classList.add('show');
      $('menuStats').innerHTML = statLines();
      paused = true;
    }
  }
  function closeMenu(){ $('menu').classList.remove('show'); paused = false; }
  G.setPaused = v => { paused = v; };

  /* The career screen: where you are, what is next, what is still locked. */
  function showCareer(){
    const S = G.S;
    const r = HS.rankOf(S);
    const nr = S.rank >= 6 && S.path
      ? (HS.PATHS[S.path].ranks.find(x => x.i === S.rank + 1) || null)
      : HS.nextRank(S);

    let html = '<div class="career-now"><span class="k">CURRENT</span>' +
               '<b>' + r.name + '</b></div>';

    if(S.rank === 5 && !S.path){
      html += '<p class="dim">The ladder ends here. Go to the Exchange and choose a path.</p>';
    } else if(nr){
      html += '<div class="career-next"><span class="k">NEXT — ' + nr.name + '</span>' +
        HS.needText(S, nr.need).map(n =>
          '<div class="req ' + (n.ok ? 'ok' : '') + '"><span>' + n.label + '</span>' +
          '<b>' + n.text + '</b></div>').join('') +
        '</div>';
    } else {
      html += '<p class="dim">There is nothing above this.</p>';
    }

    const rows = HS.UNLOCKS.map(u => {
      const have = u.by === 'rank' ? S.rank >= u.at : S.skill >= u.at;
      const gate = u.by === 'rank'
        ? (HS.RANKS[u.at] ? HS.RANKS[u.at].name : 'Rank ' + u.at)
        : 'Skill ' + u.at;
      return '<div class="unlock ' + (have ? 'have' : '') + '">' +
        '<span class="tick">' + (have ? '✓' : '·') + '</span>' +
        '<span class="un"><b>' + u.name + '</b><em>' + u.note + '</em></span>' +
        '<span class="gate">' + (have ? 'open' : gate) + '</span></div>';
    }).join('');
    html += '<div class="career-unlocks"><span class="k">UNLOCKS</span>' + rows + '</div>';

    if(S.path){
      const p = HS.PATHS[S.path];
      html += '<div class="career-path" style="border-color:' + p.accent + '">' +
        '<b style="color:' + p.accent + '">' + p.name + '</b><span>' + p.blurb + '</span></div>';
    }

    ui.modal({ title:'CAREER', body: html,
      actions:[{ label:'Back', onClick:()=>ui.closeModal() }] });
  }

  function statLines(){
    const S = G.S;
    const r = HS.rankOf(S);
    return [
      ['Rank', r.name],
      ['Path', S.path ? HS.PATHS[S.path].name : 'undecided'],
      ['Net worth', HS.money(HS.netWorth(S))],
      ['Days survived', S.stats.daysPlayed],
      ['Sessions traded', S.stats.trades],
      ['Best day', HS.money(S.stats.bestDay)]
    ].map(r => '<div class="mrow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  }

  /* ================= time & day ================= */
  G.spendTime = function(hours){
    const S = G.S;
    S.hour += hours;
    while(S.hour >= 24){ S.hour -= 24; rollDay(); }
    ui.syncHud();
  };

  function rollDay(){
    const ev = [];
    HS.rollDay(G.S, ev);
    ev.forEach(e => ui.toast(e.text, e.kind === 'bad' || e.kind === 'bill' ? 'bad' : 'good'));
    refreshLandmarks();
    checkFail();
    maybeInvestigation();
  }

  function checkCollapse(){
    const S = G.S;
    if(collapsing) return;
    const tooLate = S.hour >= 3 && S.hour < 6.5;
    if(S.energy <= 0 || tooLate){
      collapsing = true;
      const loss = Math.min(S.cash > 0 ? Math.floor(S.cash * 0.08) : 0, 20000);
      S.cash -= loss;
      HS.Audio.fail();
      ui.modal({
        title: S.energy <= 0 ? 'YOU BLACK OUT' : 'THE NIGHT WINS',
        tone:'bad',
        body:'<p>' + (S.energy <= 0
            ? 'Somewhere between the desk and the door, your body files its own resignation.'
            : 'You are still on the street at three in the morning. The street notices.') + '</p>' +
          (loss > 0 ? '<p>You wake up at home, lighter by <b>' + HS.money(loss) + '</b>.</p>'
                    : '<p>You wake up at home. There was nothing left to take.</p>'),
        actions:[{ label:'Get up', onClick:()=>{
          ui.closeModal();
          doSleep(S.maxEnergy * 0.5);
          collapsing = false;
        }}]
      });
    }
  }

  /* ================= actions ================= */
  G.sleep = function(){ doSleep(HS.HOUSING[G.S.housing].sleepPct * G.S.maxEnergy); };

  function doSleep(energyTo){
    const S = G.S;
    HS.Audio.sleep();
    // advance to 7am the next morning
    if(S.hour >= 7) { S.hour = 7; rollDay(); }
    else { S.hour = 7; }
    S.energy = HS.clamp(Math.max(S.energy, energyTo), 0, S.maxEnergy);
    placeAtHome(true);
    HS.save(S);
    ui.syncHud();
    ui.toast('Day ' + S.day + '. ' + HS.dayName(S.day) + ', 7:00.', '');
    checkFail();
  }

  /* A trading session always ends at the close. */
  function toTheBell(){
    const S = G.S;
    S.hour = HS.MARKET_CLOSE + 0.25;
    ui.syncHud();
  }

  G.trainGym = function(cost){
    const S = G.S;
    S.cash -= cost;
    G.spendTime(1.5);
    HS.addEnergy(S, -HS.ENERGY.gym);
    S.maxEnergy = HS.clamp(S.maxEnergy + 4, 0, HS.MAX_ENERGY_CAP);
    S.gymToday = true;
    HS.Audio.levelUp();
    ui.toast('Stamina up to ' + Math.round(S.maxEnergy) + '.', 'good');
    ui.syncHud(); HS.save(S);
  };

  G.buyDrink = function(drink, price){
    const S = G.S;
    S.cash -= price;
    S.drinksToday++;
    G.spendTime(0.25);
    HS.addEnergy(S, drink.energy);
    HS.Audio.cash();
    ui.toast('+' + drink.energy + ' energy. The next one costs more.', 'good');
    ui.syncHud(); HS.save(S);
  };

  /* Chart review: a crossover read on tomorrow's tape. What it TELLS you is
     only right `confidence` percent of the time — the truth is stored apart. */
  G.chartReview = function(){
    const S = G.S;
    G.spendTime(1);
    HS.addEnergy(S, -HS.ENERGY.review);
    S.reviewedToday = true;

    const confidence = Math.round(HS.clamp(50 + S.skill * 0.45, 50, 95));
    const truth = Math.random() < 0.5 ? 1 : -1;
    const right = Math.random() * 100 < confidence;
    const shown = right ? truth : -truth;
    S.edge = { day: S.day, dir: truth, shown, confidence };

    HS.Audio.levelUp();
    ui.modal({
      title: shown > 0 ? 'GOLDEN CROSS' : 'DEATH CROSS',
      tone: shown > 0 ? 'good' : 'bad',
      body: crossSvg(shown) +
        '<p>The fifty-day has crossed ' + (shown > 0 ? 'up through' : 'down through') +
        ' the two-hundred. On this read the tape opens ' +
        (shown > 0 ? '<b class="up">bid</b>' : '<b class="down">offered</b>') + '.</p>' +
        '<p class="dim">Your read is <b>' + confidence + '%</b> reliable at skill ' +
        Math.round(S.skill) + '. Study more and it sharpens.</p>',
      actions:[{ label:'Noted', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  /* A little moving-average crossover picture for the review modal. */
  function crossSvg(dir){
    const W = 460, H = 130, N = 70;
    const px = [];
    let p = 50;
    for(let i = 0; i < N; i++){
      const drift = i < N*0.45 ? -dir*0.22 : dir*0.55;
      p += drift + (Math.random()-0.5)*1.7;
      px.push(p);
    }
    const ma = n => px.map((_, i) => {
      const a = Math.max(0, i-n+1);
      const w = px.slice(a, i+1);
      return w.reduce((s,v)=>s+v,0)/w.length;
    });
    const fast = ma(6), slow = ma(18);
    const all = px.concat(fast, slow);
    const lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    const X = i => 6 + i/(N-1)*(W-12);
    const Y = v => H-10 - (v-lo)/Math.max(0.001,(hi-lo))*(H-22);
    const path = arr => arr.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');

    let cross = Math.floor(N*0.5);
    for(let i = 1; i < N; i++){
      if((fast[i-1]-slow[i-1]) * (fast[i]-slow[i]) < 0) cross = i;
    }
    const col = dir > 0 ? '#3FD68C' : '#FF5B67';
    return '<svg class="cross" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<path d="' + path(px) + '" fill="none" stroke="rgba(233,237,243,.22)" stroke-width="1.4"/>' +
      '<path d="' + path(slow) + '" fill="none" stroke="#8993A5" stroke-width="2"/>' +
      '<path d="' + path(fast) + '" fill="none" stroke="' + col + '" stroke-width="2.4"/>' +
      '<circle cx="' + X(cross).toFixed(1) + '" cy="' + Y(fast[cross]).toFixed(1) +
        '" r="6" fill="none" stroke="' + col + '" stroke-width="2"/>' +
      '</svg>';
  }

  G.promoteTo = function(rank, customText){
    const S = G.S;
    S.rank = rank;
    const r = HS.rankOf(S);
    player.setOutfit(r.outfit);
    HS.Audio.levelUp();
    refreshLandmarks();
    ui.modal({
      title:'PROMOTED — ' + r.name.toUpperCase(),
      tone:'good',
      body:'<p>' + (customText || promoText(rank)) + '</p>' +
           (r.salary ? '<p class="dim">Day rate is now <b>' + HS.money(r.salary) + '</b>.</p>' : ''),
      actions:[{ label:'Good', onClick:()=>{ ui.closeModal(); ui.syncHud(); } }]
    });
    HS.save(S);
    checkEnding();
  };
  function promoText(rank){
    return ({
      2:'They move you off the phones and give you a screen. Small size, real money.',
      3:'Your own book, your own clients, your own name on the ticket.',
      4:'The juniors ask you questions now, and you know most of the answers.',
      5:'A corner of the floor and a title with the word "President" in it.',
      6:'The next tier opens. Very few people stand where you are standing.',
      7:'Your name moves markets in a small way. Soon, in a large one.',
      8:'There is nothing above this.'
    })[rank] || 'You move up.';
  }

  /* ---- brokerage session ---- */
  G.finishWorkSession = function(res, desk){
    const S = G.S;
    S.workedToday = true;
    S.stats.trades++;
    toTheBell();
    HS.addEnergy(S, -HS.ENERGY.work);

    const salary = HS.rankOf(S).salary;
    const commission = res.pnl > 0 ? res.pnl * desk.commission : 0;
    S.cash += salary + commission;
    if(res.pnl > S.stats.bestDay) S.stats.bestDay = res.pnl;

    let repDelta = 0;
    if(res.hitTarget) repDelta = 3.2 + S.rank * 0.3;
    else if(res.pnl > 0) repDelta = 1.1;
    else if(res.busted) repDelta = -4.5;
    else repDelta = -1.6;
    HS.addRep(S, repDelta);
    HS.addSkill(S, res.pnl > 0 ? 0.55 : 0.3);

    HS.Audio[res.pnl >= 0 ? 'cash' : 'loss']();
    ui.modal({
      title: res.hitTarget ? 'DESK TARGET CLEARED' : res.busted ? 'STOPPED OUT' : res.pnl >= 0 ? 'SESSION CLOSED' : 'DOWN DAY',
      tone: res.pnl >= 0 ? 'good' : 'bad',
      body: tallies([
        ['Book P&L', HS.signed(res.pnl)],
        ['Your commission', HS.money(commission)],
        ['Day rate', HS.money(salary)],
        ['Reputation', (repDelta>=0?'+':'') + repDelta.toFixed(1)],
        ['Take home', HS.money(salary + commission)]
      ]),
      actions:[{ label:'Clock off', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
    checkFail();
  };

  /* ---- own-risk session ---- */
  G.finishPropSession = function(res, stake, isLegend){
    const S = G.S;
    S.stats.trades++;
    toTheBell();
    HS.addEnergy(S, -HS.ENERGY.prop);
    S.cash += res.pnl;
    if(res.pnl > S.stats.bestDay) S.stats.bestDay = res.pnl;
    HS.addSkill(S, res.pnl > 0 ? 0.8 : 0.5);
    HS.addRep(S, res.hitTarget ? 2.4 : res.pnl > 0 ? 0.9 : -1.2);
    if(S.tips > 0 && res.pnl > 0){ S.tips--; HS.addHeat(S, 6); }

    HS.Audio[res.pnl >= 0 ? 'cash' : 'loss']();
    ui.modal({
      title: res.busted ? 'BLOWN UP' : res.pnl >= 0 ? 'GOOD SESSION' : 'BAD SESSION',
      tone: res.pnl >= 0 ? 'good' : 'bad',
      body: tallies([
        ['Stake', HS.money(stake)],
        ['P&L', HS.signed(res.pnl)],
        ['Return', HS.pct(res.returnPct)],
        ['Cash now', HS.money(S.cash)]
      ]),
      actions:[{ label:'Done', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
    checkFail();
  };

  G.finishFundSession = function(res){
    const S = G.S;
    S.stats.trades++;
    toTheBell();
    HS.addEnergy(S, -HS.ENERGY.fund);
    S.aum = Math.max(0, S.aum + res.pnl);
    S.cash += res.pnl > 0 ? res.pnl * 0.2 : 0;
    if(S.tips > 0){ S.tips--; HS.addHeat(S, 10); }
    HS.addSkill(S, 0.6);
    HS.Audio[res.pnl >= 0 ? 'cash' : 'loss']();
    ui.modal({
      title: res.pnl >= 0 ? 'THE FUND PRINTS' : 'THE FUND BLEEDS',
      tone: res.pnl >= 0 ? 'good' : 'bad',
      body: tallies([
        ['Fund P&L', HS.signed(res.pnl)],
        ['Your 20%', HS.money(res.pnl > 0 ? res.pnl*0.2 : 0)],
        ['AUM now', HS.money(S.aum)],
        ['Heat', Math.round(S.heat) + ' / 100']
      ]),
      actions:[{ label:'Done', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); checkEnding(); } }]
    });
    checkFail();
  };

  /* ---- bar ---- */
  G.network = function(cost){
    const S = G.S;
    S.cash -= cost; S.networkedToday = true;
    G.spendTime(2);
    HS.addEnergy(S, -HS.ENERGY.network);
    const gain = 2.2 + Math.random() * 2.6 + S.rank * 0.25;
    HS.addRep(S, gain);
    let extra = '';
    if(Math.random() < 0.35){ S.contacts++; extra = ' You leave with a name worth having.'; }
    HS.Audio.cash();
    ui.toast('Reputation +' + gain.toFixed(1) + '.' + extra, 'good');
    ui.syncHud(); HS.save(S);
  };
  G.buyRound = function(cost){
    const S = G.S;
    S.cash -= cost;
    G.spendTime(2);
    HS.addEnergy(S, -HS.ENERGY.round);
    const gain = 7 + Math.random() * 5 + S.rank * 0.4;
    HS.addRep(S, gain);
    S.contacts++;
    HS.Audio.cash();
    ui.toast('The floor remembers. Reputation +' + gain.toFixed(1) + '.', 'good');
    ui.syncHud(); HS.save(S);
  };
  G.callFavour = function(){
    const S = G.S;
    S.contacts--;
    S.tips++;
    G.spendTime(1);
    HS.addEnergy(S, -HS.ENERGY.favour);
    HS.Audio.cash();
    ui.toast('A friend owes you one. You have a tip, and no heat.', 'good');
    ui.syncHud(); HS.save(S);
  };

  G.buyTip = function(){
    const S = G.S;
    G.spendTime(2);
    HS.addEnergy(S, -HS.ENERGY.tip);
    S.tips++;
    HS.addHeat(S, 12);
    HS.Audio.warn();
    ui.toast('You have a tip. Heat +12.', 'bad');
    ui.syncHud(); HS.save(S);
    refreshLandmarks();
  };

  /* ---- school ---- */
  G.study = function(c){
    const S = G.S;
    S.cash -= c.cash;
    G.spendTime(c.hours);
    HS.addEnergy(S, -c.energy);
    HS.addSkill(S, c.skill);
    S.studiedToday = true;
    HS.Audio.levelUp();
    ui.toast('Skill +' + c.skill + '.', 'good');
    ui.syncHud(); HS.save(S);
  };

  /* ---- realtor ---- */
  G.moveHouse = function(){
    const S = G.S;
    const next = HS.HOUSING[S.housing + 1];
    S.cash -= next.price;
    S.housing++;
    refreshLandmarks();
    HS.Audio.levelUp();
    ui.modal({
      title:'YOU MOVE IN',
      tone:'good',
      body:'<p><b>' + next.name + '</b></p><p>' + next.desc + '</p>' +
           '<p class="dim">Rent is now ' + HS.money(next.rent) + ' a week. Your home marker has moved — walk over when you want to sleep.</p>',
      actions:[{ label:'Good', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  /* ---- SEC ---- */
  G.lawyerUp = function(fee){
    const S = G.S;
    S.cash -= fee;
    HS.addHeat(S, -25);
    G.spendTime(2);
    ui.toast('Heat -25.', 'good');
    refreshLandmarks(); ui.syncHud(); HS.save(S);
  };
  G.cooperate = function(){
    const S = G.S;
    HS.addHeat(S, -45);
    HS.addRep(S, -12);
    G.spendTime(3);
    ui.toast('Heat -45, reputation -12.', '');
    refreshLandmarks(); ui.syncHud(); HS.save(S);
  };

  function maybeInvestigation(){
    const S = G.S;
    if(S.heat < 55) return;
    if(Math.random() > (S.heat - 50) / 120) return;
    const fine = Math.floor(S.cash * 0.18) + 20000;
    S.cash -= fine;
    HS.addHeat(S, 8);
    HS.Audio.alarm();
    ui.modal({
      title:'THEY CAME TO THE OFFICE',
      tone:'bad',
      body:'<p>Two investigators, one box of your files, and a fine of <b>' + HS.money(fine) + '</b>.</p>' +
           '<p class="dim">Heat is now ' + Math.round(S.heat) + '. At 100 they stop sending letters.</p>',
      actions:[{ label:'Say nothing', onClick:()=>{ ui.closeModal(); ui.syncHud(); } }]
    });
  }

  /* ---- boss path ---- */
  G.hireBroker = function(cost){
    const S = G.S;
    S.cash -= cost;
    S.brokers.push({
      name: brokerName(),
      skill: 18 + Math.random() * 34 + S.rep * 0.2,
      morale: 70 + Math.random() * 20,
      salary: 400 + Math.random() * 500
    });
    HS.Audio.cash();
    ui.toast('Hired. The floor is ' + S.brokers.length + ' strong.', 'good');
    ui.syncHud(); HS.save(S); checkEnding();
    G.openPanelFor('firm');
  };
  G.trainFloor = function(cost){
    const S = G.S;
    S.cash -= cost;
    G.spendTime(4);
    S.brokers.forEach(b => { b.skill = HS.clamp(b.skill + 4, 0, 100); b.morale = HS.clamp(b.morale + 10, 0, 100); });
    HS.Audio.levelUp();
    ui.toast('The floor is sharper.', 'good');
    ui.syncHud(); HS.save(S);
    G.openPanelFor('firm');
  };
  G.squeezeFloor = function(){
    const S = G.S;
    S.flags.squeezed = true;
    S.brokers.forEach(b => { b.morale = HS.clamp(b.morale - 25, 0, 100); });
    const quit = S.brokers.filter(b => b.morale < 22);
    S.brokers = S.brokers.filter(b => b.morale >= 22);
    HS.addRep(S, -4);
    HS.addHeat(S, 5);
    HS.Audio.warn();
    ui.toast(quit.length ? quit.length + ' broker(s) walked out.' : 'They will do the hours. They will not forget.', 'bad');
    ui.syncHud(); HS.save(S);
    G.openPanelFor('firm');
  };
  function brokerName(){
    const f = ['Dev','Marco','Tasha','Ruth','Kyle','Nina','Owen','Priya','Sal','Wes','Bea','Cal'];
    const l = ['Ortiz','Kaminski','Boyd','Nakamura','Farrell','Adeyemi','Vance','Reilly','Sokolov','Chen'];
    return f[Math.floor(Math.random()*f.length)] + ' ' + l[Math.floor(Math.random()*l.length)];
  }

  /* ---- villain path ---- */
  G.raiseCapital = function(amount){
    const S = G.S;
    G.spendTime(3);
    HS.addEnergy(S, -HS.ENERGY.raise);
    const got = Math.floor(amount * (0.6 + S.rep/100 * 0.8));
    S.aum += got;
    S.investors += 1 + Math.floor(Math.random()*3);
    HS.Audio.cash();
    ui.toast('Raised ' + HS.money(got) + '. AUM ' + HS.money(S.aum) + '.', 'good');
    ui.syncHud(); HS.save(S); checkEnding();
    G.openPanelFor('firm');
  };
  G.frontRun = function(){
    const S = G.S;
    const take = Math.floor(S.aum * (0.01 + Math.random()*0.02));
    S.cash += take;
    HS.addHeat(S, 18);
    HS.addRep(S, -2);
    HS.Audio.warn();
    ui.toast('You take ' + HS.money(take) + ' out of your clients\' pockets. Heat +18.', 'bad');
    refreshLandmarks(); ui.syncHud(); HS.save(S);
    G.openPanelFor('firm');
  };

  /* ================= the branch ================= */
  G.offerBranch = function(){
    const opts = ['legend','boss','villain'].map(id => {
      const p = HS.PATHS[id];
      return '<button class="branch" data-path="' + id + '">' +
        '<span class="bname" style="color:' + p.accent + '">' + p.name + '</span>' +
        '<span class="bblurb">' + p.blurb + '</span></button>';
    }).join('');
    ui.modal({
      title:'THE FORK',
      body:'<p>You have gone as far as the ladder goes. Three doors, and only one of them stays open.</p>' +
           '<div class="branches">' + opts + '</div>',
      actions:[]
    });
    document.querySelectorAll('.branch').forEach(b => {
      b.addEventListener('click', () => choosePath(b.dataset.path));
    });
  };

  function choosePath(id){
    const S = G.S;
    S.path = id;
    S.rank = 6;
    const p = HS.PATHS[id];
    if(id === 'boss'){
      const cost = 300000;
      S.cash -= cost;
      S.brokers.push({ name:brokerName(), skill:34, morale:80, salary:500 });
    }
    if(id === 'villain'){
      S.aum = 2000000;
      S.investors = 3;
      HS.addHeat(S, 10);
    }
    player.setOutfit(HS.rankOf(S).outfit);
    world.setLandmarkAccent('firm', parseInt(p.accent.slice(1), 16));
    refreshLandmarks();
    HS.Audio.win();
    ui.modal({
      title: p.name.toUpperCase(),
      tone:'good',
      body:'<p>' + branchStory(id) + '</p>' +
           '<p class="dim">Your building is on the map. Everything happens there now.</p>',
      actions:[{ label:'Begin', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  }
  function branchStory(id){
    return ({
      legend:'You turn down the corner office and keep your seat on the desk. No floor to manage, no investors to charm — only the tape, every morning, for the rest of your life. They will measure the others against you.',
      boss:'You sign the lease, put your name above the door and hire your first broker. You will never take another ticket yourself. From here you take a cut of everyone who does.',
      villain:'Two hundred million of other people\'s money and a mandate that says, in careful language, that you may do almost anything with it. The city will learn your name the hard way.'
    })[id];
  }

  /* ================= endings ================= */
  function checkEnding(){
    const S = G.S;
    if(S.ended) return;
    if(!S.path || S.rank < 6) return;
    const p = HS.PATHS[S.path];
    let promoted = null;
    // climb as far as the player currently qualifies for
    for(;;){
      const nr = p.ranks.find(r => r.i === S.rank + 1);
      if(!nr || !HS.meetsNeed(S, nr.need)) break;
      S.rank = nr.i;
      promoted = nr;
      if(nr.i === 8) break;
    }
    if(!promoted) return;
    player.setOutfit(promoted.outfit);
    HS.Audio.levelUp();
    if(promoted.i === 8){ finale(); return; }
    ui.modal({
      title:'PROMOTED — ' + promoted.name.toUpperCase(),
      tone:'good',
      body:'<p>' + promoText(promoted.i) + '</p>',
      actions:[{ label:'Good', onClick:()=>{ ui.closeModal(); ui.syncHud(); } }]
    });
  }
  G.checkEnding = checkEnding;

  function finale(){
    const S = G.S;
    S.ended = S.path;
    HS.Audio.win();
    const text = ({
      legend:'They put your track record in the training manual. Twenty years of it, and not one blown-up year. You never ran a floor and you never took a client\'s money — you just read the tape better than anyone alive, every single morning, until the morning you decided not to. The kid in the basement would not believe you. That is fine. He was not supposed to.',
      boss:'Four hundred phones and every one of them makes you money. You have not entered an order yourself in eleven years. The building has your name on it in letters you can read from the river, and the only thing that still frightens you is a quiet Monday.',
      villain:'Four hundred million dollars and an entire city that would like to see you in prison. You are on the cover of two magazines, both hostile. The fund is up again this year. At the restaurant nobody looks at you, which is how you know that everybody is.'
    })[S.path];
    ui.modal({
      title: HS.PATHS[S.path].name.toUpperCase(),
      tone:'good',
      body:'<p>' + text + '</p>' +
        tallies([
          ['Days', S.stats.daysPlayed],
          ['Net worth', HS.money(HS.netWorth(S))],
          ['Sessions traded', S.stats.trades],
          ['Best single day', HS.money(S.stats.bestDay)],
          ['Final heat', Math.round(S.heat)]
        ]),
      actions:[{ label:'New life', onClick:()=>{ ui.closeModal(); location.reload(); } }]
    });
    HS.save(S);
  }

  function checkFail(){
    const S = G.S;
    if(S.ended) return;
    if(S.heat >= 100){
      S.ended = 'prison';
      HS.Audio.fail();
      ui.modal({
        title:'INDICTED', tone:'bad',
        body:'<p>They had the tapes the whole time. Eleven counts, and your own analysts testifying in exchange for nothing at all.</p>' +
             '<p class="dim">You will be forty-nine when you get out. Somebody else has the corner office.</p>' +
             tallies([['Days', S.stats.daysPlayed],['Net worth at arrest', HS.money(HS.netWorth(S))]]),
        actions:[{ label:'Start again', onClick:()=>location.reload() }]
      });
      return;
    }
    if(S.cash < -60000 && S.cash - S.loan < -60000){
      S.ended = 'broke';
      HS.Audio.fail();
      ui.modal({
        title:'WIPED OUT', tone:'bad',
        body:'<p>The bank calls the loan. There is nothing to call it against.</p>' +
             '<p class="dim">Your mother makes up the bed in the basement without saying anything about it, which is worse.</p>' +
             tallies([['Days', S.stats.daysPlayed],['Owed', HS.money(S.loan)]]),
        actions:[{ label:'Start again', onClick:()=>location.reload() }]
      });
    }
  }

  function tallies(rows){
    return '<div class="tallies">' + rows.map(r =>
      '<div class="tally"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'
    ).join('') + '</div>';
  }

  /* ================= objective ================= */
  /* Which building the current objective sends you to. Highlighted on the map. */
  G.objectiveTarget = function(){
    const S = G.S;
    if(S.ended) return null;
    if(S.energy < 22) return S.cash > 400 ? 'store' : HS.HOUSING[S.housing].landmark;
    if(S.rank === 0) return 'brokerage';
    if(S.rank === 5 && !S.path) return 'exchange';

    const nr = S.rank >= 6 && S.path
      ? (HS.PATHS[S.path].ranks.find(r => r.i === S.rank + 1) || null)
      : HS.nextRank(S);
    if(!nr || !nr.need) return S.rank >= 6 ? 'firm' : 'brokerage';

    // send the player at whichever requirement they are furthest from
    const gaps = [];
    if(nr.need.skill != null)   gaps.push([ (nr.need.skill - S.skill) / nr.need.skill, 'school' ]);
    if(nr.need.rep != null)     gaps.push([ (nr.need.rep - S.rep) / nr.need.rep, 'bar' ]);
    if(nr.need.cash != null)    gaps.push([ (nr.need.cash - S.cash) / nr.need.cash,
                                            S.rank >= 6 ? 'firm' : 'brokerage' ]);
    if(nr.need.brokers != null) gaps.push([ (nr.need.brokers - S.brokers.length) / nr.need.brokers, 'firm' ]);
    if(nr.need.aum != null)     gaps.push([ (nr.need.aum - S.aum) / nr.need.aum, 'firm' ]);

    gaps.sort((a,b) => b[0] - a[0]);
    if(!gaps.length || gaps[0][0] <= 0) return S.rank >= 6 ? 'firm' : 'brokerage';
    return gaps[0][1];
  };

  G.objectiveText = function(){
    const S = G.S;
    if(S.ended) return 'The story is over.';
    if(S.energy < 15) return 'You are exhausted — go home and sleep.';
    if(S.rank === 0) return 'Walk to Ladder & Co. and ask for a job.';
    if(S.rank === 5 && !S.path) return 'Go to the Exchange and choose what you become.';
    if(S.rank >= 6 && S.path){
      const p = HS.PATHS[S.path];
      const nr = p.ranks.find(r => r.i === S.rank + 1);
      if(!nr) return 'You have arrived.';
      const miss = HS.needText(S, nr.need).filter(n => !n.ok);
      return miss.length ? 'Toward ' + nr.name + ': ' + miss.map(m => m.label + ' ' + m.text).join(', ')
                         : 'Requirements met for ' + nr.name + '.';
    }
    const nr = HS.nextRank(S);
    if(!nr) return 'Keep working.';
    const miss = HS.needText(S, nr.need).filter(n => !n.ok);
    return miss.length ? 'Toward ' + nr.name + ': ' + miss.map(m => m.label + ' ' + m.text).join(', ')
                       : 'You qualify for ' + nr.name + ' — ask at Ladder & Co.';
  };

  return G;
};

})(window.HS);
