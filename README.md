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
  hide on. Every dollar is yours and so is every hole. It is the longer road,
  and it ends somewhere the floor cannot follow.
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

In a trading session: `B` buy, `S` sell, `Space` close what you are holding,
`Tab` change expiry, `1` to `5` pick a rung of the chain (hold `Shift` for the
put), `Esc` leave the desk. Leaving banks the day where it stands: anything
expiring tonight comes off at the mark, anything longer dated rides.

Every position is opened by **buying** it, and **SELL** closes what you are
holding. Nothing you do not own is yours to sell.

### On a phone

Touch devices get a virtual stick and an ENTER button, and the game is played
**in landscape**. A top-down city in a tall thin window shows you almost
nothing, so a phone held upright is asked to turn rather than fobbed off with a
squeezed layout. The clock stops while that gate is up, so nobody loses a
trading day to picking the phone up the wrong way round.

Starting the game asks for fullscreen and for an orientation lock, since that
is the one moment a browser will grant either. Both are offers: iOS Safari
refuses them and the game plays fine without.

### A controller

Plug in a DualSense, an Xbox pad or anything else that reports the standard
mapping and press a button. The game notices and says so.

| Pad | Walking the city | A list of choices | In a session |
| --- | --- | --- | --- |
| Left stick | Walk, rim to sprint | Move the cursor | Pick a rung |
| `R2` | Sprint | | Chain or book |
| D-pad | | Move the cursor | Up and down the chain |
| D-pad left/right | | Move the cursor | Call or put |
| Cross | Enter a building | Take the choice | Buy |
| Square | Perk trees | | Sell |
| Circle | Back out | Back out | Close the position |
| Triangle | Full city map | | Change expiry |
| `L1` `R1` | Zoom the camera | | Size down and up |
| Options | Menu | Menu | Leave the desk |
| Share | Controls | | |

Anywhere the game asks you to choose something the pad puts a gold cursor on
the list. A session has no cursor, because every action there has a button.

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
a share of your cash, so a session matters as much at five million as it does at
five thousand.

How large a share is the thing rank actually buys. An intern may put **25%** of
their cash behind one idea and a partner **88%**, with three perks in the risk
tree worth another 52 points between them. Nothing extends past what you have,
so the worst a position can do is lose you the money in front of you.

A session **is** the 9:30 to 4:00 trading day, so getting to work early buys you
screen time.

Hit your daily target before three o'clock and the session stops to ask what
you want to do about it. Bank the day and it is yours, or sit out the quiet
middle and come back for the **power hour**, which runs hotter than the rest of
the day in both directions. Anything you leave open rides the afternoon without
you.

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

## Building a firm

Three things an employee is good at, except that nerve is not a thing you want
them to have. Tape is what they are worth in an average week. Screen is whether
they can carry a room. **Nerve is nervous energy, and less of it is better.**

Somebody with none of it sits on a position all afternoon, sizes the same way
on Friday as on Monday, and posts nothing they would not say to the desk.
Somebody full of it cuts a winner the second it wobbles, puts the week on one
idea because they cannot stand watching it, loses it live in front of the
audience you spent months building, and at the far end simply does not come in
and does not answer, then turns up on Monday calmer and sorry about it.

So calm is expensive and jumpy is cheap, and you can talk somebody down: nerve
is the one stat training takes off a person rather than adding to them.

The week is the same week for everyone on the floor, so a bad Friday arrives
for the whole room at once and nerve decides who does something stupid about
it. The roster shows it as a word rather than a bar - steady, even, streaky,
wild - and so does the screen where you are deciding what to pay somebody,
because a risk you cannot price before you buy it is not a decision.

The solo route is not really about trading alone. It is about proving the
floor was wrong to be a floor, which means building one of your own out of
people nobody else would hire.

From **Funded Trader** you can recruit. There are **ten people in this city**
worth knowing and **five chairs**, so the firm you end up with is a set of
choices rather than a pile of hires.

