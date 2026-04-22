# Campos coordinate invariants

Every adapter must emit events in a single canonical frame. Renderers trust
this contract; once an adapter runs, downstream consumers never need to know
which provider the data came from.

## The canonical frame

All pitch coordinates on every event produced by an adapter must satisfy:

- **`x: 0..100`** — `0` is the acting team's own goal, `100` is the opposition
  goal. Every event is attacker-relative: a team shooting toward its target
  goal has high `x`, regardless of which physical end of the pitch that is.
- **`y: 0..100`** — `0` is the attacker's right (physical south / bottom of a
  horizontal broadcast view when attacking left-to-right). `100` is the
  attacker's left. The y-axis is preserved from the attacker's perspective,
  just like x.
- Origin is bottom-left in canonical Campos space. No provider-specific
  flipping survives the adapter.

`endX` / `endY` (pass destinations, shot path ends) follow the same frame.

## What the adapter owns

- Scaling the provider's native range to 0..100.
- Converting the provider's y-axis convention (top-down vs bottom-up).
- Applying the 180° rotation for events from a team attacking toward the
  decreasing-x end, so their coordinates come out attacker-relative.
- Using `MatchContext.periods.homeAttacksToward` (the actual broadcast
  direction per period) when the provider's feed is **not** attack-relative.
- Ignoring `MatchContext.periods` when `attackRelative: true` — the feed has
  already done the rotation.

## What the renderer owns

- Mapping canonical Campos coordinates to SVG space.
- Deciding which way the attacker faces on screen
  (`attackingDirection: "up" | "down" | "left" | "right"` on `Pitch`,
  `ShotMap`, `Heatmap`, etc.).
- All visual orientation and cropping logic.

## Invariants adapter authors must satisfy

1. A shot from a known physical location on the pitch lands in the correct
   Campos y quadrant for the attacker's perspective. Example: a left-back
   shooting from their own left wing → Campos `y` close to 100 (attacker's
   left).
2. Every attacking-third shot has `x > 50`, regardless of which end of the
   physical pitch it came from.
3. Own goals are dropped from `shots()` but surfaced from `events()`.
4. Extra-time and penalty-shootout coordinates follow the same rules as
   regular-play; shootouts may be excluded entirely.
5. Goal-mouth coordinates (where available) are also attacker-relative:
   `goalMouthY: 0` = left post from the shooter's perspective.

## Per-provider notes

- **Opta F24 (non-attack-relative)**: bottom-to-top y, origin bottom-left.
  Adapter applies a 180° rotation (both x and y) for teams attacking toward
  decreasing-x in the relevant period.
- **Opta expected-goals (attack-relative)**: already in canonical form.
  Adapter passes x and y through untouched.
- **StatsBomb (120×80, attack-relative)**: x scaled `/120*100`; y requires
  inversion because StatsBomb's y=0 is the top touchline.
- **Wyscout (100×100, attack-relative)**: y inverted (Wyscout y=0 is the top
  touchline, opposite Campos convention).
- **WhoScored**: inherits Opta conventions; already attack-relative.

See `packages/adapters/test/opta/liv-ars-integration.test.ts` for a
physical-correctness test pattern using real match data — adapter authors
should add similar coverage whenever they onboard a new provider.
