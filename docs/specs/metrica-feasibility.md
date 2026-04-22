# Metrica Sports Adapter Feasibility

**Status:** draft
**Scope:** honest feasibility read on a future `fromMetrica` adapter seam, separating two distinct claims: Metrica's value as a fixture corpus, and kloppy's value as prior art for the canonical tracking shape
**Purpose:** record what Metrica's sample data exposes, where it would land as a narrow adapter today, and what role it plays in the adapters-first tracking-schema RFC

## Source

Reference clone: `/Volumes/WQ/ref_code/sample-data/` — Metrica Sports' public sample package. Three anonymised matches: Sample_Game_1 and Sample_Game_2 in Metrica's legacy CSV format; Sample_Game_3 in the new FIFA EPTS (XML metadata + JSON events + positional TXT) format. Pitch dimensions 105 × 68 m for all three. Event definitions PDF in `documentation/`. See `/Volumes/WQ/ref_code/INDEX.md` for the entry.

Adjacent prior art: `/Volumes/WQ/ref_code/kloppy/` already loads Metrica EPTS data via its vendor-independent model, with coordinate standardisation and event/tracking synchronisation solved. This feasibility doc must stay honest about what Campos would gain from a dedicated `fromMetrica` seam over "use kloppy-loaded fixtures directly."

## What the data contains

### Per match (legacy CSV format, Games 1-2)

| File                                   | Shape | Contents                                                                                                                                       |
| -------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `{game}_RawEventsData.csv`             | CSV   | 1,745–1,935 event rows with `Team`, `Type`, `Subtype`, `Period`, `Start/End Frame`, `Start/End Time [s]`, `From`, `To`, `Start X/Y`, `End X/Y` |
| `{game}_RawTrackingData_Home_Team.csv` | CSV   | ~145,000 frames @ 25 Hz; wide-table with 14 player columns + ball, each as `(x, y)` pair                                                       |
| `{game}_RawTrackingData_Away_Team.csv` | CSV   | Same shape, away team                                                                                                                          |

Legacy CSV does **not** carry attacking-direction metadata; it has to be inferred (see gotchas).

### Per match (EPTS / FIFA format, Game 3)

