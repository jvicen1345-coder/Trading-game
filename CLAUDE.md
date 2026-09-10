# Market Maker

A top-down 3D life sim about a stock broker's career. Plain HTML, CSS and
classic-script JavaScript. No build step, no framework, no network at runtime.
Open `index.html` and it runs.

## House style

**No em dashes.** Use a hyphen. This is enforced, not a preference:

```
node tools/no-em-dash.mjs         # report, exits 1 if any are found
node tools/no-em-dash.mjs --fix   # rewrite them to hyphens
node tools/no-em-dash.mjs --en    # also catch en dashes
```

Git hooks live in `tools/hooks` and are wired up with:

```
git config core.hooksPath tools/hooks
```

`pre-commit` rejects staged files containing an em dash and `commit-msg`
rejects commit messages containing one. The rule covers code, comments,
player-facing strings, documentation and commit messages alike.

## Layout

```
index.html      shell, styles, boot
src/tape.js     persistent market: tickers, calendar, expiries, the book
src/options.js  Black-Scholes pricing, the vol smile, strike ladders
src/market.js   the trading session
src/state.js    stats, clock, economy, career ladders, save/load
src/locations.js what each building offers
src/game.js     main loop, consequences, endings
src/perks.js    the three perk constellations
src/room.js     your room and its furniture
src/city.js     procedural city, street props, traffic
src/skyline.js  animated title screen backdrop
src/faces.js    the cast's portraits, drawn as SVG
src/world.js    renderer, camera, day/night
src/player.js   avatar, movement, collision
src/ui.js       HUD, panels, minimap
src/input.js    keyboard and touch
src/gamepad.js  a controller, mapped onto the keys above
src/audio.js    procedural sound
vendor/         three.js r128, vendored so the game runs offline
```

## Things worth knowing

- Every price is generated locally. There is no live trading, no broker
  connection, no API key and no market data anywhere in this repo, and none
  should ever be added.
- All textures and audio are generated at load. There are no asset files.
  That includes the cast's faces: `HS.face(person)` in `faces.js` returns an
  SVG built from an authored `LOOK` entry per person. They are deliberately
  abstract and must stay that way - the names are puns, not portraits, and
  nothing should try to resemble a real person.
- Phones play in landscape. `body.portrait` gates a rotate overlay and counts as
  an open overlay in `game.js`, which stops the clock behind it. It is set only
  on touch devices, so a narrow desktop window is left alone. The landscape HUD
  is driven by a `max-height` media query rather than a width one: a phone on
  its side is wider than the 820px breakpoint but only ~390px tall.
- Balance is checked with a headless harness that plays full runs against the
  real pricing, calendar and rank code. Re-run it after any balance change.
- Saves live in `localStorage` under `marketmaker_save_v3`. Changing the shape
  of the state object means bumping that version and invalidating saves.
- A week is six days: five sessions and one Weekend. Saturday and Sunday are a
  single day. Anything that counts days has to go through the helpers in
  `tape.js` rather than assuming seven, and trading days still run five to the
  week so contract expiries are unaffected.
- Housing is rented at the bottom of the ladder and bought at the top. The
  cheap rungs carry a per-night chance of broken sleep and a per-morning
  chance of a power cut that cancels the session outright.
- The solo path builds a firm from a fixed cast of ten in `HS.CAST`, seated
  five at a time. Five are trainable, three need talking round three times
  before training takes, two cannot be trained and cannot both be hired. Each
  carries a `special` that other modules look up by name.
- With no office there is no payroll: the first two seats cost nothing, quit at
  a much higher morale floor, and build `trust` on good weeks which discounts
  training. Taking the lease starts the wage bill.
- Candidate stats are never shown exactly. `HS.readCandidate` blurs them into a
  band whose width comes from skill and reputation, and a losing week on the
  desks sets `known` and reveals the truth.
- The Blue House is a second trading system, gated behind its own skill. It
  raises the chart read and caps position size, and your own skill eventually
  overtakes it. Both systems share the same market code.
