/* MARKET MAKER - main controller: loop, interaction, consequences, endings. */
window.HS = window.HS || {};
(function(HS){
'use strict';
const $ = HS.$;

/* The scripted opening. Each step names what to do and where. */
const TUTORIAL = [
  { key:'goto_work',  target:'brokerage', text:'Walk to Ladder & Co. and ask for the internship.' },
  { key:'session1',   target:'brokerage', text:'Trade your first session. Buy one cheap call and see what happens.' },
  { key:'sleep1',     target:'home',      text:'Go home and sleep. Turn in before 21:30 to wake refreshed.' },
  { key:'review',     target:'brokerage', text:'Day two. Do a chart review before the open. It tells you which way the tape leans.' },
  { key:'session2',   target:'brokerage', text:'Trade the session with your read.' },
  { key:'study',      target:'school',    text:'Take an evening seminar. Skill is what lets you see the tape.' },
  { key:'sleep2',     target:'home',      text:'Sleep. Early, if you can.' },
  { key:'session3',   target:'brokerage', text:'Day three. Trade the session.' },
  { key:'bar',        target:'bar',       text:'Work the room at The Ticker Bar. Reputation opens doors.' },
  { key:'sleep3',     target:'home',      text:'Sleep on it.' }
];

HS.Game = function(){
  const G = {};
  let world, player, input, city, ui, locs;
  let paused = true, started = false;
  let nearest = null, lastT = 0, walkSfx = 0;
  let collapsing = false;
  let perfFrames = 0, perfTime = 0, perfChecked = false;
  let roomSlot = 'bed';

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
    $('btnSaveQuit').addEventListener('click', () => { HS.save(G.S); ui.toast('Saved.', 'good'); closeMenu(); });
    $('btnHelp').addEventListener('click', () => $('help').classList.add('show'));
    $('btnCareer').addEventListener('click', () => { HS.Audio.click(); showCareer(); });
    $('btnPerksMenu').addEventListener('click', () => { HS.Audio.click(); closeMenu(); G.openPerks(); });
    $('helpClose').addEventListener('click', () => $('help').classList.remove('show'));
    $('interactBtn').addEventListener('click', () => tryEnter());
    $('roomClose').addEventListener('click', () => { HS.Audio.exit(); $('room').classList.remove('show'); });
    $('perksClose').addEventListener('click', () => { HS.Audio.exit(); $('perks').classList.remove('show'); });
    $('mapClose').addEventListener('click', () => { HS.Audio.exit(); $('bigmap').classList.remove('show'); });
  }

  /* ================= start / load ================= */
  G.startNew = function(){
    G.S = HS.newState();
    G.S.market = HS.newMarket();
    HS.syncPerkPoints(G.S);
    HS.clearSave();
    started = true; paused = false;
    refreshLandmarks(); placeAtHome(true); ui.syncHud();
    intro();
  };
  G.startLoaded = function(S){
    G.S = S;
    if(!S.market) S.market = HS.newMarket();
    if(!S.positions) S.positions = [];
    HS.syncPerkPoints(S);
    started = true; paused = false;
    refreshLandmarks(); placeAtHome(true); ui.syncHud();
    ui.toast('Welcome back.', 'good');
  };

  function intro(){
    ui.modal({
      title:'MONDAY, 8:00',
      body:'<p>The basement smells of damp and your father is already awake upstairs.</p>' +
           '<p>You have <b>' + HS.money(G.S.cash) + '</b>, a suit that does not fit, and one week of ' +
           'unpaid-adjacent work experience lined up at a brokerage called Ladder &amp; Co.</p>' +
           '<p class="dim">Five days to prove you belong on a screen. What happens after that is up to you.</p>',
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
    return city.landmarks.find(l => l.id === HS.HOUSING[G.S.housing].landmark);
  }

  /* ================= landmarks ================= */
  G.isLandmarkActive = function(id){
    const S = G.S;
    if(id.startsWith('home_')) return HS.HOUSING[S.housing].landmark === id;
    /* The vacant floor shows up the moment building on it is imaginable. */
    if(id === 'firm') return S.path === 'fund' || !!S.flags.kadeSeen ||
                             (S.path === 'solo' && S.rank >= 3);
    if(id === 'sec') return S.heat >= 20;
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
    const free = started && !paused && !ui.isPanelOpen() && !ui.isModalOpen() &&
                 !menuOpen() && !overlayOpen();

    player.update(dt, input, free);

    if(free){
      S.hour += dt * HS.MINUTES_PER_SECOND / 60;
      while(S.hour >= 24){ S.hour -= 24; rollDay(); }
      if(player.moving){
        walkSfx -= dt;
        if(walkSfx <= 0){ HS.Audio.step(); walkSfx = player.sprinting ? 0.26 : 0.38; }
      }
      checkCollapse();
      ui.syncHud();
    }

    if(!perfChecked && started){
      perfFrames++; perfTime += dt;
      if(perfTime > 2.5){
        perfChecked = true;
        if(perfTime / perfFrames > 0.030){
          world.setLowQuality();
          ui.toast('Shadows off, keeping the frame rate up.', '');
        }
      }
    }
    world.update(dt, S.hour, player.x, player.z, false);
    world.render();
    ui.drawMinimap(city, player.x, player.z, player.angle, dt);
    updateProximity();
  }

  function overlayOpen(){
    return $('room').classList.contains('show') || $('perks').classList.contains('show') ||
           $('bigmap').classList.contains('show') || $('help').classList.contains('show');
  }

  function updateProximity(){
    let best = null, bestD = 1e9;
    for(const lm of city.landmarks){
      if(!G.isLandmarkActive(lm.id)) continue;
      const d = Math.hypot(player.x - lm.x, player.z - lm.z);
      if(d < 7.5 && d < bestD){ best = lm; bestD = d; }
    }
    if(best !== nearest){ nearest = best; ui.setPrompt(best); }
  }

  function tryEnter(){
    if(!nearest || paused || ui.isPanelOpen() || ui.isModalOpen() || menuOpen() || overlayOpen()) return;
    HS.Audio.enter();
    if(nearest.id === 'bar' && G.S.flags.kadePending){ kadeEncounter(); return; }
    G.openPanelFor(nearest.id);
  }
  G.openPanelFor = function(id){
    const f = locs[id];
    if(f) ui.openPanel(f());
  };

  /* ================= keys ================= */
  function handleKey(k, e){
    if(k === 'escape'){
      if(ui.isModalOpen()) return true;
      if(overlayOpen()){
        ['room','perks','bigmap','help'].forEach(id => $(id).classList.remove('show'));
        return true;
      }
      if(ui.isPanelOpen()){ HS.Audio.exit(); ui.closePanel(); return true; }
      togglePause(); return true;
    }
    if(!started || ui.isModalOpen()) return false;
    if(k === 'tab'){ toggleBigMap(); return true; }
    if(k === 'e' || k === 'enter'){
      if(ui.isPanelOpen()){ ui.closePanel(); return true; }
      tryEnter(); return true;
    }
    if(k === 'p'){ G.openPerks(); return true; }
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
    else { $('menu').classList.add('show'); $('menuStats').innerHTML = statLines(); paused = true; }
  }
  function closeMenu(){ $('menu').classList.remove('show'); paused = false; }
  G.setPaused = v => { paused = v; };

  function statLines(){
    const S = G.S;
    return [
      ['Rank', HS.rankOf(S).name],
      ['Path', S.path ? HS.PATHS[S.path].name : 'intern'],
      ['Week', HS.weekOf(S.day)],
      ['Net worth', HS.money(HS.netWorth(S))],
      ['Open contracts', S.positions.length],
      ['Perk points', S.perkPoints]
    ].map(r => '<div class="mrow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  }

  /* ================= time ================= */
  G.spendTime = function(hours){
    const S = G.S;
    S.hour += hours;
    while(S.hour >= 24){ S.hour -= 24; rollDay(); }
    ui.syncHud();
  };
  function toTheBell(){ G.S.hour = HS.MARKET_CLOSE + 0.25; ui.syncHud(); }

  function rollDay(){
    const ev = [];
    HS.rollDay(G.S, ev);
    ev.forEach(e => ui.toast(e.text, e.kind === 'good' ? 'good' : 'bad'));
    refreshLandmarks();
    if(HS.kadeReady(G.S)) G.S.flags.kadePending = true;
    checkFail();
  }

  function checkCollapse(){
    const S = G.S;
    if(collapsing) return;
    if(S.energy <= 0 || (S.hour >= 3 && S.hour < 6.5)){
      collapsing = true;
      const loss = Math.min(S.cash > 0 ? Math.floor(S.cash * 0.06) : 0, 20000);
      S.cash -= loss;
      HS.Audio.fail();
      ui.modal({
        title: S.energy <= 0 ? 'YOU BLACK OUT' : 'THE NIGHT WINS',
        tone:'bad',
        body:'<p>' + (S.energy <= 0
            ? 'Somewhere between the desk and the door, your body files its own resignation.'
            : 'You are still on the street at three in the morning. The street notices.') + '</p>' +
          (loss > 0 ? '<p>You wake at home, lighter by <b>' + HS.money(loss) + '</b>.</p>' : ''),
        actions:[{ label:'Get up', onClick:()=>{ ui.closeModal(); doSleep(HS.REST.poor); collapsing = false; } }]
      });
    }
  }

  /* ================= sleep ================= */
  G.sleep = function(){
    if(weekOneDecisionDue()){ offerWeekOneChoice(); return; }
    doSleep(HS.restFor(G.S.hour));
  };

  function doSleep(rest){
    const S = G.S;
    HS.Audio.sleep();
    const before = S.day;
    if(S.hour >= HS.WAKE_HOUR){ S.hour = HS.WAKE_HOUR; rollDay(); }
    else S.hour = HS.WAKE_HOUR;

    /* Cheap walls do not care what time you turned in. */
    const home = HS.HOUSING[S.housing];
    let disturbed = null;
    if(home.bad && Math.random() < home.bad && rest.id > 0){
      disturbed = HS.pick(HS.BAD_NIGHTS);
      rest = rest.id === 2 ? HS.REST.normal : HS.REST.poor;
    }
    S.rest = rest.id;
    const q = home.quality;
    const target = HS.clamp(rest.pct * q + HS.roomBonus(S,'sleep'), 0, 1.1) * S.maxEnergy;
    S.energy = HS.clamp(Math.max(S.energy, target) + HS.roomBonus(S,'morning'), 0, S.maxEnergy);
    placeAtHome(true);
    HS.save(S);
    ui.syncHud();
    const label = rest.id === 2 ? 'You wake refreshed.' : rest.id === 0 ? 'You wake ragged.' : 'You wake up.';
    ui.toast('Day ' + S.day + ', ' + HS.dayName(S.day) + '. ' + label, rest.id === 2 ? 'good' : '');
    if(disturbed) ui.toast(disturbed, 'bad');
    if(S.day > before) powerCutCheck();
    if(evictionDue()){ checkFail(); eviction(); return; }
    if(HS.yoonDue(S)){ yoonEncounter(); return; }
    if(S.day > before) tutorMaybe(['sleep1','sleep2','sleep3']);
    if(S.tutorial.step >= TUTORIAL.length && !S.tutorial.done) endTutorial();
    if(!S.path && S.day > 5) offerWeekOneChoice();
    checkFail();
  }

  /* The other half of living cheap: some mornings there is no power, and a
     session you cannot open is a day of the week gone. */
  function powerCutCheck(){
    const S = G.S;
    const home = HS.HOUSING[S.housing];
    S.blackout = false;
    if(!home.cut || HS.isWeekend(S.day) || S.ended) return;
    if(Math.random() >= home.cut) return;
    S.blackout = true;
    HS.Audio.fail();
    ui.modal({
      title:'THE POWER IS OUT', tone:'bad',
      body:'<p>' + HS.pick(HS.BLACKOUTS) + '</p>' +
           '<p class="dim">No screens, no tape, no session today. The market does not wait for you ' +
           'to sort out your electricity.</p>',
      actions:[{ label:'Nothing to be done', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  }

  /* ================= moving out ================= */
  /* Monday of week two, whichever way you went. Nobody is asking. */
  function evictionDue(){
    const S = G.S;
    return !S.flags.movedOut && S.housing === 0 && S.path &&
           HS.weekOf(S.day) >= 2 && HS.isMonday(S.day);
  }
  function eviction(){
    const S = G.S;
    S.flags.movedOut = true;
    const room = HS.HOUSING[HS.FIRST_RENTAL];
    const solo = S.path === 'solo';
    const scene = solo
      ? '<p>Your mother is at the top of the basement stairs with her arms folded, and your father ' +
        'will not come down at all. You told them you turned down the job at the brokerage to trade ' +
        'from a bedroom. They heard something else entirely.</p>' +
        '<p>The word they keep using is <b>Monday</b>. As in, by.</p>'
      : '<p>Your new boss reads your file back to you, stops at the address, and reads it again.</p>' +
        '<p>"You are a broker at this firm now. Clients ask where a man lives. Nobody at Ladder ' +
        'gives out his parents\' basement." He writes something down. "Sort it this week."</p>';

    const canAfford = S.cash >= room.deposit;
    ui.modal({
      title: solo ? 'YOUR MOTHER HAS HAD ENOUGH' : 'A WORD ABOUT YOUR ADDRESS', tone:'bad',
      body: scene +
        '<p class="pbody">The only thing you can afford is a <b>' + room.name.toLowerCase() + '</b>. ' +
        room.desc + '</p>' +
        '<div class="stats-grid">' +
          '<div class="stat"><span class="k">DEPOSIT</span><span class="v">' + HS.money(room.deposit) + '</span></div>' +
          '<div class="stat"><span class="k">RENT</span><span class="v">' + HS.money(room.rent) + '/wk</span></div>' +
          '<div class="stat"><span class="k">BAD NIGHTS</span><span class="v bad">' + Math.round(room.bad*100) + '%</span></div>' +
          '<div class="stat"><span class="k">POWER CUTS</span><span class="v bad">' + Math.round(room.cut*100) + '%</span></div>' +
        '</div>' +
        (canAfford ? '' : '<p class="pbody" style="color:var(--red)">You cannot cover the deposit, ' +
          'so it goes on the tab at ' + Math.round(S.loanRate*100) + '% a week.</p>'),
      actions:[{ label:'Pack', onClick:()=>{
        ui.closeModal();
        if(!canAfford){                       /* borrow exactly the shortfall */
          const short = room.deposit - Math.max(0, S.cash);
          S.loan += short; S.cash = Math.max(0, S.cash) + short;
        }
        G.moveHouse(HS.FIRST_RENTAL);
      }}]
    });
  }

  /* ================= the internship ================= */
  G.takeInternship = function(){
    const S = G.S;
    S.flags.hired = true;
    S.cash += 600;
    HS.Audio.levelUp();
    ui.modal({
      title:'YOU ARE AN INTERN',
      tone:'good',
      body:'<p>A headset, a spare terminal and a supervisor who will check on you twice a day.</p>' +
           '<p>They advance you <b>$600</b> against the week. Trade the training account, do not embarrass anyone, and on Friday somebody will decide what you are.</p>',
      actions:[{ label:'Sit down', onClick:()=>{ ui.closeModal(); ui.syncHud(); tutorMaybe(['goto_work']); HS.save(S); } }]
    });
  };

  /* ================= sessions ================= */
  G.finishSession = function(res){
    const S = G.S;
    S.flags.coached = true;          /* one lesson, on the first day, and no more */
    if(S.path === 'solo') S.flags.soloBriefed = true;
    S.workedToday = true;
    S.stats.sessions++;
    toTheBell();
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.work));

    const salary = HS.rankOf(S).salary;
    S.cash += salary;
    if(res.pnl > S.stats.bestDay) S.stats.bestDay = res.pnl;
    S.weekPnl = S.cash - S.weekStartCash;

    let repDelta = res.hitTarget ? 2.8 + S.rank * 0.3 : res.pnl > 0 ? 1.0 : res.busted ? -4 : -1.2;
    // Trading alone still builds a record; funders and prop desks read it.
    if(S.path === 'solo') repDelta *= 0.8;
    HS.addRep(S, repDelta);
    HS.addSkill(S, res.pnl > 0 ? 0.20 : 0.12);

    /* If you were live, the audience saw whatever just happened. */
    let streamRow = null;
    const st = S.stream;
    if(st && st.on && st.live){
      st.live = false;
      st.streamed++;
      HS.addEnergy(S, -HS.energyCost(S, HS.STREAM.liveEnergy));
      const ret = res.pnl / Math.max(1, S.cash - res.pnl);
      const delta = HS.streamFollowers(S, ret);
      st.followers = Math.max(0, st.followers + delta);
      if(ret >= HS.STREAM.viralAt){ st.viral++; HS.addRep(S, 2.5); }
      if(res.busted){                       /* blowing up in public is a story */
        st.followers = Math.round(st.followers * 0.72);
        HS.addRep(S, -3);
      }
      streamRow = ['Followers', (delta>=0?'+':'') + delta.toLocaleString() +
                   (ret >= HS.STREAM.viralAt ? '  VIRAL' : res.busted ? '  they clipped it' : '')];
    }

    const rows = [
      ['Session P&L', HS.signed(res.pnl)],
      ['Wage', HS.money(salary)],
      ['Reputation', (repDelta>=0?'+':'') + repDelta.toFixed(1)],
      ['Cash', HS.money(S.cash)]
    ];
    if(res.settled && res.settled.length){
      res.settled.forEach(x => rows.push([x.name + ' settled', HS.signed(x.pnl)]));
    }
    if(streamRow) rows.push(streamRow);
    if(S.positions.length) rows.push(['Still open', S.positions.length + ' contract(s)']);

    HS.Audio[res.pnl >= 0 ? 'cash' : 'loss']();
    ui.modal({
      title: res.busted ? 'STOPPED OUT' : res.hitTarget ? 'GOOD SESSION' : res.pnl >= 0 ? 'SESSION CLOSED' : 'DOWN DAY',
      tone: res.pnl >= 0 ? 'good' : 'bad',
      body: tallies(rows),
      actions:[{ label:'Clock off', onClick:()=>{
        ui.closeModal(); ui.syncHud(); HS.save(S);
        tutorMaybe(['session1','session2','session3']);
        maybePromote();
      } }]
    });
    checkFail();
  };

  /* ================= the firm ================= */
  G.recruit = function(source){
    const S = G.S;
    G.spendTime(2);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.network));
    const pool = HS.available(S, source);
    if(!pool.length){
      ui.modal({ title:'NOBODY TONIGHT',
        body:'<p>Plenty of talk, nobody worth a second conversation. The people who are ' +
             'any good are working, and the ones who are not are here.</p>' +
             '<p class="pbody dim">Come back when your name is worth more.</p>',
        actions:[{ label:'Fair enough', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }] });
      return;
    }
    const c = pool[Math.floor(Math.random() * pool.length)];
    S.met = (S.met || []).concat([c.id]);
    meetCandidate(HS.readCandidate(S, c), c);
  };

  /* Somebody you have already met, seen again later at the office. */
  G.rehire = function(id){
    const S = G.S;
    const c = HS.castOf(id);
    if(c) meetCandidate(HS.readCandidate(S, c), c);
  };

  function meetCandidate(cand, c){
    const S = G.S;
    const seats = HS.teamSeats(S);
    const full = HS.teamOf(S).length >= seats;
    const tier = HS.TIERS[c.tier];

    /* Your counter comes from what you think they are worth, not what they are
       worth. Misread somebody and it was your read that lost them. */
    const guess = HS.recruitWorth({ tape:cand.est.tape.mid, screen:cand.est.screen.mid,
                                    nerve:cand.est.nerve.mid });
    const fair = Math.round(Math.max(guess, cand.worth * 0.7));
    const low  = Math.round(fair * 0.82);
    const band = st => HS.statText(cand, st);

    /* The two at the top will not share a floor. Taking one shuts the door. */
    const rival = c.rival ? HS.castOf(c.rival) : null;
    const rivalOn = rival && HS.hasHired(S, rival.id);

    const hire = (wage, moraleAt, note) => {
      ui.closeModal();
      const e = HS.employ(c, wage, moraleAt);
      S.team = HS.teamOf(S); S.team.push(e);
      if(rival && !HS.isLost(S, rival.id)){
        S.lost = (S.lost || []).concat([rival.id]);
        S.met = (S.met || []).filter(id => id !== rival.id);
      }
      HS.Audio.levelUp();
      ui.toast(c.name + ' is on the payroll at ' + HS.money(wage) + ' a week. ' + note, 'good');
      if(rival) ui.toast(rival.name + ' will not be taking your calls.', 'bad');
      ui.syncHud(); HS.save(S);
    };
    const walk = () => {
      ui.closeModal(); HS.Audio.loss();
      ui.toast(c.name + ' thanks you for your time. You can try again another day.', 'bad');
      ui.syncHud(); HS.save(S);
    };
    const offer = (amount, moraleAt) => {
      if(amount >= cand.floor) return hire(amount, moraleAt, 'They took it.');
      if(amount >= cand.floor * 0.95) return hire(amount, Math.max(38, moraleAt - 22),
        'They took it, and they will remember it.');
      walk();
    };

    const acts = [];
    if(rivalOn){
      acts.push({ label:'They will not work with ' + rival.name, disabled:true,
        detail:'One of them was always going to be a door you closed',
        why:'You already made that choice' });
    } else if(full){
      acts.push({ label:'No seat for them', disabled:true,
        detail: HS.OFFICES[S.office||0].name + ' seats ' + seats + ' and you have ' +
                HS.teamOf(S).length, why:'Let somebody go first, or take a bigger floor' });
    } else if(HS.isUnpaid(S)){
      /* No office, no payroll, nothing to negotiate. You are asking somebody to
         work on the promise of a firm that does not exist yet. */
      acts.push({ label:'Ask them to come in on it', detail:'No wage until there is an office',
        cost:'nothing, which is the problem',
        onClick:()=>hire(cand.worth, 70, 'They are in, for now.') });
    } else {
      acts.push({ label:'Meet their number', detail:'They start keen',
        cost: HS.money(cand.ask) + ' a week',
        disabled: S.cash < cand.ask * 2, why:'You cannot cover two weeks of that',
        onClick:()=>hire(cand.ask, 86, 'They were not expecting that.') });
      acts.push({ label:'Offer ' + HS.money(fair), detail:'What you make them worth',
        cost: HS.money(fair) + ' a week',
        disabled: S.cash < fair * 2, why:'You cannot cover two weeks of that',
        onClick:()=>offer(fair, 74) });
      acts.push({ label:'Offer ' + HS.money(low), detail:'Try it on. They may walk',
        cost: HS.money(low) + ' a week', tone:'red',
        disabled: S.cash < low * 2, why:'You cannot cover two weeks of that',
        onClick:()=>offer(low, 60) });
    }
    acts.push({ label:'Leave it for now',
      onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } });

    ui.modal({
      title: c.name.toUpperCase(),
      sub: tier.name.toUpperCase() + ' - ' + HS.RECRUIT_SOURCES[c.from].name.toUpperCase(),
      body:'<p>' + c.line + '</p>' +
        tallies([
          ['Tape', band('tape')], ['Screen', band('screen')], ['Nerve', band('nerve')],
          ['Asking', HS.money(cand.ask) + ' a week']
        ]) +
        '<p class="pbody y">' + c.perk + '</p>' +
        '<p class="pbody dim">' + tier.blurb + ' ' +
          (c.tier === 'basic' ? 'Train them at the office and they will go whichever way you point them.'
           : c.tier === 'sharp' ? 'You would have to talk them round before any of it took.'
           : 'Nothing you say will move them, and they do not need moving.') + '</p>' +
        (HS.isUnpaid(S) ? '<p class="pbody y">You have no office and no payroll. They would be ' +
          'coming in on nothing but your word, which costs you nothing and buys you nothing: ' +
          'a bad week and they are simply not there on Monday. Weeks that go well build trust, ' +
          'and trust is what makes them cheap to teach.</p>' : '') +
        (rival && !rivalOn ? '<p class="pbody" style="color:var(--red)">Will not work in the ' +
          'same building as <b>' + rival.name + '</b>. Take one and the other is gone.</p>' : ''),
      actions: acts
    });
  }

  G.buyOffice = function(to){
    const S = G.S;
    const o = HS.OFFICES[to];
    S.cash -= o.price; S.office = to;
    refreshLandmarks(); HS.Audio.levelUp();
    ui.modal({
      title:'YOU TAKE THE LEASE', tone:'good',
      body:'<p><b>' + o.name + '</b></p><p>' + o.desc + '</p>' +
        tallies([['Seats', o.seats], ['Upkeep', HS.money(o.upkeep) + ' a week']]) +
        (to === 1 ? '<p class="pbody y">You can hand the channel to somebody now. Pick whoever ' +
                    'can hold a room, and go back to trading.</p>' : ''),
      actions:[{ label:'Good', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  /* The roster. Who trades, who fronts the channel, and who is dead weight. */
  G.openRoster = function(){
    const S = G.S;
    const team = HS.teamOf(S);
    if(!team.length){
      ui.modal({ title:'NOBODY WORKS HERE YET',
        body:'<p>Find people at the bar, on the floor of the Exchange, or through the channel.</p>',
        actions:[{ label:'Right', onClick:()=>ui.closeModal() }] });
      return;
    }
    const rows = team.map(e =>
      '<button class="act" data-emp="' + e.id + '">' +
        '<span class="act-main">' + e.name + '  <span class="dim">' + HS.ROLES[e.role].name +
          ' · ' + HS.TIERS[e.tier].name + '</span></span>' +
        '<span class="act-detail">Tape ' + HS.statText(e,'tape') + ' · Screen ' + HS.statText(e,'screen') +
          ' · Nerve ' + HS.statText(e,'nerve') + ' · morale ' + Math.round(e.morale) +
          ' · trust ' + Math.round(HS.trustOf(e)) +
          (e.known ? '' : ' · <span class="dim">not yet tested</span>') + '</span>' +
        '<span class="act-cost">' + HS.money(e.wage) + ' a week</span>' +
      '</button>').join('');
    /* People you have met and not seated are still people you can call. */
    const known = HS.metNotHired(S);
    const waiting = known.length
      ? '<p class="pbody dim">You also know these people. They are not on the payroll.</p>' +
        '<div class="acts">' + known.map(c =>
          '<button class="act" data-call="' + c.id + '">' +
            '<span class="act-main">' + c.name + '</span>' +
            '<span class="act-detail">' + HS.TIERS[c.tier].name + ' · ' + c.line + '</span>' +
          '</button>').join('') + '</div>'
      : '';
    ui.modal({
      title:'YOUR PEOPLE', sub: HS.OFFICES[S.office||0].name.toUpperCase() + ' · ' +
        team.length + ' of ' + HS.teamSeats(S) + ' seats',
      body:'<p class="pbody dim">Tap somebody to change what they do or teach them something.</p>' +
        '<div class="acts">' + rows + '</div>' + waiting,
      actions:[{ label:'Done', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
    document.querySelectorAll('#modalBody [data-emp]').forEach(btn => {
      btn.addEventListener('click', () => employeeSheet(btn.dataset.emp));
    });
    document.querySelectorAll('#modalBody [data-call]').forEach(btn => {
      btn.addEventListener('click', () => { ui.closeModal(); G.rehire(btn.dataset.call); });
    });
  };

  function employeeSheet(id){
    const S = G.S;
    const e = HS.teamOf(S).find(x => x.id === id);
    if(!e) return;
    const canStream = (S.office || 0) >= 1;
    ui.modal({
      title:e.name.toUpperCase(), sub:HS.RECRUIT_SOURCES[e.from].name.toUpperCase(),
      body: tallies([
        ['Tape', HS.statText(e,'tape')], ['Screen', HS.statText(e,'screen')],
        ['Nerve', HS.statText(e,'nerve')],
        ['Morale', Math.round(e.morale)], ['Trust', Math.round(HS.trustOf(e))],
        ['Wage', HS.isUnpaid(G.S) ? 'nothing yet' : HS.money(e.wage) + '/wk']
      ]) + (e.known ? '' : '<p class="pbody dim">Still an estimate. A losing week on the desks ' +
            'is what settles it.</p>') +
        (canStream ? '' : '<p class="pbody dim">You need an office before anyone can front the channel.</p>'),
      actions:[
        { label:'Put them on the book', detail:HS.ROLES.trader.blurb,
          onClick:()=>{ e.role = 'trader'; ui.closeModal(); G.openRoster(); } },
        { label:'Give them the channel', detail: e.special === 'oldschool'
            ? 'He would rather resign' : 'Screen ' + HS.statText(e,'screen') + ' decides how it grows',
          disabled: !canStream || e.special === 'oldschool',
          why: e.special === 'oldschool' ? 'Winston thinks a webcam is a confession' : '',
          onClick:()=>{
            HS.teamOf(S).forEach(x => { if(x.role === 'streamer') x.role = 'trader'; });
            e.role = 'streamer'; S.stream.delegated = true;
            ui.closeModal(); G.openRoster();
          } },
        { label:'Train them', detail: HS.TIERS[e.tier].blurb,
          disabled: HS.TIERS[e.tier].train === 0,
          why:'They did not come here to be taught',
          onClick:()=>{ ui.closeModal(); G.trainSheet(e.id); } },
        { label:'Let them go', tone:'red', detail:'No notice, no goodwill',
          onClick:()=>{
            S.team = HS.teamOf(S).filter(x => x.id !== e.id);
            if(!HS.streamerOf(S)) S.stream.delegated = false;
            HS.addRep(S, -1.5);
            ui.closeModal(); G.openRoster();
          } },
        { label:'Back', onClick:()=>{ ui.closeModal(); G.openRoster(); } }
      ]
    });
  }

  /* ---- training, and the people who do not want any ---- */
  G.trainSheet = function(id){
    const S = G.S;
    const e = HS.teamOf(S).find(x => x.id === id);
    if(!e) return;
    const tier = HS.TIERS[e.tier];
    const price = Math.max(2, Math.round(HS.energyCost(S, HS.ENERGY.classB) * HS.trainMult(e)));
    const rate = 3.4 * tier.train * (0.7 + S.skill / 140);
    const stuck = e.tier === 'sharp' && e.talked < 3;

    const put = stat => ({
      label:'Put it into ' + stat.charAt(0).toUpperCase() + stat.slice(1),
      detail: stat === 'tape' ? 'Reading the market, which is what they earn on'
            : stat === 'screen' ? 'Carrying a room, which is what the channel runs on'
            : 'Holding up when a week turns, which is what stops the bleeding',
      cost: '2h · ' + price + ' energy · about +' + rate.toFixed(1),
      disabled: S.energy < price || tier.train === 0 || stuck || e[stat] >= 99,
      why: tier.train === 0 ? 'They did not come here to be taught'
         : stuck ? 'They are not listening to you yet'
         : e[stat] >= 99 ? 'There is nothing left to add' : 'Not enough energy',
      onClick: () => { ui.closeModal(); G.train(e.id, stat, rate); }
    });

    const acts = [put('tape'), put('screen'), put('nerve')];
    if(e.tier === 'sharp' && e.talked < 3){
      const p2 = HS.energyCost(S, HS.ENERGY.round);
      acts.unshift({ label:'Talk them round', detail:'Attempt ' + (e.talked + 1) + ' of 3',
        cost:'1.5h · ' + p2 + ' energy',
        disabled: S.energy < p2, why:'Not enough energy',
        onClick: () => { ui.closeModal(); G.talkRound(e.id); } });
    }
    acts.push({ label:'Back', onClick:()=>{ ui.closeModal(); G.openRoster(); } });

    ui.modal({
      title:'TRAINING ' + e.name.toUpperCase(), sub:tier.name.toUpperCase(),
      body: tallies([
        ['Tape', HS.statText(e,'tape')], ['Screen', HS.statText(e,'screen')],
        ['Nerve', HS.statText(e,'nerve')],
        ['Trust', Math.round(HS.trustOf(e)) + ' of 100'],
        ['Sessions put in', e.trained || 0]
      ]) +
      '<p class="pbody dim">Somebody who believes in this takes less out of you to teach. ' +
      'At ' + Math.round(HS.trustOf(e)) + ' trust a session costs ' +
      Math.round(HS.trainMult(e) * 100) + '% of the usual.</p>' +
      '<p class="pbody dim">' + (tier.train === 0
        ? 'You are not going to teach this person anything. That is rather the point of them.'
        : e.tier === 'sharp'
          ? (e.talked >= 3
             ? 'They have decided you are worth listening to, though it still goes in slowly.'
             : 'They have been doing this a long time and they did not come here for a lesson. ' +
               'Three proper conversations might change that.')
          : 'Point them at something and they will go that way.') + '</p>',
      actions: acts
    });
  };

  G.train = function(id, stat, rate){
    const S = G.S;
    const e = HS.teamOf(S).find(x => x.id === id);
    if(!e) return;
    G.spendTime(2);
    HS.addEnergy(S, -Math.max(2, Math.round(HS.energyCost(S, HS.ENERGY.classB) * HS.trainMult(e))));
    const before = e[stat];
    e[stat] = Math.min(99, e[stat] + rate);
    e.trained = (e.trained || 0) + 1;
    e.morale = HS.clamp(e.morale + 2, 0, 100);
    e.known = true;                      /* you cannot teach somebody and not learn them */
    HS.addSkill(S, 0.15);
    HS.Audio.levelUp();
    ui.toast(e.name + ': ' + stat + ' ' + Math.round(before) + ' to ' + Math.round(e[stat]) + '.', 'good');
    ui.syncHud(); HS.save(S);
  };

  G.talkRound = function(id){
    const S = G.S;
    const e = HS.teamOf(S).find(x => x.id === id);
    if(!e) return;
    G.spendTime(1.5);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.round));
    /* They are weighing you up. A record and a name are the argument. */
    const odds = HS.clamp(0.22 + S.skill * 0.005 + S.rep * 0.004 + (e.morale - 60) * 0.004, 0.1, 0.92);
    const won = Math.random() < odds;
    if(won) e.talked = (e.talked || 0) + 1;
    else e.morale = HS.clamp(e.morale - 4, 0, 100);
    HS.Audio[won ? 'cash' : 'loss']();
    const done = e.talked >= 3;
    ui.modal({
      title: won ? 'HE HEARS YOU OUT' : 'HE IS NOT HAVING IT', tone: won ? 'good' : 'bad',
      body:'<p>' + (won
        ? (done ? 'Something lands. He does not agree with you, exactly, but he stops ' +
                  'explaining why you are wrong long enough to try it your way.'
                : 'You get further than last time. He is still doing most of the talking.')
        : 'You get about four minutes before he starts telling you how it was done properly, ' +
          'and how long he did it for.') + '</p>' +
        '<p class="pbody dim">' + (done ? e.name + ' will take training now.'
          : 'Talked round ' + (e.talked || 0) + ' of 3. Your record and your name are the ' +
            'argument here, and right now they are worth about ' + Math.round(odds * 100) +
            '% a go.') + '</p>',
      actions:[{ label:'Leave it there', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  G.checkIn = function(){
    const S = G.S;
    G.spendTime(1.5);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.round));
    S.checkedIn = S.day;
    HS.teamOf(S).forEach(e => { e.morale = HS.clamp(e.morale + 9, 0, 100); });
    const sm = HS.streamerOf(S);
    HS.Audio.cash();
    ui.modal({
      title:'YOU WALK THE FLOOR', tone:'good',
      body:'<p>You go desk to desk. Somebody wants a bigger screen, somebody else wants to know ' +
           'whether the name on the door is going to mean anything.</p>' +
        (sm ? '<p class="pbody">' + sm.name + ' shows you the numbers from the channel and waits ' +
              'to be told they did well.</p>' : '') +
        tallies([
          ['On the payroll', HS.teamOf(S).length],
          ['Weekly wages', HS.money(HS.teamWages(S))],
          ['Morale', Math.round(HS.teamOf(S).reduce((n,e)=>n+e.morale,0) / Math.max(1,HS.teamOf(S).length))]
        ]),
      actions:[{ label:'Back to it', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  /* ================= Yoon Suk-Yield ================= */
  function yoonEncounter(){
    const S = G.S;
    S.blue.met = true; S.blue.skill = 12;
    HS.Audio.levelUp();
    ui.modal({
      title:'A MESSAGE FROM SEOUL',
      body:'<p>Somebody has been watching every session you have put out, at four in the morning ' +
           'his time, for months. He finally writes, and the message is nine hundred words long ' +
           'and mostly about what you are doing wrong.</p>' +
           '<p><b>Yoon Suk-Yield</b> trades a system nobody here uses. He offers to teach it, ' +
           'on the condition you stop calling it a strategy.</p>' +
           '<p class="pbody y">The Blue House reads the tape far better than you can. It also ' +
           'refuses to let you size into anything, so it will never give your audience a clip.</p>' +
           '<p class="pbody dim">Work through his notes at home. Below <b>' + HS.BLUE.usable +
           '</b> you will trade it worse than trading blind.</p>',
      actions:[{ label:'Start reading', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  }

  G.studyBlue = function(){
    const S = G.S;
    G.spendTime(2);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.classB));
    const gain = 2.2 + S.skill * 0.03;
    S.blue.skill = Math.min(100, S.blue.skill + gain);
    HS.Audio.levelUp();
    const ready = HS.blueReady(S);
    ui.toast('Blue House ' + S.blue.skill.toFixed(0) + '.' +
             (ready ? ' You can trade it now.' : ''), ready ? 'good' : '');
    ui.syncHud(); HS.save(S);
  };

  G.toggleBlue = function(){
    const S = G.S;
    S.blue.on = !S.blue.on;
    HS.Audio.click();
    ui.toast(S.blue.on ? 'Trading the Blue House. Small size, better reads.'
                       : 'Back to your own system.', '');
    ui.syncHud(); HS.save(S);
  };

  /* ================= the weekend ================= */
  G.weekStudy = function(){
    const S = G.S;
    G.spendTime(2);
    HS.addEnergy(S, -HS.energyCost(S, Math.round(HS.ENERGY.review * 1.7)));
    const rested = S.rest === 2 ? 6 : S.rest === 0 ? -6 : 0;
    /* A week of homework reads better than a morning of it, but it is one
       call on five sessions, so it is never as sharp as looking at today. */
    const confidence = Math.round(HS.clamp(44 + S.skill*0.38 + HS.reviewBonus(S) +
                                           HS.roomBonus(S,'review') + rested, 44, 92));
    const truth = Math.random() < 0.5 ? 1 : -1;
    const shown = (Math.random()*100 < confidence) ? truth : -truth;
    S.weekEdge = { week: HS.weekOf(S.day) + 1, dir:truth, shown, confidence, day:-1 };
    HS.addSkill(S, 0.5);
    HS.Audio.levelUp();
    ui.modal({
      title: shown > 0 ? 'THE WEEK LOOKS BID' : 'THE WEEK LOOKS OFFERED',
      tone: shown > 0 ? 'good' : 'bad',
      body: crossSvg(shown) +
        '<p>Six hours at the kitchen table with every chart you can find. Across the whole tape ' +
        'the weight of it sits ' + (shown > 0 ? '<b class="up">to the upside</b>' : '<b class="down">to the downside</b>') + '.</p>' +
        '<p class="dim">Your read is <b>' + confidence + '%</b> reliable and it stands for every ' +
        'session next week, unless a morning review says otherwise.</p>',
      actions:[{ label:'Noted', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  G.weekendShift = function(){
    const S = G.S;
    G.spendTime(5);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.work));
    S.workedToday = true;
    const rep = 2.2 + S.rank * 0.45;
    HS.addRep(S, rep);
    HS.addSkill(S, 0.7);
    HS.Audio.cash();
    ui.toast('Five hours on an empty floor. Reputation +' + rep.toFixed(1) + '.', 'good');
    ui.syncHud(); HS.save(S);
  };

  /* ================= the channel ================= */
  G.startChannel = function(){
    const S = G.S;
    S.stream.on = true;
    HS.Audio.levelUp();
    ui.modal({
      title:'YOU START A CHANNEL', tone:'good',
      body:'<p>A webcam pointed at the corner of your screen, a name you will regret, and a chat ' +
           'window that is empty for eleven minutes and then is not.</p>' +
           '<p class="pbody">Go live before a session and strangers watch you trade. Post the recap ' +
           'afterwards and some of them start paying. They pay <b>' + HS.money(HS.STREAM.subFee) +
           '</b> each a week, on the same morning the rent comes out.</p>' +
           '<p class="pbody dim">They came to watch somebody win. A red day on camera costs you ' +
           'more followers than a green one earns.</p>',
      actions:[{ label:'Go on then', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  G.toggleLive = function(){
    const S = G.S;
    S.stream.live = !S.stream.live;
    HS.Audio.click();
    ui.toast(S.stream.live ? 'You are live. Chat is watching.' : 'Stream off.',
             S.stream.live ? 'good' : '');
    ui.syncHud(); HS.save(S);
  };

  G.postRecap = function(){
    const S = G.S;
    const st = S.stream;
    G.spendTime(1.5);
    HS.addEnergy(S, -HS.energyCost(S, HS.STREAM.postEnergy));
    const weekRet = S.weekPnl / Math.max(1, S.weekStartCash);
    const gained = HS.streamConvert(S, weekRet);
    st.subs += gained;
    HS.addRep(S, 0.6);
    HS.Audio.cash();
    ui.modal({
      title:'YOU POST THE RECAP', tone: gained > 0 ? 'good' : '',
      body:'<p>' + (gained > 0
          ? 'The clip does the rounds. A few of them decide you are worth paying for.'
          : 'It goes out. It lands on nobody in particular.') + '</p>' +
        tallies([
          ['New subscribers', gained > 0 ? '+' + gained : 'none'],
          ['Subscribers', st.subs.toLocaleString()],
          ['Followers', st.followers.toLocaleString()],
          ['Weekly income', HS.money(st.subs * HS.STREAM.subFee)]
        ]),
      actions:[{ label:'Close the laptop', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  };

  /* ================= week one ================= */
  function weekOneDecisionDue(){
    const S = G.S;
    return !S.path && S.flags.hired && HS.weekOf(S.day) === 1 && S.day >= 5;
  }

  function offerWeekOneChoice(){
    const S = G.S;
    const pnl = S.cash - 1000;
    const opts = ['solo','desk'].map(id => {
      const p = HS.PATHS[id];
      return '<button class="branch" data-path="' + id + '">' +
        '<span class="bname" style="color:' + p.accent + '">' + p.name + '</span>' +
        '<span class="bblurb">' + p.blurb + '</span></button>';
    }).join('');
    ui.modal({
      title:'FRIDAY, 5:40 PM',
      body:'<p>The week is over. Your supervisor drops into the chair beside you with two pieces of paper and does not offer you either of them yet.</p>' +
        '<p>"You did ' + (pnl >= 0 ? 'alright' : 'badly') + '," she says. ' +
        '"There is a junior seat opening on the floor. There is also the door. Some people do better through the door."</p>' +
        '<div class="branches">' + opts + '</div>' +
        '<p class="dim">Whatever you pick, you keep your account and everything in it.</p>',
      actions:[]
    });
    document.querySelectorAll('.branch').forEach(b =>
      b.addEventListener('click', () => choosePath(b.dataset.path)));
  }

  function choosePath(id){
    const S = G.S;
    S.path = id;
    S.rank = 1;
    S.flags.chose = true;
    HS.syncPerkPoints(S);
    player.setOutfit(HS.rankOf(S).outfit);
    refreshLandmarks();
    HS.Audio.win();
    const p = HS.PATHS[id];
    ui.modal({
      title: p.name.toUpperCase(),
      tone:'good',
      body:'<p>' + (id === 'solo'
        ? 'You take the door. On Monday there is no commute, no supervisor and no floor to hide on, only the desk in your room and whatever you can make of it.'
        : 'You take the seat. A junior book, a wage, and a ladder with a great many rungs above you.') + '</p>' +
        '<p class="dim">' + (id === 'solo'
          ? 'Trade from home. Nobody will tell you when to start.'
          : 'Report to Ladder & Co. every weekday before the bell.') + '</p>',
      actions:[{ label:'Monday, then', onClick:()=>{
        ui.closeModal(); ui.syncHud(); HS.save(S);
        doSleep(HS.restFor(S.hour));
      } }]
    });
  }

  /* ================= Kade ================= */
  function kadeEncounter(){
    const S = G.S;
    S.flags.kadePending = false;
    S.flags.kadeOffered = true;
    S.flags.kadeSeen = true;
    refreshLandmarks();
    HS.Audio.alarm();
    ui.modal({
      title:'A MAN AT THE END OF THE BAR',
      body:'<p>He does not introduce himself, because he does not have to. Ezra Kade turns his glass a quarter turn and says your last four trades back to you, in order, including the one you lost on.</p>' +
        '<p>"You are good," he says. "You are also already doing the thing you tell yourself you do not do. I have a floor where nobody pretends."</p>' +
        '<p class="dim">Take the meeting and the fund is yours to run. Refuse and he will not ask twice.</p>',
      actions:[
        { label:'Take the meeting', onClick:()=>{ ui.closeModal(); joinFund(); } },
        { label:'Finish your drink and leave', ghost:true, onClick:()=>{
            ui.closeModal();
            HS.addRep(G.S, 4);
            ui.toast('You said no to Ezra Kade. Word gets around.', 'good');
            HS.save(G.S);
          } }
      ]
    });
  }

  function joinFund(){
    const S = G.S;
    S.path = 'fund';
    S.rank = 1;
    S.aum = 4000000;
    S.investors = 4;
    HS.addHeat(S, 12);
    HS.syncPerkPoints(S);
    player.setOutfit(HS.rankOf(S).outfit);
    refreshLandmarks();
    HS.Audio.win();
    ui.modal({
      title:'KADE CAPITAL',
      tone:'good',
      body:'<p>Four million to start, black glass, no signage, and a mandate written loosely enough to cover almost anything you can think of.</p>' +
        '<p class="dim">The building is on your map now. Everything happens there.</p>',
      actions:[{ label:'Begin', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }]
    });
  }

  /* ================= tutorial ================= */
  G.tutorStep = function(){
    const S = G.S;
    if(S.tutorial.done || S.tutorial.step >= TUTORIAL.length) return null;
    return TUTORIAL[S.tutorial.step];
  };
  function tutorMaybe(keys){
    const S = G.S;
    const st = G.tutorStep();
    if(st && keys.indexOf(st.key) >= 0){
      S.tutorial.step++;
      if(S.tutorial.step >= TUTORIAL.length) endTutorial();
      else ui.toast('Next: ' + TUTORIAL[S.tutorial.step].text, '');
    }
  }
  G.tutorMaybe = tutorMaybe;

  function endTutorial(){
    const S = G.S;
    if(S.tutorial.done) return;
    S.tutorial.done = true;
    HS.Audio.levelUp();
    ui.modal({
      title:'NICE START TO THE WEEK',
      tone:'good',
      body:'<p>Three days in and you have traded a session, read a chart, sat a class and shaken some hands. That is the whole loop.</p>' +
        '<p><b>Now take control.</b> Two days left in the week. Spend them however you like, but end the week <b>green</b>.</p>' +
        '<p class="dim">Your week P&amp;L is on the objective panel. Friday evening somebody decides what you are.</p>',
      actions:[{ label:'Understood', onClick:()=>{ ui.closeModal(); HS.save(S); } }]
    });
  }

  /* ================= actions ================= */
  /* The floor under a blown-up account: you can always sell your time. */
  G.gigShift = function(){
    const S = G.S;
    G.spendTime(5);
    HS.addEnergy(S, -HS.energyCost(S, 18));
    const pay = 240 + Math.round(Math.random() * 160);
    S.cash += pay;
    HS.Audio.cash();
    ui.toast('A day of honest work. ' + HS.money(pay) + '.', '');
    ui.syncHud(); HS.save(S);
  };

  G.trainGym = function(price){
    const S = G.S;
    S.cash -= price; G.spendTime(1.5);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.gym));
    S.maxEnergy = HS.clamp(S.maxEnergy + 5, 0, HS.MAX_ENERGY_CAP);
    S.gymToday = true;
    HS.Audio.levelUp();
    ui.toast('Stamina up to ' + Math.round(S.maxEnergy) + '.', 'good');
    ui.syncHud(); HS.save(S);
  };
  G.buyDrink = function(drink, price){
    const S = G.S;
    S.cash -= price; S.drinksToday++; G.spendTime(0.25);
    HS.addEnergy(S, drink.energy);
    HS.Audio.cash();
    ui.toast('+' + drink.energy + ' energy. The next one costs more.', 'good');
    ui.syncHud(); HS.save(S);
  };
  G.study = function(c){
    const S = G.S;
    S.cash -= c.cash; G.spendTime(c.hours);
    HS.addEnergy(S, -HS.energyCost(S, c.energy));
    HS.addSkill(S, c.skill);
    S.studiedToday = true;
    HS.Audio.levelUp();
    ui.toast('Skill +' + c.skill + (S.perkPoints ? ' · ' + S.perkPoints + ' perk point(s)' : ''), 'good');
    ui.syncHud(); HS.save(S);
    tutorMaybe(['study']);
  };
  G.network = function(costCash){
    const S = G.S;
    S.cash -= costCash; S.networkedToday = true;
    G.spendTime(2);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.network));
    const gain = (2.4 + Math.random()*2.6 + S.rank * 0.3) * HS.networkMul(S) * HS.netMul(S);
    HS.addRep(S, gain);
    let extra = HS.teamHas(S,'connected') ? ' Nancy knew half the room already.' : '';
    if(Math.random() < 0.4){ S.contacts++; extra += ' You leave with a name worth having.'; }
    HS.Audio.cash();
    ui.toast('Reputation +' + gain.toFixed(1) + '.' + extra, 'good');
    maybeRumour();
    ui.syncHud(); HS.save(S);
    tutorMaybe(['bar']);
  };
  G.buyRound = function(costCash){
    const S = G.S;
    S.cash -= costCash; G.spendTime(2);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.round));
    const gain = (7 + Math.random()*5 + S.rank*0.4) * HS.networkMul(S);
    HS.addRep(S, gain); S.contacts++;
    HS.Audio.cash();
    ui.toast('The floor remembers. Reputation +' + gain.toFixed(1) + '.', 'good');
    maybeRumour();
    ui.syncHud(); HS.save(S);
    tutorMaybe(['bar']);
  };
  G.callFavour = function(){
    const S = G.S;
    S.contacts--; S.tips++;
    if(!HS.freeFavour(S)){
      G.spendTime(1);
      HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.favour));
    }
    HS.Audio.cash();
    ui.toast('A friend owes you one. A tip, and no heat.', 'good');
    ui.syncHud(); HS.save(S);
  };
  G.buyTip = function(){
    const S = G.S;
    G.spendTime(2);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.tip));
    S.tips++; HS.addHeat(S, 12);
    HS.Audio.warn();
    ui.toast('You have a tip. Heat +12.', 'bad');
    refreshLandmarks(); ui.syncHud(); HS.save(S);
  };
  function maybeRumour(){
    const S = G.S;
    if(S.path === 'fund' || S.flags.kadeOffered) return;
    if(Math.random() < 0.45){
      const line = HS.KADE_RUMOURS[Math.floor(Math.random()*HS.KADE_RUMOURS.length)];
      setTimeout(() => ui.toast(line, ''), 900);
    }
  }

  G.moveHouse = function(to){
    const S = G.S;
    const next = HS.HOUSING[to != null ? to : S.housing + 1];
    if(!next) return;
    S.cash -= next.deposit;
    S.housing = next.id;
    S.rentDueDay = S.day + HS.WEEK_DAYS;          /* first week in, first week free */
    refreshLandmarks(); HS.Audio.levelUp();
    ui.modal({ title:'YOU MOVE IN', tone:'good',
      body:'<p><b>' + next.name + '</b></p><p>' + next.desc + '</p>' +
           '<p class="dim">Rent is ' + HS.money(next.rent) + ' a week, first due in seven days. ' +
           'Your home marker has moved.</p>' + housingWarning(next),
      actions:[{ label:'Good', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); } }] });
  };

  /* Cheap rooms come with a warning label, because the dice are real. */
  function housingWarning(h){
    if(!h.bad && !h.cut) return '';
    const bits = [];
    if(h.bad) bits.push('you will not always sleep through the night');
    if(h.cut) bits.push('the power is not always on in the morning');
    return '<p class="pbody" style="color:var(--red)">At this end of the market ' +
           bits.join(', and ') + '.</p>';
  }
  G.lawyerUp = function(fee){
    const S = G.S;
    S.cash -= fee; HS.addHeat(S, -25); G.spendTime(2);
    ui.toast('Heat -25.', 'good'); refreshLandmarks(); ui.syncHud(); HS.save(S);
  };
  G.cooperate = function(){
    const S = G.S;
    HS.addHeat(S, -45); HS.addRep(S, -12); G.spendTime(3);
    ui.toast('Heat -45, reputation -12.', ''); refreshLandmarks(); ui.syncHud(); HS.save(S);
  };
  G.hireBroker = function(cost){
    const S = G.S;
    S.cash -= cost;
    const f = ['Dev','Marco','Tasha','Ruth','Kyle','Nina','Owen','Priya','Sal','Wes','Bea','Cal'];
    const l = ['Ortiz','Kaminski','Boyd','Nakamura','Farrell','Adeyemi','Vance','Reilly','Sokolov','Chen'];
    S.brokers.push({ name: f[Math.floor(Math.random()*f.length)] + ' ' + l[Math.floor(Math.random()*l.length)],
      skill: 18 + Math.random()*34 + S.rep*0.2, morale: 70 + Math.random()*20, salary: 400 + Math.random()*500 });
    HS.Audio.cash();
    ui.toast('Hired. Your team is ' + S.brokers.length + ' strong.', 'good');
    ui.syncHud(); HS.save(S); maybePromote();
    G.openPanelFor('brokerage');
  };
  G.raiseCapital = function(amount){
    const S = G.S;
    G.spendTime(3);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.raise));
    const got = Math.floor(amount * (0.6 + S.rep/100 * 0.8));
    S.aum += got; S.investors += 1 + Math.floor(Math.random()*3);
    HS.Audio.cash();
    ui.toast('Raised ' + HS.money(got) + '. AUM ' + HS.money(S.aum) + '.', 'good');
    ui.syncHud(); HS.save(S); maybePromote();
    G.openPanelFor('firm');
  };
  G.frontRun = function(){
    const S = G.S;
    const take = Math.floor(S.aum * (0.01 + Math.random()*0.02));
    S.cash += take; HS.addHeat(S, 18); HS.addRep(S, -2);
    HS.Audio.warn();
    ui.toast('You take ' + HS.money(take) + ' from your clients. Heat +18.', 'bad');
    refreshLandmarks(); ui.syncHud(); HS.save(S);
    G.openPanelFor('firm');
  };

  /* ---- chart review ---- */
  G.chartReview = function(){
    const S = G.S;
    G.spendTime(1);
    HS.addEnergy(S, -HS.energyCost(S, HS.ENERGY.review));
    S.reviewedToday = true;
    const rested = S.rest === 2 ? 6 : S.rest === 0 ? -6 : 0;
    /* Yoon's method is a better read or a worse one, with nothing in between:
       below the threshold you are following rules you do not understand. */
    const blue = HS.usingBlue(S) ? HS.BLUE.accuracy
               : (HS.metYoon(S) && S.blue.on) ? -18 : 0;
    const raw = 50 + S.skill*0.42 + HS.reviewBonus(S) + HS.roomBonus(S,'review') + rested + blue;
    const confidence = Math.round(HS.usingBlue(S)
      ? HS.clamp(raw, 30, HS.BLUE.ceiling)      /* better, never certain */
      : HS.clamp(raw, 30, 100));
    const truth = Math.random() < 0.5 ? 1 : -1;
    const shown = (Math.random()*100 < confidence) ? truth : -truth;
    S.edge = { day:S.day, dir:truth, shown, confidence };
    if(HS.metYoon(S) && S.blue.on) S.blue.skill = Math.min(100, S.blue.skill + 0.8);
    /* Al reads over your shoulder and feeds it back into his scanners. */
    const al = HS.teamOf(S).find(e => e.special === 'quant');
    if(al) al.tape = Math.min(99, al.tape + 0.6);
    HS.Audio.levelUp();
    ui.modal({
      title: shown > 0 ? 'GOLDEN CROSS' : 'DEATH CROSS',
      tone: shown > 0 ? 'good' : 'bad',
      body: crossSvg(shown) +
        '<p>The fifty has crossed ' + (shown > 0 ? 'up through' : 'down through') +
        ' the two-hundred. On this read the tape opens ' +
        (shown > 0 ? '<b class="up">bid</b>' : '<b class="down">offered</b>') + '.</p>' +
        '<p class="dim">Your read is <b>' + confidence + '%</b> reliable' +
        (rested > 0 ? ', and being refreshed helped' : rested < 0 ? ', and you are too tired to see straight' : '') + '.</p>',
      actions:[{ label:'Noted', onClick:()=>{ ui.closeModal(); ui.syncHud(); HS.save(S); tutorMaybe(['review']); } }]
    });
  };

  function crossSvg(dir){
    const W = 460, H = 130, N = 70;
    const px = []; let p = 50;
    for(let i = 0; i < N; i++){
      p += (i < N*0.45 ? -dir*0.22 : dir*0.55) + (Math.random()-0.5)*1.7;
      px.push(p);
    }
    const ma = n => px.map((_, i) => {
      const w = px.slice(Math.max(0, i-n+1), i+1);
      return w.reduce((s,v)=>s+v,0)/w.length;
    });
    const fast = ma(6), slow = ma(18);
    const all = px.concat(fast, slow);
    const lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    const X = i => 6 + i/(N-1)*(W-12);
    const Y = v => H-10 - (v-lo)/Math.max(0.001,(hi-lo))*(H-22);
    const path = a => a.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
    let cross = Math.floor(N*0.5);
    for(let i = 1; i < N; i++) if((fast[i-1]-slow[i-1])*(fast[i]-slow[i]) < 0) cross = i;
    const col = dir > 0 ? '#3FD68C' : '#FF5B67';
    return '<svg class="cross" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">' +
      '<path d="'+path(px)+'" fill="none" stroke="rgba(233,237,243,.22)" stroke-width="1.4"/>' +
      '<path d="'+path(slow)+'" fill="none" stroke="#8993A5" stroke-width="2"/>' +
      '<path d="'+path(fast)+'" fill="none" stroke="'+col+'" stroke-width="2.4"/>' +
      '<circle cx="'+X(cross).toFixed(1)+'" cy="'+Y(fast[cross]).toFixed(1)+
        '" r="6" fill="none" stroke="'+col+'" stroke-width="2"/></svg>';
  }

  /* ================= promotion & endings ================= */
  G.promoteTo = function(rank, text){
    const S = G.S;
    S.rank = rank;
    HS.syncPerkPoints(S);
    const r = HS.rankOf(S);
    player.setOutfit(r.outfit);
    HS.Audio.levelUp();
    refreshLandmarks();
    const last = HS.PATHS[S.path] && !HS.nextRank(S);
    if(last){ finale(); return; }
    /* Rank buys time on the chain, so say so plainly when it happens. */
    const unlocked = Object.keys(HS.EXPIRY_KINDS)
      .map(k => HS.EXPIRY_KINDS[k])
      .filter(e => e.unlockRank === rank);
    ui.modal({
      title:'PROMOTED - ' + r.name.toUpperCase(), tone:'good',
      body:'<p>' + (text || 'You move up.') + '</p>' +
           (r.salary ? '<p class="dim">Day rate is now <b>' + HS.money(r.salary) + '</b>.</p>' : '') +
           unlocked.map(e => '<p class="y"><b>' + e.name + ' contracts unlocked.</b> ' +
                             e.blurb + '</p>').join(''),
      actions:[{ label:'Good', onClick:()=>{ ui.closeModal(); ui.syncHud(); } }]
    });
    HS.save(S);
  };
  function maybePromote(){
    const S = G.S;
    if(!S.path || S.ended) return;
    const nr = HS.nextRank(S);
    if(nr && HS.meetsNeed(S, nr.need) && S.path !== 'desk') G.promoteTo(nr.i);
  }
  G.checkEnding = maybePromote;

  function finale(){
    const S = G.S;
    S.ended = S.path;
    HS.Audio.win();
    const text = ({
      solo:'The forty-first floor, your name in the lobby directory, and a room full of people who would not have got an interview across the street. Ladder and Co. spent four straight quarters explaining you to their investors, and somebody in that building is still being asked, in meetings, why they let the intern walk out. You started in a basement with four hundred dollars and a suit that did not fit. The suit still does not fit. You have simply stopped changing it.',
      desk:'Four hundred phones and every one of them makes you money. You have not entered an order yourself in eleven years. Your name is above the door in letters you can read from the river.',
      fund:'Two hundred million dollars and an entire city that would like to see you in prison. Kade left you the whole thing and disappeared somewhere warm. The fund is up again this year. At the restaurant nobody looks at you, which is how you know that everybody is.'
    })[S.path];
    ui.modal({
      title: HS.PATHS[S.path].name.toUpperCase(), tone:'good',
      body:'<p>' + text + '</p>' + tallies([
        ['Weeks', HS.weekOf(S.day)],
        ['Net worth', HS.money(HS.netWorth(S))],
        ['Sessions traded', S.stats.sessions],
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
      ui.modal({ title:'INDICTED', tone:'bad',
        body:'<p>They had the tapes the whole time. Eleven counts, and your own analysts testifying for nothing at all.</p>' +
             tallies([['Weeks', HS.weekOf(S.day)],['Net worth at arrest', HS.money(HS.netWorth(S))]]),
        actions:[{ label:'Start again', onClick:()=>location.reload() }] });
      return;
    }
    if(S.cash < -40000 && HS.netWorth(S) < -40000){
      S.ended = 'broke';
      HS.Audio.fail();
      ui.modal({ title:'WIPED OUT', tone:'bad',
        body:'<p>The bank calls the loan. There is nothing to call it against.</p>' +
             tallies([['Weeks', HS.weekOf(S.day)],['Owed', HS.money(S.loan)]]),
        actions:[{ label:'Start again', onClick:()=>location.reload() }] });
    }
  }

  function tallies(rows){
    return '<div class="tallies">' + rows.map(r =>
      '<div class="tally"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'
    ).join('') + '</div>';
  }

  /* ================= career screen ================= */
  function showCareer(){
    const S = G.S;
    const r = HS.rankOf(S);
    const nr = HS.nextRank(S);
    let html = '<div class="career-now"><span class="k">CURRENT</span><b>' + r.name + '</b></div>';
    if(!S.path){
      html += '<p class="dim">You are an intern. On Friday of week one somebody decides what you are.</p>';
    } else if(nr){
      html += '<div class="career-next"><span class="k">NEXT - ' + nr.name + '</span>' +
        HS.needText(S, nr.need).map(n => '<div class="req ' + (n.ok?'ok':'') + '"><span>' +
          n.label + '</span><b>' + n.text + '</b></div>').join('') + '</div>';
    } else html += '<p class="dim">There is nothing above this.</p>';

    html += '<div class="career-unlocks"><span class="k">PATHS</span>' +
      Object.keys(HS.PATHS).map(id => {
        const p = HS.PATHS[id];
        const known = S.path === id || !p.hidden || S.flags.kadeSeen;
        const have = S.path === id;
        return '<div class="unlock ' + (have?'have':'') + '">' +
          '<span class="tick">' + (have ? '✓' : '·') + '</span>' +
          '<span class="un"><b>' + (known ? p.name : '???') + '</b><em>' +
          (known ? p.blurb : 'Somebody in this city runs money that nobody talks about.') + '</em></span>' +
          '<span class="gate">' + (have ? 'yours' : known ? p.tagline : 'unknown') + '</span></div>';
      }).join('') + '</div>';

    ui.modal({ title:'CAREER', body:html, actions:[{ label:'Back', onClick:()=>ui.closeModal() }] });
  }

  /* ================= room ================= */
  G.openRoom = function(){
    roomSlot = 'bed';
    $('room').classList.add('show');
    renderRoom();
  };
  function renderRoom(){
    const S = G.S;
    $('roomTitle').textContent = HS.HOUSING[S.housing].name;
    $('roomSub').textContent = HS.roomOwned(S) + ' OF ' + HS.ROOM_SLOTS.length + ' FITTED · ' + HS.money(S.cash);
    HS.drawRoom($('roomCanvas'), S, S.housing);

    const slots = $('roomSlots');
    slots.innerHTML = '';
    HS.ROOM_SLOTS.forEach(sl => {
      const cur = HS.roomItem(sl.id, S.room[sl.id]);
      const b = HS.el('button', 'room-slot' + (roomSlot === sl.id ? ' sel' : ''),
        '<b>' + sl.name.toUpperCase() + '</b>' + (cur ? cur.name : 'empty'));
      b.addEventListener('click', () => { roomSlot = sl.id; HS.Audio.click(); renderRoom(); });
      slots.appendChild(b);
    });

    const shop = $('roomShop');
    shop.innerHTML = '';
    (HS.ROOM_ITEMS[roomSlot] || []).forEach(it => {
      const owned = S.room[roomSlot] === it.id;
      const tags = [];
      if(it.sleep)   tags.push('rest +' + Math.round(it.sleep*100) + '%');
      if(it.review)  tags.push('review +' + it.review);
      if(it.study)   tags.push('classes -' + Math.round(it.study*100) + '%');
      if(it.effort)  tags.push('effort -' + it.effort);
      if(it.morning) tags.push('+' + it.morning + ' each morning');
      const b = HS.el('button', 'room-buy' + (owned ? ' owned' : ''),
        '<b>' + it.name + '</b><em>' + it.desc + '</em>' +
        '<span class="tags">' + tags.map(t=>'<span class="tag">'+t+'</span>').join('') + '</span>' +
        '<span class="cost">' + (owned ? 'fitted' : it.price ? HS.money(it.price) : 'free') + '</span>');
      b.disabled = owned || S.cash < it.price;
      if(!b.disabled) b.addEventListener('click', () => {
        S.cash -= it.price;
        S.room[roomSlot] = it.id;
        HS.Audio.cash();
        ui.syncHud(); HS.save(S); renderRoom();
      });
      shop.appendChild(b);
    });
  }

  /* ================= perks ================= */
  G.openPerks = function(){
    $('perks').classList.add('show');
    renderPerks();
  };
  function renderPerks(){
    const S = G.S;
    HS.syncPerkPoints(S);
    $('perkPoints').textContent = S.perkPoints;
    const wrap = $('perkTrees');
    wrap.innerHTML = '';
    HS.PERK_TREES.forEach(tree => {
      const el = HS.el('div','perk-tree');
      el.innerHTML = '<h4 style="color:' + tree.accent + '">' + tree.name + '</h4><p>' + tree.blurb + '</p>';
      const canvas = HS.el('div','perk-canvas');
      el.appendChild(canvas);
      wrap.appendChild(el);

      const W = canvas.clientWidth || 220, H = 250;
      const pos = p => [ p.x * W, 14 + p.y * (H - 34) ];
      tree.perks.forEach(p => (p.needs||[]).forEach(nid => {
        const a = pos(HS.PERK[nid]), b = pos(p);
        const dx = b[0]-a[0], dy = b[1]-a[1];
        const line = HS.el('div','perk-line' + (HS.hasPerk(S,nid) && HS.hasPerk(S,p.id) ? ' have' : ''));
        line.style.left = a[0]+'px'; line.style.top = a[1]+'px';
        line.style.width = Math.hypot(dx,dy)+'px';
        line.style.transform = 'rotate(' + Math.atan2(dy,dx) + 'rad)';
        canvas.appendChild(line);
      }));
      tree.perks.forEach(p => {
        const [x,y] = pos(p);
        const have = HS.hasPerk(S,p.id), avail = HS.canBuyPerk(S,p);
        const node = HS.el('button','perk-node' + (have?' have':avail?' avail':''), have?'✓':'●');
        node.style.left = x+'px'; node.style.top = y+'px';
        node.title = p.name + ': ' + p.desc;
        const tag = HS.el('span','perk-label', p.name);
        tag.style.left = x+'px'; tag.style.top = (y+20)+'px';
        canvas.appendChild(tag);
        node.addEventListener('click', () => {
          const reqs = HS.perkReqText(S,p).map(r => (r.ok?'✓ ':'✗ ')+r.label).join('  ');
          if(HS.canBuyPerk(S,p)){
            HS.buyPerk(S,p.id); HS.Audio.levelUp();
            ui.toast(p.name + ' unlocked.', 'good');
            ui.syncHud(); HS.save(S); renderPerks();
          } else {
            HS.Audio.click();
            $('perkHint').innerHTML = '<b>' + p.name + '</b>. ' + p.desc +
              (have ? '' : '<br><span class="dim">' + (reqs || 'no requirements') +
              (S.perkPoints < 1 ? '  ✗ needs a point' : '') + '</span>');
          }
        });
        node.addEventListener('mouseenter', () => {
          $('perkHint').innerHTML = '<b>' + p.name + '</b>. ' + p.desc;
        });
        canvas.appendChild(node);
      });
    });
  }

  /* ================= big map ================= */
  function toggleBigMap(){
    const el = $('bigmap');
    if(el.classList.contains('show')){ el.classList.remove('show'); return; }
    el.classList.add('show');
    drawBigMap();
  }
  function drawBigMap(){
    const S = G.S;
    const cv = $('bigmapCanvas'), ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    const half = city.half + 26;
    const sc = Math.min(W,H) / (half*2);
    const ox = (W - half*2*sc)/2, oy = (H - half*2*sc)/2;
    const toMap = (x,z) => [ ox + (x+half)*sc, oy + (z+half)*sc ];

    ctx.fillStyle = '#0A0D13'; ctx.fillRect(0,0,W,H);
    const C = HS.CITY;
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for(let i=0;i<C.GRID;i++) for(let j=0;j<C.GRID;j++){
      const r = HS.blockRect(i,j);
      const a = toMap(r.x0,r.z0), b = toMap(r.x1,r.z1);
      ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
    }
    const target = G.objectiveTarget();
    const legend = $('mapLegend'); legend.innerHTML = '';
    city.landmarks.forEach(lm => {
      if(!G.isLandmarkActive(lm.id)) return;
      const [x,y] = toMap(lm.x, lm.z);
      const col = G.landmarkColor(lm.id);
      const isT = lm.id === target;
      if(isT){
        ctx.beginPath(); ctx.arc(x,y,17,0,Math.PI*2);
        ctx.fillStyle = 'rgba(232,184,92,.18)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x,y,15,0,Math.PI*2);
        ctx.strokeStyle = '#E8B85C'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#E9EDF3';
      ctx.font = '600 11px "Space Grotesk",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(lm.name, x, y + 11);
      legend.appendChild(HS.el('div', isT ? 'obj' : '',
        '<i style="background:' + col + '"></i>' + lm.name + (isT ? ' (go here)' : '')));
    });
    const [px,py] = toMap(player.x, player.z);
    const dx = Math.sin(player.angle), dy = Math.cos(player.angle);
    ctx.beginPath();
    ctx.moveTo(px+dx*11, py+dy*11);
    ctx.lineTo(px-dx*6-dy*6, py-dy*6+dx*6);
    ctx.lineTo(px-dx*2, py-dy*2);
    ctx.lineTo(px-dx*6+dy*6, py-dy*6-dx*6);
    ctx.closePath();
    ctx.fillStyle='#fff'; ctx.strokeStyle='#080B11'; ctx.lineWidth=2;
    ctx.fill(); ctx.stroke();
  }

  /* ================= objective ================= */
  G.objectiveTarget = function(){
    const S = G.S;
    if(S.ended) return null;
    const t = G.tutorStep();
    if(t) return t.target === 'home' ? HS.HOUSING[S.housing].landmark : t.target;
    if(S.flags.kadePending) return 'bar';
    if(S.energy < 20) return S.cash > 400 ? 'store' : HS.HOUSING[S.housing].landmark;
    if(!S.path) return 'brokerage';
    if(!S.workedToday && !HS.isWeekend(S.day) && S.hour < HS.MARKET_CLOSE)
      return S.path === 'solo' ? HS.HOUSING[S.housing].landmark
           : S.path === 'fund' ? 'firm' : 'brokerage';
    const nr = HS.nextRank(S);
    if(!nr) return null;
    const gaps = [];
    if(nr.need.skill != null) gaps.push([(nr.need.skill - S.skill)/nr.need.skill, 'school']);
    if(nr.need.rep   != null) gaps.push([(nr.need.rep - S.rep)/nr.need.rep, 'bar']);
    if(nr.need.cash  != null) gaps.push([(nr.need.cash - S.cash)/nr.need.cash,
      S.path === 'solo' ? HS.HOUSING[S.housing].landmark : S.path === 'fund' ? 'firm' : 'brokerage']);
    if(nr.need.aum   != null) gaps.push([(nr.need.aum - S.aum)/nr.need.aum, 'firm']);
    if(nr.need.brokers != null) gaps.push([(nr.need.brokers - S.brokers.length)/nr.need.brokers, 'brokerage']);
    gaps.sort((a,b)=>b[0]-a[0]);
    if(!gaps.length || gaps[0][0] <= 0) return 'school';
    return gaps[0][1];
  };

  G.objectiveText = function(){
    const S = G.S;
    if(S.ended) return 'The story is over.';
    const t = G.tutorStep();
    if(t) return t.text;
    if(S.flags.kadePending) return 'Someone is waiting for you at The Ticker Bar.';
    if(!S.path) return 'Finish the week. Friday evening they decide what you are.';
    if(HS.weekOf(S.day) === 1) return 'End the week green. Week P&L ' + HS.signed(S.weekPnl) + '.';
    const nr = HS.nextRank(S);
    if(!nr) return 'You have arrived.';
    const miss = HS.needText(S, nr.need).filter(n => !n.ok);
    return miss.length ? 'Toward ' + nr.name + ': ' + miss.map(m => m.label + ' ' + m.text).join(', ')
                       : 'You qualify for ' + nr.name + '.';
  };

  return G;
};

})(window.HS);
