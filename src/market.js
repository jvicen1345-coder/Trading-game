/* MARKET MAKER — the trading shift. A live tape you trade against the clock. */
window.HS = window.HS || {};
(function(HS){
'use strict';
const $ = HS.$;

const SIM_HZ = 10, DT = 1/SIM_HZ, TICKS_PER_BAR = 5, VIEW_BARS = 54;

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

/* Skill sharpens your read: at high skill the tape's bias leaks into the chart. */
function readQuality(skill){ return HS.clamp((skill - 12) / 88, 0, 1); }

HS.Market = {};

HS.Market.run = function(opts, done){
  const cfg = Object.assign({
    symbol:'VLT', capital:10000, leverage:1, fee:0.0006,
    vol:0.0036, trendStr:0.9, chop:0.34, regimeT:[6,11],
    duration:45, target:0.10, skill:10, tip:false, news:[10,18], shock:0.03,
    title:'MORNING SESSION', sub:'', keepPct:1
  }, opts || {});

  const base = SYMBOLS[cfg.symbol];
  const state = {
    price: base.px * (0.94 + Math.random()*0.12),
    tickSize: base.tick,
    open:0, bars:[], sub:0,
    regime:null, regimeLeft:0, shock:0, shockLeft:0,
    cash: cfg.capital, qty:0, entry:0,
    sizePct:0.5, timeLeft:cfg.duration, acc:0, last:0,
    trades:0, wins:0, streak:0, bestStreak:0, peak:cfg.capital, trough:cfg.capital,
    nextNews: cfg.news ? HS.rng(Date.now()&0xffff).range(cfg.news[0]*0.5, cfg.news[1]) : Infinity,
    newsHide:0, running:false, finished:false,
    tipLeft: cfg.tip ? 8 : 0
  };
  state.price = Math.round(state.price / state.tickSize) * state.tickSize;
  state.open = state.price;
  state.bars.push({ o:state.price, h:state.price, l:state.price, c:state.price });
  newRegime(true);

  // warm the tape so the chart opens with readable history
  for(let i = 0; i < VIEW_BARS * TICKS_PER_BAR; i++) step();
  state.open = state.price; state.shock = 0; state.shockLeft = 0;
  newRegime(true);

  const targetEquity = cfg.capital * (1 + cfg.target);
  const bustEquity   = cfg.capital * 0.55;

  function newRegime(first){
    const r = Math.random(), side = (1 - cfg.chop) / 2;
    let d;
    if(r < side)          d =  (0.55 + Math.random()*0.45) * cfg.trendStr;
    else if(r < side * 2) d = -(0.55 + Math.random()*0.45) * cfg.trendStr;
    else                  d = (Math.random()*0.28 - 0.14);
    if(first && Math.abs(d) > 0.2) d *= 0.6;
    state.regime = { d, kind: d > 0.2 ? 'BID' : d < -0.2 ? 'OFFERED' : 'RANGE' };
    state.regimeLeft = cfg.regimeT[0] + Math.random() * (cfg.regimeT[1] - cfg.regimeT[0]);
  }

  function step(){
    state.regimeLeft -= DT;
    if(state.regimeLeft <= 0) newRegime(false);
    const stretch = (state.price - state.open) / state.open;
    let ret = (state.regime.d * cfg.vol * 0.45) + (HS.gauss() * cfg.vol) + (-stretch * 0.055 * cfg.vol * 8);
    if(state.shockLeft > 0){ ret += state.shock; state.shockLeft--; }
    state.price = Math.max(state.tickSize * 5, state.price * (1 + ret));
    state.price = Math.round(state.price / state.tickSize) * state.tickSize;
    const b = state.bars[state.bars.length-1];
    b.c = state.price;
    if(state.price > b.h) b.h = state.price;
    if(state.price < b.l) b.l = state.price;
    if(++state.sub >= TICKS_PER_BAR){
      state.sub = 0;
      state.bars.push({ o:state.price, h:state.price, l:state.price, c:state.price });
      if(state.bars.length > 300) state.bars.shift();
    }
  }

  const equity = () => state.cash + state.qty * state.price;
  const openPnl = () => state.qty === 0 ? 0 : state.qty * (state.price - state.entry);

  function close(quiet){
    if(state.qty === 0) return 0;
    const px = state.price, qty = state.qty;
    const gross = qty * (px - state.entry);
    const fee = Math.abs(qty * px) * cfg.fee;
    state.cash += qty * px - fee;
    state.qty = 0; state.entry = 0;
    state.trades++;
    const net = gross - fee;
    if(net > 0){ state.wins++; state.streak++; if(state.streak > state.bestStreak) state.bestStreak = state.streak; }
    else state.streak = 0;
    if(!quiet){
      pop(HS.signed(net), net >= 0);
      net >= 0 ? HS.Audio.cash() : HS.Audio.loss();
      log((net >= 0 ? '<b class="g">' : '<b class="r">') + 'FLAT</b> ' + cfg.symbol +
          ' @ ' + px.toFixed(2) + ' <span class="' + (net>=0?'g':'r') + '">' + HS.signed(net) + '</span>');
    }
    return net;
  }

  function open(dir){
    if(state.qty !== 0){
      const same = (state.qty > 0 && dir > 0) || (state.qty < 0 && dir < 0);
      if(same) return;
      close(false);
    }
    const notional = equity() * cfg.leverage * state.sizePct;
    const qty = dir * notional / state.price;
    if(!isFinite(qty) || Math.abs(qty) < 1e-9) return;
    state.cash -= qty * state.price + Math.abs(qty * state.price) * cfg.fee;
    state.qty = qty; state.entry = state.price;
    dir > 0 ? HS.Audio.buy() : HS.Audio.sell();
    log('<b class="y">' + (dir > 0 ? 'LONG' : 'SHORT') + '</b> ' + cfg.symbol +
        ' @ ' + state.price.toFixed(2) + ' <span class="dim">' + HS.money(Math.abs(notional)) + '</span>');
  }

  function fireNews(){
    const up = Math.random() < 0.5;
    const mag = cfg.shock * (0.45 + Math.random()*0.55);
    const ticks = 3;
    state.shock = (up ? 1 : -1) * (Math.pow(1 + mag, 1/ticks) - 1);
    state.shockLeft = ticks;
    $('mkNewsText').textContent = base.name + ' ' + (up ? HS.rng(Date.now()&255).pick(HEADLINES.up) : HS.rng(Date.now()&255).pick(HEADLINES.down));
    $('mkNews').classList.add('show');
    state.newsHide = 4;
    HS.Audio.alarm();
    state.nextNews = cfg.news[0] + Math.random() * (cfg.news[1] - cfg.news[0]);
  }

  /* ---------- dom ---------- */
  const root = $('market');
  $('mkTitle').textContent = cfg.title;
  $('mkSub').textContent = cfg.sub || (base.name + ' · ' + cfg.symbol);
  $('mkNews').classList.remove('show');
  $('mkLog').innerHTML = '';
  $('mkTipRow').style.display = cfg.tip ? '' : 'none';
  root.classList.add('show');

  function log(html){
    const d = HS.el('div', null, html);
    $('mkLog').insertBefore(d, $('mkLog').firstChild);
    while($('mkLog').children.length > 14) $('mkLog').removeChild($('mkLog').lastChild);
  }
  function pop(text, good){
    const e = HS.el('div', 'mk-pop', text);
    e.style.color = good ? 'var(--green)' : 'var(--red)';
    e.style.left = (30 + Math.random()*40) + '%';
    $('mkChartWrap').appendChild(e);
    setTimeout(() => e.remove(), 1100);
  }

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

  const PAD_R = 58, PAD_T = 14, PAD_B = 16, PAD_L = 10;
  function draw(){
    if(CW < 10) fit();
    cx.clearRect(0,0,CW,CH);
    const bars = state.bars.slice(-VIEW_BARS);
    if(!bars.length) return;
    let hi = -Infinity, lo = Infinity;
    for(const b of bars){ if(b.h>hi) hi=b.h; if(b.l<lo) lo=b.l; }
    const span = Math.max(hi-lo, state.price*0.004);
    hi += span*0.12; lo -= span*0.12;
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
      cx.fillText(p.toFixed(state.tickSize < 0.05 ? 2 : 1), CW-PAD_R+6, yy);
    }

    /* Skill leak: the better you are, the more the bias shows. */
    const q = readQuality(cfg.skill);
    const showBias = state.tipLeft > 0 ? 1 : q;
    if(showBias > 0.12){
      const d = state.regime.d;
      const bull = d > 0.15, bear = d < -0.15;
      if(bull || bear){
        const a = 0.03 + showBias*0.09;
        const g = cx.createLinearGradient(0, PAD_T, 0, PAD_T+ph);
        const c = bull ? '63,214,140' : '255,91,103';
        g.addColorStop(bull?0:1, 'rgba('+c+','+a.toFixed(3)+')');
        g.addColorStop(bull?1:0, 'rgba('+c+',0)');
        cx.fillStyle = g; cx.fillRect(PAD_L, PAD_T, pw, ph);
      }
      if(showBias > 0.45){
        cx.fillStyle = state.regime.d > 0.15 ? '#3FD68C' : state.regime.d < -0.15 ? '#FF5B67' : '#8993A5';
        cx.font = '600 10px "IBM Plex Mono",monospace';
        cx.fillText('TAPE ' + state.regime.kind, PAD_L+4, PAD_T+9);
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

    if(state.qty !== 0){
      const ye = y(state.entry);
      if(ye > PAD_T && ye < PAD_T+ph){
        cx.strokeStyle = 'rgba(232,184,92,.7)'; cx.setLineDash([5,4]);
        cx.beginPath(); cx.moveTo(PAD_L,ye); cx.lineTo(CW-PAD_R,ye); cx.stroke();
        cx.setLineDash([]);
        cx.fillStyle = '#E8B85C'; cx.font = '600 9px "IBM Plex Mono",monospace';
        cx.fillText((state.qty>0?'LONG ':'SHORT ')+state.entry.toFixed(2), PAD_L+4, ye-7);
      }
    }

    const yp = y(state.price);
    const lastUp = bars[bars.length-1].c >= bars[bars.length-1].o;
    cx.fillStyle = lastUp ? '#3FD68C' : '#FF5B67';
    cx.beginPath();
    cx.moveTo(CW-PAD_R, yp); cx.lineTo(CW-PAD_R+6, yp-7); cx.lineTo(CW-2, yp-7);
    cx.lineTo(CW-2, yp+7); cx.lineTo(CW-PAD_R+6, yp+7); cx.closePath(); cx.fill();
    cx.fillStyle = '#07090D'; cx.font = '700 10px "IBM Plex Mono",monospace';
    cx.fillText(state.price.toFixed(state.tickSize < 0.05 ? 2 : 1), CW-PAD_R+9, yp);
  }

  /* ---------- hud ---------- */
  function sync(){
    const eq = equity();
    $('mkClock').textContent = Math.max(0, state.timeLeft).toFixed(1) + 's';
    $('mkClock').className = 'mk-clock' + (state.timeLeft <= 8 ? ' crit' : '');
    $('mkEquity').textContent = HS.moneyFull(eq);
    $('mkEquity').style.color = eq >= cfg.capital ? 'var(--green)' : 'var(--red)';
    const pl = eq - cfg.capital;
    $('mkPnl').textContent = HS.signed(pl);
    $('mkPnl').style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
    const prog = HS.clamp((eq - cfg.capital) / (targetEquity - cfg.capital), 0, 1);
    $('mkTargetFill').style.width = (prog*100).toFixed(1) + '%';
    $('mkTargetVal').textContent = HS.money(targetEquity);

    const card = $('mkPos');
    if(state.qty === 0){
      card.className = 'mk-pos flat';
      $('mkPosSide').textContent = 'FLAT';
      $('mkPosInfo').textContent = '—';
    } else {
      const long = state.qty > 0;
      card.className = 'mk-pos ' + (long ? 'long' : 'short');
      $('mkPosSide').textContent = long ? 'LONG' : 'SHORT';
      const op = openPnl();
      $('mkPosInfo').innerHTML = Math.abs(state.qty).toFixed(1) + ' @ ' + state.entry.toFixed(2) +
        ' <span style="color:' + (op>=0?'var(--green)':'var(--red)') + '">' + HS.signed(op) + '</span>';
    }
    $('mkFlat').disabled = state.qty === 0;
    if(cfg.tip) $('mkTipVal').textContent = state.tipLeft > 0 ? Math.ceil(state.tipLeft)+'s' : 'spent';
  }

  /* ---------- loop ---------- */
  function frame(now){
    if(state.finished) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - state.last)/1000);
    state.last = now;
    if(!state.running) return;

    state.acc += dt;
    let guard = 0;
    while(state.acc >= DT && guard++ < 12){
      state.acc -= DT;
      step();
      state.timeLeft -= DT;
      if(state.tipLeft > 0) state.tipLeft -= DT;
      if(state.newsHide > 0){
        state.newsHide -= DT;
        if(state.newsHide <= 0) $('mkNews').classList.remove('show');
      }
      if(cfg.news){
        state.nextNews -= DT;
        if(state.nextNews <= 0) fireNews();
      }
      const eq = equity();
      if(eq > state.peak) state.peak = eq;
      if(eq < state.trough) state.trough = eq;
      if(eq <= bustEquity){ finish('bust'); return; }
      if(state.timeLeft <= 0){ finish('bell'); return; }
    }
    draw(); sync();
  }

  function finish(reason){
    if(state.finished) return;
    close(true);
    state.finished = true;
    state.running = false;
    detach();
    root.classList.remove('show');
    const eq = equity();
    done({
      pnl: eq - cfg.capital,
      finalEquity: eq,
      returnPct: (eq - cfg.capital) / cfg.capital,
      hitTarget: eq >= targetEquity,
      busted: reason === 'bust',
      trades: state.trades,
      wins: state.wins,
      bestStreak: state.bestStreak,
      drawdown: (state.peak - state.trough) / cfg.capital
    });
  }

  /* ---------- controls ---------- */
  const onBuy  = () => { if(state.running) { open(1); sync(); } };
  const onSell = () => { if(state.running) { open(-1); sync(); } };
  const onFlat = () => { if(state.running) { close(false); sync(); } };
  const onSize = e => {
    state.sizePct = parseFloat(e.currentTarget.dataset.size);
    document.querySelectorAll('#mkSizes .mk-size').forEach(b =>
      b.classList.toggle('sel', b === e.currentTarget));
    HS.Audio.click();
  };
  function onKey(e){
    if(!state.running) return;
    const k = e.key.toLowerCase();
    if(k === 'b'){ onBuy(); e.preventDefault(); }
    else if(k === 's'){ onSell(); e.preventDefault(); }
    else if(k === ' ' || k === 'f'){ onFlat(); e.preventDefault(); }
    else if(k === '1'){ pickSize(0); }
    else if(k === '2'){ pickSize(1); }
    else if(k === '3'){ pickSize(2); }
  }
  function pickSize(i){
    const b = document.querySelectorAll('#mkSizes .mk-size')[i];
    if(b) b.click();
  }

  $('mkBuy').addEventListener('click', onBuy);
  $('mkSell').addEventListener('click', onSell);
  $('mkFlat').addEventListener('click', onFlat);
  document.querySelectorAll('#mkSizes .mk-size').forEach(b => b.addEventListener('click', onSize));
  window.addEventListener('keydown', onKey, true);

  function detach(){
    $('mkBuy').removeEventListener('click', onBuy);
    $('mkSell').removeEventListener('click', onSell);
    $('mkFlat').removeEventListener('click', onFlat);
    document.querySelectorAll('#mkSizes .mk-size').forEach(b => b.removeEventListener('click', onSize));
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
  }

  /* ---------- countdown then go ---------- */
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
      state.running = true;
      state.last = performance.now();
      requestAnimationFrame(frame);
      return;
    }
    n--;
    setTimeout(tick, 700);
  })();

  return { abort: () => finish('bell') };
};

})(window.HS);
