# Showcase A — Match Deep-Dive Page Plan

**Status:** draft — pending user review
**Roadmap row:** `docs/roadmap-v0.3.md` Lane 1 order 5 (final v0.3 Lane 1 packet)
**Target path:** `apps/site/src/pages/showcase/match.astro`
**Kind:** Integration page — not a new component. Composes existing charts into a single real-data story.

---

## Why this exists

Lane 1 shipped seven primitives: PassNetwork, Formation, Territory, StatBadge, plus existing ShotMap, Heatmap, XGTimeline, PassMap, KDE. Each has its own demo page for isolated inspection. **Showcase A is the proof that they compose** — that a real match report built from Campos components looks like a real product, not a collection of widgets.

It's also the forcing function that surfaces rough edges the isolated demo pages hide: typography mismatches between components, theme inconsistency, data-flow ergonomics (how painful is it for a consumer to wire Formation + ShotMap + StatBadge together with one match's worth of Opta data), and visual coherence across mixed chart types on one page.

If Showcase A looks like a real match article, v0.3 is done. If it doesn't, whatever's off is a follow-up for v0.4.

---

## What Showcase A is not

Explicit non-goals, so scope doesn't drift:

- **Not a new component.** Every visual element is an existing chart or primitive. No new React components get added to `packages/react/src/` for this page — except maybe tiny site-only layout helpers in `apps/site/src/components/`.
- **Not a generalized match template.** It's one real match, hand-wired. Consumers who want to build their own match pages can read the source, but we're not extracting a `<MatchReport>` composition primitive — that's deferred to v0.4+ once we've seen the real shape.
- **Not tabbed.** No tab navigation, no Opta/WhoScored-style "Summary / Lineups / Stats / Passing" switcher. Pure vertical scroll, magazine-style.
- **Not a narrative write-up.** No match report copy ("Liverpool dominated the first half..."). The charts carry the story. Optional one-line captions per section, but no editorial prose.
- **Not interactive beyond existing component behavior.** No cross-filter (clicking a Formation player to filter the heatmap to their touches), no timeline scrubber, no match-minute slider. Every interactive affordance is the one the underlying component already ships.
- **Not real-time.** One static match from the archive. No live data fetching.
- **Not mobile-perfect.** Responsive CSS grid defaults, nothing hand-tuned for small viewports. Desktop is the target.
- **No player photos, no club crests, no broadcast assets.** Pure graphics. If the new `PlayerBadges.tsx` primitives mature into showcase-ready status by the time we build, we can revisit.

---

## The match

**Liverpool 4–2 AFC Bournemouth**
Premier League matchday 1, 2025-08-15
Opta match ID: `zhs8gg1hvcuqvhkk2itb54pg`
Source: `/Volumes/WQ/projects/www/src/data/opta/match-events/zhs8gg1hvcuqvhkk2itb54pg.json`

**Why this match:**

- **The Formation fixture already decodes to it.** `apps/site/src/data/formation-opta-liverpool.ts` and `opta-squads.ts` are already wired up with real Liverpool + Bournemouth lineups. Showcase A reuses them — no second fixture extraction for lineups.
- **Full event stream available locally.** The source JSON has shots, passes, goals, cards, corners, substitutions — everything the page needs.
- **It's a real match with real patterns** — Liverpool 4-2-3-1 against Bournemouth's 4-1-4-1, 4 goals to 2, some xG drama, different team shapes. Enough texture for every chart type to have something to show.
- **Not a famous "classic."** Deliberate — this isn't Man City vs Arsenal with a penalty shootout. It's a normal matchday 1 opener, which is the honest "what does Campos look like on an average real match" test.

**Open question 1:** Is Liverpool–Bournemouth the right match, or do you want a more famous fixture (e.g., an Arsenal match, a title-race game, a derby)? Cost of switching: ~2-4 hours re-extracting and re-decoding a different match's events + lineup. Recommendation: ship with Liverpool–Bournemouth, swap later if needed.

---

## Page structure

**Layout strategy:** broadcast-style vertical scroll, magazine composition. The reader scans top-to-bottom like a long-form article.

### Sections (top → bottom)

1. **Match header / hero**
   - Teams, score, date, competition, venue, kickoff time
   - Large typography, team colors, no chart
   - Built as a simple Astro component (`ShowcaseMatchHeader.astro`), no React island needed

2. **StatBadgeRow**
   - Horizontal strip of match KPIs: possession, shots, shots on target, xG, corners, fouls
   - Home left, label center, away right, with proportional bars
   - Just above-the-fold after the hero
   - Single `<StatBadgeRow>` React island, `client:load`

