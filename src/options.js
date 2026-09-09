/* MARKET MAKER - options pricing and chain construction.
   Black–Scholes on a tape that realises roughly the volatility it is priced at,
   so the player's edge has to come from direction, not from vol mispricing. */
window.HS = window.HS || {};
(function(HS){
'use strict';

const R = 0.04;                 // risk-free rate
const TRADING_DAYS = 252;
HS.CONTRACT_SIZE = 100;         // shares per contract, as in the real thing

/* Expiries. `days` is in trading days; 0DTE dies at today's bell. */
HS.EXPIRIES = [
  { id:'weekly', name:'WEEKLY', label:'5d',  days:5,   ivMult:1.00, unlockRank:0,
    blurb:'Five sessions of life. The everyday contract.' },
  { id:'leap',   name:'LEAP',   label:'1y',  days:252, ivMult:0.80, unlockRank:2,
    blurb:'A year out. Barely any theta - closest thing to owning the stock.' },
  { id:'0dte',   name:'0DTE',   label:'today', days:0, ivMult:1.35, unlockRank:4,
    blurb:'Expires at the bell. All gamma, all theta, no mercy.' }
];

/* Cumulative normal (Abramowitz & Stegun 7.1.26). */
function N(x){
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741,
        a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1) * t * Math.exp(-z*z);
  return 0.5 * (1 + sign * y);
}
function n(x){ return Math.exp(-0.5*x*x) / Math.sqrt(2*Math.PI); }
HS.normCdf = N;

/* Price + greeks. T in years; falls back to intrinsic as T -> 0. */
HS.blackScholes = function(isCall, S, K, T, sigma){
  if(T <= 1e-9 || sigma <= 1e-9){
    const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
    return { price:intrinsic, delta: isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
             gamma:0, theta:0, vega:0 };
  }
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S/K) + (R + sigma*sigma/2) * T) / sq;
  const d2 = d1 - sq;
  const disc = Math.exp(-R * T);
  const price = isCall
    ? S * N(d1) - K * disc * N(d2)
    : K * disc * N(-d2) - S * N(-d1);
  const delta = isCall ? N(d1) : N(d1) - 1;
  const gamma = n(d1) / (S * sq);
  // theta per trading day, which is how a trader actually feels it
  const thetaYr = isCall
    ? (-(S * n(d1) * sigma) / (2*Math.sqrt(T)) - R * K * disc * N(d2))
    : (-(S * n(d1) * sigma) / (2*Math.sqrt(T)) + R * K * disc * N(-d2));
  return {
    price: Math.max(0, price),
    delta, gamma,
    theta: thetaYr / TRADING_DAYS,
    vega: S * n(d1) * Math.sqrt(T) / 100
  };
};

/* Skewed smile: puts bid up, wings bid up, and it steepens as expiry nears. */
HS.ivFor = function(baseIv, spot, strike, T){
  const m = Math.log(strike / spot);
  const steep = 1 + 0.9 / (1 + T * 26);
  const iv = baseIv * (1 + 1.9 * m * m * steep - 0.42 * m * steep);
  return HS.clamp(iv, baseIv * 0.42, baseIv * 2.6);
};

/* A tape that moves `tickVol` per tick, over `ticksPerDay`, annualised. */
HS.impliedFromTape = function(tickVol, ticksPerDay){
  return tickVol * Math.sqrt(ticksPerDay * TRADING_DAYS);
};

/* Strike ladder: spaced off the expected daily move, snapped to a clean number. */
HS.strikeStep = function(spot, dailySigma){
  const raw = spot * Math.max(0.012, dailySigma * 0.55);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const snap = norm < 1.5 ? 1 : norm < 3.5 ? 2.5 : norm < 7.5 ? 5 : 10;
  return snap * mag;
};

/* Time to expiry in years, given how far through the session we are.
   `prog` runs 0 -> 1 across the trading day. */
HS.timeToExpiry = function(expiry, prog){
  const daysLeft = expiry.days === 0
    ? (1 - prog)                       // 0DTE bleeds out across the session
    : expiry.days - prog;              // everything else loses one day per session
  return Math.max(0, daysLeft) / TRADING_DAYS;
};

/* Quote width: tight for fat ATM contracts, ugly for cheap wings and 0DTE. */
function spreadPct(mid, expiry){
  const base = 0.022 + 0.075 / (mid + 0.6) + (expiry.id === '0dte' ? 0.035 : 0);
  return HS.clamp(base, 0.02, 0.34);
}

/* Build the full chain for one expiry at the current spot. */
HS.buildChain = function(opts){
  const { spot, expiry, baseIv, dailySigma, prog, strikes } = opts;
  const step = HS.strikeStep(spot, dailySigma);
  const atm = Math.round(spot / step) * step;
  const T = HS.timeToExpiry(expiry, prog);
  const half = Math.floor(strikes / 2);
  const rows = [];

  for(let i = -half; i <= half; i++){
    const K = +(atm + i * step).toFixed(4);
    if(K <= 0) continue;
    const iv = HS.ivFor(baseIv * expiry.ivMult, spot, K, T);
    const call = HS.blackScholes(true,  spot, K, T, iv);
    const put  = HS.blackScholes(false, spot, K, T, iv);
    rows.push({
      strike: K, iv, T,
      call: quote(call, expiry),
      put:  quote(put,  expiry)
    });
  }
  return { expiry, strikes: rows, atm, step, T };
};

function quote(g, expiry){
  const mid = g.price;
  const sp = spreadPct(mid, expiry);
  const halfW = Math.max(0.01, mid * sp / 2);
  return {
    mid,
    bid: Math.max(0, mid - halfW),
    ask: mid + halfW,
    delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega
  };
}

/* Re-quote one held contract as spot and time move. */
HS.quoteContract = function(c, spot, baseIv, prog){
  const T = HS.timeToExpiry(c.expiry, prog);
  const iv = HS.ivFor(baseIv * c.expiry.ivMult, spot, c.strike, T);
  const g = HS.blackScholes(c.isCall, spot, c.strike, T, iv);
  return Object.assign(quote(g, c.expiry), { iv, T });
};

HS.contractName = function(c){
  return c.symbol + ' ' + c.expiry.label + ' ' +
         (Math.round(c.strike*100)/100) + ' ' + (c.isCall ? 'C' : 'P');
};

})(window.HS);