| File                  | Shape | Contents                                                                                                                                                                                                          |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{game}_metadata.xml` | XML   | FIFA EPTS metadata: frame rate (25 Hz), half-start/end frames, pitch dimensions, `Players`, `Teams`, position codes, and **`attack_direction_first_half`** per team (confirmed `left_to_right` / `right_to_left`) |
| `{game}_events.json`  | JSON  | 3,620 event objects with `index`, `team`, `type.id/name`, `subtypes.id/name`, `start/end.frame/time/x/y`, `from`, `to`, `period`                                                                                  |
| `{game}_tracking.txt` | Text  | One line per frame: `frame:p1x,p1y;p2x,p2y;...;pNx,pNy:ballx,bally` — both teams interleaved, ball suffix                                                                                                         |

### Coordinate system

- Normalised to **`x: 0..1`, `y: 0..1` with origin top-left** — `(0, 0)` = top-left corner, `(1, 1)` = bottom-right, `(0.5, 0.5)` = centre spot.
- Tracking and events use the same frame, with `NaN` for unknown positions (substitute not yet on pitch, ball out of bounds, etc.).
- Both teams and ball in a **single team-agnostic frame** — no per-half mirroring baked in. Per-team attacking direction is **explicit** in EPTS metadata via `ProviderTeamsParameters → attack_direction_first_half`, and inferred for legacy CSV.

### Event taxonomy (observed frequencies, Sample_Game_1)

| Type             | Count | Notable subtypes                                                                         |
| ---------------- | ----- | ---------------------------------------------------------------------------------------- |
| `PASS`           | 799   | (mostly blank subtype; a few `HEAD`, `THEFT`)                                            |
| `RECOVERY`       | 278   | `INTERCEPTION` (162), `THEFT` (23), blank (84)                                           |
| `BALL LOST`      | 257   | `INTERCEPTION` (128), blank (51), `THEFT`, `OFFSIDE`                                     |
| `CHALLENGE`      | 233   | `TACKLE-WON` / `TACKLE-LOST`, `AERIAL-WON` / `AERIAL-LOST`, `GROUND-WON` / `GROUND-LOST` |
| `SET PIECE`      | 77    | `FREE KICK`, `THROW IN`, `KICK OFF`, `CORNER KICK`, `GOAL KICK`                          |
| `BALL OUT`       | 51    | Lifecycle / play-state marker                                                            |
| `SHOT`           | 24    | ON TARGET, OFF TARGET, BLOCKED, HEAD                                                     |
| `FAULT RECEIVED` | 22    | Foul-won equivalent                                                                      |
| `CARD`           | 4     | `YELLOW`, `RED`                                                                          |

Total: ~1,700–1,900 events per match. Event counts are low compared with StatsBomb (~3,000 per match) because Metrica does not include `Ball Receipt`, `Pressure`, `Carry`, or `Dribble` as discrete event rows — those signals are expected to be derived from the synchronised tracking stream.

## Two distinct claims this doc tries to separate

An earlier draft collapsed two claims into one framing ("Metrica is the cleanest reference format"). The claims are separate and have different weights:

**Claim A: Metrica is the best fixture corpus for validating the tracking-schema RFC.** True. It is the only public sample where a canonical `ShotEvent`'s frame number maps directly into a full 22-player tracking frame. StatsBomb's 360 data is event-anchored (no continuous frames); SkillCorner's data has tracking but only derived tactical events. For the RFC's Stage 2 prototype, Metrica is the right input.

**Claim B: Metrica is the best prior art for designing the canonical tracking shape.** Likely false. Kloppy has already built a vendor-independent tracking data model covering Metrica, StatsBomb, SkillCorner, and 9 other providers, including coordinate standardisation (`PitchDimensions`, `Dataset.transform()`), synchronised event ↔ tracking joins, and SPADL-adjacent event models. The canonical tracking shape should borrow from kloppy's abstractions, not derive purely from Metrica's format.

The RFC (`tracking-schema-rfc.md`) adopts this split: Metrica is the Stage 2 concrete adapter target; kloppy is cited as prior art to borrow from during Stage 3 canonical extraction.

## Surfaces that could plausibly ship today

Against the current Campos canonical kinds, if we choose to land a dedicated `fromMetrica` seam at all (see "Do-nothing alternative" below):

### 1. `matchContext()` — EPTS-only, cheap

EPTS XML metadata carries half boundaries (`first_half_start`, `first_half_end`, `second_half_start`, `second_half_end`), frame rate (25 Hz), pitch dimensions, provider identity, and the per-team `attack_direction_first_half`. Directly shaped to feed a per-match context object. Crucially, this is where the coordinate-conversion inputs live — see below.

### 2. `matchLineups()` — EPTS-only, cheap

EPTS `Players` + `Teams` elements have anonymous IDs and `position_type` / `position_index`. Squad-joined labels cannot be real (data is anonymised: `Player 10`, `Player 11`, etc.) so demo value is limited, but the adapter shape is honest.

### 3. `events()` — doable once coordinate rotation is correct

| Metrica Type     | Metrica Subtype                                                     | Canonical kind                                                                                                                |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `PASS`           | any                                                                 | `pass`                                                                                                                        |
| `SHOT`           | any                                                                 | `shot` with `xg: null` (no xG field in Metrica)                                                                               |
| `RECOVERY`       | `INTERCEPTION`                                                      | `interception`                                                                                                                |
| `RECOVERY`       | blank / `THEFT`                                                     | `recovery`                                                                                                                    |
| `CHALLENGE`      | `TACKLE-WON` / `TACKLE-LOST`                                        | `tackle`                                                                                                                      |
| `CHALLENGE`      | `AERIAL-WON` / `AERIAL-LOST` / `GROUND-*`                           | `duel`                                                                                                                        |
| `SET PIECE`      | `FREE KICK` / `THROW IN` / `KICK OFF` / `CORNER KICK` / `GOAL KICK` | `set-piece`                                                                                                                   |
| `CARD`           | `YELLOW` / `RED`                                                    | `card`                                                                                                                        |
| `BALL LOST`      | any                                                                 | **absorb into `sourceMeta.precedingTurnover` on the next `RECOVERY` when adjacent; else emit as orphan metadata** (see below) |
| `BALL OUT`       | any                                                                 | drop (lifecycle)                                                                                                              |
| `FAULT RECEIVED` | any                                                                 | **absorb into `sourceMeta.faultReceivedBy` on the adjacent `CARD` / foul-committed event; else emit as orphan metadata**      |

The earlier draft recommended silently dropping `BALL LOST` and `FAULT RECEIVED`. That was inconsistent with how the StatsBomb audit handles `Foul Won` (type.id 21) — flagged as a design-decision gap awaiting a canonical `foul-won` kind, not a silent drop.

**`BALL LOST` adjacency policy** — verified against Sample_Game_1:

- 257 `BALL LOST` rows, 278 `RECOVERY` rows in the match.
- 169 of 257 `BALL LOST` rows (66%) are immediately followed by a `RECOVERY` row — absorb into that recovery's `sourceMeta.precedingTurnover: { subtype, fromPlayer, frame }`.
- 85 `BALL LOST` rows (33%) are orphans: no adjacent `RECOVERY` (ball went out of play to `BALL OUT`, half ended, woodwork, offside-no-recovery, etc.). Orphan policy: emit the `BALL LOST` data into `sourceMeta.unmappedProviderRows` on the match-level context (or the owning team's event-stream metadata), rather than silently dropping. Structurally similar to the StatsBomb audit's "intentionally unmapped lifecycle" posture — preserved for provenance, not emitted as canonical events.
- 109 `RECOVERY` rows have no preceding `BALL LOST` (e.g., started from a shot block or opposition set-piece). These are fine — they emit as plain `RecoveryEvent` with no `sourceMeta.precedingTurnover`.
- 6 `BALL LOST` subtypes structurally cannot pair (`END HALF`, `GOAL KICK`, `WOODWORK`, `OFFSIDE` with no recovery). These count toward the orphan set.

The adapter's test suite should assert a specific coverage ratio (~66% paired, ~33% orphan in the observed sample) rather than assuming 100% pairing.

**`FAULT RECEIVED` adjacency policy** — similar pattern. Typically pairs with an adjacent `CARD` or the opposing team's implicit foul. When paired, absorb. When orphan (no adjacent foul event — e.g., advantage played), emit into `sourceMeta.unmappedProviderRows`. At 22 rows/match this is a small surface.

### 4. `shots()` / `passes()` — narrow, honest

Shot count per match is small (24) and Metrica does not expose xG. The adapter emits `xg: null` — same policy as `fromWhoScored`. Passes are the strongest surface (~800–960 per match) with start/end coordinates and from/to player IDs.

**Gap matrix impact**: adding `fromMetrica` requires a new row in the narrow reference-backed adapter table of `docs/standards/adapter-gap-matrix.md` with xG = `unsupported`, `XGTimeline` readiness = `unsupported`. Landing this adapter without the matrix update would create silent drift.

### 5. Not viable without schema additions

- `frames()` / tracking-frame stream — see tracking-schema RFC. Metrica is Stage 2 per the RFC; internal provisional type first, canonical extraction later.
- `BALL LOST` as a first-class event — no canonical kind.
- `FAULT RECEIVED` as a first-class event — no canonical `foul-won` kind yet.

## Coordinate conversion

Metrica events and tracking frames are in a **team-agnostic** 0..1 top-left frame. Campos canonical coordinates are **attacker-relative** 0..100 origin bottom-left (x=0 own goal, x=100 opposition goal; y=0 attacker's right, y=100 attacker's left). A complete conversion requires per-team, per-half rotation using the explicit `attack_direction_first_half` metadata.

An earlier draft offered `campos.y = 100 * (1 - metrica.y)` as a universal formula. That was incomplete — it handled only the vertical flip for one specific attacking direction and did not address `x` at all. The correct per-team transform:

Let `d = attack_direction_first_half` from EPTS metadata (`left_to_right` or `right_to_left`), and `p = period` (1 or 2). A team's effective attacking direction in the current period is:

```
attacking_direction =
  d                      if p == 1
  flip(d)                if p == 2   (teams switch ends at half time)
