/* MARKET MAKER - portraits.
 *
 * Ten flat avatars, drawn as SVG at load like every other texture in this
 * game. There are no image files here and there should not be.
 *
 * They are deliberately abstract: a head, a haircut, a suit and a tie. The
 * names in the cast are puns, not portraits, and nothing in here tries to
 * make anybody look like a real person.
 *
 * What the drawing has to do is narrow: five of these sit side by side at
 * about sixty pixels wide, and you need to tell at a glance which one you are
 * about to fire. That is a silhouette problem before it is a face problem, so
 * the hair carries most of the work and the features stay simple.
 */
window.HS = window.HS || {};
(function(HS){
'use strict';

/* Warm and a little desaturated, because these sit on a near-black card and a
   bright peach head glows like a bulb. */
const SKIN  = ['#E8C1A0','#D9A985','#C08A63','#9C6844','#7A4E31','#5B3A25'];
const SHADE = ['#D3A987','#C2916D','#A7714C','#845233','#653D24','#4A2D1C'];
const SUIT  = ['#2A3140','#333A4B','#232B37','#3A3745','#2F3947'];
const HAIRC = { black:'#241E19', brown:'#4E3826', sand:'#93724A', auburn:'#7A3F26',
                grey:'#A19C97', silver:'#CFC9C1', ink:'#1C1C22' };
/* Brows in the hair colour disappear on a fair head, and a face with no brows
   has no mood at all, so light hair gets a darker brow than the hair above it. */
const BROWC = { silver:'#8C867E', grey:'#7A746D', sand:'#6E5334' };
const TIE   = { gold:'#E8B85C', red:'#E8555F', cyan:'#3ECFCF',
                violet:'#9B7BD4', green:'#3FD68C', slate:'#63708A' };

/* The card behind the head, tinted by what they are rather than who. */
const GROUND = { basic:['#18232F','#0D141C'], sharp:['#261F33','#130F1D'],
                 god:['#30281A','#13100A'] };

/* The head runs x 19 to 45 and y 12 to 48, so every hair shape below is drawn
   against those edges. Silhouette first: at sixty pixels the outline is most
   of what survives. */
const HEAD = 'M32 12c-7.5 0-13 5-13 13.5V31c0 10 6 17 13 17s13-7 13-17v-5.5' +
             'C45 17 39.5 12 32 12z';

const HAIR = {
  /* short, follows the skull */
  buzz: 'M19 28c0-11 5.5-16 13-16s13 5 13 16c-2-7.5-6.5-11-13-11s-11 3.5-13 11z',

  /* a neat side part, heavier on one side */
  side: 'M19 28c0-11 5.5-16 13-16s13 5 13 16c-1-8-5.5-12-11-12-4 0-7 1.5-9.5 4.5' +
        'C22.6 22.6 20.2 25 19 28z' +
        'M22 23c4-6.5 12-9 19-6.5-6-1-12 1.5-16 7z',

  /* volume above the forehead */
  pomp: 'M19.5 27c0-13 6-18 12.5-18 7 0 13 5.5 13 17-1.6-8-6-11.5-11.5-11.5' +
        '-6.5 0-11 4-14 12.5z' +
        'M23 18c2.5-7.5 11-10 16.5-6-5.5-1.6-12 .8-16.5 6z',

  /* chin length, framing both sides */
  bob:  'M19 29c0-11.5 5.5-17 13-17s13 5.5 13 17c-2-8-6.5-11.5-13-11.5S21 21 19 29z' +
        'M18.4 27c-1.8 8-1.4 16 .6 21l4.8.6C21.4 43 21.2 34 22.4 28z' +
        'M45.6 27c1.8 8 1.4 16-.6 21l-4.8.6C42.6 43 42.8 34 41.6 28z',

  /* past the shoulders */
  long: 'M19 29c0-11.5 5.5-17 13-17s13 5.5 13 17c-2-8-6.5-11.5-13-11.5S21 21 19 29z' +
        'M18 27c-2.6 12-2 24 .6 32l6 .8C21.4 51 20.6 36 22 28z' +
        'M46 27c2.6 12 2 24-.6 32l-6 .8C42.6 51 43.4 36 42 28z',

  /* a cloud rather than a cap */
  curl: 'M19 30c-1.2-4.4 0-7.6 2.2-9.6C21.4 14 26 9.6 32 9.6s10.6 4.4 10.8 10.8' +
        'c2.2 2 3.4 5.2 2.2 9.6-2-8-6.5-12.4-13-12.4S21 22 19 30z',

  /* gone on top, still there round the sides */
  horse:'M19 34c-.8-9 1.2-15 5.4-17.8-2.8 6.2-3.8 12-3.2 18z' +
        'M45 34c.8-9-1.2-15-5.4-17.8 2.8 6.2 3.8 12 3.2 18z',

  /* up and back */
  updo: 'M19 28c0-11 5.5-16 13-16s13 5 13 16c-2-7.5-6.5-11-13-11s-11 3.5-13 11z' +
        'M25.6 11.4c1.8-5.2 11-5.2 12.8 0 1.8 5.2-2 8.2-6.4 8.2s-8.2-3-6.4-8.2z',

  bald: ''
};

/* Three moods and no fourth. Nobody in this cast is sad: they are pleased with
   themselves, annoyed with you, or giving you nothing. A downturned mouth or an
   inner brow lifted toward the middle reads as hurt, so neither shape exists
   here and neither should be added.

   Brows do more of this work at sixty pixels than the mouth does. */
const MOOD = {
  /* pleased, and not hiding it */
  happy: { brow:'M23 26.2q2.8-2.6 5.6 0M35.4 26.2q2.8-2.6 5.6 0',
           mouth:'M28.4 40.4q3.6 3 7.2 0' },
  /* brows down and in, mouth a tight line */
  mad:   { brow:'M23 24.4l5.6 2M41 24.4l-5.6 2',
           mouth:'M28.8 41.4h6.4' },
  /* nothing on the face at all, which on a trading floor is its own answer */
  cool:  { brow:'M23 25.6h5.6M35.4 25.6H41',
           mouth:'M28.6 41.4q3.4.8 6.8 0' }
};

/* What each of the ten looks like. Authored rather than hashed, because a
   hash gives you ten strangers and this is a cast of ten people. */
const LOOK = {
  /* will explain his scanners to anybody who stands still */
  gorithm:   { hair:'side',  hc:'brown',  skin:1, suit:2, tie:'cyan',
               mood:'happy', glasses:true },
  /* knows everybody in the room */
  pelosini:  { hair:'bob',   hc:'ink',    skin:1, suit:0, tie:'violet',
               mood:'happy' },
  /* has never once asked what the plan is */
  rosevelt:  { hair:'side',  hc:'brown',  skin:2, suit:1, tie:'red',
               mood:'cool',  stache:true },
  /* has not raised her voice in eleven years */
  merkup:    { hair:'bob',   hc:'sand',   skin:0, suit:3, tie:'green',
               mood:'cool' },
  /* extremely watchable */
  trudough:  { hair:'pomp',  hc:'black',  skin:2, suit:4, tie:'gold',
               mood:'happy' },
  /* thinks a webcam is a confession */
  churnwell: { hair:'horse', hc:'silver', skin:1, suit:2, tie:'slate',
               mood:'mad',   jowl:true },
  /* asked to leave two firms, profitable at both */
  hatcher:   { hair:'updo',  hc:'sand',   skin:0, suit:1, tie:'cyan',
               mood:'mad' },
  /* ran risk at a bank that no longer exists, and mentions it */
  brownout:  { hair:'buzz',  hc:'grey',   skin:1, suit:0, tie:'slate',
               mood:'cool',  glasses:true },
  /* nobody asks him twice */
  arbitrage: { hair:'buzz',  hc:'ink',    skin:4, suit:2, tie:'gold',
               mood:'mad',   beard:true },
  /* has not had a losing month since 2011 */
  obalance:  { hair:'curl',  hc:'grey',   skin:3, suit:1, tie:'red',
               mood:'happy' }
};

const esc = s => String(s).replace(/[^A-Za-z0-9_-]/g, '');

/* One portrait. `p` is anybody with an id and a tier: somebody on the
   payroll, or a stranger you have only just met. */
HS.face = function(p, px){
  const L = LOOK[p && p.id] || LOOK.rosevelt;
  const g = GROUND[(p && p.tier) || 'basic'] || GROUND.basic;
  const skin = SKIN[L.skin], shade = SHADE[L.skin];
  const hair = HAIRC[L.hc] || HAIRC.black;
  const suit = SUIT[L.suit] || SUIT[0];
  const tie = TIE[L.tie] || TIE.slate;
  const uid = 'f' + esc(p && p.id);
  const size = px ? ' width="' + px + '" height="' + Math.round(px * 76 / 64) + '"' : '';
  const hairPath = HAIR[L.hair] || '';
  const mood = MOOD[L.mood] || MOOD.cool;
  const behind = L.hair === 'long' || L.hair === 'bob';

  /* Given a fixed height shorter than the art, crop rather than squash, and
     crop from the top: the head runs from y 12 to y 48 and the shoulders sit
     below it, so anything cropped off the bottom is suit. Crop from the middle
     instead and a phone loses the hair, which is the one thing telling these
     ten apart. */
  return '<svg class="mug-art" viewBox="0 0 64 76" preserveAspectRatio="xMidYMin slice"' +
    size + ' role="img" aria-label="' + ((p && p.name) || 'portrait') + '">' +
    '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + g[0] + '"/>' +
      '<stop offset="1" stop-color="' + g[1] + '"/></linearGradient>' +
      '<clipPath id="' + uid + 'c"><rect width="64" height="76" rx="9"/></clipPath></defs>' +
    '<g clip-path="url(#' + uid + 'c)">' +
      '<rect width="64" height="76" fill="url(#' + uid + ')"/>' +
      /* a soft light behind the head lifts it off the card */
      '<circle cx="32" cy="33" r="25" fill="#FFFFFF" opacity=".05"/>' +

      /* hair that falls behind the shoulders is laid down first */
      (behind ? '<path d="' + hairPath + '" fill="' + hair + '" opacity=".92"/>' : '') +

      /* neck, and the shadow the jaw casts on it */
      '<path d="M27.4 40h9.2v10.5c0 2.4-1.8 3.5-4.6 3.5s-4.6-1.1-4.6-3.5z" fill="' +
        skin + '"/>' +
      '<path d="M27.4 40h9.2v5.4c-4.6 3-7.4 2-9.2 0z" fill="' + shade + '"/>' +

      /* shoulders wide enough to run off both edges of the card */
      '<path d="M-2 76c0-14 7-20.5 19-23.5L32 62l15-9.5c12 3 19 9.5 19 23.5z" fill="' +
        suit + '"/>' +
      /* The shirt is one wedge under everything else, so there is no gap for
         the background to show through under the chin. Lapels then cut into
         it from both sides and the tie covers the middle. */
      '<path d="M23.5 51.5 32 76l8.5-24.5z" fill="#DCE3EE"/>' +
      '<path d="M16.5 53 32 62l-6.6 14H13.5z" fill="' + suit + '"/>' +
      '<path d="M47.5 53 32 62l6.6 14h11.9z" fill="' + suit + '"/>' +
      '<path d="M16.5 53 32 62l-6.6 14H13.5z" fill="#FFFFFF" opacity=".05"/>' +
      '<path d="M47.5 53 32 62l6.6 14h11.9z" fill="#FFFFFF" opacity=".05"/>' +
      /* the fold of the collar, a shade off the shirt */
      '<path d="M23.5 51.5 32 62l-4.4 2.6-5.6-11z" fill="#C2CCDC"/>' +
      '<path d="M40.5 51.5 32 62l4.4 2.6 5.6-11z" fill="#C2CCDC"/>' +
      /* knot, then the tie */
      '<path d="M32 62l-3.2 2.6 1 3.6h4.4l1-3.6z" fill="' + tie + '"/>' +
      '<path d="M29.8 68.2h4.4l1.5 7.8h-7.4z" fill="' + tie + '" opacity=".94"/>' +

      /* ears, then the head over them */
      '<ellipse cx="18.8" cy="32" rx="2.4" ry="3.4" fill="' + shade + '"/>' +
      '<ellipse cx="45.2" cy="32" rx="2.4" ry="3.4" fill="' + shade + '"/>' +
      '<path d="' + HEAD + '" fill="' + skin + '"/>' +

      (L.jowl ? '<path d="M20 36c1 8 5.5 12 12 12s11-4 12-12c-2 6-6 9-12 9s-11-3-12-9z" ' +
                'fill="' + shade + '" opacity=".4"/>' : '') +
      (L.beard ? '<path d="M19.4 30c0 11.4 5.8 18 12.6 18s12.6-6.6 12.6-18' +
                 'c-1.4 5.2-4.2 7.2-7.1 7.6-1.6.2-2.4 1-2.4 2.2 0 1.3-1.4 2.1-3.1 2.1' +
                 's-3.1-.8-3.1-2.1c0-1.2-.8-2-2.4-2.2-2.9-.4-5.7-2.4-7.1-7.6z" fill="' +
                 hair + '"/>' : '') +

      /* the face. Brows carry the character, so they go on heavy. */
      '<path d="' + mood.brow + '" stroke="' + (BROWC[L.hc] || hair) +
        '" stroke-width="2.1" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="26.4" cy="31.4" rx="2" ry="2.4" fill="#2A2F3A"/>' +
      '<ellipse cx="37.6" cy="31.4" rx="2" ry="2.4" fill="#2A2F3A"/>' +
      '<circle cx="27" cy="30.6" r=".7" fill="#FFFFFF" opacity=".75"/>' +
      '<circle cx="38.2" cy="30.6" r=".7" fill="#FFFFFF" opacity=".75"/>' +
      '<path d="M32 33.6v2.8q0 1.2-1.4 1.6" stroke="' + shade +
        '" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".85"/>' +
      '<path d="' + mood.mouth + '" stroke="#8A4C46" ' +
        'stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
      (L.stache || L.beard ? '<path d="M27.6 39q4.4-2 8.8 0" stroke="' + hair +
                  '" stroke-width="2.6" stroke-linecap="round" fill="none"/>' : '') +

      /* and the hair that sits on top of the head goes on last */
      (hairPath ? '<path d="' + (behind ? HAIR.buzz : hairPath) + '" fill="' + hair +
                  '"/>' : '') +

      (L.glasses
        ? '<g fill="none" stroke="#C7D2E4" stroke-width="1.2" opacity=".92">' +
          '<circle cx="26.4" cy="31.6" r="5"/><circle cx="37.6" cy="31.6" r="5"/>' +
          '<path d="M31.4 31.6h1.2M21.4 30.6l-2.6.6M42.6 30.6l2.6.6"/></g>'
        : '') +
    '</g></svg>';
};

})(window.HS);
