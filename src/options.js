/* MARKET MAKER - options pricing and chain construction.
   Black–Scholes on a tape that realises roughly the volatility it is priced at,
   so the player's edge has to come from direction, not from vol mispricing. */
window.HS = window.HS || {};
(function(HS){
'use strict';

const R = 0.04;                 // risk-free rate
const TRADING_DAYS = 252;
HS.CONTRACT_SIZE = 100;         // shares per contract, as in the real thing

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

/* Rung spacing: a fixed share of the move the contract can still make before
   it dies, so every expiry's five rungs sit at the same distance measured in
   sigma. Deliberately not snapped to round numbers. Snapping put each expiry
   at a different distance in sigma, and that broke the rule the chain is
   supposed to teach: more time costs more money. It made a far OTM swing
   cheaper than a far OTM weekly. */
HS.rungWidth = function(spot, dailySigma){
  return spot * Math.max(0.012, dailySigma * 0.55);
};

})(window.HS);