3. **Dual-team Formation**
   - Broadcast-style lineup card: Liverpool at the bottom half (attacking up), Bournemouth at the top half (mirrored)
   - Real names, real jersey numbers, captain mark on van Dijk
   - Section caption: "Starting XIs"
   - Single `<Formation home={...} away={...}>` React island

4. **xG timeline**
   - Cumulative xG over 90 minutes, both teams on one chart
   - Goals marked as discrete dots or labels
   - Section caption: "How the xG accumulated"
   - Single `<XGTimeline>` React island

5. **Shot map**
   - One or two ShotMap instances showing both teams' shots on the same pitch (or side-by-side)
   - Shots colored by team, sized by xG
   - Section caption: "Where the shots came from"
   - One or two `<ShotMap>` React islands — **decision needed** (see open question 2)

6. **Territory**
   - Side-by-side Territory diagrams for each team (single-team instances rather than the dual-team Formation-style mirror)
   - 3×3 grid, broadcast convention
   - Section caption: "Zone control"
   - Two `<Territory>` React islands

7. **PassNetwork**
   - One or two PassNetwork instances — **decision needed** (see open question 3)
   - Nodes at average position, edges weighted by pass volume
   - Section caption: "Passing networks"

8. **Credits / data source footer**
   - Small text: "Data: Opta. Match: Liverpool 4–2 AFC Bournemouth, 2025-08-15. Rendered with Campos."

### What's deliberately out of section order

- **No Heatmap or KDE section.** Territory already answers "where did the team play?" for the broadcast audience. Heatmap and KDE would be redundant on the same page. If you want them, we add a "Density" section between Territory and PassNetwork, using one Heatmap per team. Flagged as open question 4.
- **No PassMap section.** PassNetwork covers the same territory (passing patterns) at a higher level of abstraction, and it's more visually distinctive. PassMap's individual-arrow detail is lost at the scale of a showcase section. Could add as a standalone section if the section count feels thin — flag open question 5.

---

## Data pipeline

### Source

One file: `/Volumes/WQ/projects/www/src/data/opta/match-events/zhs8gg1hvcuqvhkk2itb54pg.json`

This is the full Opta F24 event stream for the match, plus the typeId 34 lineup events we already decoded for Formation.

### Extraction plan

Build fixture modules under `apps/site/src/data/showcase-match/`:

| Module                              | Purpose                                                         | Source                                            | Method                                                   |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `meta.ts`                           | Match metadata (teams, score, date, venue, kickoff)             | Opta JSON root                                    | Hand-extracted, pre-computed                             |
| `lineups.ts`                        | Pre-decoded Liverpool + Bournemouth `FormationTeamData`         | Reuses `formation-opta-liverpool.ts` from Task 14 | Re-export, no new decoding                               |
| `shots.ts`                          | Shot events for ShotMap                                         | Opta JSON event array                             | `fromOpta.shots()` at build time, filtered to this match |
| `passes.ts`                         | Pass events for PassMap (if used) / PassNetwork                 | Opta JSON event array                             | `fromOpta.events()` filtered to typeId 1 (pass)          |
| `events.ts`                         | All normalized events for Heatmap / Territory                   | Opta JSON event array                             | `fromOpta.events()` with no type filter                  |
| `pass-network-home.ts` / `-away.ts` | Pre-aggregated `{nodes, edges}` per team for PassNetwork        | passes.ts + `aggregatePassNetwork` from core      | Build-time aggregation                                   |
| `stats.ts`                          | Pre-computed match KPIs (possession, shots, xG, corners, fouls) | Opta JSON event array                             | **New helper** — see open question 6                     |

All fixtures are static — no runtime computation. Astro pre-renders everything.

### Stats computation (new work)

`stats.ts` is the one non-trivial data item. It needs to compute:

- **Possession %** — ratio of pass events per team, or possession sequences if we can get them out of Opta
- **Shots** — count of shot events per team
- **Shots on target** — count of shot events with outcome = on target per team
- **xG** — sum of xG per team
- **Corners** — count of corner events per team
- **Fouls** — count of foul events per team

Options:

- **A: Hand-author the stats inline in `meta.ts`** — read them off the match summary, hard-code them. Fastest, no new code. Breaks if we ever change the match.
- **B: Extract a `computeMatchStats()` helper** in `apps/site/src/data/showcase-match/stats.ts` that takes the event array and returns the `Stat[]` shape StatBadge needs. Deliberate site-only code, not a reusable Campos export.
- **C: Widen the shared compute surface in `@withqwerty/campos-react` with a `computeMatchStats()` export** so Showcase A uses the public API and other consumers benefit. More work, more API surface, more test burden.

