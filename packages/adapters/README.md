# @withqwerty/campos-adapters

Provider-specific football data normalization for TypeScript.

`@withqwerty/campos-adapters` turns raw Opta, StatsBomb, WhoScored, Wyscout,
reference-backed provider payloads such as Stats Perform / Impect / Sportec, and
narrow scrape-backed rows into stable first-stage Campos products such as
`Event[]`, `ShotEvent[]`, `PassEvent[]`, `MatchLineups`, `FormationTeamData`, and
`MatchSummary`.

Use the outputs with Campos UI, or use them directly in your own TS workflows for
reports, custom React views, service-layer transforms, or downstream analysis. The
adapter layer is not renderer-bound.

Campos has learned from `kloppy`, with thanks, especially on provider
normalization seams and coordinate handling. Campos does not aim to replace
`kloppy` or become "`kloppy` for TypeScript". The adapter goal is narrower:
stable TypeScript-first first-stage packets that are directly useful in UI,
application, and report workflows. Parity matters only on the provider seams
Campos intentionally adopts.

## Product model

Campos uses a two-stage data model:

- first-stage products from adapters: canonical football packets
- second-stage products from core or app code: pass networks, xG timelines, KPI
  summaries, report-specific aggregates

Good adapter methods look like:

- `events()`
- `shots()`
- `passes()`
- `matchLineups()`
- `matchSummary()`

Bad adapter methods usually look like chart-shaped packets:

- `passNetworkData()`
- `xgTimelineData()`

## Current surface

### Opta

- `fromOpta.events(events, matchContext)`
- `fromOpta.shots(events, matchContext)`
- `fromOpta.passes(events, matchContext)`
- `fromOpta.parseSquads(rawSquadsFile)`
- `fromOpta.formations(lineupEvent, options)`
- `fromOpta.matchLineups({ home, away }, { squads, matchId? })`

Notes:

- Opta is the strongest current shot and xG path.
- `events()` and `shots()` require `MatchContext` because direction is not safely
  recoverable from raw F24 rows alone.
- `matchLineups()` is intentionally kickoff-lineup focused: starters, bench ordering,
  captain, formation, shirts, and squad-joined labels.

### StatsBomb

- `fromStatsBomb.events(events, matchInfo)`
- `fromStatsBomb.shots(events, matchInfo)`
- `fromStatsBomb.passes(events, matchInfo)`
- `fromStatsBomb.matchLineups(lineups, events, matchInfo)`
- `fromStatsBomb.formations(lineups, events, matchInfo, side)`

Notes:

- Cleanest current event envelope.
- Carries are first-class inside `events()`.
- `matchLineups()` now ships as the honest multi-payload lineup surface:
  the separate lineup feed provides the match-day squad, while `Starting XI`,
  `Substitution`, and `Tactical Shift` events provide formation and lineup changes.
- `formations()` now ships as a narrow projection from that richer team-sheet surface.
- Current StatsBomb lineup support is still narrower than WhoScored:
  no captain flag, no explicit player coordinates, and no promise of full tactical-state reconstruction.

### WhoScored

- `fromWhoScored.events(matchData, matchInfo)`
- `fromWhoScored.shots(matchData, matchInfo)`
- `fromWhoScored.passes(matchData, matchInfo)`
- `fromWhoScored.formations(teamData)`
- `fromWhoScored.matchLineups(matchData, matchInfo)`

Notes:

- Best current `matchLineups()` implementation.
- Self-contained match-centre blobs make the lineup/team-sheet surface richer here
  than on other providers.
- Current WhoScored path is weaker on xG than Opta or StatsBomb.

### Wyscout

- `fromWyscout.events(matchData, matchInfo?)`
- `fromWyscout.shots(matchData, matchInfo?)`
- `fromWyscout.passes(matchData, matchInfo?)`
- `fromWyscout.matchLineups(matchData, { players, teams, matchId? })`

Notes:

- Most inference-heavy current provider.
- Tag and subevent interpretation matter more than coordinate handling.
- `matchLineups()` now ships as a narrow public-dataset seam built from
  `match.teamsData.formation` plus optional `players.json` and `teams.json`
  lookup slices.
- Current Wyscout lineup support is intentionally narrower than the other providers:
  no formation label, no shirt numbers, no captain flag, and no explicit formation coordinates.

### Stats Perform

- `fromStatsPerform.events(ma3Document)`
- `fromStatsPerform.shots(ma3Document)`
- `fromStatsPerform.passes(ma3Document)`
- `fromStatsPerform.matchContext(ma3Document)`
- `fromStatsPerform.matchLineups(ma1Document)`
- `fromStatsPerform.formations(ma1Document, side)`

Notes:

