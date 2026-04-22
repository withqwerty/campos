# Match Lineups Contract

**Status:** active implementation-aligned draft
**Purpose:** define a richer first-stage adapter product for lineup- and team-sheet-driven UI work, distinct from the narrower `formations()` snapshot surface

## Why this exists

Campos currently has a useful `formations()` adapter surface for rendering `<Formation>`, but that is not the same thing as a reusable lineup/team-sheet packet.

`matchLineups()` is the proposed richer first-stage product for UIs such as:

- formation cards
- lineup cards with richer adornments
- bench / substitutes lists
- captain strips
- rating strips
- match-day team sheets

The key rule is:

- `formations()` remains a narrow formation snapshot for layout-first UI
- `matchLineups()` becomes the richer football data packet that multiple UI families can consume

## Ownership boundary

`matchLineups()` belongs in adapters because it requires provider-specific parsing, joins, and normalization.

It should **not** own:

- card layout
- marker styling
- bench layout
- section composition
- match-report page chrome

It should return football data, not renderer packets.

## Public API

```ts
const lineups = fromWhoScored.matchLineups(matchCentreData, matchInfo);
const lineups = fromOpta.matchLineups(lineupInputs, options);
```

Exact provider inputs may differ, but the output contract should be shared.

## Pressure-tested against current adapter inputs

This draft has been checked against the provider paths Campos already uses today:

- `fromWhoScored.formations(team)` currently reads `matchCentreData.home` / `.away`
- `fromOpta.formations(lineupEvent, { squads })` currently reads a typeId 34 lineup event plus a parsed `squads.json` index

That means the contract is grounded in real source paths, not just wishful shape design.

What the current code paths support **now**:

- **WhoScored:** team identity, starters, bench, captain, formation label, slot/position, explicit formation coordinates, and a credible path to some substitution metadata from formation intervals
- **Opta:** team identity, starters, bench, captain, formation label, slot/position, shirt numbers, and player labels via squad join

What the current code paths do **not** support cleanly yet:

- **Opta minute-on / minute-off state** without joining wider substitution events
- **Opta explicit player coordinates** from the current lineup-event path
- **Ratings** as a guaranteed cross-provider field

## Proposed canonical types

```ts
type MatchLineups = {
  matchId?: string;
  home?: TeamSheet | null;
  away?: TeamSheet | null;
};

type TeamSheet = {
  teamId: string;
  teamLabel?: string | null;
  formation?: string | null;
  captainPlayerId?: string | null;
  starters: TeamSheetPlayer[];
  bench: TeamSheetPlayer[];
  unavailable?: TeamSheetPlayer[];
  sourceMeta?: Record<string, unknown> | null;
};

type TeamSheetPlayer = {
  playerId: string;
  label?: string | null;
  number?: number | null;
  positionCode?: string | null;
  slot?: number | null;
  captain?: boolean;
  starter?: boolean;
  substitutedIn?: boolean;
  substitutedOut?: boolean;
  minuteOn?: number | null;
  minuteOff?: number | null;
  rating?: number | null;
  x?: number | null;
  y?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};
```

## Field intent

### MatchLineups

- `matchId`: stable match identifier when known
- `home` / `away`: optional because some sources or workflows may decode one side at a time

### TeamSheet

- `teamId`: required stable team identifier
- `teamLabel`: optional display-ready team name
- `formation`: kickoff or current formation label when known
- `captainPlayerId`: explicit team-level captain reference for convenience
- `starters`: required starter list
- `bench`: required bench list, empty array when none available
- `unavailable`: optional future seam for squads broader than the bench
- `sourceMeta`: provider-specific context for debugging and advanced consumers; follow `docs/standards/source-meta-standard.md`

### TeamSheetPlayer

- `playerId`: required stable player identifier
- `label`: display-ready player name
- `number`: shirt number
- `positionCode`: canonical or provider-normalized position code
- `slot`: formation slot when a formation snapshot exists
- `captain`: per-player captain flag
- `starter`: explicit starter flag for convenience
- `substitutedIn` / `substitutedOut`: substitution status when derivable
- `minuteOn` / `minuteOff`: entry / exit minute when derivable
- `rating`: optional player rating when the source genuinely supplies one
- `x` / `y`: explicit player-position override when the source gives actual formation coordinates
- `sourceMeta`: provider-specific enrichment; keep meanings honest and non-canonical per `docs/standards/source-meta-standard.md`

## `sourceMeta` rule

For lineup/team-sheet packets, `sourceMeta` must stay:

- provider-specific
- small and JSON-serializable
- semantically honest to the raw source
- free of duplicated canonical fields

Examples:

- good: `yellowCardMinute: 92`
- bad: `yellowCards: 92`
- bad: copying `teamId`, `formation`, or `minuteOn` into `sourceMeta`

## Required vs optional

### Required in the canonical contract

- `TeamSheet.teamId`
- `TeamSheet.starters`
- `TeamSheet.bench`
- `TeamSheetPlayer.playerId`

### Strongly preferred when provider supports them

- `teamLabel`
- `formation`
- `number`
- `label`
- `captain`
- `positionCode`
- `slot`

### Optional enrichment

- `rating`
- `minuteOn`
- `minuteOff`
- `substitutedIn`
- `substitutedOut`
- `x`
- `y`
- `unavailable`
- `sourceMeta`

## Relationship to `FormationTeamData`

`FormationTeamData` remains useful and should not be replaced.

Instead, the relationship should be:

1. `matchLineups()` returns a richer `TeamSheet`
2. `formations()` either:
   - remains a direct provider adapter convenience surface, or
   - later becomes a narrowing projection from `TeamSheet`

Conceptually:

```ts
type FormationTeamData = {
  formation: string;
  teamLabel?: string;
  players: FormationPlayer[];
};
```