```

The transform is **per-event**, not per-match. For each row, the adapter reads the event's `team` attribution, looks up that team's `attack_direction_first_half` in EPTS metadata, flips for period 2, then selects the row of the table below. Applying a single match-level rule would rotate opposition events backwards.

Given a Metrica event or tracking coordinate `(mx, my)` where `mx, my ∈ [0, 1]`, the Campos coordinate for the acting team's perspective is:

| Attacking direction | Campos transform                     | Rationale (anchored to Metrica's top-left origin)                                                                                                |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `left_to_right`     | `x = 100 * mx`, `y = 100 * (1 - my)` | Attacker's goal is at `mx = 1`, own goal at `mx = 0` — x passes through. Attacker's right is the `my = 1` touchline (opposite Metrica's origin). |
| `right_to_left`     | `x = 100 * (1 - mx)`, `y = 100 * my` | Attacker's goal is at `mx = 0`, own goal at `mx = 1` — invert x. Attacker's right is the `my = 0` touchline (Metrica's origin side).             |

This matches the pattern documented for Opta F24 in `docs/standards/coordinate-invariants.md`: when a team attacks toward decreasing-x (`right_to_left`), rotate both axes; when attacking toward increasing-x (`left_to_right`), only the y-flip is needed (because Metrica's y-axis is inverted relative to Campos regardless of direction).

For **legacy CSV format (Games 1-2)**, the `attack_direction_first_half` metadata does not exist. The adapter must either infer from kickoff frame (team taking kickoff is by definition at the centre spot; first pass direction gives the attacking end) or require the consumer to supply direction via a config argument. **This is the honest gotcha for legacy CSV.** A first implementation should target EPTS only; legacy CSV can follow with an explicit direction-override API.

## Do-nothing alternative

A dedicated `fromMetrica` adapter is not obviously required. Alternatives:

1. **Use kloppy-loaded Metrica fixtures as test inputs only**, with a thin Campos-side adapter over kloppy's unified model. Pros: reuses solved parsing, cross-provider consistency. Cons: adds Python interop dependency; kloppy's canonical model diverges from Campos's in ways we'd have to reconcile per-chart.
2. **Skip Metrica entirely**. The tracking-schema RFC's Stage 2 prototype could be built against StatsBomb's 360 data (already local, already documented) plus a separately-loaded kloppy-sourced tracking sample for continuous-frame design validation. Pros: avoids duplicating kloppy's parsing work. Cons: no direct Campos-native adapter story for a provider whose sample is public and legible.
3. **Land the adapter as a narrow EPTS-only validator.** Pros: exercises Campos's coordinate contract, event taxonomy, and canonical shape against a minimal real provider in isolation. Cons: 3 anonymised matches is thin demo fuel; arguable value over option 2.

Recommendation: **resolve by running the 1-day Stage 0 spike defined in `tracking-schema-rfc.md`** — load `Sample_Game_3` via kloppy, shim its output into a Campos attacker-frame type, render one chart. The spike's outcome picks the vehicle: if the kloppy shim composes cleanly, option 2 wins and no dedicated `fromMetrica` adapter is required. If the shim forces too many per-chart reconciliations, option 3 wins and the adapter lands. Deferring this decision to the end of the RFC's Stage 1 would only move the same question later — Stage 1 targets StatsBomb 360, not continuous tracking, and produces no evidence about kloppy's Metrica model.

If option 3 wins, the adapter's first implementation ships **EPTS-only**, covering 1 of the 3 public Metrica matches — call out explicitly as a corpus-coverage limitation vs kloppy, which handles legacy CSV too (confirmed in `/Volumes/WQ/ref_code/kloppy/kloppy/infra/serializers/tracking/metrica_csv.py`). Legacy CSV support can follow with an explicit direction-override API.

## What Metrica validates vs does not validate

Landing `fromMetrica.events()` exercises the **coordinate contract** and the **tracking-join contract** (via `sourceMeta.frame`). It does **not** validate the event-taxonomy surface against stress: Metrica has 9 event types and ~30 subtypes. StatsBomb has 36 event types with rich qualifier substructures. A small vocabulary cannot test whether the canonical shape handles 36-type providers; it only confirms the happy path. The earlier draft's "validates that the canonical event shape holds up against a very different source vocabulary" overclaimed this — the variety is in structure (tracking-sync, coordinate system), not in taxonomy depth.

## Material gotchas

1. **Corpus size**: 3 matches. Thinner than SkillCorner (10), and anonymised, so no real team/player narrative for demos.
2. **Two formats**: legacy CSV and EPTS/JSON/XML are structurally different. First implementation targets EPTS only; legacy CSV needs explicit direction-override API.
3. **Coordinate inversion**: per-team, per-half rules above. Requires `attack_direction_first_half` from EPTS metadata; legacy CSV requires inference or consumer-supplied direction.
4. **Anonymised identifiers**: `Player 1`…`Player 14` on each team. Fine for format validation, bad for showcase fixtures.
5. **EPTS XML parsing**: the existing `packages/adapters/src/shared/xml.ts` parser (used by Sportec) handles DOM-level XML but EPTS namespaces differ. Likely a small extension rather than a rewrite.
6. **No xG, no body part, no pressure flag**: expected — Metrica leaves these to derived analysis on top of tracking. Adapter emits `xg: null` honestly.
7. **Silent-drop policy alignment**: `BALL LOST` and `FAULT RECEIVED` are absorbed into `sourceMeta` of adjacent paired events, not silently dropped, in line with how the StatsBomb audit treats analogous unmapped types.

## Relationship to the tracking-schema RFC

Per `tracking-schema-rfc.md` (adapters-first staging):

- **Stage 1** is `fromStatsBomb.freezeFrames` against a provisional internal type.
- **Stage 2** is `fromMetrica.frames` against a provisional internal type — continuous-tracking counterpart.
- **Stage 3** extracts the canonical `TrackingFrame` shape from both prototypes.

This doc's "primary anchor" claim is about **design reference**, not ship order. Metrica is Stage 2, after StatsBomb 360. Readers of only this doc should not assume `fromMetrica.frames()` lands first.

## Recommendation

- **Decision required**: do we land `fromMetrica` at all, or rely on kloppy-sourced fixtures? Resolve this after the tracking RFC's Stage 1 prototype evidence is in.
- **If we land it**: narrow EPTS-only adapter with `matchContext()`, `matchLineups()`, `events()`, `shots()`, `passes()`. Per-team per-half coordinate rotation using explicit EPTS metadata. `BALL LOST` / `FAULT RECEIVED` absorbed into `sourceMeta` of paired events, not dropped. Gap matrix entry added with xG = `unsupported`.
- **If we skip it**: the tracking RFC can still use Metrica's sample via kloppy-loaded fixtures for schema-validation tests. Document that decision explicitly rather than leaving this adapter in a permanent "draft / maybe" state.
- **Defer unconditionally**: `frames()`. Blocked on tracking RFC Stage 2.

## Open questions

1. Does option 2 (kloppy-sourced fixtures only) compose with Campos's adapter contract, or does kloppy's canonical model force too many per-chart reconciliations? Resolve by landing a small kloppy-to-Campos shim against one fixture and seeing what breaks.
2. If the adapter lands, what is the honest direction-inference policy for legacy CSV — kickoff-frame consensus, consumer-supplied override, or "EPTS-only, no legacy support"?
3. If `BALL LOST`/`FAULT RECEIVED` are absorbed into `sourceMeta`, what is the canonical key name? `sourceMeta.precedingTurnover` and `sourceMeta.faultReceivedBy` are proposed; needs agreement before implementation.
4. Should the tracking RFC's canonical coordinate contract be Campos 0..100 attacker-frame (matching events) or Metrica 0..1 team-agnostic (matching the source format)? Resolved by Stage 2 of the RFC, not here.