- Reference-backed MA1 / MA3 adapter surface based on the local `kloppy` and
  `socceraction` sample seams.
- MA3 rows now ship real `events()`, `shots()`, and `passes()` through the
  Opta-family type/qualifier seam while keeping `provider: "statsperform"`.
- This is still sample-backed coverage, not a claim of full licensed-feed parity
  across every Stats Perform product family.

### Impect

- `fromImpect.events(openDataSlice)`
- `fromImpect.shots(openDataSlice)`
- `fromImpect.passes(openDataSlice)`
- `fromImpect.matchLineups(openDataSlice)`
- `fromImpect.formations(openDataSlice, side)`

Notes:

- Open-data adapter based on Impect's public Bundesliga release
  ([ImpectAPI/open-data](https://github.com/ImpectAPI/open-data)).
- Ships a real event subset for passes, shots, carries, recoveries,
  interceptions, clearances, goalkeeper actions, and fouls.
- Shot outcomes are inferred from Impect's public `targetPoint` seam where
  available, so this remains honest open-data coverage rather than full vendor parity.
- Coordinates come exclusively from `start.adjCoordinates` / `end.adjCoordinates`
  (attacker-relative). Raw `coordinates` are pitch-absolute and not rotated by
  the adapter — events without `adjCoordinates` return `null` rather than being
  silently mirrored for one team.
- Input shape: `openDataSlice.lineups` matches the open-data `lineups_*.json`
  shape directly (`{ id, squadHome: { id, players, startingPositions, substitutions, startingFormation }, squadAway: {...} }`).
  `squads` and `players` in the slice come from the sibling `squads.json` and
  `players.json` files in the open-data repo.

### Sportec

- `fromSportec.events(metaXmlOrMeta, eventXmlOrEvents)`
- `fromSportec.shots(metaXmlOrMeta, eventXmlOrEvents)`
- `fromSportec.passes(metaXmlOrMeta, eventXmlOrEvents)`
- `fromSportec.parseMeta(metaXml)`
- `fromSportec.parseEvents(eventXml)`
- `fromSportec.matchContext(metaXmlOrMeta, eventXmlOrEvents)`
- `fromSportec.matchLineups(metaXmlOrMeta)`
- `fromSportec.formations(metaXmlOrMeta, side)`

Notes:

- Open-data XML adapter backed by the public DFL / Sportec sample release.
- Ships a narrower real event subset: passes, shots, fouls, cards,
  substitutions, and ball-claiming recoveries from the public XML taxonomy.
- Tackling/other-ball-action taxonomy is still intentionally deferred rather
  than guessed into fake parity.

### Understat

- `fromUnderstat.matchSummary(scheduleRow)`
- `fromUnderstat.shots(shotRows)`

Notes:

- Narrow result/xG adapter based on `soccerdata`'s Understat outputs.
- Good fit for result cards, `ShotMap`, and `XGTimeline`.
- Not a full event-stream adapter.

### FBref

- `fromFbref.matchSummary(scheduleRow)`

Notes:

- Narrow match-header adapter based on `soccerdata`'s schedule output.
- Good fit for result cards and scoreline headers.
- Not an honest shot-map or stable-ID lineup adapter from the current `soccerdata` seam.

### Sofascore

- `fromSofascore.matchSummary(matchEvent)`

Notes:

- Narrow live/result adapter based on the event/status objects used by the local
  `soccerdata` and `ScraperFC` references.
- Good fit for live-score and result-page headers.
- This packet does not yet claim event, shot, or lineup parity.

## Example

```ts
import { fromOpta, fromWhoScored } from "@withqwerty/campos-adapters";

const optaShots = fromOpta.shots(rawEvents, matchContext);
const optaPasses = fromOpta.passes(rawEvents, matchContext);
const optaEvents = fromOpta.events(rawEvents, matchContext);

const whoScoredLineups = fromWhoScored.matchLineups(matchData, matchInfo);
```

From there you can:

- render Campos components directly
- filter or aggregate the canonical packets in your own app
- compute second-stage products in your own app, or use the current helper/chart surface exported from `@withqwerty/campos-react` where that API is explicitly supported

## Fixtures

Use raw event fragments under `test/fixtures/` when expanding coverage. Avoid computed
or post-processed source files.

Current provider fixtures include:

- Opta event fragments for normalization and lineup tests
- StatsBomb open-data fragments for regulation shots, penalties, and extra-time/shootout behavior
- WhoScored match-centre fragments for formation and lineup decoding
- Wyscout v2 fragments for tag-driven event normalization
- Narrow source-shaped summary/shot row fixtures derived from the local `soccerdata`
  and `ScraperFC` reference libraries

Keep provider payloads verbatim inside fixture files where possible. Only the small
wrapper metadata for provenance and match identification should be reduced.