is a narrower layout-oriented subset of:

```ts
type TeamSheet = {
  formation?: string | null;
  teamLabel?: string | null;
  starters: TeamSheetPlayer[];
  // ... bench and other richer team-sheet fields
};
```

## Non-goals

`matchLineups()` should not:

- encode formation card layout decisions
- choose marker labels or typography
- compute pass networks or average positions
- attach colors or theme values
- attempt full tactical-state reconstruction from every substitution unless we explicitly scope that work

## Provider expectations

### WhoScored

Best first implementation target.

Expected strengths:

- self-contained team object
- starters and bench
- captain
- formation intervals
- explicit formation positions
- some substitution metadata

Expected cautions:

- ratings may exist in fuller payloads but are not guaranteed in every extract
- interval-level data does not automatically imply perfect minute-on/minute-off semantics without careful rules
- the current public parser type intentionally trims many fields, so richer player stats should not be assumed until we widen that raw type on purpose

### Opta

Useful second implementation target.

Expected strengths:

- starters and bench from lineup event qualifiers
- captain via q194
- formation via q130
- shirt numbers via q59
- player labels via squad join

Expected cautions:

- richer substitution state likely requires joining lineup data with separate event streams
- explicit player-position coordinates are not part of the current lineup-event path
- bench ordering is available from the full q30/q59 lists, but the current public `formations()` helper only exposes the starting XI
- do not imply WhoScored-level richness if the source does not support it

### StatsBomb / Wyscout

StatsBomb and Wyscout now both ship honest but narrower lineup seams, with the
important caveat that they are source-shaped in different ways.

StatsBomb ships the separate lineup payload plus the event stream.

Recommended first seam:

```ts
const lineups = fromStatsBomb.matchLineups(rawLineups, rawEvents, matchInfo);
```

Why the seam should require both payloads:

- the separate `lineup` payload carries the match-day squad, shirt numbers, cards,
  and player position intervals with `from`, `to`, `start_reason`, and `end_reason`
- the `events` payload carries `Starting XI` (`type.id 35`) with `tactics.formation`
  and lineup-by-position data
- the `events` payload also carries `Substitution` (`type.id 19`) and
  `Tactical Shift` (`type.id 36`) events, which are the honest source for lineup
  changes and formation changes

This is now backed by:

- the public `statsbomb/open-data` split between `events` and `lineups`
- the `kloppy` StatsBomb loader contract
- a committed real-data Campos fixture derived from open-data match `15946`

Recommended v1 target from that seam:

- starters and bench
- shirt numbers
- stable player IDs and labels
- formation label / key
- slot / position from `Starting XI`
- honest substitution metadata when the event join supports it
- optional availability state where the lineup payload or event join supports it

Recommended v1 non-goals:

- no events-only convenience overload
- no invented explicit player coordinates
- no ratings
- no promise of minute-by-minute tactical-state reconstruction

That required the following widening in Campos:

- add a StatsBomb lineup raw type for the separate `lineup` payload
- widen `StatsBombEvent` to support `tactics`
- explicitly model the `Starting XI` and `Tactical Shift` event path instead of
  treating them as out-of-scope unknown events

Wyscout now ships against the public research dataset seam:

```ts
const lineups = fromWyscout.matchLineups(matchData, { players, teams, matchId });
```

Why the seam needs the lookup bag:

- `match.teamsData.formation` provides starters, bench, and substitutions
- `players.json` provides stable player labels and coarse role codes
- `teams.json` provides team labels
- the current public dataset does not provide formation labels, shirt numbers,
  captain flags, or explicit formation coordinates in this path

Recommended v1 target from that seam:

- starters and bench
- stable team IDs and labels
- stable player IDs and labels
- coarse role-based position codes when lookup data is present
- substitution metadata from `formation.substitutions`
- optional source metadata for goals / cards already carried on lineup entries

Recommended v1 non-goals:

- no claim of official Wyscout API parity
- no invented formation label
- no shirt numbers
- no captain flag
- no explicit player coordinates

## Promotion note

The current lineup implementations suggest one plausible future promotion from
`sourceMeta` into the canonical `TeamSheetPlayer` surface:

- match-day adornments such as goals and dismissal/card timing

That should stay out of the canonical schema for now.

Why:

- support is still asymmetric across providers
- the semantics differ between “count”, “state”, and “minute”
- promoting too early would create fake parity

So the current rule is:

- keep lineup adornments in `sourceMeta` while support is uneven
- only promote them once multiple providers can fill the fields honestly

## Implementation status and next order

1. `fromWhoScored.matchLineups()` is now implemented as the first real adapter method for this contract.
2. `fromOpta.matchLineups()` is now implemented as a narrower kickoff team-sheet surface.
3. `fromStatsBomb.matchLineups()` is now implemented as a separate `lineups + events + matchInfo` surface.
4. `fromWyscout.matchLineups()` is now implemented as a public-dataset-driven `matchData + { players, teams }` surface.
5. decide whether `fromOpta.formations()` and `fromWhoScored.formations()` should later narrow from `matchLineups()`

## Schema status

Draft schema additions now exist for:

- `TeamSheetPlayer`
- `TeamSheet`
- `MatchLineups`

They are intentionally a **draft canonical surface**, not a claim that all providers
implement the contract equally.

Implementation should still follow the phased plan above:

1. keep `fromWhoScored.matchLineups()` honest and tested as the reference implementation
2. keep `fromOpta.matchLineups()` honest about its narrower source path
3. keep `fromStatsBomb.matchLineups(lineups, events, matchInfo)` honest about its multi-payload seam and narrower field coverage than WhoScored
4. keep `fromWyscout.matchLineups(matchData, { players, teams })` explicitly framed as a public-dataset seam rather than official API parity
