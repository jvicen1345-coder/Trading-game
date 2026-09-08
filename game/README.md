# HEATSEEKER — Broker

A top-down 3D life sim about a stock broker's career, played in the browser.

You start at twenty-four, in your parents' basement, with $240. You walk a city,
take a job on a brokerage floor, learn to read a tape, and climb — until the
ladder runs out and you choose what you actually become:

- **The Legend** — stay on the desk and out-trade everyone alive.
- **The House** — open your own floor and take a cut of every ticket on it.
- **The Villain** — raise a fund, lever it to the ceiling, and let the city hate you.

## Playing it

Open `index.html` in any modern browser. No build step, no server, no network —
everything including three.js is vendored in this folder.

| Key | Action |
| --- | --- |
| `W A S D` | Walk |
| `Shift` | Sprint (burns more energy) |
| `E` | Enter the building you're standing at |
| `Esc` | Menu / close a panel |
| `[` `]` | Zoom the camera |
| `M` | Mute |

In a trading session: `B` long, `S` short, `Space` flatten, `1` `2` `3` trade size.

Touch devices get a virtual stick and an ENTER button.

## How it works

Time passes while you walk — a full day is about six minutes. Energy drains as you
move and every action costs hours. Rent comes due every seven days. Sleep at home
to start the next day. Stay out past 3am or hit zero energy and the night takes
something off you.

**Four stats drive everything.** *Skill* sharpens what you can see on the tape:
at low skill the chart is noise, at high skill the hidden trend leaks through.
*Reputation* opens promotions and lets you raise money. *Heat* is how interested
the SEC is in you. *Energy* is the limit on how much you can do in a day.

**Two kinds of trading.** At the brokerage you trade the firm's book — you keep a
commission on the upside and losses cost you standing, not savings. At the Exchange
you put up your own cash and keep all of it, both ways.

The nine city locations — home, brokerage, exchange, bank, bar, night school,
realtor, SEC field office, and eventually your own building — each do something
distinct. Progress saves to `localStorage` automatically.

## Layout

```
index.html          shell, styles, boot
vendor/three.min.js three.js r128 (MIT), vendored so the game runs offline
src/util.js         math, seeded RNG, formatting
src/audio.js        procedural sound — oscillators, no audio files
src/state.js        stats, clock, economy, career ladder, save/load
src/city.js         procedural city: layout, merged geometry, traffic
src/world.js        renderer, follow camera, day/night lighting
src/player.js       avatar, WASD movement, collision
src/input.js        keyboard and touch
src/ui.js           HUD, panels, toasts, minimap
src/market.js       the trading session
src/locations.js    what each building offers
src/game.js         main loop, consequences, endings
```

The city is generated from a fixed seed, so the map is the same every run.
All textures are drawn to canvas at load — there are no image assets.