**Recommendation:** B. Showcase A is an integration page — stats computation is site-local work that doesn't belong in the shared library surface until a second consumer appears. Flag the helper as "probably belongs in the shared compute surface someday" in a code comment and move on.

---

## Composition approach

### Astro-first, React islands where needed

- **Page is Astro.** Hero, section headers, section dividers, captions, credits — all plain Astro + CSS. No React.
- **Charts are React islands.** Each `<Formation>`, `<ShotMap>`, etc. is a `client:load` or `client:visible` island. No shared React state between islands.
- **No new layout components** beyond maybe `ShowcaseSection.astro` (a wrapper that provides consistent padding, max-width, section heading styling).
- **Section order is hard-coded in the Astro page.** No data-driven section rendering, no config object.

### Theme

- **Pitch theme** — single consistent pitch theme across the whole page. Pick the existing campos-green or noir/coral preset depending on what looks best with the home/away team colors.
- **Team colors** — Liverpool red (`#c8102e`) and Bournemouth red (`#da291c`) are both red. This is a known Campos problem for same-color-scheme derbies. Use a differentiating accent (e.g., Bournemouth with a darker/desaturated red or a hollow marker) to disambiguate. Flag open question 7.
- **UI theme** — whatever ComponentPage currently uses. Match the rest of the site.

### Responsive behavior

- CSS grid with `minmax(...)` to let charts wrap on narrow viewports
- No media queries beyond the CSS grid breakpoints
- Target: desktop 1200-1600px width looks great, tablet ~800px is acceptable, phone <600px is best-effort
- Dual-team Formation may need a vertical stack on narrow screens (one team on top of the other rather than side-by-side) — CSS only, no JS

---

## Nav / discoverability

Add a "Showcase" entry to the top nav. Options:

