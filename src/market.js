/* MARKET MAKER — the trading session.
   The underlying runs a regime-driven tape; you trade options on it from an
   opening chain. The session *is* the 9:30-16:00 day, so 0DTE dies at the bell. */
window.HS = window.HS || {};
(function(HS){
'use strict';
const $ = HS.$;

const SIM_HZ = 10, DT = 1/SIM_HZ, TICKS_PER_BAR = 5, VIEW_BARS = 52;
const STRIKES = 7;                       // 3 below, ATM, 3 above
const CS = 100;                          // shares per contract

const SYMBOLS = {
  VLT:{ name:'Volatis Systems',  px: 84.20, tick:0.01 },
  NRG:{ name:'Nordrig Energy',   px:142.75, tick:0.01 },
  QNT:{ name:'Quantex Labs',     px: 31.60, tick:0.01 },
  BTX:{ name:'Bitrex Composite', px:608.00, tick:0.05 },
  ARC:{ name:'Arclight Media',   px: 57.40, tick:0.01 },
  HLX:{ name:'Helix Bio',        px: 96.10, tick:0.01 }
};
HS.SYMBOLS = SYMBOLS;

const HEADLINES = {
  up:['beats on earnings, guides higher','lands a sovereign supply contract',
      'upgraded to Overweight','announces a buyback','clears review early',
      'squeezes its shorts to a record low'],
  down:['misses guidance, CFO resigns','regulator opens a formal probe',
        'downgraded to Underperform','recalls its flagship line',
        'loses its anchor client','has its credit facility pulled']
};

/* What the desk lets you see, earned with skill. */
HS.showDelta = s => s >= 25;
HS.showTheta = s => s >= 45;
HS.showIv    = s => s >= 65;

HS.Market = {};

HS.Market.run = function(opts, done){
  const cfg = Object.assign({
    symbol:'VLT', capital:10000, duration:75, target:0.10,
    vol:0.0011, trendStr:0.9, chop:0.34, regimeT:[7,14],
    skill:10, rank:1, edge:null, feePerContract:0.65,
    news:[16,30], shock:0.03, title:'SESSION', sub:''
  }, opts || {});

  const base = SYMBOLS[cfg.symbol];
  const TICKS = Math.round(cfg.duration * SIM_HZ);
  const baseIv = HS.impliedFromTape(cfg.vol, TICKS);
  const dailySigma = baseIv / Math.sqrt(252);

  const S = {
    price: base.px * (0.94 + Math.random()*0.12),
    tickSize: base.tick,
    open:0, bars:[], sub:0, tick:0,
    regime:null, regimeLeft:0, shock:0, shockLeft:0,
    cash: cfg.capital, pos:null,
    selected:null, qty:1, expIdx:0,
    acc:0, last:0, running:false, finished:false,
    trades:0, wins:0, streak:0, bestStreak:0,
    peak:cfg.capital, trough:cfg.capital,
    nextNews: cfg.news ? cfg.news[0]*0.6 + Math.random()*cfg.news[1] : Infinity,
    newsHide:0, chain:null
  };
  S.price = Math.round(S.price / S.tickSize) * S.tickSize;
  S.open = S.price;
  S.bars.push(bar(S.price));
  newRegime(true);

  // warm the tape so the chart opens with readable history
  for(let i = 0; i < VIEW_BARS * TICKS_PER_BAR; i++) step(true);
  S.open = S.price; S.shock = 0; S.shockLeft = 0; S.tick = 0;
  S.bars = S.bars.slice(-VIEW_BARS);
  newRegime(true);

  // a chart review pre-loads the day with a direction you already know about
  if(cfg.edge){
    const d = cfg.edge.dir * (0.7 + Math.random()*0.5) * cfg.trendStr;
    S.regime = { d, kind: d > 0 ? 'BID' : 'OFFERED' };
    S.regimeLeft = Math.max(S.regimeLeft, cfg.duration * 0.42);
  }

  const targetEquity = cfg.capital * (1 + cfg.target);
  const bustEquity   = cfg.capital * 0.40;
  const expiries = HS.EXPIRIES.filter(e => cfg.rank >= e.unlockRank);
  if(!expiries.length) expiries.push(HS.EXPIRIES[0]);

  function bar(p){ return { o:p, h:p, l:p, c:p }; }
  const prog = () => HS.clamp(S.tick / TICKS, 0, 1);
  const marketHour = () => HS.MARKET_OPEN + prog() * (HS.MARKET_CLOSE - HS.MARKET_OPEN);

  function newRegime(first){
    const r = Math.random(), side = (1 - cfg.chop) / 2;
    let d;
    if(r < side)          d =  (0.55 + Math.random()*0.45) * cfg.trendStr;
    else if(r < side * 2) d = -(0.55 + Math.random()*0.45) * cfg.trendStr;
    else                  d = (Math.random()*0.28 - 0.14);
    if(first && Math.abs(d) > 0.2) d *= 0.6;
    S.regime = { d, kind: d > 0.2 ? 'BID' : d < -0.2 ? 'OFFERED' : 'RANGE' };
    S.regimeLeft = cfg.regimeT[0] + Math.random() * (cfg.regimeT[1] - cfg.regimeT[0]);
  }

  function step(warm){
    S.regimeLeft -= DT;
    if(S.regimeLeft <= 0) newRegime(false);
    const stretch = (S.price - S.open) / S.open;
    let ret = (S.regime.d * cfg.vol * 0.45) + (HS.gauss() * cfg.vol) + (-stretch * 0.05 * cfg.vol * 8);
    if(S.shockLeft > 0){ ret += S.shock; S.shockLeft--; }
    S.price = Math.max(S.tickSize * 5, S.price * (1 + ret));
    S.price = Math.round(S.price / S.tickSize) * S.tickSize;
    const b = S.bars[S.bars.length-1];
    b.c = S.price;
    if(S.price > b.h) b.h = S.price;
    if(S.price < b.l) b.l = S.price;
    if(++S.sub >= TICKS_PER_BAR){
      S.sub = 0;
      S.bars.push(bar(S.price));
      if(S.bars.length > 320) S.bars.shift();
    }
    if(!warm) S.tick++;
  }

  /* ---------- book ---------- */
  function markPos(){
    if(!S.pos) return null;
    return HS.quoteContract(S.pos.contract, S.price, baseIv, prog());
  }
  function posValue(){
    if(!S.pos) return 0;
    const q = markPos();
    return S.pos.qty * q.mid * CS;              // negative qty => a liability
  }
  const equity = () => S.cash + posValue();
  function openPnl(){
    if(!S.pos) return 0;
    const q = markPos();
    return S.pos.qty * (q.mid - S.pos.entry) * CS;
  }

  function maxQty(isShort){
    const eq = equity();
    if(!S.selected) return 0;
    const q = HS.quoteContract(S.selected, S.price, baseIv, prog());
    if(isShort){
      const margin = S.selected.strike * CS * 0.25;      // naked margin
      return Math.max(0, Math.floor(eq * 0.6 / Math.max(1, margin)));
    }
    const cost = q.ask * CS + cfg.feePerContract;
    return Math.max(0, Math.floor(eq * 0.85 / Math.max(0.01, cost)));
  }

  function openPos(dir){
    if(!S.selected || S.pos) return;
    const qty = Math.min(S.qty, maxQty(dir < 0));
    if(qty < 1){ flash('Not enough capital for that size.'); return; }
    const q = HS.quoteContract(S.selected, S.price, baseIv, prog());
    const px = dir > 0 ? q.ask : q.bid;
    const fee = cfg.feePerContract * qty;
    S.cash -= dir * px * CS * qty;               // buying spends, writing credits
    S.cash -= fee;
    S.pos = { contract:S.selected, qty: dir * qty, entry: px };
    dir > 0 ? HS.Audio.buy() : HS.Audio.sell();
    log('<b class="' + (dir>0?'g':'r') + '">' + (dir>0?'BOT':'SOLD') + '</b> ' + qty + 'x ' +
        HS.contractName(S.selected) + ' @ ' + px.toFixed(2));
    sync();
  }

  function closePos(quiet){
    if(!S.pos) return 0;
    const q = markPos();
    const long = S.pos.qty > 0;
    const px = long ? q.bid : q.ask;
    const qty = Math.abs(S.pos.qty);
    const fee = cfg.feePerContract * qty;
    S.cash += S.pos.qty * px * CS;
    S.cash -= fee;
    const net = S.pos.qty * (px - S.pos.entry) * CS - fee;
    const name = HS.contractName(S.pos.contract);
    S.pos = null;
    S.trades++;
    if(net > 0){ S.wins++; S.streak++; if(S.streak > S.bestStreak) S.bestStreak = S.streak; }
    else S.streak = 0;
    if(!quiet){
      pop(HS.signed(net), net >= 0);
      net >= 0 ? HS.Audio.cash() : HS.Audio.loss();
      log('<b class="' + (net>=0?'g':'r') + '">CLOSE</b> ' + name + ' ' +
          '<span class="' + (net>=0?'g':'r') + '">' + HS.signed(net) + '</span>');
    }
    sync();
    return net;
  }

  /* Settle anything still open at the bell, at intrinsic. */
  function settle(){
    if(!S.pos) return;
    const c = S.pos.contract;
    const intrinsic = c.isCall ? Math.max(0, S.price - c.strike) : Math.max(0, c.strike - S.price);
    const net = S.pos.qty * (intrinsic - S.pos.entry) * CS;
    S.cash += S.pos.qty * intrinsic * CS;
    log('<b class="y">BELL</b> ' + HS.contractName(c) + ' settles at ' + intrinsic.toFixed(2));
    S.pos = null;
    S.trades++;
    if(net > 0) S.wins++;
  }

  function fireNews(){
    const up = Math.random() < 0.5;
    const mag = cfg.shock * (0.45 + Math.random()*0.55);
    S.shock = (up ? 1 : -1) * (Math.pow(1 + mag, 1/3) - 1);
    S.shockLeft = 3;
    const list = up ? HEADLINES.up : HEADLINES.down;
    $('mkNewsText').textContent = base.name + ' ' + list[Math.floor(Math.random()*list.length)];
    $('mkNews').classList.add('show');
    S.newsHide = 5;
    HS.Audio.alarm();
    S.nextNews = cfg.news[0] + Math.random() * (cfg.news[1] - cfg.news[0]);
  }

  /* ---------- dom ---------- */
  const root = $('market');
  $('mkTitle').textContent = cfg.title;
  $('mkSub').textContent = cfg.sub || (base.name + ' · ' + cfg.symbol);
  $('mkNews').classList.remove('show');
  $('mkLog').innerHTML = '';
  root.classList.add('show');

  const edgeBadge = $('mkEdge');
  if(cfg.edge){
    edgeBadge.style.display = '';
    const shown = cfg.edge.shown != null ? cfg.edge.shown : cfg.edge.dir;
    edgeBadge.className = 'mk-edge ' + (shown > 0 ? 'golden' : 'death');
    edgeBadge.textContent = (shown > 0 ? '▲ GOLDEN CROSS' : '▼ DEATH CROSS') +
                            ' · ' + cfg.edge.confidence + '% READ';
  } else edgeBadge.style.display = 'none';

  function log(html){
    const d = HS.el('div', null, html);
    $('mkLog').insertBefore(d, $('mkLog').firstChild);
    while($('mkLog').children.length > 12) $('mkLog').removeChild($('mkLog').lastChild);
  }
  function pop(text, good){
    const e = HS.el('div', 'mk-pop', text);
    e.style.color = good ? 'var(--green)' : 'var(--red)';
    e.style.left = (28 + Math.random()*40) + '%';
    $('mkChartWrap').appendChild(e);
    setTimeout(() => e.remove(), 1100);
  }
  let flashT = 0;
  function flash(msg){
    const el = $('mkFlash');
    el.textContent = msg; el.classList.add('show'); flashT = 1.6;
  }

  /* ---------- expiry tabs ---------- */
  const tabsEl = $('mkExpiries');
  tabsEl.innerHTML = '';
  HS.EXPIRIES.forEach(e => {
    const locked = cfg.rank < e.unlockRank;
    const b = HS.el('button', 'mk-exp' + (locked ? ' locked' : ''));
    b.innerHTML = '<span>' + e.name + '</span><small>' + (locked ? 'RANK ' + e.unlockRank : e.label) + '</small>';
    if(!locked){
      b.addEventListener('click', () => {
        S.expIdx = expiries.indexOf(e);
        S.selected = null;
        HS.Audio.click();
        renderTabs(); buildChain(); renderChain(); sync();
      });
    }
    b.dataset.exp = e.id;
    tabsEl.appendChild(b);
  });
  function renderTabs(){
    [...tabsEl.children].forEach(b => {
      b.classList.toggle('sel', b.dataset.exp === expiries[S.expIdx].id);
    });
  }
  renderTabs();

  /* ---------- chain ---------- */
  function buildChain(){
    S.chain = HS.buildChain({
      spot: S.price, expiry: expiries[S.expIdx],
      baseIv, dailySigma, prog: prog(), strikes: STRIKES
    });
  }

  const chainEl = $('mkChain');
  let chainRows = [];
  function renderChain(){
    chainEl.innerHTML = '';
    chainRows = [];
    const showD = HS.showDelta(cfg.skill);

    const head = HS.el('div', 'ch-head');
    head.innerHTML = '<span class="side">CALLS</span>' +
                     '<span class="k">STRIKE</span>' +
                     '<span class="side">PUTS</span>';
    chainEl.appendChild(head);

    const sub = HS.el('div', 'ch-row ch-sub');
    sub.dataset.d = showD ? '1' : '0';
    sub.innerHTML =
      '<span class="ch-side">' + (showD ? '<span>BID</span><span>ASK</span><span>Δ</span>'
                                        : '<span>BID</span><span>ASK</span>') + '</span>' +
      '<span class="ch-strike"></span>' +
      '<span class="ch-side">' + (showD ? '<span>Δ</span><span>BID</span><span>ASK</span>'
                                        : '<span>BID</span><span>ASK</span>') + '</span>';
    chainEl.appendChild(sub);

    S.chain.strikes.forEach(r => {
      const row = HS.el('div', 'ch-row');
      row.dataset.d = showD ? '1' : '0';
      const atm = Math.abs(r.strike - S.chain.atm) < 1e-6;
      if(atm) row.classList.add('atm');

      const cCell = HS.el('button', 'ch-side call');
      const pCell = HS.el('button', 'ch-side put');
      const strike = HS.el('span', 'ch-strike', r.strike.toFixed(r.strike < 20 ? 2 : 1));

      cCell.innerHTML = '<span class="b">' + r.call.bid.toFixed(2) + '</span>' +
                        '<span class="a">' + r.call.ask.toFixed(2) + '</span>' +
                        (showD ? '<span class="d">' + r.call.delta.toFixed(2) + '</span>' : '');
      pCell.innerHTML = (showD ? '<span class="d">' + r.put.delta.toFixed(2) + '</span>' : '') +
                        '<span class="b">' + r.put.bid.toFixed(2) + '</span>' +
                        '<span class="a">' + r.put.ask.toFixed(2) + '</span>';

      if(r.strike < S.price) cCell.classList.add('itm');
      if(r.strike > S.price) pCell.classList.add('itm');
      cCell.addEventListener('click', () => select(r.strike, true));
      pCell.addEventListener('click', () => select(r.strike, false));

      row.appendChild(cCell); row.appendChild(strike); row.appendChild(pCell);
      chainEl.appendChild(row);
      chainRows.push({ row, cCell, pCell, strike: r.strike });
    });
    markSelection();
  }

  function updateChainPrices(){
    const showD = HS.showDelta(cfg.skill);
    S.chain.strikes.forEach((r, i) => {
      const cr = chainRows[i];
      if(!cr) return;
      cr.cCell.children[0].textContent = r.call.bid.toFixed(2);
      cr.cCell.children[1].textContent = r.call.ask.toFixed(2);
      if(showD) cr.cCell.children[2].textContent = r.call.delta.toFixed(2);
      const pOff = showD ? 1 : 0;
      if(showD) cr.pCell.children[0].textContent = r.put.delta.toFixed(2);
      cr.pCell.children[pOff].textContent = r.put.bid.toFixed(2);
      cr.pCell.children[pOff+1].textContent = r.put.ask.toFixed(2);
      cr.row.classList.toggle('atm', Math.abs(r.strike - S.chain.atm) < 1e-6);
      cr.cCell.classList.toggle('itm', r.strike < S.price);
      cr.pCell.classList.toggle('itm', r.strike > S.price);
    });
  }

  function select(strike, isCall){
    if(S.pos){ flash('Close your position first.'); return; }
    S.selected = { symbol: cfg.symbol, strike, isCall, expiry: expiries[S.expIdx] };
    HS.Audio.click();
    markSelection(); sync();
  }
  function markSelection(){
    chainRows.forEach(cr => {
      const sel = S.selected && Math.abs(cr.strike - S.selected.strike) < 1e-6;
      cr.cCell.classList.toggle('sel', !!sel && S.selected.isCall);
      cr.pCell.classList.toggle('sel', !!sel && !S.selected.isCall);
    });
  }

  buildChain(); renderChain();

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
    const bars = S.bars.slice(-VIEW_BARS);
    if(!bars.length) return;
    let hi = -Infinity, lo = Infinity;
    for(const b of bars){ if(b.h>hi) hi=b.h; if(b.l<lo) lo=b.l; }
    const strikesShown = S.chain ? S.chain.strikes.map(r=>r.strike) : [];
    const selK = S.selected ? S.selected.strike : (S.pos ? S.pos.contract.strike : null);
    if(selK != null){ hi = Math.max(hi, selK); lo = Math.min(lo, selK); }
    const span = Math.max(hi-lo, S.price*0.004);
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
      cx.fillText(p.toFixed(S.tickSize < 0.05 ? 2 : 1), CW-PAD_R+6, yy);
    }

    // strike ladder, so the chain and the chart are visibly the same thing
    strikesShown.forEach(K => {
      const yy = y(K);
      if(yy < PAD_T || yy > PAD_T+ph) return;
      const isSel = selK != null && Math.abs(K - selK) < 1e-6;
      cx.strokeStyle = isSel ? 'rgba(232,184,92,.75)' : 'rgba(255,255,255,.07)';
      cx.setLineDash(isSel ? [] : [3,4]);
      cx.lineWidth = isSel ? 1.4 : 1;
      cx.beginPath(); cx.moveTo(PAD_L, yy); cx.lineTo(CW-PAD_R, yy); cx.stroke();
      cx.setLineDash([]);
      if(isSel){
        cx.fillStyle = '#E8B85C';
        cx.font = '600 9px "IBM Plex Mono",monospace';
        cx.fillText('K ' + K.toFixed(2), PAD_L+4, yy-7);
        cx.font = '10px "IBM Plex Mono",monospace';
      }
    });

    // the tape bias leaks through as skill rises
    const q = HS.clamp((cfg.skill - 12) / 88, 0, 1);
    if(q > 0.12){
      const d = S.regime.d;
      const bull = d > 0.15, bear = d < -0.15;
      if(bull || bear){
        const a = 0.03 + q*0.08;
        const g = cx.createLinearGradient(0, PAD_T, 0, PAD_T+ph);
        const c = bull ? '63,214,140' : '255,91,103';
        g.addColorStop(bull?0:1, 'rgba('+c+','+a.toFixed(3)+')');
        g.addColorStop(bull?1:0, 'rgba('+c+',0)');
        cx.fillStyle = g; cx.fillRect(PAD_L, PAD_T, pw, ph);
      }
      if(q > 0.45){
        cx.fillStyle = S.regime.d > 0.15 ? '#3FD68C' : S.regime.d < -0.15 ? '#FF5B67' : '#8993A5';
        cx.font = '600 10px "IBM Plex Mono",monospace';
        cx.fillText('TAPE ' + S.regime.kind, PAD_L+4, PAD_T+9);
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

    const yp = y(S.price);
    const lastUp = bars[bars.length-1].c >= bars[bars.length-1].o;
    cx.fillStyle = lastUp ? '#3FD68C' : '#FF5B67';
    cx.beginPath();
    cx.moveTo(CW-PAD_R, yp); cx.lineTo(CW-PAD_R+6, yp-7); cx.lineTo(CW-2, yp-7);
    cx.lineTo(CW-2, yp+7); cx.lineTo(CW-PAD_R+6, yp+7); cx.closePath(); cx.fill();
    cx.fillStyle = '#07090D'; cx.font = '700 10px "IBM Plex Mono",monospace';
    cx.fillText(S.price.toFixed(S.tickSize < 0.05 ? 2 : 1), CW-PAD_R+9, yp);
  }

  /* ---------- hud ---------- */
  function sync(){
    const eq = equity();
    const h = marketHour();
    $('mkClock').textContent = HS.clockStr(h);
    const left = 1 - prog();
    $('mkClock').className = 'mk-clock' + (left < 0.12 ? ' crit' : '');
    $('mkBell').style.width = (prog()*100).toFixed(1) + '%';

    $('mkEquity').textContent = HS.moneyFull(eq);
    $('mkEquity').style.color = eq >= cfg.capital ? 'var(--green)' : 'var(--red)';
    const pl = eq - cfg.capital;
    $('mkPnl').textContent = HS.signed(pl);
    $('mkPnl').style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
    $('mkTargetFill').style.width =
      (HS.clamp((eq - cfg.capital)/(targetEquity - cfg.capital), 0, 1)*100).toFixed(1) + '%';
    $('mkTargetVal').textContent = HS.money(targetEquity);

    // selection / position readout
    const card = $('mkPos');
    if(S.pos){
      const q = markPos();
      const long = S.pos.qty > 0;
      card.className = 'mk-pos ' + (long ? 'long' : 'short');
      $('mkPosName').textContent = (long ? '+' : '-') + Math.abs(S.pos.qty) + ' ' +
                                   HS.contractName(S.pos.contract);
      const op = openPnl();
      const bits = ['entry ' + S.pos.entry.toFixed(2), 'mark ' + q.mid.toFixed(2)];
      if(HS.showDelta(cfg.skill)) bits.push('Δ ' + (q.delta * S.pos.qty * CS).toFixed(0));
      if(HS.showTheta(cfg.skill)) bits.push('Θ ' + HS.money(q.theta * S.pos.qty * CS));
      if(HS.showIv(cfg.skill))    bits.push('IV ' + (q.iv*100).toFixed(0) + '%');
      $('mkPosInfo').innerHTML = bits.join(' · ') +
        ' <b style="color:' + (op>=0?'var(--green)':'var(--red)') + '">' + HS.signed(op) + '</b>';
    } else if(S.selected){
      const q = HS.quoteContract(S.selected, S.price, baseIv, prog());
      card.className = 'mk-pos sel';
      $('mkPosName').textContent = HS.contractName(S.selected);
      const bits = ['bid ' + q.bid.toFixed(2), 'ask ' + q.ask.toFixed(2)];
      if(HS.showDelta(cfg.skill)) bits.push('Δ ' + q.delta.toFixed(2));
      if(HS.showTheta(cfg.skill)) bits.push('Θ ' + q.theta.toFixed(2) + '/day');
      if(HS.showIv(cfg.skill))    bits.push('IV ' + (q.iv*100).toFixed(0) + '%');
      $('mkPosInfo').innerHTML = bits.join(' · ') +
        ' <span class="dim">· ' + HS.money(q.ask*CS*S.qty) + ' to buy ' + S.qty + '</span>';
    } else {
      card.className = 'mk-pos flat';
      $('mkPosName').textContent = 'NO CONTRACT SELECTED';
      $('mkPosInfo').innerHTML = '<span class="dim">Tap a bid/ask in the chain to pick one.</span>';
    }

    $('mkBuy').disabled = !S.selected || !!S.pos;
    $('mkSell').disabled = !S.selected || !!S.pos;
    $('mkClose').disabled = !S.pos;
    [...document.querySelectorAll('#mkQty .mk-size')].forEach(b =>
      b.classList.toggle('sel', +b.dataset.qty === S.qty));
  }

  /* ---------- loop ---------- */
  function frame(now){
    if(S.finished) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - S.last)/1000);
    S.last = now;
    if(!S.running) return;

    if(flashT > 0){ flashT -= dt; if(flashT <= 0) $('mkFlash').classList.remove('show'); }

    S.acc += dt;
    let guard = 0;
    while(S.acc >= DT && guard++ < 12){
      S.acc -= DT;
      step(false);
      if(S.newsHide > 0){
        S.newsHide -= DT;
        if(S.newsHide <= 0) $('mkNews').classList.remove('show');
      }
      if(cfg.news){
        S.nextNews -= DT;
        if(S.nextNews <= 0) fireNews();
      }
      const eq = equity();
      if(eq > S.peak) S.peak = eq;
      if(eq < S.trough) S.trough = eq;
      if(eq <= bustEquity){ finish('bust'); return; }
      if(S.tick >= TICKS){ finish('bell'); return; }
    }
    buildChain(); updateChainPrices();
    draw(); sync();
  }

  function finish(reason){
    if(S.finished) return;
    if(reason === 'bell') settle(); else closePos(true);
    S.finished = true; S.running = false;
    detach();
    root.classList.remove('show');
    const eq = equity();
    done({
      pnl: eq - cfg.capital,
      finalEquity: eq,
      returnPct: (eq - cfg.capital) / cfg.capital,
      hitTarget: eq >= targetEquity,
      busted: reason === 'bust',
      trades: S.trades, wins: S.wins, bestStreak: S.bestStreak,
      drawdown: (S.peak - S.trough) / cfg.capital
    });
  }

  /* ---------- controls ---------- */
  const onBuy = () => S.running && openPos(1);
  const onSell = () => S.running && openPos(-1);
  const onClose = () => S.running && closePos(false);
  const onQty = e => { S.qty = +e.currentTarget.dataset.qty; HS.Audio.click(); sync(); };
  function onKey(e){
    if(!S.running) return;
    const k = e.key.toLowerCase();
    if(k === 'b'){ onBuy(); e.preventDefault(); }
    else if(k === 's'){ onSell(); e.preventDefault(); }
    else if(k === ' ' || k === 'f'){ onClose(); e.preventDefault(); }
    else if(k === 'tab'){
      S.expIdx = (S.expIdx + 1) % expiries.length; S.selected = null;
      renderTabs(); buildChain(); renderChain(); sync(); e.preventDefault();
    }
    else if(k >= '1' && k <= '7'){
      const r = S.chain.strikes[+k - 1];
      if(r) select(r.strike, !e.shiftKey);
      e.preventDefault();
    }
  }
  $('mkBuy').addEventListener('click', onBuy);
  $('mkSell').addEventListener('click', onSell);
  $('mkClose').addEventListener('click', onClose);
  document.querySelectorAll('#mkQty .mk-size').forEach(b => b.addEventListener('click', onQty));
  window.addEventListener('keydown', onKey, true);

  function detach(){
    $('mkBuy').removeEventListener('click', onBuy);
    $('mkSell').removeEventListener('click', onSell);
    $('mkClose').removeEventListener('click', onClose);
    document.querySelectorAll('#mkQty .mk-size').forEach(b => b.removeEventListener('click', onQty));
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
  }

  /* ---------- open the bell ---------- */
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
      S.running = true; S.last = performance.now();
      requestAnimationFrame(frame);
      return;
    }
    n--;
    setTimeout(tick, 650);
  })();

  return { abort: () => finish('bell') };
};

})(window.HS);
