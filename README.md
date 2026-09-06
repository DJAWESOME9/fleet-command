# Fleet Command

A playable, local browser prototype of a fleet-building naval deduction game. No runtime dependencies, paid services, accounts, or API keys.

## Run

Requires Node.js 22 or newer. From this directory:

```sh
npm start
```

Open http://localhost:3000. Run rules tests with `npm test`.

## Playable foundation

- 10×10, 12×12, 16×16, and 20×20 boards; configurable fleet budgets.
- Fleet sizes are limited by map: 4–6 ships on 10×10, 5–8 on 12×12, 7–10 on 16×16, and 9–12 on 20×20. Captains and mines do not count.
- Eight starter ships, five unique captains, and up to five escalating-cost mines. Mines cost 1, 2, 3, 4, then 5 points respectively.
- Fleet selection, captain assignment, random deployment, and manual repositioning/rotation.
- Standard and Salvo turns; optional repeat action on normal hits in Standard. Salvo rounds allow one action per living ship up to a 4/5/6/7 action cap by map size.
- Lowest purchased fleet cost goes first, with a random tie break.
- Movement along ship facing, persistent section damage, armor, limited repairs.
- Click a ship to select it, use its on-board movement arrows, and choose from its named contextual orders. Repair appears only for damaged ships with repair supply. Automatic captain effects are labeled.
- Reconnaissance planes are placed on carrier hull sections during deployment. Click a carrier section after choosing “Place plane.” Launching a plane removes it from the deck; if that section is hit first, the plane is destroyed and its flight is lost.
- Specialized hulls have roster limits: Wraith, Beacon, Bulwark, Trident, and Osprey are limited to one each; Mako and Echo allow three each. Patrol boats remain flexible fleet fillers.
- Settings persist locally: adjust interface volume, require confirmation before orders, and choose the bot response delay.
- Local commander progression awards XP for wins and smaller XP for losses. Level unlocks expand the ship and captain catalog; the profile and call sign are saved on this device.
- During deployment, drag ships and mines to reposition them. Changing a selected ship's facing immediately rotates its footprint. Hover order buttons for ability details.
- Radar for surface sections/mines; sonar and hydrophone for submarines; aircraft area counts; depth charges and paired fire.
- Four bot settings, with stronger targeting, scan use, and repairs at higher difficulty. These are heuristic bots, not paid AI models. The current Expert setting does not yet perform multi-turn search.
- Victory, defeat, retaliation, confirmed white-flag concession, and restarting matches.
- Local autosave and resume after reloading the browser.

## Architecture

`src/catalog.js` defines content. `src/engine.js` validates and resolves actions independently of the interface. Invalid actions leave the state untouched. Bot decisions use their own discoveries rather than hidden enemy locations. `src/app.js` and `src/style.css` implement the interface. `server.js` is a loopback-only static development server, not a multiplayer backend.

The entire match currently runs in the browser. Hidden boards can therefore be inspected by someone using development tools. Do not use this prototype as a secure online multiplayer implementation. Future multiplayer must keep authoritative match state on a server and send filtered observations to each client. The prototype's human-oriented log must also become per-player event output before that migration.

## Rules details

Movement is one cell forward/backward, never a turn or sideways step. It carries damage and resources; historical target markers stay at their old coordinates. Ship and mine overlap is illegal. A destroyed ship remains a wreck occupying its cells. Ships may be purchased more than once, but each named captain may appear once.

Repairs restore one health and consume an action and supply. Starter hulls have one repair for 2–3 cells or two for 4 cells; Rook adds one. No sunk hull can be revived. Radar and sonar each select one unshot, previously unrevealed eligible cell; no eligible cells returns no new contacts. Scans count surviving sections rather than their remaining health.

Voss retaliation resolves before victory, including on the last ship. Pike's extra shot must be orthogonally adjacent. Bonus and area shots cannot generate repeat-on-hit actions. Normal mine hits qualify for repeat-on-hit. Ortiz's first two normal shots inspect for mines; a cleared mine allows a replacement shot.

## Later milestones

The agreed design also includes larger advanced ships and captains (including silent repair and support ships), account-backed XP and unlocks, and private multiplayer with reconnect support. These are not implemented in this first playable foundation. Monetization is intentionally outside the current work.
