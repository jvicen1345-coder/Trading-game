/* MARKET MAKER - the persistent market.
   Prices survive between sessions so a contract can outlive the day that
   opened it. One ticker is "the name of the week"; every other ticker still
   drifts each night so a carried contract can be marked and closed. */
window.HS = window.HS || {};
(function(HS){
'use strict';

HS.TICKERS = {
  VLT:{ name:'Volatis Systems',  px: 84.20, tick:0.01, vol:1.00 },
  NRG:{ name:'Nordrig Energy',   px:142.75, tick:0.01, vol:0.85 },
  QNT:{ name:'Quantex Labs',     px: 31.60, tick:0.01, vol:1.25 },
  BTX:{ name:'Bitrex Composite', px:608.00, tick:0.05, vol:1.35 },
  ARC:{ name:'Arclight Media',   px: 57.40, tick:0.01, vol:1.10 },
  HLX:{ name:'Helix Bio',        px: 96.10, tick:0.01, vol:1.45 }
};
const ORDER = Object.keys(HS.TICKERS);

/* ---------------- calendar ----------------
   Day 1 is a Monday. A week is six days: five sessions and one weekend.
   Saturday and Sunday are a single day, because two days of a shut market
   is two days of clicking through nothing. */
HS.WEEK_DAYS     = 6;
HS.weekOf        = d => Math.floor((d - 1) / 6) + 1;
HS.weekdayIndex  = d => (d - 1) % 6;                 // 0 = Mon .. 4 = Fri, 5 = Weekend
HS.isWeekend     = d => HS.weekdayIndex(d) === 5;
HS.isFriday      = d => HS.weekdayIndex(d) === 4;
HS.isMonday      = d => HS.weekdayIndex(d) === 0;

/* Monotonic count of trading days elapsed before `d`. The weekend does not
   count, so a trading week is still five sessions. */
HS.tradingDay = function(d){
  const w = Math.floor((d - 1) / 6), rem = (d - 1) % 6;
  return w * 5 + Math.min(rem, 5);
};
/* The trading-day index of this week's Friday. */
HS.fridayOfWeek = function(d){
  return Math.floor((d - 1) / 6) * 5 + 4;
};

/* ---------------- market state ---------------- */
HS.newMarket = function(){
  const t = {};
  ORDER.forEach(sym => {
    const b = HS.TICKERS[sym];
    t[sym] = {
      price: +(b.px * (0.94 + Math.random() * 0.12)).toFixed(2),
      prevClose: 0,
      drift: (Math.random() - 0.5) * 0.6,   // slow multi-day lean
      driftLeft: 3 + Math.floor(Math.random() * 6)
    };
    t[sym].prevClose = t[sym].price;
  });
  return { tickers: t, lastRolled: 1 };
};

/* Which name the desk is on this week. */
HS.weekTicker = function(day){
  return ORDER[(HS.weekOf(day) - 1) % ORDER.length];
};

/* Move every ticker overnight so nothing goes stale while you are not watching. */
HS.rollMarketNight = function(S, daysPassed){
  const m = S.market;
  if(!m) return [];
  const moves = [];
  ORDER.forEach(sym => {
    const t = m.tickers[sym];
    const base = HS.TICKERS[sym];
    t.prevClose = t.price;
    for(let i = 0; i < Math.max(1, daysPassed); i++){
      if(--t.driftLeft <= 0){
        t.drift = (Math.random() - 0.5) * 0.6;
        t.driftLeft = 3 + Math.floor(Math.random() * 6);
      }
      // an overnight gap is roughly half a session's worth of movement
      const g = (t.drift * 0.004) + HS.gauss() * 0.013 * base.vol;
      t.price = Math.max(base.tick * 5, t.price * (1 + g));
    }
    t.price = Math.round(t.price / base.tick) * base.tick;
    moves.push({ sym, from:t.prevClose, to:t.price,
                 pct:(t.price - t.prevClose) / t.prevClose });
  });
  return moves;
};

HS.tickerPrice = function(S, sym){
  return S.market && S.market.tickers[sym] ? S.market.tickers[sym].price : HS.TICKERS[sym].px;
};

/* ---------------- contracts ----------------
   A contract settles at the CLOSE of trading day `expiryDay`. */
/* Time is the thing you earn. A new trader gets today and nothing else,
   which is the hardest way to trade and the fastest way to learn. The
   first promotion on either path buys you the week, the second buys you
   the fortnight. */
/* The multipliers give the tape a gently upward sloping term structure, so
   the same rung always costs more the further out you go. Time is the thing
   you are buying and the chain should never say otherwise. A 0DTE is
   dangerous because it decays to nothing by the bell, not because it is
   expensive. */
HS.EXPIRY_KINDS = {
  '0dte':   { id:'0dte',   name:'0DTE',   unlockRank:0, ivMult:0.92,
              blurb:'Cheap, and dead by tonight\'s bell. All gamma, no mercy.' },
  'weekly': { id:'weekly', name:'WEEKLY', unlockRank:2, ivMult:1.00,
              blurb:'Runs to Friday\'s close. Room for a thesis to work.' },
  'swing':  { id:'swing',  name:'SWING',  unlockRank:3, ivMult:1.06,
              blurb:'A fortnight of time value, and priced like it. One slot only.' }
};
HS.SWING_DAYS = 10;                      // two trading weeks

HS.expiryDayFor = function(kind, day){
  const td = HS.tradingDay(day);
  if(kind === '0dte') return td;
  if(kind === 'weekly'){
    /* On Friday the front weekly is just a 0DTE wearing a different name,
       and it would price under one, since it carries less implied vol for
       the same time. The tab rolls to next week's, the way the front
       weekly rolls once it expires. */
    const fri = HS.fridayOfWeek(day);
    return fri > td ? fri : fri + 5;
  }
  return td + HS.SWING_DAYS;
};

/* Days of life left, including the fraction of today still to run. */
HS.daysLeft = function(pos, day, prog){
  return Math.max(0, (pos.expiryDay - HS.tradingDay(day)) + (1 - (prog || 0)));
};
HS.yearsLeft = function(pos, day, prog){ return HS.daysLeft(pos, day, prog) / 252; };

HS.expiryLabel = function(pos, day){
  const d = pos.expiryDay - HS.tradingDay(day);
  if(pos.kind === '0dte')   return 'today';
  if(pos.kind === 'weekly') return d <= 0 ? 'today' : d + 'd';
  return d + 'd';
};

/* Annualised vol the chain is priced off, derived from the tape itself. */
HS.tickerIv = function(S, sym, ticksPerDay, baseVol){
  return HS.impliedFromTape(baseVol * HS.TICKERS[sym].vol, ticksPerDay);
};

/* ---------------- the book ---------------- */
HS.newPosition = function(o){
  return {
    id: 'p' + Math.random().toString(36).slice(2, 9),
    sym:o.sym, isCall:o.isCall, strike:o.strike, kind:o.kind,
    expiryDay:o.expiryDay, qty:o.qty, entry:o.entry, openedDay:o.openedDay,
    moneyness:o.moneyness || ''
  };
};

HS.posName = function(p, day){
  return p.sym + ' ' + HS.expiryLabel(p, day) + ' ' +
         (Math.round(p.strike * 100) / 100) + (p.isCall ? 'C' : 'P');
};

HS.swingCount = function(S){
  return (S.positions || []).filter(p => p.kind === 'swing').length;
};

/* Mark one position at the current tape, outside a live session. */
HS.markPosition = function(S, p, day, prog, ivFor){
  const spot = HS.tickerPrice(S, p.sym);
  const T = HS.yearsLeft(p, day, prog);
  const iv = HS.ivFor(ivFor * HS.EXPIRY_KINDS[p.kind].ivMult, spot, p.strike, T);
  const g = HS.blackScholes(p.isCall, spot, p.strike, T, iv);
  return { spot, iv, T, mid:g.price, delta:g.delta, theta:g.theta / 252, gamma:g.gamma };
};

HS.intrinsic = function(p, spot){
  return p.isCall ? Math.max(0, spot - p.strike) : Math.max(0, p.strike - spot);
};

/* Settle everything that has reached its expiry day. Returns a report. */
HS.settleExpired = function(S, day){
  const td = HS.tradingDay(day);
  const out = [];
  S.positions = (S.positions || []).filter(p => {
    if(p.expiryDay >= td) return true;
    const spot = HS.tickerPrice(S, p.sym);
    const v = HS.intrinsic(p, spot);
    const pnl = p.qty * (v - p.entry) * HS.CONTRACT_SIZE;
    S.cash += p.qty * v * HS.CONTRACT_SIZE;
    out.push({ pos:p, value:v, pnl, expired:true });
    return false;
  });
  return out;
};

})(window.HS);
