# SkillCorner Adapter Feasibility

**Status:** draft
**Scope:** honest feasibility read on a future `fromSkillCorner` adapter seam before committing to implementation work
**Purpose:** record what SkillCorner's open data contains, what it cannot support, and which surfaces could plausibly ship against the current Campos schema

## Source

Reference clone: `/Volumes/WQ/ref_code/skillcorner-opendata/` — 10 matches of 2024/2025 Australian A-League broadcast tracking, released jointly with PySport. License: see upstream repo. See `/Volumes/WQ/ref_code/INDEX.md` for the entry.

## What the data contains

### Per match

| File                               | Shape             | Contents                                                                                                                                                                                                                                 |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{id}_match.json`                  | JSON obj          | Scoreline, teams, stadium, referees, season, `players[]` squad list, `match_periods[]` (frame-range per half), pitch size                                                                                                                |
| `{id}_tracking_extrapolated.jsonl` | JSONL             | ~59,000 frames @ 10 Hz; per-frame ball position + 22 players; `possession.player_id/group`; visible-area polygon                                                                                                                         |
| `{id}_dynamic_events.csv`          | CSV (294 columns) | ~5,000 derived tactical events across four categories (see below). **No shots, goals, or passes as primary rows.** Every row carries an explicit `attacking_side` column (`left_to_right` / `right_to_left`) at team-period granularity. |
| `{id}_phases_of_play.csv`          | CSV               | In-possession and out-of-possession phase segments with phase type classification                                                                                                                                                        |

Pitch coordinates are **metres, origin at pitch centre**: long side = x ∈ [-L/2, +L/2], short side = y ∈ [-W/2, +W/2]. Pitch dimensions are carried in `match.json`.

### Dynamic event categories (observed counts on match `1886347`)

| Category             | Count | Subtypes / notable fields                                                                                                                                                       |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `passing_option`     | 2,544 | Predicted (not actual) passing targets with `xpass_completion`, `xthreat`, `dangerous`, `difficult_pass_target`, `pass_direction`, `passing_option_score`                       |
| `player_possession`  | 999   | Possession **segments** with `start_type`, `end_type`, `one_touch`, `quick_pass`, `carry`, `forward_momentum`, `is_header`, `initiate_give_and_go`                              |
| `on_ball_engagement` | 937   | Pressure **spans** with `duration`, `x_start/y_start`, `x_end/y_end`. Subtypes: `pressing` (244), `pressure` (236), `recovery_press` (206), `other` (164), `counter_press` (87) |
| `off_ball_run`       | 599   | Run typology: `run_ahead_of_the_ball`, `coming_short`, `dropping_off`, `support`, `cross_receiver` with speed, angle, outcome                                                   |

### Season aggregates

`data/aggregates/` contains season-level CSVs for Physical (PSV99, high-intensity counts, distance), Off-Ball Runs, and Passing. Filtered to performances above 60 minutes.

## How SkillCorner fits into the Campos adapter matrix

SkillCorner is neither a peer of the four-provider event matrix (Opta, StatsBomb, Wyscout, WhoScored) nor a pure-tracking dead end. Its open data is a hybrid: broadcast tracking + four families of derived tactical events. Some of those derived event families map reasonably onto canonical Campos kinds with acknowledged loss; others are structurally incompatible and need either new canonical kinds or deferral.

The feasibility question is not "is SkillCorner a peer adapter" but "for each of the four derived-event families, is the mapping to a canonical Campos kind honest enough to ship today?" The answer is different per family.

## Landable surfaces (zero canonical-schema change)

### `matchSummary()` — cheap

`match.json` carries the scoreline, team labels, stadium, referees, kickoff, and competition/season. Maps directly onto the existing `MatchSummary` shape used by every other adapter's `matchSummary()` method.

### `matchLineups()` — cheap

`match.json.players[]` contains per-match squad entries. Substitution events are not in the event stream but can be inferred from `match_periods` boundaries and per-player `time_played`. Maps onto `MatchLineups` with the usual home/away split.

### `passes()` + `carries()` from `player_possession` — worth evaluating, not rejected up front

An earlier draft dismissed this path on a "SkillCorner is tracking-first" premise. Data inspection rejects that dismissal: of the 999 `player_possession` rows per match, **707 start with `start_type: pass_reception`**, **902 end with `end_type: pass`**, and **487 have `carry: true`**. That is a similar-volume pass stream to Metrica's (800/match), with explicit start/end coordinates per segment.

Each `player_possession` row ending in `end_type: pass` already carries the pass primitives directly — no chain reconstruction across rows is required for the happy path:

- `player_targeted_x_pass`, `player_targeted_y_pass` — pass origin coordinates.
- `player_targeted_x_reception`, `player_targeted_y_reception` — where the receiver actually collected the ball. **Populated only for successful passes** (observed on match `1886347`: 731 of 902 rows). For unsuccessful passes the adapter must fall back to `player_targeted_x_pass` / `y_pass` (the intended target, not the actual end) and mark this in `sourceMeta.passDestinationKind: "intended"` rather than `"actual"`. For the 902 pass rows observed: 731 successful + reception known, 167 unsuccessful + reception absent, 3 successful + reception absent (rare data gap), 1 offside.
- `pass_outcome` — `successful` / `unsuccessful` / `offside`, maps directly onto the canonical `passResult` field.
- `player_targeted_id`, `pass_distance`, `pass_angle`, `pass_direction`, `is_header`, `hand_pass` — richer metadata for `sourceMeta`.
- Carries: `carry: true` on a segment plus the segment's start/end coords (`x_start/y_start`, `x_end/y_end`) → canonical `CarryEvent`.

**Recommendation**: treat `passes()` and `carries()` as in-scope surfaces. The mapping is mechanically clear without cross-row joins. Ship as `partial` in the gap matrix to reflect the `passDestinationKind: "intended"` fallback for unsuccessful passes, matching how Wyscout passes are currently marked. A new row is required in `docs/standards/adapter-gap-matrix.md` — either in the narrow scrape-backed or reference-backed section. SkillCorner doesn't fit either tier cleanly today (peers in narrow scrape-backed are summary-only; reference-backed tier is event-data providers, not tracking-derived possession rows). The right fix is probably a new "tracking-derived partial" tier label — decide at gap-matrix update time.

## Surfaces that need a schema-level decision before they ship

### `pressures()` — a span-vs-point semantic mismatch

The existing canonical `PressureEvent` (landed this wave via `fromStatsBomb.mapPressure`) is a **point event**: single `x, y`, optional `counterpress: boolean` flag. SkillCorner's `on_ball_engagement` rows are **spans**: distinct `x_start, y_start` and `x_end, y_end`, with `duration` field. Observed data from match `1886347`:

| SkillCorner subtype | n   | Mean duration | Max duration | Mean displacement | Max displacement |
| ------------------- | --- | ------------- | ------------ | ----------------- | ---------------- |
| `pressing`          | 244 | 1.86s         | 5.1s         | 5.8m              | 24.7m            |
| `pressure`          | 236 | 2.01s         | 8.0s         | 5.7m              | 32.5m            |
| `recovery_press`    | 206 | 2.34s         | 10.0s        | 7.5m              | 39.7m            |
| `other`             | 164 | 1.44s         | 9.8s         | 3.8m              | 21.1m            |
| `counter_press`     | 87  | 2.08s         | 6.0s         | 6.4m              | 22.4m            |

Collapsing a 10-second, 30-metre span into a single `{x, y}` forces the adapter to pick start, end, or midpoint. Whichever it picks, downstream heatmaps will render SkillCorner pressure at a **different semantic granularity** than StatsBomb pressure while looking identical — the silent provider conflation the Campos adapter contract exists to prevent.

**This is not a "value-add over StatsBomb" surface.** It is a different measurement. A previous draft overclaimed it; that framing was wrong.

Three honest options:

1. **Defer pressures until the canonical `PressureEvent` is widened to span shape** — add `endX`, `endY`, `durationSec` as optional fields. This is a schema RFC on its own; worth filing once a press-map chart actually needs span fidelity.
2. **Ship `pressureSpans()` as a SkillCorner-only product**, typed as a provider-specific shape exported from `@withqwerty/campos-adapters` but **not** from `@withqwerty/campos-schema`. Downstream charts that want SkillCorner span data opt in explicitly.
3. **Emit canonical `PressureEvent` using start-coord and document the projection as lossy** in `sourceMeta.projection: "start"`. This is the cheapest option but the most conflation-prone.

Recommendation: option 1 or 2. Option 3 is ruled out specifically because it violates the tracking-schema RFC's invariant against cross-provider meaning in `sourceMeta` — a field like `sourceMeta.projection: "start"` would become load-bearing for any chart that pairs SkillCorner + StatsBomb pressure, laundering a canonical meaning through the provider-scoped bag. The bag can carry provider-specific richness; it should not carry cross-provider semantics consumers rely on for correctness.

Additional honesty note: the earlier draft mapped `counter_press → counterpress: true` and all other subtypes → `counterpress: false` to match StatsBomb's flag. StatsBomb's `counterpress` is defined as pressure within ~5s of losing possession; SkillCorner's `counter_press` is a separate taxonomic tier from `recovery_press`, `pressing`, `pressure`. Without verifying the two providers' temporal definitions are equivalent, claiming `counter_press → counterpress: true` fabricates cross-provider equivalence. Claiming `counterpress: false` on SkillCorner's `counter_press` subtype is worse — it actively negates something the source data labelled. Until verified, ship `counterpress: null` (unknown) on **all** SkillCorner pressure rows and thread the full subtype into `sourceMeta.engagementSubtype`. Downstream filters `events.filter(e => e.counterpress)` then honestly exclude SkillCorner data rather than silently returning an unvetted subset. The 164-row `other` subtype also needs an explicit decision — drop, emit with `engagementSubtype: "other"`, or open question.

### `recoveries()` — one honest source, one misleading one

Two paths were identified; inspection shows they are not equivalent:

- `player_possession` rows with `start_type == "recovery"` — 61/match. These are genuine recoveries: the tracked player started a possession segment by recovering the ball.
- `on_ball_engagement` with `subtype: recovery_press` — **directionally wrong**. In match `1886347`, 154/206 `recovery_press` rows (75%) end with the pressed team's successful `pass`, and only 28/206 end in `possession_loss`. `recovery_press` in SkillCorner's taxonomy is **pressure applied while the opposing team is recovering** — it is not "our team recovered the ball." Mapping this to `RecoveryEvent` produces a recovery event against the pressing team in cases where the pressed team retained possession.

Recommendation: `recoveries()` narrows to `player_possession.start_type == "recovery"` only. Drop `recovery_press` from this path entirely. At 61 rows/match this is a small surface but mechanically clean.

## Surfaces that need their own schema RFCs (not blocked on tracking RFC)

These four families share the property that no canonical `EVENT_KINDS` slot exists today, and the tracking-schema RFC explicitly scopes itself out of them:

### `offBallRuns()`

`off_ball_run` is a distinctive SkillCorner surface — 599 rows/match, typed runs with speed, angle, outcome, and target-player context. Needs a canonical `off-ball-run` kind. **Worth filing as its own schema RFC** because it unlocks genuinely new viz territory (run-and-pass maps, pressing triggers, defensive-line-break analysis). Out of scope for the tracking-schema RFC, which covers positional frames only.

Inherits a provider-binding question: many off-ball-run fields (speed, separation-to-last-defensive-line, line-break classification) are tracking-derived signals that other providers cannot reproduce without their own tracking stream. The RFC must decide whether `OffBallRunEvent` carries only cross-provider-portable fields (origin, destination, outcome, subtype) with the rest in `sourceMeta`, or whether it becomes a SkillCorner-specific export from the start. "Separate from the tracking RFC" does not mean "trivial."

### `passingOptions()`

2,544 rows/match of predicted-pass data with `xpass_completion`, `xthreat`, `dangerous`, `difficult_pass_target`, and 100+ tactical context columns. No canonical kind for "predicted but not attempted" events. Exposing through `passes()` would mislead consumers about attempted-pass semantics. Needs its own `PredictedPassEvent` (or similar) schema RFC — again, separate from the tracking RFC.

Inherits the same provider-binding question as off-ball runs: most of the 100+ tactical-context columns are derived from SkillCorner's tracking stream (teammate/opponent separations, defensive-line proximity, n-passing-options) and have no cross-provider equivalent. The canonical shape either stays narrow (origin, target-player, outcome, xT) with richness in `sourceMeta`, or is ruled provider-specific from the start.

### `phases()` / phases of play

Segment-based (start frame → end frame with phase type classification). No canonical time-segment kind in Campos. Would need a `MatchPhase` or similar shape.

### `frames()` / tracking stream

No `TrackingFrame` canonical schema today. This **is** the tracking-schema RFC. See `tracking-schema-rfc.md` — note that the RFC is staged adapters-first, with StatsBomb 360 as Stage 1, Metrica EPTS as Stage 2, and SkillCorner tracking deferred to Stage 4+ conditional on the corpus widening beyond 10 matches.

## Material gotchas

1. **Corpus size**: only 10 matches. Compare with StatsBomb (3,464), WSL subset (326), Impect Bundesliga 23/24. Thin demo fuel.
2. **League coverage**: Australian A-League specific. No European league overlap for cross-provider comparison demos.
3. **Coordinate conversion for events**: trivially solved. `attacking_side` is an explicit CSV column (`left_to_right` / `right_to_left`) populated per row at team-per-period granularity. The adapter reads this directly.
4. **Coordinate conversion for tracking**: non-trivial. The `_tracking_extrapolated.jsonl` frames have no per-frame attacking-side column. Per-frame rotation requires joining tracking frames to `match_periods` + per-team attacking side from the events CSV or `match.json`. Deferred to Stage 4 of the tracking RFC.
5. **Extrapolated positions**: `is_detected: false` rows are model-extrapolated player positions, not observed. Products must decide whether to filter or trust. This is a per-consumer question that should surface in `sourceMeta`, not be silently applied.
6. **Possession nulls**: early-frame rows have `possession.player_id: null` and `timestamp: null`. Adapters must tolerate sparse-pre-kickoff frames.
7. **CSV wide-table ergonomics**: `dynamic_events.csv` has 294 columns per row. Most columns are context the canonical events don't need. Adapter should pick narrowly, not mirror the full schema.

## Recommendation

- **Land (v0.3, zero canonical-schema change)**:
  - `matchSummary()` and `matchLineups()` from `match.json` — trivially cheap.
  - `passes()` and `carries()` from `player_possession` — pending one-match validation of the reception→pass chain reconstruction. Ship as `partial`.
  - `recoveries()` narrowed to `player_possession.start_type == "recovery"` only.
- **Defer pending its own schema RFC** (not the tracking RFC):
  - `pressureSpans()` — until canonical `PressureEvent` widens to span shape, or we choose a provider-specific export.
  - `offBallRuns()` — canonical `off-ball-run` kind RFC.
  - `passingOptions()` — canonical `predicted-pass` kind RFC.
  - `phases()` — canonical time-segment shape RFC.
- **Defer pending the tracking RFC**:
  - `frames()` — Stage 4+ per `tracking-schema-rfc.md`, conditional on corpus widening.

## Open questions

1. Is the `player_possession` reception→pass chain reconstruction sound, or does pass destination drift from the true recipient often enough that `passResult` coding is unreliable? Requires a one-match sanity check against a known match with rich provider-side ground truth.
2. For `on_ball_engagement` subtype `other` (164 rows/match), what does the adapter do — drop, or emit with `engagementSubtype: "other"`?
3. Do the season-level aggregates in `data/aggregates/` belong in a separate "scouting-aggregate" product entirely, rather than match-level adapter output?
