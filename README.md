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
fortnight-out swing.

Time is the thing you earn. A new trader gets today and nothing else:

- **0DTE** dies at tonight's bell. All gamma, no mercy. This is all you have
  as an intern and through your first rank on either path.
- **WEEKLY** runs to Friday's close. Your first promotion unlocks it, and it
  becomes the everyday contract.
- **SWING** is a fortnight of time value, unlocked by your second promotion.
  Barely any decay, and one slot only, so choose well.

Contracts outlive the closing bell, so the book you carry home matters. Anything
still open sits in the **BOOK** tab and is marked against the live tape. Size is
a share of what you can actually deploy, so a session matters as much at five
million as it does at five thousand. Long premium is paid in cash; leverage is
margin, and only widens what you can write.

A session **is** the 9:30 to 4:00 trading day, so getting to work early buys you
screen time.

## How a week works

Five sessions and one **Weekend**. Saturday and Sunday are a single day,
because two days of a shut market is two days of clicking through nothing.

The weekend is where the rest of the job happens: chart the week ahead and the
read stands for all five sessions, take a class, work a room at the bar, post
to your following, or go into the office if you are on the floor. There is no
market, so the only thing competing for the day is everything else.

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

## Where you live

Monday of week two you are out of the basement whichever way you went: the
parents lose patience with the one who turned down a real job, and the firm
will not have a broker handing out his mother's address. Either way the only
room you can afford has thin walls and a meter nobody owns.

The bottom of the ladder is rented on a deposit and the top is bought outright.
Cheap rooms cost you sleep, and sometimes cost you a whole session when the
power goes out in the morning. That is the entire argument for climbing.

| | Down | Rent | Bad nights | Power cuts |
| --- | --- | --- | --- | --- |
| Rooming House | $400 | $150 | 25% | 8% |
| Share House | $900 | $320 | 15% | 4% |
| Rented Studio | $1,800 | $900 | 6% | 1% |
| Riverside Loft | $180,000 | $5,200 | never | never |
| Sky Penthouse | $2,400,000 | $24,000 | never | never |

Rent comes due once a week. Stay out past 3am or hit zero energy and the night
takes something off you. If a solo account blows up there is gig work at home
to keep the lights on.

## The channel

A day trader has no salary, so the audience is the salary. Once you are
**Consistent**, you can start a channel: go live before a session and strangers
watch you trade, then post the recap and some of them start paying. They pay by
the week, on the same morning the rent comes out.

Followers are reach and subscribers are money. A green day compounds both, a
big enough day goes viral, and a red day in front of an audience costs more
followers than a green one earns. Blow up on stream and they clip it.

The catch is deliberate. An audience rewards size and drama rather than
discipline, so the channel quietly pays you to take the trade you should not.

**Four stats drive everything.** *Skill* sharpens what you can see on the tape
and unlocks the greeks on the chain. *Reputation* opens promotions, raises money
and shaves up to 40% off your commission. *Heat* is how interested the SEC is in
you. *Energy* is the limit on how much you can do in a day.

Skill and rank pay out as **perk points** across three constellations, the tape,
risk and the street, and your room is yours to furnish, with every piece doing
something small.

Progress saves to `localStorage` automatically. A run to the top of either
ladder is roughly ten to fifteen in-game weeks.

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
src/skyline.js      animated title screen backdrop
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
