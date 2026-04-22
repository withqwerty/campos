These fixtures are intended to be real provider fragments, not invented payloads.

- `opta/raw-shots-man-utd-vs-spurs.json`: focused Opta shot sample used by the existing shot adapter tests.
- `opta/raw-goal-everton-vs-watford.json`: single-goal Opta fragment for focused outcome coverage.
- `opta/raw-match-events-sample.json`: compact mixed Opta event sample for current shot/pass event-stream tests.
- `opta/whoscored-match-centre-data.json`: compact WhoScored-compatible wrapper fixture for current parser coverage.
- `opta/whoscored-sporting-v-arsenal.json`: full direct WhoScored match-centre export from local sample data, useful for richer Opta-derived parser and mixed-event coverage.
- `statsbomb/raw-shots-bayer-leverkusen-vs-werder-bremen.json`: real StatsBomb open-data shot fixture from match `3895302`.
- `statsbomb/raw-match-events-sample.json`: compact real mixed-event StatsBomb fixture from the same match, curated to cover pass and shot mappings plus future raw kinds like carry, duel, interception, foul, goalkeeper, clearance, and substitution.
- `statsbomb/raw-match-lineups-barcelona-vs-alaves.json`: compact real StatsBomb open-data lineup fixture from match `15946`, keeping selected match-day squad entries plus `Starting XI`, `Tactical Shift`, and `Substitution` events for `matchLineups()` coverage.
- `statsbomb/raw-direct-free-kicks-barcelona-vs-alaves.json`: focused direct free-kick shot coverage from match `15946`, including a scored free kick.
- `statsbomb/raw-extra-time-argentina-vs-france.json`: focused extra-time shot coverage.
- `statsbomb/raw-penalty-ecuador-vs-senegal.json`: focused penalty shot coverage.
- `statsperform/raw-match-lineups-hamburg-vs-sandhausen-ma1.json`: real Stats Perform MA1 fixture from local `kloppy` tests, keeping `matchInfo`, both `lineUp` entries, substitutions, and cards for `matchLineups()` helper coverage.
- `statsperform/raw-match-events-hamburg-vs-sandhausen-ma3.json`: real Stats Perform MA3 fixture from local `kloppy` tests, curated to include direction events, lineup seed events, and early live events for match-context and qualifier helper coverage.
- `statsperform/raw-match-events-full-hamburg-vs-sandhausen-ma3.json`: full real Stats Perform MA3 match fixture from local `kloppy` tests, used for event / shot / pass public-surface coverage.
- `impect/raw-match-122838.json`: real Impect open-data fixture for match `122838`, keeping lineups, squad/player lookups, and selected event fragments with provenance back to the cloned `ImpectAPI/open-data` repo.
- `impect/raw-match-122838-rich.json`: richer Impect open-data fixture for the same match, keeping the existing lineup/squad/player bundle and widening the selected event slice to cover pass, shot, carry, recovery, interception, clearance, goalkeeper, foul, and set-piece seams.
- `impect/raw-match-122839-tactical-shifts.json`: real Impect open-data slice for match `122839` (RB Leipzig vs Bayer Leverkusen), sourced from `ImpectAPI/open-data`. Keeps the full lineup (both squads carry in-match tactical shifts where neither `fromPosition` nor `toPosition` is `BANK`) plus trimmed `squads` and `players` lookup slices, for substitution ordering and tactical-shift coverage.
- `sportec/raw-matchinformation-koeln-vs-bayern.xml`: real Sportec DFL open-data metadata XML for `1. FC Köln vs FC Bayern München`, used for lineup and match-context helper coverage.
- `sportec/raw-events-koeln-vs-bayern.xml`: matching Sportec event XML for the same match, used to test kickoff direction parsing plus the narrower public event / shot / pass subset.
- `wyscout/raw-match-arsenal-v-southampton.json`: match-scoped Wyscout open-data extract from the England league dump, kept for future adapter and cross-provider parity work.
- `wyscout/raw-lookups-arsenal-v-southampton.json`: compact Wyscout `players.json` and `teams.json` lookup slice for the same match, used to enrich `matchLineups()` with player and team labels plus coarse role codes.

When adding new adapter behavior, prefer extending one of these real fixtures or introducing another sourced fragment with provenance in its top-level `source` block.