**Five are green.** Al Gorithm, Nancy Pelosini, Teddy Rosevelt, Angela Merkup
and Justin Trudough are much of a muchness on paper, around forty across the
board, and each has one thing of their own: Al learns from every chart review
you do, Nancy makes the bar pay half again as well, Teddy never minds that you
are not around, Angela's nerve counts twice on a week that goes wrong, and
Justin turns a following into subscribers faster than you can. Train them at
the office and they go whichever way you point them.

**Three are already good.** Winston Churnwell adds a quarter to what the desks
clear and thinks a webcam is a confession. Margaret Hatcher adds a third and a
little heat every week she is there. Gordon Brownout buys you five more points
of rope before the desk pulls your book. None of them came here for a lesson,
and it takes three proper conversations before any training takes. Whether a
conversation lands is your record and your name against their opinion of both.

**Two are better than you.** Chester Arbitrage doubles what the desks clear and
takes a quarter of it, up and down, so on a bad week you are paying him to have
lost you money. Barack Obalance means the desks never lose in a week and never
make a killing either. They will not sit in the same building, so taking one
shuts the door on the other for good.

You do not see anyone's real numbers. You get a range, and how wide it is
depends on you: a new Funded Trader reads tape to within about ten points and
nerve to within twenty, while somebody with skill and a name on the street
reads both to within two or three. Nerve is always the vaguest, because nerve
only shows on a bad day, and a losing week on the desks is what finally tells
you what you bought.

Then you haggle. They open above what they are worth, and your counter is
worked out from **what you think they are worth**. Meet their number and they
start keen. Offer what you make them worth and they usually take it. Try it on
and they may walk, which is how a bad read costs you somebody good.

**The first two work for nothing.** Before there is an office there is no
payroll, so the two people you can fit around a bedroom are not employed by
you, they are taking a chance on you. It costs you nothing and it buys you
nothing: a bad week and they are simply not there on Monday, where somebody on
a wage would have grumbled and stayed. What they give you instead is **trust**,
earned on the weeks that go well, and trust is what makes them cheap to teach.
At full trust a training session takes about a third of the effort.

Taking the lease ends that. On the Monday after you sign, the people who had
been doing it for nothing start being paid.

Then the address. A vacant floor becomes **The Back Room** above a laundrette,
and eventually **The High-Rise**, forty-one storeys up and in sight of the firm
that did not want you. Once you have desks you hand the channel to whoever can
carry a room and go back to trading, though you still have to walk the floor
once a week. Nobody works hard for somebody who never comes in.

## The quarter

From Funded Trader, Ladder and Co. starts posting numbers whether you look or
not. A quarter is two weeks. Beat them four quarters running and the game is
over on your terms; lose one and the streak goes back to nothing. Their target
is published in advance, so a bad quarter is always something you saw coming.

## The Blue House

Once your channel is real, somebody in Seoul who has watched every session you
ever put out finally writes. **Yoon Suk-Yield** trades a system nobody here
uses, and offers to teach it.

It reads the tape far better than you do and it will not let you size into
anything. Below a threshold you are following rules you do not understand and
it is worse than trading blind; above it, it is a reliably better read that is
never a certainty, and it caps you at a fraction of your usual size. Your own
skill eventually overtakes it.

Which makes it exactly the wrong tool for a man with an audience, and that is
the point. You pick a system every session.

**Four stats drive everything.** *Skill* sharpens what you can see on the tape
and unlocks the greeks on the chain. *Reputation* opens promotions, raises money
and shaves up to 40% off your commission. *Heat* is how interested the SEC is in
you. *Energy* is the limit on how much you can do in a day.

Skill and rank pay out as **perk points** across three constellations, the tape,
risk and the street, and your room is yours to furnish, with every piece doing
something small.

Progress saves to `localStorage` automatically. The Floor takes around eight
in-game weeks. The Day Trader takes around fifteen, because building a firm and
then beating one takes longer than climbing inside somebody else's.

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
src/faces.js        the cast's portraits, drawn as SVG
src/world.js        renderer, follow camera, day/night lighting
src/player.js       avatar, WASD movement, collision
src/input.js        keyboard and touch
src/gamepad.js      a controller, mapped onto the keys above
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
