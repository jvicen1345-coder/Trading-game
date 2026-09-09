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
src/world.js    renderer, camera, day/night
src/player.js   avatar, movement, collision
src/ui.js       HUD, panels, minimap
src/input.js    keyboard and touch
src/audio.js    procedural sound
vendor/         three.js r128, vendored so the game runs offline
```

## Things worth knowing

- Every price is generated locally. There is no live trading, no broker
  connection, no API key and no market data anywhere in this repo, and none
  should ever be added.
- All textures and audio are generated at load. There are no asset files.
- Balance is checked with a headless harness that plays full runs against the
  real pricing, calendar and rank code. Re-run it after any balance change.
- Saves live in `localStorage` under `marketmaker_save_v2`. Changing the shape
  of the state object means bumping that version and invalidating saves.
