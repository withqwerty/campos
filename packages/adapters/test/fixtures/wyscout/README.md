These fixtures are real Wyscout open-data extracts, not invented payloads.

Current fixture:

- `raw-match-arsenal-v-southampton.json`: match-scoped extract from the England league dump, containing the original `match` record plus all `events` for match `2500040`.
- `raw-lookups-arsenal-v-southampton.json`: compact lookup slice from the public
  `players.json` and `teams.json` files for the same match, used to enrich
  `matchLineups()` with player labels, team labels, and coarse role codes.

## Intended `fromWyscout` fixture contract

When a Wyscout adapter is introduced, keep fixture files match-scoped and preserve the raw provider objects verbatim inside a small provenance wrapper:

```jsonc
{
  "source": {
    "provider": "wyscout-open-data",
    "competition": "England",
    "originalEventsFile": "events_England.json",
    "originalMatchesFile": "matches_England.json",
    "originalMatchId": 2500040,
  },
  "match": {
    /* raw Wyscout match object */
  },
  "events": [
    {
      /* raw Wyscout event object */
    },
  ],
}
```

## Adapter expectations

- `match.wyId` is the canonical fixture match identifier.
- `events` must all share the same `matchId`.
- `teamsData` should remain untouched so home/away resolution and score context can be derived later.
- `positions`, `tags`, `eventName`, `subEventName`, and `matchPeriod` should remain verbatim; these are the fields a future adapter will normalize.

## Extraction rule

Do not commit league-wide Wyscout dumps. Always slice a single match and keep the full raw event objects for that match only.
