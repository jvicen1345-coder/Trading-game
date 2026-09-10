/* MARKET MAKER - portraits.
 *
 * Ten flat avatars, drawn as SVG at load like every other texture in this
 * game. There are no image files here and there should not be.
 *
 * They are deliberately abstract: a head, a haircut, a suit and a tie. The
 * names in the cast are puns, not portraits, and nothing in here tries to
 * make anybody look like a real person. What the drawing has to do is much
 * narrower than that: five of these sit side by side on your roster and you
 * need to tell at a glance which one you are about to fire.
 */
window.HS = window.HS || {};
(function(HS){
'use strict';

const SKIN = ['#F2D5B8','#E4BA95','#CE9A70','#AE774C','#835636','#603D25'];
const SUIT = ['#252C3A','#2E3444','#1F2833','#353241','#2B3442'];
const HAIRC = { black:'#221C17', brown:'#4B3626', sand:'#8A6A44',
                grey:'#9C9793', white:'#DCD7CF', ink:'#191920', rust:'#6E3B2B' };
const TIE = { gold:'#E8B85C', red:'#FF5B67', cyan:'#3ECFCF',
              violet:'#9B7BD4', green:'#3FD68C', slate:'#5A6478' };

/* The card behind the head, tinted by what they are rather than who. */
const GROUND = { basic:['#16202C','#0E1620'], sharp:['#241E30','#141020'],
                 god:['#2E2617','#161208'] };

/* Hair sits on a head centred at x 32, spanning y 16.5 to 49.5. Every shape
   is drawn over the head, so they only need to describe the top and sides. */
const HAIR = {
  crop:  'M17 33q0-17 15-17t15 17q-4-9-15-9t-15 9z',
  tight: 'M18.5 32q1.5-15 13.5-15t13.5 15q-4-7-13.5-7t-13.5 7z',
  swept: 'M17 31q1-16 15-16t15 16q-3-8-13-8-9 0-17 8z',
  wave:  'M17 33q0-11 6-15 4 4 9 1 5-3 7 2 4 3 4 12-4-9-15-9t-11 9z',
  bob:   'M17 33q0-17 15-17t15 17q-4-9-15-9t-15 9zM17 32q-1 11 1 16l4.5 1q-3-9-2-17z' +
         'M47 32q1 11-1 16l-4.5 1q3-9 2-17z',
  long:  'M17 33q0-17 15-17t15 17q-4-9-15-9t-15 9zM16.5 32q-2 14 1 21l6 1q-4-11-3-22z' +
         'M47.5 32q2 14-1 21l-6 1q4-11 3-22z',
  bald:  '',
  thin:  'M17.5 32q2-9 6-11-1 5 1 7 5-6 14-4 5 1 7 8-4-7-14-7-10 0-14 7z'
};

/* What each of the ten looks like. Authored rather than hashed, because a
   hash gives you ten strangers and this is a cast. */
const LOOK = {
  gorithm:   { hair:'thin',  hc:'brown', skin:0, suit:2, tie:'cyan',   glasses:true },
  pelosini:  { hair:'bob',   hc:'ink',   skin:1, suit:0, tie:'violet' },
  rosevelt:  { hair:'crop',  hc:'brown', skin:1, suit:1, tie:'red',    stache:true },
  merkup:    { hair:'bob',   hc:'sand',  skin:0, suit:3, tie:'green' },
  trudough:  { hair:'wave',  hc:'black', skin:2, suit:4, tie:'gold' },
  churnwell: { hair:'bald',  hc:'grey',  skin:1, suit:2, tie:'slate',  jowl:true },
  hatcher:   { hair:'bob',   hc:'sand',  skin:0, suit:1, tie:'cyan' },
  brownout:  { hair:'tight', hc:'grey',  skin:0, suit:0, tie:'slate',  glasses:true },
  arbitrage: { hair:'tight', hc:'ink',   skin:4, suit:2, tie:'gold',   beard:true },
  obalance:  { hair:'tight', hc:'grey',  skin:3, suit:1, tie:'red' }
};

const esc = s => String(s).replace(/[^A-Za-z0-9_-]/g, '');

/* One portrait. `p` is anybody with an id and a tier: somebody on the
   payroll, or a stranger you have only just met. */
HS.face = function(p, px){
  const L = LOOK[p && p.id] || LOOK.rosevelt;
  const g = GROUND[(p && p.tier) || 'basic'] || GROUND.basic;
  const skin = SKIN[L.skin] || SKIN[0];
  const hair = HAIRC[L.hc] || HAIRC.black;
  const suit = SUIT[L.suit] || SUIT[0];
  const tie = TIE[L.tie] || TIE.slate;
  const uid = 'f' + esc(p && p.id);
  const size = px ? ' width="' + px + '" height="' + Math.round(px * 76 / 64) + '"' : '';

  /* A shade of the skin tone for anything that has to read as shadow. */
  const shade = SKIN[Math.min(SKIN.length - 1, (L.skin || 0) + 2)];

  /* Given a fixed height shorter than the art, crop rather than squash, and
     crop from the middle: the head sits centre frame, so a phone loses some
     shoulder instead of the whole face below the eyes. */
  return '<svg class="mug-art" viewBox="0 0 64 76" preserveAspectRatio="xMidYMid slice"' + size +
    ' role="img" aria-label="' + ((p && p.name) || 'portrait') + '">' +
    '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + g[0] + '"/>' +
      '<stop offset="1" stop-color="' + g[1] + '"/></linearGradient>' +
      '<clipPath id="' + uid + 'c"><rect width="64" height="76" rx="9"/></clipPath></defs>' +
    '<g clip-path="url(#' + uid + 'c)">' +
      '<rect width="64" height="76" fill="url(#' + uid + ')"/>' +
      /* shoulders, then the shirt and the tie over them */
      '<path d="M2 76c0-15 10-21 20-23l10 6 10-6c10 2 20 8 20 23z" fill="' + suit + '"/>' +
      '<path d="M22 53l10 6 10-6-3-1-7 4-7-4z" fill="#C9D2E0"/>' +
      '<path d="M32 59l-3.4 3.6L32 76h1l3.4-13.4z" fill="' + tie + '"/>' +
      /* lapels */
      '<path d="M22 53l10 6-8 17-6-21z" fill="' + suit + '" opacity=".55"/>' +
      '<path d="M42 53l-10 6 8 17 6-21z" fill="' + suit + '" opacity=".55"/>' +
      /* neck, then the head over it */
      '<path d="M27 42h10v13h-10z" fill="' + shade + '"/>' +
      '<ellipse cx="32" cy="33" rx="14.5" ry="16.5" fill="' + skin + '"/>' +
      (L.jowl ? '<path d="M19 37q2 13 13 13t13-13q-3 9-13 9-10 0-13-9z" fill="' +
                shade + '" opacity=".45"/>' : '') +
      (L.beard ? '<path d="M19 34q1 16 13 16t13-16q-3 10-13 10-10 0-13-10z" fill="' +
                 hair + '" opacity=".92"/>' : '') +
      /* eyes and brows */
      '<ellipse cx="26" cy="33" rx="1.7" ry="1.9" fill="#1B1F27"/>' +
      '<ellipse cx="38" cy="33" rx="1.7" ry="1.9" fill="#1B1F27"/>' +
      '<path d="M22.5 28.4h6M35.5 28.4h6" stroke="' + hair +
        '" stroke-width="1.5" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M29 42.2q3 1.6 6 0" stroke="#8A5C50" stroke-width="1.4" ' +
        'stroke-linecap="round" fill="none"/>' +
      (L.stache ? '<path d="M27 39.4h10" stroke="' + hair +
                  '" stroke-width="2.2" stroke-linecap="round"/>' : '') +
      (HAIR[L.hair] ? '<path d="' + HAIR[L.hair] + '" fill="' + hair + '"/>' : '') +
      (L.glasses
        ? '<g fill="none" stroke="#DCE3EE" stroke-width="1.3" opacity=".9">' +
          '<rect x="20.5" y="29" width="11" height="8" rx="3"/>' +
          '<rect x="32.5" y="29" width="11" height="8" rx="3"/>' +
          '<path d="M31.5 33h1.5"/></g>'
        : '') +
    '</g></svg>';
};

})(window.HS);
