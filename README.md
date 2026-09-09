# Market Maker

A top-down 3D life sim about a stock broker's career, played in the browser.

A market maker is the honest party who provides liquidity and takes the spread.
It is also the person who makes the market do what he wants. And it is what you
become, from nothing, over the course of the game. All three readings are on the
table, and which one you end up being is the whole point.

You start as an intern at a brokerage called Ladder & Co. with $400 and one week
to prove you belong on a screen. The first three days are guided. After that the
game hands you the controls and asks you to end the week green.

On Friday of week one you choose:

- **Day Trader.** Go it alone from a bedroom. No salary, no boss, no floor to
  hide on. Every dollar is yours and so is every hole.
- **The Floor.** Take the junior seat and climb. A wage, a book that grows with
  your title, and a floor you might one day run.

There is a third path, but it has to find you. Somebody in this city runs money
nobody talks about, and he only calls once.

## Playing it

Open `index.html` in any modern browser. No build step, no server, no network.
Everything including three.js is vendored in this folder.

| Key | Action |
| --- | --- |
| `W A S D` | Walk |
| `Shift` | Sprint |
| `E` | Enter the building you are standing at |
| `Tab` | Full city map |
| `P` | Perk trees |
| `Esc` | Menu, or close a panel |
| `[` `]` | Zoom the camera |
| `M` | Mute |

In a trading session: `B` buy, `S` write, `Tab` change expiry, `1` to `5` pick a
rung of the chain (hold `Shift` for the put).

Touch devices get a virtual stick and an ENTER button.

## Trading

Trading is options, and the chain is sorted by moneyness rather than by strike.
Five rungs of calls and five of puts, from **DEEP ITM** (moves almost like the
stock) through **ATM** (the balanced bet) to **FAR OTM** (a lottery ticket). The
rungs are spaced by what that contract can actually move before it dies, so
every one of them is worth trading whether you are on a one-hour 0DTE or a
quarter-out LEAP.

Three expiries behave genuinely differently:

- **0DTE** dies at tonight's bell. All gamma, no mercy.
- **WEEKLY** runs to Friday's close. The everyday contract.
- **LEAP** lives a quarter and barely decays, but you only get one slot.

Contracts outlive the closing bell, so the book you carry home matters. Anything
still open sits in the **BOOK** tab and is marked against the live tape. Size is
a share of what you can actually deploy, so a session matters as much at five
million as it does at five thousand. Long premium is paid in cash; leverage is
margin, and only widens what you can write.

A session **is** the 9:30 to 4:00 trading day, so getting to work early buys you
screen time.

## How a day works

Walking is free. Energy goes on **actions**: the session, a class, an hour at
the gym, working a room at the bar. A full weekday costs about a whole day's
energy, so something usually has to give.

Sleeping before half nine leaves you **refreshed**, which sharpens your chart
reads and makes everything cost less effort all day. Turn in after half eleven
and you wake ragged, with both of those reversed. The gym raises your stamina
ceiling permanently and the corner store sells it back to you by the can, at a
price that climbs steeply with the size and doubles with every can you have had
that day.

Rent comes due every seven days. Stay out past 3am or hit zero energy and the
night takes something off you. If a solo account blows up there is gig work at
home to keep the lights on.

**Four stats drive everything.** *Skill* sharpens what you can see on the tape
and unlocks the greeks on the chain. *Reputation* opens promotions, raises money
and shaves up to 40% off your commission. *Heat* is how interested the SEC is in
you. *Energy* is the limit on how much you can do in a day.

Skill and rank pay out as **perk points** across three constellations, the tape,
risk and the street, and your room is yours to furnish, with every piece doing
something small.

Progress saves to `localStorage` automatically. A run to the top of either
ladder is roughly ten to fourteen in-game weeks.

## Layout

```
index.html          shell, styles, boot
vendor/three.min.js three.js r128 (MIT), vendored so the game runs offline
src/util.js         math, seeded RNG, formatting
src/audio.js        procedural sound, no audio files
src/state.js        stats, clock, economy, career ladders, save/load
src/tape.js         persistent market: tickers, calendar, expiries, the book
src/options.js      Black-Scholes pricing, the vol smile, strike ladders
src/market.js       the trading session
src/perks.js        the three perk constellations
src/room.js         your room and its furniture
src/city.js         procedural city, street props, traffic
src/world.js        renderer, follow camera, day/night lighting
src/player.js       avatar, WASD movement, collision
src/input.js        keyboard and touch
src/ui.js           HUD, panels, toasts, minimap
src/locations.js    what each building offers
src/game.js         main loop, consequences, endings
tools/              the house-style checker and its git hooks
```

The city is generated from a fixed seed, so the map is the same every run. All
textures are drawn to canvas at load, and there are no image assets.

## House style

No em dashes; use a hyphen. `node tools/no-em-dash.mjs` reports them and `--fix`
rewrites them. Git hooks in `tools/hooks` enforce it for both staged files and
commit messages. Enable them with `git config core.hooksPath tools/hooks`.

## Scope

This repository is the game and nothing else. There is no live trading, no
broker connection, no API keys and no market data. Every price you see is
generated locally by `src/tape.js` and priced by `src/options.js`. It is a
simulation for play, not a tool for trading real money.