- **A: Top-level nav link** — `Showcase` alongside `Components`, `Adapters`, `About`, `Get Started`. Most discoverable. Pressures future showcases (v0.4 scouting) to fit under a "Showcases ▾" dropdown.
- **B: Inside Components dropdown** — a "Showcases" section header at the top of the Components dropdown with one link to the match page. Fits the existing grouped-dropdown pattern.
- **C: Inside Get Started** — a "See a full example →" link from the onboarding page. Lowest discoverability, highest context (readers know they're looking for an example).

**Recommendation:** A. Top-level "Showcase" link. If a second showcase family ever ships later, convert it to a "Showcases ▾" dropdown. Adds one nav entry now, no refactor cost later.

---

## Scope of the work

Rough checklist of what ships when Showcase A is done:

### Files to create

- `apps/site/src/pages/showcase/match.astro` — the page (~300-400 lines)
- `apps/site/src/data/showcase-match/meta.ts` — match metadata
- `apps/site/src/data/showcase-match/lineups.ts` — re-export / adapter-run formation data
- `apps/site/src/data/showcase-match/shots.ts` — shots fixture
- `apps/site/src/data/showcase-match/passes.ts` — passes fixture
- `apps/site/src/data/showcase-match/events.ts` — all-events fixture
- `apps/site/src/data/showcase-match/pass-network-home.ts` — aggregated nodes/edges
- `apps/site/src/data/showcase-match/pass-network-away.ts` — aggregated nodes/edges
- `apps/site/src/data/showcase-match/stats.ts` — computed match KPIs
- `apps/site/src/components/showcase/ShowcaseMatchHeader.astro` — hero component
- `apps/site/src/components/showcase/ShowcaseSection.astro` — section wrapper with consistent heading + padding

### Files to modify

- `apps/site/src/components/Nav.astro` — add Showcase link per decision above
- `docs/roadmap-v0.3.md` — mark Lane 1 order 5 complete when the page ships
- `docs/status/matrix.md` — add a Showcase A row or append to the Demo Pages table

### No files to modify in packages

No changes to `packages/react/`, `packages/adapters/`, `packages/stadia/`, or `packages/schema/` for Showcase A. If the page needs a capability an existing component doesn't have, that's either a component bug (fix separately) or out of scope (defer).

### Dependencies on existing components

Per-component assumption check:

| Component     | Current state                              | Risk for Showcase A                                                                                                     |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Formation     | shipped, dual-team mode works              | **Unstaged reshuffle in working tree** — see risk section below                                                         |
| PassNetwork   | shipped, follow-ups already landed         | Low — well-tested, interactive                                                                                          |
| Territory     | shipped with recent label/pitch-line fixes | Low — stable                                                                                                            |
| StatBadge     | shipped                                    | Low — pre-computed stats is the only integration task                                                                   |
| ShotMap       | shipped (pre-v0.3)                         | Low                                                                                                                     |
| XGTimeline    | shipped (pre-v0.3)                         | Medium — may not accept two-team input out of the box, need to verify the prop shape supports home vs away on one chart |
| Heatmap / KDE | shipped (pre-v0.3)                         | Deferred (open question 4)                                                                                              |
| PassMap       | shipped (pre-v0.3)                         | Deferred (open question 5)                                                                                              |

---

## Open questions

These need user input before implementation starts. Each has a recommendation so the default path is clear.

### Q1 — Match choice

Liverpool v Bournemouth (already decoded for Formation) or a different match? **Recommendation: Liverpool v Bournemouth.** Saves extraction time. Swap later if the demo feels bland.

### Q2 — ShotMap: one chart or two?

- **A: One ShotMap**, both teams' shots on the same pitch, colored by team. More condensed.
- **B: Two ShotMaps**, side-by-side, one per team. Cleaner separation, each team gets its own pitch.

**Recommendation: B (side-by-side).** The Liverpool–Bournemouth case study has ~15 shots per team, enough to fill a pitch each. One combined pitch gets cluttered when both sides have 10+ shots.

### Q3 — PassNetwork: one chart or two?

Same tradeoff as Q2. PassNetworks get messy when both teams are on one pitch (edges overlap). **Recommendation: two side-by-side**, mirroring the Territory section.

### Q4 — Include Heatmap / KDE section?

Territory + PassNetwork already tell the "where on the pitch" story. Heatmap is redundant unless we want finer-grained density.

- **A: No Heatmap section.** Cleaner, more focused page. Lighter reader load.
- **B: Add one Heatmap between Territory and PassNetwork** showing combined-team density or per-team heatmap.

**Recommendation: A (no Heatmap).** Redundant with Territory on a broadcast-style page. If you disagree, Option B is a 20-minute addition.

### Q5 — Include PassMap section?

PassMap shows individual pass arrows, PassNetwork shows aggregated nodes and edges. Arguably redundant.

**Recommendation: skip PassMap.** PassNetwork carries the same information at a more communicative level of abstraction. PassMap shines when you want to see individual pass trajectories — that's a scouting tool, not a match-report tool.

### Q6 — Stats computation: inline, site-local helper, or core export?

**Recommendation: site-local helper at `apps/site/src/data/showcase-match/stats.ts`** with a TODO comment suggesting it could move to core when a second consumer appears.

### Q7 — Team color disambiguation for Liverpool v Bournemouth (both red)

Options for distinguishing two red-ish teams:

- **A:** Pick darker/desaturated for one (e.g., Liverpool `#c8102e`, Bournemouth `#7a0000`). Still red, readable difference.
- **B:** Use outlined markers for one team instead of filled.
- **C:** Swap Bournemouth's nominal color to a contrasting accent (e.g., Bournemouth "black" from their alternate kit).

**Recommendation: A (desaturated accent).** Simplest, consistent across all charts, no per-component override needed.

### Q8 — Nav placement

Top-level `Showcase` link vs inside Components dropdown vs inside Get Started.

**Recommendation: top-level Showcase link.** Highest discoverability for a flagship page. Convert to a `Showcases ▾` dropdown only if another showcase family is added later.

### Q9 — Captions per section?

Short one-line caption above each chart (e.g., "Where the shots came from") vs no captions at all.

**Recommendation: short captions.** Helps casual readers. Adds ~8 lines of copy to the whole page. If it feels too magazine-y, delete.

---

## Risks and watchouts

### 1. Formation has unstaged working-tree reshuffle

`packages/react/src/compute/formation.ts` and its tests may be in the middle of orientation-related work. If that is still in flight, Showcase A's dual-team Formation card could drift from the current component behavior. **Action:** before starting Showcase A, re-run the current Formation tests and confirm the page plan still matches the landed Formation semantics instead of assuming older behavior.

### 2. New PlayerBadges primitives

`packages/react/src/primitives/PlayerBadges.tsx` gained new primitives (`MarkerIcon`, `MarkerPill`, `RatingPill`, `MarkerGlyphs`, `PlayerAvatar`, `estimateSmallPillWidth`) at some point — unclear if these are part of a Formation rework or a separate initiative. Showcase A should NOT depend on them unless they're stable by the time we build. Check with user before planning to use any.

### 3. TerritoryStaticSvg (static export)

`packages/react/src/Territory.tsx` now has a `TerritoryStaticSvg` export that skips the interactive chrome. This is part of the Phase 1 export work (Lane 3) bleeding into individual chart files. Showcase A uses the interactive `Territory`, not `TerritoryStaticSvg`, so this shouldn't affect it — but worth knowing the surface is growing.

### 4. Liverpool–Bournemouth team color collision

Both teams wear red. Planned mitigation: Q7 above. If the mitigation doesn't look good in practice, falling back to a completely different match (home team in blue/white/green) is a ~half-day delta.

### 5. XGTimeline two-team input

The component may need verification that its prop shape accepts home-and-away cumulative xG on the same chart. If it's single-team only, we either ship a single-team XGTimeline (home or away), skip the section, or fix XGTimeline first (out of Showcase A scope).

### 6. pnpm check drift

The repo has had several "lefthook formatting aborted the commit" moments. Before opening Showcase A work, run `pnpm check` to confirm the baseline is clean. Anything broken should be fixed as a standalone packet, not rolled into Showcase A.

---

## Verification plan

When Showcase A is "done":

- `pnpm typecheck` — clean globally
- `pnpm test` — full suite still passes (nothing touches existing components)
- `pnpm lint` — 0 errors
- `pnpm format:check` — clean
- `pnpm build` — all 6 packages build
- `pnpm --filter @withqwerty/campos-site build` — site builds, `/showcase/match/index.html` generated
- **Visual check via the running dev server at `http://localhost:4321/showcase/match/`** — the real test. Does it look like a real match article?
- **No tests added for the page itself.** Showcase A is an integration demo, not a unit. The underlying components have their own test coverage. If a section is broken, it's the component's bug, not the page's.

---

## Rough effort breakdown

Not a schedule — a rough allocation of where the work lives.

| Phase                        | Share | Notes                                                                                             |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| Data extraction + fixtures   | ~35%  | 6-7 fixture modules, mostly mechanical but the stats computation is the novel bit                 |
| Astro page + layout          | ~25%  | `match.astro`, section wrapper, hero component, responsive grid                                   |
| Stats helper (site-local)    | ~10%  | `computeMatchStats()` from the event stream                                                       |
| Theme / color reconciliation | ~10%  | Getting Liverpool and Bournemouth reds to read differently, pitch theme picking, StatBadge colors |
| Visual polish                | ~10%  | Fixing whatever looks wrong when you actually see the page — typography, spacing, section headers |
| Verification + commits       | ~10%  | Running the full gate, fixing anything that breaks, landing commits                               |

**Total effort:** M (medium) per the roadmap. If any of the risks materialize (Formation WIP conflicts, XGTimeline two-team issue), could push to M-L.

---

## Commit strategy

Probably 4-6 commits landing on `main`:

1. `feat(site): add Showcase A match fixtures` — all `apps/site/src/data/showcase-match/*` modules in one go
2. `feat(site): add computeMatchStats helper for Showcase A` — the new site-local stats function
3. `feat(site): add ShowcaseMatchHeader and ShowcaseSection components` — layout primitives
4. `feat(site): add Showcase A match deep-dive page` — the main `match.astro` page
5. `feat(site): add Showcase link to nav` — nav update
6. `docs(status): mark Showcase A complete in roadmap + matrix` — finalize

Can be combined into fewer commits if convenient. TDD is not relevant for an integration page.

---

## What "done" looks like

Showcase A is done when you can load `http://localhost:4321/showcase/match/`, scroll from top to bottom, and feel like you're reading a real Opta / Sky Sports match page. The charts are the content, the layout is clean, the typography is consistent, the data is real, nothing looks like a widget demo. If you share a screenshot with a football analyst they should ask "what tool is this?" not "why does the lineup look different from the shot map?"

The Lane 1 primitives all get a second life as citizens of a real page. Any rough edges that emerge go into a Lane 1 follow-up list, not back into Showcase A.

---

## Historical note on the old v0.3 plan

This plan still matters as the integration contract for Showcase A, but the
older “Showcase A then Showcase B scouting slice” framing is no longer the
active roadmap.

Current follow-on work is tracked in:

- `docs/roadmap-v0.3.md`
- `docs/status/matrix.md`
- `docs/standards/battle-test-recreation-standard.md`

What changed:

- Showcase A shipped and remains the key match-deep-dive reference page.
- The dedicated scouting slice / Showcase B plan was removed.
- `PercentileBar`, `PassSonar`, and `SmallMultiples` survived as standalone
  reusable gap packets rather than as pieces of a second showcase page.
- Ongoing product-shaping work now runs primarily through battle-tests and
  targeted follow-up packets.
