/* MARKET MAKER - the trading session.
   You always trade your own account. Contracts are picked by moneyness rather
   than by strike arithmetic, and they survive the closing bell unless their
   expiry says otherwise. */
window.HS = window.HS || {};
(function(HS){
'use strict';
const $ = HS.$;

const SIM_HZ = 10, DT = 1/SIM_HZ, TICKS_PER_BAR = 6, VIEW_BARS = 56;
const CS = 100;

/* Five rungs either side of the money, labelled rather than numbered. */
const MONEY = [
  { key:'deep', label:'DEEP ITM', sig: 1.4, hint:'Moves almost like the stock' },
  { key:'itm',  label:'ITM',      sig: 0.6, hint:'Already has real value' },
  { key:'atm',  label:'ATM',      sig: 0.0, hint:'The balanced bet' },
  { key:'otm',  label:'OTM',      sig:-0.6, hint:'Cheap, needs a move' },
  { key:'far',  label:'FAR OTM',  sig:-1.4, hint:'Lottery ticket' }
];

const HEADLINES = {
  up:['beats on earnings, guides higher','lands a sovereign supply contract',
      'upgraded to Overweight','announces a buyback','clears review early',
      'squeezes its shorts to a record low'],
  down:['misses guidance, CFO resigns','regulator opens a formal probe',
        'downgraded to Underperform','recalls its flagship line',
        'loses its anchor client','has its credit facility pulled']
};

HS.Market = {};

HS.Market.run = function(opts, done){
  const G = opts.state;                       // live game state, mutated directly
  const cfg = Object.assign({
    duration:110, target:0.08, vol:0.0011, trendStr:0.9, chop:0.34,
    regimeT:[9,18], leverage:1, feePerContract:0.65,
    news:[22,40], shock:0.02, title:'SESSION', sub:''
  }, opts);

  const sym = cfg.symbol;
  const base = HS.TICKERS[sym];
  const TICKS = Math.round(cfg.duration * SIM_HZ);
  const baseIv = HS.impliedFromTape(cfg.vol * base.vol, TICKS);
  const dailySigma = baseIv / Math.sqrt(252);
  const startCash = G.cash;
  const startEquity = () => cfg.startEquity;

  const M = {
    price: HS.tickerPrice(G, sym), tickSize: base.tick,
    open:0, bars:[], sub:0, tick:0,
    regime:null, regimeLeft:0, shock:0, shockLeft:0,
    selected:null, sizePct:0.25, expIdx:0, tab:'chain',
    acc:0, last:0, running:false, finished:false,
    trades:0, wins:0,
    peak:0, trough:Infinity,
    nextNews: cfg.news ? cfg.news[0]*0.6 + Math.random()*cfg.news[1] : Infinity,
    newsHide:0, chain:null
  };
  M.open = M.price;
  M.bars.push(bar(M.price));
  newRegime(true);
  for(let i = 0; i < VIEW_BARS * TICKS_PER_BAR; i++) step(true);
  // Rescale the warm-up so yesterday's shape runs continuously into today's
  // real opening price, with no artificial gap on the last candle.
  const real = HS.tickerPrice(G, sym);
  const k = real / M.price;
  M.bars.forEach(b => { b.o*=k; b.h*=k; b.l*=k; b.c*=k; });
  M.price = real; M.open = real;
  M.shock = 0; M.shockLeft = 0; M.tick = 0;
  M.targetSeen = false; M.power = false;
  M.coachedBuy = false; M.coachedLate = false;
  M.bars = M.bars.slice(-VIEW_BARS);
  newRegime(true);

  if(cfg.edge){
    const d = cfg.edge.dir * (0.7 + Math.random()*0.5) * cfg.trendStr;
    M.regime = { d, kind: d > 0 ? 'BID' : 'OFFERED' };
    M.regimeLeft = Math.max(M.regimeLeft, cfg.duration * 0.40);
  }

  const expiries = ['0dte','weekly','swing']
    .map(k => HS.EXPIRY_KINDS[k])
    .filter(e => cfg.rank >= e.unlockRank || cfg.ignoreRankGate);
  if(!expiries.length) expiries.push(HS.EXPIRY_KINDS['0dte']);
  /* Open on the week once you have it. It is the everyday contract. */
  M.expIdx = Math.max(0, expiries.findIndex(e => e.id === 'weekly'));

  function bar(p){ return { o:p, h:p, l:p, c:p }; }
  const prog = () => HS.clamp(M.tick / TICKS, 0, 1);
  const marketHour = () => HS.MARKET_OPEN + prog() * (HS.MARKET_CLOSE - HS.MARKET_OPEN);

  function newRegime(first){
    const r = Math.random(), side = (1 - cfg.chop) / 2;
    let d;
    if(r < side)          d =  (0.55 + Math.random()*0.45) * cfg.trendStr;
    else if(r < side * 2) d = -(0.55 + Math.random()*0.45) * cfg.trendStr;
    else                  d = (Math.random()*0.28 - 0.14);
    if(first && Math.abs(d) > 0.2) d *= 0.6;
    M.regime = { d, kind: d > 0.2 ? 'BID' : d < -0.2 ? 'OFFERED' : 'RANGE' };
    M.regimeLeft = cfg.regimeT[0] + Math.random() * (cfg.regimeT[1] - cfg.regimeT[0]);
  }

  function step(warm){
    M.regimeLeft -= DT;
    if(M.regimeLeft <= 0) newRegime(false);
    const stretch = (M.price - M.open) / M.open;
    const vol = cfg.vol * (M.power ? 1.65 : 1);      /* the last hour has teeth */
    let ret = (M.regime.d * vol * 0.45) + (HS.gauss() * vol) + (-stretch * 0.05 * vol * 8);
    if(M.shockLeft > 0){ ret += M.shock; M.shockLeft--; }
    M.price = Math.max(M.tickSize * 5, M.price * (1 + ret));
    M.price = Math.round(M.price / M.tickSize) * M.tickSize;
    const b = M.bars[M.bars.length-1];
    b.c = M.price;
    if(M.price > b.h) b.h = M.price;
    if(M.price < b.l) b.l = M.price;
    if(++M.sub >= TICKS_PER_BAR){
      M.sub = 0;
      M.bars.push(bar(M.price));
      if(M.bars.length > 340) M.bars.shift();
    }
    if(!warm){
      M.tick++;
      G.market.tickers[sym].price = M.price;    // the tape is the real tape
    }
  }

  /* ---------- marking ---------- */
  function spotOf(p){ return p.sym === sym ? M.price : HS.tickerPrice(G, p.sym); }
  function quoteOf(p){
    const T = HS.yearsLeft(p, G.day, prog());
    const s = spotOf(p);
    const iv = HS.ivFor(baseIv * HS.EXPIRY_KINDS[p.kind].ivMult, s, p.strike, T);
    const g = HS.blackScholes(p.isCall, s, p.strike, T, iv);
    const mid = g.price;
    const sp = HS.clamp(0.022 + 0.075/(mid+0.6) + (p.kind==='0dte'?0.035:0), 0.02, 0.34);
    const hw = Math.max(0.01, mid*sp/2);
    return { mid, bid:Math.max(0,mid-hw), ask:mid+hw, iv, T,
             delta:g.delta, theta:g.theta/252, gamma:g.gamma };
  }
  function bookValue(){
    let v = 0;
    G.positions.forEach(p => { v += p.qty * quoteOf(p).mid * CS; });
    return v;
  }
  const equity = () => G.cash + bookValue();

  /* A name on the street gets you a better ticket: up to 40% off commission. */
  const feeEach = () => cfg.feePerContract * HS.feeMul(G) * (1 - Math.min(0.4, G.rep / 250));
  function buyingPower(){ return equity() * cfg.leverage * HS.sizeMul(G); }

  /* Long premium is paid in cash; leverage cannot buy it. Leverage is margin,
     so it only widens what you may write. */
  function maxQty(contract, isWrite){
    const q = quoteOf(contract);
    if(isWrite){
      const margin = contract.strike * CS * 0.25 * HS.marginMul(G);
      return Math.max(0, Math.floor(buyingPower() * 0.5 / Math.max(1, margin)));
    }
    const cost = q.ask * CS + feeEach();
    return Math.max(0, Math.floor(G.cash * 0.92 / Math.max(0.01, cost)));
  }
  /* Contracts for the currently selected slice of capacity. */
  function sizedQty(contract, isWrite){
    const cap = maxQty(contract, isWrite);
    /* The Blue House will not let you swing. Precision instead of noise,
       which is exactly the wrong trade for a man with an audience. */
    const pct = cfg.blue ? Math.min(M.sizePct, HS.BLUE.sizeCap) : M.sizePct;
    return Math.max(cap >= 1 ? 1 : 0, Math.floor(cap * pct));
  }

  /* ---------- trading ---------- */
  function openPos(dir){
    if(!M.selected) return;
    const c = M.selected;
    if(c.kind === 'swing' && HS.swingCount(G) >= HS.swingSlots(G)){
      flash(HS.swingSlots(G) > 1 ? 'Both swing slots are already used.'
                                 : 'Your swing slot is already used.'); return;
    }
    const qty = sizedQty(c, dir < 0);
    if(qty < 1){ flash(dir > 0 ? 'Not enough cash for even one contract.'
                               : 'Not enough margin to write that.'); return; }
    const q = quoteOf(c);
    const px = dir > 0 ? q.ask : q.bid;
    G.cash -= dir * px * CS * qty + feeEach() * qty;
    G.positions.push(HS.newPosition({
      sym:c.sym, isCall:c.isCall, strike:c.strike, kind:c.kind,
      expiryDay:c.expiryDay, qty: dir*qty, entry:px, openedDay:G.day, moneyness:c.moneyness
    }));
    dir > 0 ? HS.Audio.buy() : HS.Audio.sell();
    log('<b class="' + (dir>0?'g':'r') + '">' + (dir>0?'BOT':'SOLD') + '</b> ' + qty + 'x ' +
        HS.posName(c, G.day));
    renderBook(); sync();
    if(cfg.coach && !M.coachedBuy){ M.coachedBuy = true; coachBought(); }
  }

  function closeById(id, quiet){
    const i = G.positions.findIndex(p => p.id === id);
    if(i < 0) return 0;
    const p = G.positions[i];
    const q = quoteOf(p);
    const long = p.qty > 0;
    const px = long ? q.bid : q.ask;
    const qty = Math.abs(p.qty);
    const net = p.qty * (px - p.entry) * CS - feeEach()*qty;
    G.cash += p.qty * px * CS - feeEach()*qty;
    G.positions.splice(i, 1);
    M.trades++;
    if(net > 0) M.wins++;
    if(!quiet){
      pop(HS.signed(net), net >= 0);
      net >= 0 ? HS.Audio.cash() : HS.Audio.loss();
      log('<b class="' + (net>=0?'g':'r') + '">CLOSE</b> ' + HS.posName(p, G.day) +
          ' <span class="' + (net>=0?'g':'r') + '">' + HS.signed(net) + '</span>');
    }
    renderBook(); sync();
    return net;
  }

  /* Anything whose last day this is settles at the close, at intrinsic. */
  function settleAtBell(){
    const td = HS.tradingDay(G.day);
    const report = [];
    G.positions = G.positions.filter(p => {
      if(p.expiryDay > td) return true;
      const v = HS.intrinsic(p, spotOf(p));
      const pnl = p.qty * (v - p.entry) * CS;
      G.cash += p.qty * v * CS;
      report.push({ name:HS.posName(p, G.day), value:v, pnl });
      M.trades++; if(pnl > 0) M.wins++;
      return false;
    });
    return report;
  }

  function fireNews(){
    const up = Math.random() < 0.5;
    const mag = cfg.shock * (0.45 + Math.random()*0.55);
    M.shock = (up ? 1 : -1) * (Math.pow(1 + mag, 1/3) - 1);
    M.shockLeft = 3;
    const list = up ? HEADLINES.up : HEADLINES.down;
    $('mkNewsText').textContent = base.name + ' ' + list[Math.floor(Math.random()*list.length)];
    $('mkNews').classList.add('show');
    M.newsHide = 6;
    HS.Audio.alarm();
    M.nextNews = cfg.news[0] + Math.random() * (cfg.news[1] - cfg.news[0]);
  }

  /* ---------- dom ---------- */
  const root = $('market');
  $('mkTitle').textContent = cfg.title;
  $('mkSub').textContent = cfg.sub || (base.name + ' · ' + sym);
  $('mkNews').classList.remove('show');
  $('mkLog').innerHTML = '';
  root.classList.add('show');

  const edgeBadge = $('mkEdge');
  if(cfg.edge){
    const shown = cfg.edge.shown != null ? cfg.edge.shown : cfg.edge.dir;
    edgeBadge.style.display = '';
    edgeBadge.className = 'mk-edge ' + (shown > 0 ? 'golden' : 'death');
    edgeBadge.textContent = (shown > 0 ? '▲ GOLDEN CROSS' : '▼ DEATH CROSS') +
                            ' · ' + cfg.edge.confidence + '%';
  } else edgeBadge.style.display = 'none';

  function log(html){
    const d = HS.el('div', null, html);
    $('mkLog').insertBefore(d, $('mkLog').firstChild);
    while($('mkLog').children.length > 10) $('mkLog').removeChild($('mkLog').lastChild);
  }
  function pop(text, good){
    const e = HS.el('div', 'mk-pop', text);
    e.style.color = good ? 'var(--green)' : 'var(--red)';
    e.style.left = (28 + Math.random()*40) + '%';
    $('mkChartWrap').appendChild(e);
    setTimeout(() => e.remove(), 1100);
  }
  let flashT = 0;
  function flash(msg){ $('mkFlash').textContent = msg; $('mkFlash').classList.add('show'); flashT = 1.8; }

  /* ---------- expiry tabs ---------- */
  const tabsEl = $('mkExpiries');
  tabsEl.innerHTML = '';
  ['0dte','weekly','swing'].forEach(k => {
    const e = HS.EXPIRY_KINDS[k];
    const locked = cfg.rank < e.unlockRank && !cfg.ignoreRankGate;
    const b = HS.el('button', 'mk-exp' + (locked ? ' locked' : ''));
    const days = HS.expiryDayFor(k, G.day) - HS.tradingDay(G.day);
    b.innerHTML = '<span>' + e.name + '</span><small>' +
      (locked ? 'RANK ' + e.unlockRank : (k==='0dte' ? 'today' : days + 'd')) + '</small>';
    b.title = locked ? e.name + ' unlocks at rank ' + e.unlockRank : e.blurb;
    b.dataset.exp = e.id;
    if(!locked) b.addEventListener('click', () => {
      M.expIdx = expiries.indexOf(e); M.selected = null;
      HS.Audio.click(); renderTabs(); renderChain(); sync();
    });
    tabsEl.appendChild(b);
  });
  function renderTabs(){
    [...tabsEl.children].forEach(b =>
      b.classList.toggle('sel', b.dataset.exp === expiries[M.expIdx].id));
  }
  renderTabs();

  /* ---------- chain by moneyness ---------- */
  /* Rungs are whole steps off the money, and the step is sized by what this
     contract can actually move before it dies. Index-based, so the five rungs
     are always five distinct strikes even in the last hour of a 0DTE. */
  function contractFor(m, isCall){
    const kind = expiries[M.expIdx].id;
    const expiryDay = HS.expiryDayFor(kind, G.day);
    const days = Math.max(0.12, (expiryDay - HS.tradingDay(G.day)) + (1 - prog()));
    const em = dailySigma * Math.sqrt(days);
    const step = Math.max(base.tick * 5, HS.rungWidth(M.price, em * 0.7));
    /* Anchor the ladder near the spot, not on the rung grid. Snapping the
       anchor to a step that is coarse for a long expiry threw the ATM rung
       up to half a step off the money, in a different direction for each
       expiry, which is how a weekly put ended up dearer than a swing put.
       A tenth of a step is round enough to read and close enough to spot
       that time is the only thing separating the three columns. */
    const grid = Math.max(base.tick, step / 10);
    const atm = Math.round(M.price / grid) * grid;
    const n = MONEY.indexOf(m) - 2;                  // -2 .. +2
    const dp = M.price < 20 ? 2 : 1;                 // as the chain prints it
    const strike = Math.max(step, +(atm + (isCall ? n : -n) * step).toFixed(dp));
    return { sym, isCall, strike, kind, moneyness:m.label, expiryDay };
  }

  const chainEl = $('mkChain');
  let chainCells = [];
  function renderChain(){
    chainEl.innerHTML = '';
    chainCells = [];
    const head = HS.el('div','ch-head','<span class="side call">CALLS</span>' +
      '<span class="k">' + expiries[M.expIdx].name + '</span>' +
      '<span class="side put">PUTS</span>');
    chainEl.appendChild(head);

    MONEY.forEach(m => {
      const row = HS.el('div','ch-row');
      const c = HS.el('button','ch-cell call');
      const lab = HS.el('span','ch-money','<b>' + m.label + '</b>');
      const pu = HS.el('button','ch-cell put');
      c.addEventListener('click', () => select(m, true));
      pu.addEventListener('click', () => select(m, false));
      row.appendChild(c); row.appendChild(lab); row.appendChild(pu);
      chainEl.appendChild(row);
      chainCells.push({ m, c, pu });
    });
    updateChain();
  }
  function updateChain(){
    const showD = HS.showDelta(cfg.skill) || HS.alwaysGreeks(G);
    chainCells.forEach(cc => {
      const cc1 = contractFor(cc.m, true), pp1 = contractFor(cc.m, false);
      const qc = quoteOf(cc1), qp = quoteOf(pp1);
      cc.c.innerHTML  = '<span class="px">' + qc.ask.toFixed(2) + '</span>' +
                        '<span class="k">' + cc1.strike.toFixed(cc1.strike<20?2:1) + '</span>' +
                        (showD ? '<span class="d">Δ' + qc.delta.toFixed(2) + '</span>' : '');
      cc.pu.innerHTML = '<span class="px">' + qp.ask.toFixed(2) + '</span>' +
                        '<span class="k">' + pp1.strike.toFixed(pp1.strike<20?2:1) + '</span>' +
                        (showD ? '<span class="d">Δ' + qp.delta.toFixed(2) + '</span>' : '');
      const sel = M.selected;
      cc.c.classList.toggle('sel', !!sel && sel.isCall && sel.moneyness === cc.m.label);
      cc.pu.classList.toggle('sel', !!sel && !sel.isCall && sel.moneyness === cc.m.label);
    });
  }
  function select(m, isCall){
    M.selected = contractFor(m, isCall);
    M.selected.hint = m.hint;
    HS.Audio.click(); updateChain(); sync();
  }
  renderChain();

  /* ---------- book ---------- */
  /* The book is marked to market every frame, but the rows are built once.
     Tearing them down and rebuilding them mid-frame destroys the CLOSE
     button between mousedown and mouseup, so the click never lands. */
  const bookEl = $('mkBook');
  let bookRows = [], bookKey = null;

  function renderBook(){
    const key = G.positions.map(p => p.id).join(',');
    if(key === bookKey){ updateBook(); return; }
    bookKey = key;
    bookRows = [];
    bookEl.innerHTML = '';
    $('mkBookCount').textContent = String(G.positions.length);

    if(!G.positions.length){
      bookEl.appendChild(HS.el('div','bk-empty','Nothing open. Pick a contract from the chain.'));
      return;
    }
    G.positions.forEach(p => {
      const row = HS.el('div','bk-row' + (p.qty>0?' long':' short'));
      const id  = HS.el('div','bk-id',
        '<b>' + (p.qty>0?'+':'') + p.qty + ' ' + HS.posName(p, G.day) + '</b><em></em>');
      const pnl = HS.el('div','bk-pnl');
      const btn = HS.el('button','bk-x','CLOSE');
      btn.addEventListener('click', () => closeById(p.id, false));
      row.appendChild(id); row.appendChild(pnl); row.appendChild(btn);
      bookEl.appendChild(row);
      bookRows.push({ p:p, pnl:pnl, sub:id.querySelector('em') });
    });
    updateBook();
  }

  /* Numbers only. Every node here already exists. */
  function updateBook(){
    bookRows.forEach(r => {
      const p = r.p;
      const net = p.qty * (quoteOf(p).mid - p.entry) * CS;
      r.pnl.textContent = HS.signed(net);
      r.pnl.className = 'bk-pnl ' + (net >= 0 ? 'g' : 'r');
      r.sub.innerHTML = p.moneyness + ' \u00b7 ' +
        (p.expiryDay <= HS.tradingDay(G.day)
          ? '<span class="dying">expires at the bell</span>'
          : HS.expiryLabel(p, G.day) + ' left');
    });
  }

  renderBook();

  $('mkTabChain').addEventListener('click', () => setTab('chain'));
  $('mkTabBook').addEventListener('click', () => setTab('book'));
  function setTab(t){
    M.tab = t;
    $('mkTabChain').classList.toggle('sel', t==='chain');
    $('mkTabBook').classList.toggle('sel', t==='book');
    $('mkChainPane').style.display = t==='chain' ? '' : 'none';
    $('mkBookPane').style.display  = t==='book' ? '' : 'none';
    HS.Audio.click();
  }
  setTab('chain');

  /* ---------- canvas ---------- */
  const cv = $('mkChart'), cx = cv.getContext('2d');
  let CW = 0, CH = 0;
  function fit(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    CW = cv.clientWidth; CH = cv.clientHeight;
    cv.width = Math.max(1, Math.round(CW*dpr));
    cv.height = Math.max(1, Math.round(CH*dpr));
    cx.setTransform(dpr,0,0,dpr,0,0);
  }
  fit();
  window.addEventListener('resize', fit);

  const PAD_R = 56, PAD_T = 14, PAD_B = 16, PAD_L = 10;
  function draw(){
    if(CW < 10) fit();
    cx.clearRect(0,0,CW,CH);
    const bars = M.bars.slice(-VIEW_BARS);
    if(!bars.length) return;
    let hi = -Infinity, lo = Infinity;
    for(const b of bars){ if(b.h>hi) hi=b.h; if(b.l<lo) lo=b.l; }
    const selK = M.selected ? M.selected.strike : null;
    if(selK != null){ hi = Math.max(hi, selK); lo = Math.min(lo, selK); }
    const span = Math.max(hi-lo, M.price*0.004);
    hi += span*0.10; lo -= span*0.10;
    const range = hi-lo;
    const pw = CW-PAD_R-PAD_L, ph = CH-PAD_T-PAD_B;
    const y = p => PAD_T + (hi-p)/range*ph;
    const bw = pw/VIEW_BARS;
    const x = i => PAD_L + (i + (VIEW_BARS-bars.length))*bw;

    cx.font = '10px "IBM Plex Mono",monospace';
    cx.textBaseline = 'middle'; cx.textAlign = 'left';
    for(let i = 0; i <= 4; i++){
      const p = lo + range*(i/4), yy = Math.round(y(p))+0.5;
      cx.strokeStyle = 'rgba(255,255,255,.04)';
      cx.beginPath(); cx.moveTo(PAD_L,yy); cx.lineTo(CW-PAD_R,yy); cx.stroke();
      cx.fillStyle = '#4C5568';
      cx.fillText(p.toFixed(M.tickSize < 0.05 ? 2 : 1), CW-PAD_R+6, yy);
    }

    // where your open strikes sit, plus the one you are looking at
    G.positions.filter(p => p.sym === sym).forEach(p => {
      const yy = y(p.strike);
      if(yy < PAD_T || yy > PAD_T+ph) return;
      cx.strokeStyle = p.qty > 0 ? 'rgba(63,214,140,.5)' : 'rgba(255,91,103,.5)';
      cx.setLineDash([3,4]); cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(PAD_L, yy); cx.lineTo(CW-PAD_R, yy); cx.stroke();
      cx.setLineDash([]);
    });
    if(selK != null){
      const yy = y(selK);
      cx.strokeStyle = 'rgba(232,184,92,.8)'; cx.lineWidth = 1.4;
      cx.beginPath(); cx.moveTo(PAD_L, yy); cx.lineTo(CW-PAD_R, yy); cx.stroke();
      cx.fillStyle = '#E8B85C'; cx.font = '600 9px "IBM Plex Mono",monospace';
      cx.fillText(M.selected.moneyness + ' ' + selK.toFixed(2), PAD_L+4, yy-7);
      cx.font = '10px "IBM Plex Mono",monospace';
    }

    const q = Math.max(HS.readFloor(G), HS.clamp((cfg.skill - 12)/88, 0, 1));
    if(q > 0.12){
      const d = M.regime.d, bull = d > 0.15, bear = d < -0.15;
      if(bull || bear){
        const a = 0.03 + q*0.08;
        const g = cx.createLinearGradient(0, PAD_T, 0, PAD_T+ph);
        const c = bull ? '63,214,140' : '255,91,103';
        g.addColorStop(bull?0:1, 'rgba('+c+','+a.toFixed(3)+')');
        g.addColorStop(bull?1:0, 'rgba('+c+',0)');
        cx.fillStyle = g; cx.fillRect(PAD_L, PAD_T, pw, ph);
      }
      if(q > 0.45 || HS.alwaysRegime(G)){
        cx.fillStyle = M.regime.d > 0.15 ? '#3FD68C' : M.regime.d < -0.15 ? '#FF5B67' : '#8993A5';
        cx.font = '600 10px "IBM Plex Mono",monospace';
        cx.fillText('TAPE ' + M.regime.kind, PAD_L+4, PAD_T+9);
      }
    }

    const cwid = Math.max(1.5, bw*0.6);
    for(let i = 0; i < bars.length; i++){
      const b = bars[i], cxp = x(i)+bw/2, up = b.c >= b.o;
      cx.strokeStyle = cx.fillStyle = up ? '#3FD68C' : '#FF5B67';
      cx.globalAlpha = i === bars.length-1 ? 1 : 0.85;
      cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(Math.round(cxp)+0.5, y(b.h)); cx.lineTo(Math.round(cxp)+0.5, y(b.l)); cx.stroke();
      const yo = y(b.o), yc = y(b.c);
      cx.fillRect(cxp-cwid/2, Math.min(yo,yc), cwid, Math.max(1.2, Math.abs(yc-yo)));
    }
    cx.globalAlpha = 1;

    const yp = y(M.price);
    const lastUp = bars[bars.length-1].c >= bars[bars.length-1].o;
    cx.fillStyle = lastUp ? '#3FD68C' : '#FF5B67';
    cx.beginPath();
    cx.moveTo(CW-PAD_R, yp); cx.lineTo(CW-PAD_R+6, yp-7); cx.lineTo(CW-2, yp-7);
    cx.lineTo(CW-2, yp+7); cx.lineTo(CW-PAD_R+6, yp+7); cx.closePath(); cx.fill();
    cx.fillStyle = '#07090D'; cx.font = '700 10px "IBM Plex Mono",monospace';
    cx.fillText(M.price.toFixed(M.tickSize < 0.05 ? 2 : 1), CW-PAD_R+9, yp);
  }

  /* ---------- hud ---------- */
  function sync(){
    const eq = equity();
    $('mkClock').textContent = HS.clockStr(marketHour());
    $('mkClock').className = 'mk-clock' + (prog() > 0.88 ? ' crit' : '');
    $('mkBell').style.width = (prog()*100).toFixed(1) + '%';
    $('mkEquity').textContent = HS.moneyFull(eq);
    $('mkEquity').style.color = eq >= cfg.startEquity ? 'var(--green)' : 'var(--red)';
    const pl = eq - cfg.startEquity;
    $('mkPnl').textContent = HS.signed(pl);
    $('mkPnl').style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
    $('mkTargetFill').style.width =
      (HS.clamp(pl / (cfg.startEquity * cfg.target), 0, 1)*100).toFixed(1) + '%';
    $('mkTargetVal').textContent = HS.money(cfg.startEquity * (1+cfg.target));

    const card = $('mkPos');
    if(M.selected){
      const q = quoteOf(M.selected);
      card.className = 'mk-pos sel';
      $('mkPosName').textContent = M.selected.moneyness + ' ' +
        (M.selected.isCall ? 'CALL' : 'PUT') + ' · ' + HS.posName(M.selected, G.day);
      const bits = [M.selected.hint, 'ask ' + q.ask.toFixed(2)];
      if(HS.showDelta(cfg.skill) || HS.alwaysGreeks(G)) bits.push('Δ ' + q.delta.toFixed(2));
      if(HS.showTheta(cfg.skill) || HS.alwaysGreeks(G)) bits.push('Θ ' + q.theta.toFixed(2) + '/day');
      if(HS.showIv(cfg.skill) || HS.alwaysIv(G)) bits.push('IV ' + (q.iv*100).toFixed(0) + '%');
      const n = sizedQty(M.selected, false);
      bits.push(n + ' contract' + (n===1?'':'s') + ' · ' + HS.money(q.ask*CS*n));
      $('mkPosInfo').textContent = bits.join(' · ');
    } else {
      card.className = 'mk-pos flat';
      $('mkPosName').textContent = 'NO CONTRACT SELECTED';
      $('mkPosInfo').textContent = 'Pick a call or a put from the chain.';
    }
    $('mkBuy').disabled = !M.selected;
    $('mkSell').disabled = !M.selected;
    [...document.querySelectorAll('#mkQty .mk-size')].forEach(b =>
      b.classList.toggle('sel', +b.dataset.pct === M.sizePct));
  }

  /* ---------- loop ---------- */
  function frame(now){
    if(M.finished) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - M.last)/1000);
    M.last = now;
    if(!M.running) return;
    if(flashT > 0){ flashT -= dt; if(flashT <= 0) $('mkFlash').classList.remove('show'); }

    M.acc += dt;
    let guard = 0;
    while(M.acc >= DT && guard++ < 12){
      M.acc -= DT;
      step(false);
      if(M.newsHide > 0){ M.newsHide -= DT; if(M.newsHide <= 0) $('mkNews').classList.remove('show'); }
      if(cfg.news){ M.nextNews -= DT; if(M.nextNews <= 0) fireNews(); }
      const eq = equity();
      if(eq > M.peak) M.peak = eq;
      if(eq < M.trough) M.trough = eq;
      if(eq <= cfg.startEquity * HS.bustFloor(G)){ finish('bust'); return; }
      if(M.tick >= TICKS){ finish('bell'); return; }
      if(cfg.coach && !M.coachedLate && G.positions.length && prog() > 0.55){
        M.coachedLate = true; coachLate(); return;
      }
      if(cfg.powerHour && !M.targetSeen &&
         eq >= cfg.startEquity * (1 + cfg.target) && prog() < POWER_PROG){
        M.targetSeen = true;
        offerPowerHour(eq);
        return;
      }
    }
    updateChain(); if(M.tab === 'book') renderBook();
    draw(); sync();
  }

  /* ---------- the first day ----------
     A new trader is told to buy a call and does, holds it into the bell and
     watches it die, four days running. That is the market being honest and
     the game being useless. So on the very first session the tape stops and
     explains itself, three times, and then leaves you alone for good. */
  let coachThen = null;
  function coach(title, html, label, then){
    M.running = false;
    $('mkBreakTitle').textContent = title;
    $('mkBreakNum').textContent = '';
    $('mkBreakNum').className = 'num';
    $('mkBreakText').innerHTML = html;
    $('mkBreakGo').textContent = label || 'Got it';
    $('mkBreakStop').style.display = 'none';
    $('mkBreak').classList.add('show');
    coachThen = then || (() => {});
  }
  function coachDone(){
    const f = coachThen; coachThen = null;
    $('mkBreak').classList.remove('show');
    $('mkBreakStop').style.display = '';
    $('mkBreakGo').textContent = 'TRADE THE POWER HOUR';
    M.running = true; M.last = performance.now(); M.acc = 0;
    requestAnimationFrame(frame);
    if(f) f();
  }

  function coachOpen(){
    coach('THE CHAIN',
      'Calls on the left, puts on the right, and the rungs between them are how far ' +
      'from the money each contract sits. <b>ATM</b> is the balanced bet. ' +
      '<b>OTM</b> is cheap and needs a real move to pay.' +
      '<br><br>Pick one, then <b>B</b> to buy it. Your supervisor said a cheap call. ' +
      'She did not say what happens next.',
      'Show me the chain');
  }
  function coachBought(){
    coach('YOU ARE LONG',
      'That is a <b>0DTE</b>. It expires at tonight\'s bell and it is losing value every ' +
      'minute it sits there, whether the price moves or not. That bleed is <b>theta</b>, ' +
      'and it is the whole reason most first days end red.' +
      '<br><br>You do not have to hold it. <b>Space</b> closes your position at the ' +
      'current price, and the money is yours the moment you do.',
      'Understood');
  }
  function coachLate(){
    coach('THE BELL IS COMING',
      'You are still holding it. At four o\'clock this contract settles at whatever it is ' +
      'actually worth, and an out-of-the-money one is worth nothing at all.' +
      '<br><br>Close it with <b>space</b>, or hold and find out. Either way the rest of the ' +
      'day is yours: no more interruptions.',
      'Leave me to it');
  }

  /* ---------- the power hour ----------
     Hitting the number early is a decision, not a finish line. Bank it and
     the day is yours, or sit out the quiet middle and come back for the last
     hour, which is where the day actually moves. */
  const POWER_HOUR = 15.0;
  const POWER_PROG = (POWER_HOUR - HS.MARKET_OPEN) / (HS.MARKET_CLOSE - HS.MARKET_OPEN);

  function offerPowerHour(eq){
    M.running = false;
    HS.Audio.cash();
    const made = eq - cfg.startEquity;
    $('mkBreakTitle').textContent = 'TARGET HIT';
    $('mkBreakNum').textContent = HS.signed(made);
    $('mkBreakNum').className = 'num ' + (made >= 0 ? 'g' : 'r');
    $('mkBreakText').innerHTML =
      'You are done for the day at ' + HS.clockStr(marketHour()) + ', and the middle of the ' +
      'session is nothing but chop.' +
      (G.positions.length
        ? '<br><br><b class="y">' + G.positions.length + ' contract' + (G.positions.length===1?'':'s') +
          ' still open.</b> Anything you leave on rides the afternoon without you.'
        : '') +
      '<br><br>The last hour is where the volume comes back.';
    $('mkBreak').classList.add('show');
  }

  function skipToPowerHour(){
    $('mkBreak').classList.remove('show');
    const target = Math.floor(TICKS * POWER_PROG);
    let rough = false;
    while(M.tick < target){
      step(false);
      /* If the afternoon goes against what you left open, you come back to it
         rather than being wiped out while you were not watching. */
      if(equity() <= cfg.startEquity * HS.bustFloor(G) * 1.35){ rough = true; break; }
    }
    M.power = true;
    updateChain(); renderBook(); draw(); sync();
    countdown(3, () => {
      M.running = true; M.last = performance.now(); M.acc = 0;
      flash(rough ? 'You come back to a mess.' : 'Power hour. Size comes back in.');
      requestAnimationFrame(frame);
    });
  }

  function countdown(n, done2){
    const el = $('mkCount'), num = $('mkCountNum');
    el.classList.add('show');
    (function tick(k){
      num.textContent = k > 0 ? k : 'OPEN';
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if(k <= 0){ setTimeout(() => { el.classList.remove('show'); done2(); }, 620); return; }
      setTimeout(() => tick(k - 1), 700);
    })(n);
  }

  function finish(reason){
    if(M.finished) return;
    let settled = [];
    if(reason === 'bust'){
      G.positions.slice().forEach(p => closeById(p.id, true));
    } else {
      /* Banking the day has to actually bank it. Anything that dies tonight
         comes off at the mark, because a player who was told they hit their
         number and then watched it settle away has been lied to. Longer
         dated contracts still ride: carrying those is the point of them. */
      if(reason === 'target'){
        const td = HS.tradingDay(G.day);
        G.positions.slice().filter(p => p.expiryDay <= td)
          .forEach(p => closeById(p.id, true));
      }
      settled = settleAtBell();
    }
    M.finished = true; M.running = false;
    detach();
    root.classList.remove('show');
    G.market.tickers[sym].price = M.price;
    const eq = equity();
    done({
      pnl: eq - cfg.startEquity,
      finalEquity: eq,
      returnPct: (eq - cfg.startEquity) / Math.max(1, cfg.startEquity),
      /* Reaching the number counts even if you banked it and the closing
         spread put you a hair back under. You made the day. */
      hitTarget: M.targetSeen || eq >= cfg.startEquity * (1 + cfg.target),
      busted: reason === 'bust',
      trades: M.trades, wins: M.wins, settled,
      closePrice: M.price, symbol: sym
    });
  }

  /* ---------- controls ---------- */
  const onBuy = () => M.running && openPos(1);
  const onSell = () => M.running && openPos(-1);
  const onClose = () => { if(M.running && G.positions.length) closeById(G.positions[G.positions.length-1].id, false); };
  const onQty = e => { M.sizePct = +e.currentTarget.dataset.pct; HS.Audio.click(); sync(); };
  function onKey(e){
    if(!M.running) return;
    const k = e.key.toLowerCase();
    if(k === 'b'){ onBuy(); e.preventDefault(); }
    else if(k === 's'){ onSell(); e.preventDefault(); }
    else if(k === ' ' || k === 'f'){ onClose(); e.preventDefault(); }
    else if(k === 'tab'){
      M.expIdx = (M.expIdx + 1) % expiries.length; M.selected = null;
      renderTabs(); renderChain(); sync(); e.preventDefault();
    }
    else if(k >= '1' && k <= '5'){ select(MONEY[+k-1], !e.shiftKey); e.preventDefault(); }
  }
  const onPower = () => { if(coachThen) coachDone(); else skipToPowerHour(); };
  const onBank  = () => { $('mkBreak').classList.remove('show'); finish('target'); };
  $('mkBuy').addEventListener('click', onBuy);
  $('mkSell').addEventListener('click', onSell);
  $('mkBreakGo').addEventListener('click', onPower);
  $('mkBreakStop').addEventListener('click', onBank);
  document.querySelectorAll('#mkQty .mk-size').forEach(b => b.addEventListener('click', onQty));
  window.addEventListener('keydown', onKey, true);
  function detach(){
    $('mkBuy').removeEventListener('click', onBuy);
    $('mkSell').removeEventListener('click', onSell);
    $('mkBreakGo').removeEventListener('click', onPower);
    $('mkBreakStop').removeEventListener('click', onBank);
    $('mkBreak').classList.remove('show');
    $('mkCount').classList.remove('show');
    document.querySelectorAll('#mkQty .mk-size').forEach(b => b.removeEventListener('click', onQty));
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
  }

  /* ---------- opening bell ---------- */
  M.peak = M.trough = cfg.startEquity;
  draw(); sync();
  let n = 3;
  $('mkCount').classList.add('show');
  (function tick(){
    $('mkCountNum').textContent = n > 0 ? n : 'OPEN';
    const el = $('mkCountNum');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    n > 0 ? HS.Audio.click() : HS.Audio.enter();
    if(n < 0){
      $('mkCount').classList.remove('show');
      M.running = true; M.last = performance.now();
      requestAnimationFrame(frame);
      if(cfg.coach) coachOpen();
      return;
    }
    n--;
    setTimeout(tick, 650);
  })();

  return { abort: () => finish('bell') };
};

/* What the desk lets you see, earned with skill. */
HS.showDelta = s => s >= 22;
HS.showTheta = s => s >= 42;
HS.showIv    = s => s >= 62;

})(window.HS);
