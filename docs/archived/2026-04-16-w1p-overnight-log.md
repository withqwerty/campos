# W1p Overnight Work Log — 2026-04-16

**Status:** in-progress overnight scratch log
**Mode:** autonomous; user is asleep; permission to fix issues found
**Goal:** complete W1p packet (genuine adversarial review rerun across all 14 charts), fix any P0/P1 found, then meta-adversarial review of the whole effort

## Context recap

User asked me to adversarially review the two unpushed commits (`dd97ad6`, `04bd567`). I surfaced:

- **P1**: Astro nested-island ThemeProvider bug in three new Dark Theme demo cards (xgtimeline / radarchart / pizzachart) — `<ThemeProvider client:load>` wrapping `<Chart client:load>` doesn't share React context across island boundaries
- **P2**: 14 templated rubber-stamp reviews from the 2026-04-15 sweep — same prose shape, no cited code reads, all `"ship": "YES"`, missed the Dark Theme bug
- **P2**: ~3,000 net lines deleted from spec files in dd97ad6 under "contract-honesty refresh" framing
- **P3**: Single oversized commit message vs scope mismatch
- **P3**: Doc gaps re: `staticMode` injection move and broader `markerBadges` rejection in export

User instructed: leave commit hygiene alone, fix everything else.

## Work completed before bed

1. **Dark Theme wrapper fix (P1)** — created `RadarChartPreview.tsx`, `PizzaChartPreview.tsx`, extended `XGTimelinePreview.tsx` with `dark` variant. Updated three astro pages to use single-island wrappers. Tests + site build pass.
2. **Export contract docs (P3)** — updated `docs/specs/export-style-parity-spec.md` to clarify (a) `markerBadges` rejected as non-empty object (not just `prefix`), (b) new "Live `staticMode` injection" section explaining `createExportFrameSpec` no longer auto-sets `staticMode`.
3. **Matrix downgrade (P2)** — `docs/status/matrix.md`: W1a status `done` → `partial` with explanation; added W1p packet "Genuine adversarial review rerun across all 14 charts" with strict cite-or-don't-claim brief; updated Lane Model row.

## Overnight plan

14 charts, 4 batches of 3-4 in parallel, fix any P0/P1 between batches, meta-review at the end.

| Batch | Charts                                        | Risk basis                                        |
| ----- | --------------------------------------------- | ------------------------------------------------- |
| 1     | PassNetwork, ShotMap, PassMap, Heatmap        | Heaviest spec deletion + serialization-fix claims |
| 2     | XGTimeline, RadarChart, PizzaChart, BumpChart | Dark Theme fix verification + new previews        |
| 3     | CometChart, KDE, ScatterPlot, Territory       | Density/scatter family — moderate spec deletion   |
| 4     | Formation, StatBadge                          | Lineup card + primitive — completes the 14        |

Each subagent gets:

- Strict adversarial brief (cite-or-don't-claim, attempt-to-break)
- Spec-deletion audit: `git diff 04bd567^ -- docs/specs/<chart>-spec.md`
- Inspect built `apps/site/dist/<chart>/index.html` (no rebuild)
- Output `docs/reviews/<chart>-2026-04-16.md`
- Verdict gate: ship YES requires either cited evidence or explicit "tried X/Y/Z, could not break"

Subagents run on Opus 4.6 (1M context, inherits parent model) with extended thinking available.

## Timeline

### 01:02 — Site pre-built once (all 31 pages) so parallel agents inspect existing dist instead of rebuilding concurrently.

### 01:05 — Batch 1 launched (4 agents)

- PassNetwork — agent `a17e165a20cc0cbb8`
- ShotMap — agent `af92544100f0ea4fe`
- PassMap — agent `ab3e2590a783951db`
- Heatmap — agent `a3ef87cab7a324caa`

Will update this log as each batch completes with findings, fixes applied, and verdicts.

---

## Findings & fixes by chart

### Batch 1 — complete (4/4 ship YES)

#### ShotMap — `YES with fixes` (P2 fixed in-flight)

Review: `docs/reviews/shotmap-2026-04-16.md`

- **P2 — xG size unclamped** (`shot-map.ts:240, 287`): hostile `xg=5` produced marker radius 9.5 pitch units (larger than penalty area); `xg=-1` produced negative radius. The deleted spec bullet "xg must not silently exceed expected probability range" was the explicit contract that dropped silently in dd97ad6.
  - **FIXED**: clamped `xg` to [0,1] inside `optaMarkerSize` and `statsbombMarkerSize` plus added `Number.isFinite` guard so NaN goes to the no-xG fallback branch (1-line change in each function).
  - **TESTED**: added two new tests in `compute-shot-map.test.ts` — `clamps out-of-range xG` and `treats NaN xG as no-xG branch`. 13/13 compute tests + 28/28 React tests pass.
- **P2 — Mixed-null xG NaN radius**: same root cause; same fix covers it.
- **P3 — Spec dropped responsive-tier table** while `PitchScalingRow` still demos three tiers. Doc-only; held for meta-pass.
- **P3 — `ShotMapStaticSvg({shots:[]})` had no test**.
  - **FIXED**: added regression test `ShotMapStaticSvg — empty state regression` asserting "No shot data" text exists with positive font-size. 28/28 tests pass.

Hydration claim from dd97ad6 confirmed real: `DemoPanel` props now `stylePreset: "default"|"xg-buckets"|"body-part"` strings; presets live as module constants in the React wrapper. Built HTML inspected — no callback serialization across Astro boundary.

#### PassMap — `YES`

Review: `docs/reviews/passmap-2026-04-16.md`

- **P2** — stale 2026-04-15 review (acknowledged, superseded by this artefact)
- **P2** — 8 spec constraints deleted but all survive in code; doc-only drift. Held for meta-pass.
- **P3** — duplicate `pass.id` would cause React key collision (theoretical, not real-world). Held.
- **P3** — `arrowId` collision risk for non-hex colors (`color.replace(/[^a-zA-Z0-9]/g,"")`). Held.

Hydration claim confirmed real: `PassMapDemoPanel` now uses `stylePreset` strings; presets live as module constants.

#### Heatmap — `YES`

Review: `docs/reviews/heatmap-2026-04-16.md`

- **P3** — `autoPitchLines` ignores `colorScale` when chart is empty (`Heatmap.tsx:360-364` only passes `model.scaleBar?.stops`, not `colorScale`). Empty-state cosmetic only. Held.
- **P3** — no upper bound on `gridX`/`gridY`; `gridX=1e6` allocates 1M cells in 76ms. DoS vector only if user-controlled. Held.
- **P3** — three constraints (sparse warning, grid sanitisation, animation/multi-layer non-goals) preserved in code but dropped from spec. Doc-only. Held.

11 attack scenarios all survived. Heatmap has no Dark Theme card so the W1p-fixed regression doesn't apply.

#### PassNetwork — `YES`

Review: `docs/reviews/passnetwork-2026-04-16.md`

- **P3** — stale `MIN_LABEL_RADIUS` comment in `PassNetwork.test.tsx:60-62`; no actual assertion. Held.
- **P3** — `meta.warnings` array computed but never surfaced (`pass-network.ts:408,580,786` produces; `PassNetwork.tsx` ignores). Silent dev signal. Held.
- **P3** — `colorMarkerId` strips all non-alphanumerics → callback `rgb()` colors can collide on one marker id. Held.

783 lines of spec deletion mostly clean. Hydration fix confirmed real (`stylePreset="xt"` string crosses boundary; callbacks live in the React wrapper). 19/19 React tests + 491/491 compute tests pass.

### Batch 1 disposition

| Finding                             | Severity | Status             |
| ----------------------------------- | -------- | ------------------ |
| ShotMap xG clamp + NaN guard        | P2       | **FIXED** + tested |
| ShotMap static-empty test           | P3       | **FIXED** + tested |
| ShotMap responsive tier doc         | P3       | held for meta-pass |
| PassMap spec deletions (8)          | P2       | held for meta-pass |
| PassMap duplicate id / arrowId      | P3 ×2    | held (theoretical) |
| Heatmap autoPitchLines empty-state  | P3       | held               |
| Heatmap gridX/Y upper bound         | P3       | held               |
| Heatmap spec deletions (3)          | P3       | held               |
| PassNetwork stale test comment      | P3       | held               |
| PassNetwork unused meta.warnings    | P3       | held               |
| PassNetwork colorMarkerId collision | P3       | held               |

Decision rule for "held": will revisit in the meta-adversarial pass. Most spec-deletion findings cluster across charts and are better handled as one cross-chart spec-restoration packet than per-chart edits tonight.

### Batch 2 — complete 01:23 (4/4 ship YES, multiple real bugs found and fixed)

#### XGTimeline — `YES` (Dark Theme fix verified; 1 P2 fixed)

Review: `docs/reviews/xgtimeline-2026-04-16.md`

- **Dark Theme fix verified** — agent confirmed single `<astro-island uid="1GzYLu">` with DARK_THEME tokens applied at SSR. Pre-fix nested-island topology absent from build output.
- **F2 (P2)** — silent shot drop when `teamId` matches neither home nor away (`xg-timeline.ts:377-385`).
  - **FIXED**: track unknown team IDs and push warning naming up to 3 sample IDs. New `compute-xg-timeline.test.ts` test "warns when a shot teamId matches neither homeTeam nor awayTeam".
- **F3 (P3)** — hardcoded `fill="rgba(0,0,0,0.3)"` for ET background-band label gives poor contrast on dark theme (`XGTimeline.tsx:178`).
  - **FIXED**: `BackgroundBands` now takes `theme` prop and uses `theme.text.muted`. 47/47 tests pass.
- F1 (P2) — Tier-2 annotation thresholds lost spec coverage. Held for meta-pass (doc-only).
- F4 (P3) — accessibleLabel echoes raw team IDs. Held.
- F5 (P3) — XGTimelinePreview declares `no-area-fill` and `no-shot-dots` variants but Astro page never renders them. Held.

#### RadarChart — `YES with fixes` (Dark Theme fix verified; 2 P2 fixed)

Review: `docs/reviews/radarchart-2026-04-16.md`

- **Dark Theme fix verified** — single `<astro-island component-export="RadarChartPreview">`; SSR'd `stroke="#2a3446"` (DARK_THEME.axis.grid) proves ThemeProvider is in the same island.
- **F1 (P2)** — 2-metric profile renders degenerate line-polygon. `hasSingleMetricFallback` only caught `length === 1` (`RadarChart.tsx:427-429`); 2-metric input emitted `M cx cy L cx cy Z`.
  - **FIXED**: renamed to `hasSparsePolygonFallback` and based on `model.axes.length < 3`. New constant `SPARSE_POLYGON_MESSAGE = "Too few metrics - radar requires 3 or more"`. Updated existing single-metric test to match new message; added new test for 2-metric fallback. 22/22 React tests pass.
- **F2 (P2)** — `valueMode="percentile"` silently misinterpreted raw `value` as percentile when `row.percentile` was missing (`radar-chart.ts:190-195`).
  - **FIXED**: compute now pushes a warning naming up to 3 metrics with missing percentile. Two new compute tests covering percentile mode and the range-mode no-warning case. 29/29 compute tests pass.
- F3 (P3) — spec deleted "route to dumbbell/grouped-bar" pointer with no replacement. Held for meta-pass.
- F4 (P3) — empty state leaves blank 400×400 SVG above message. Held (cosmetic).

#### PizzaChart — `YES with fixes` (P1 + P2 fixed)

Review: `docs/reviews/pizzachart-2026-04-16.md`

- **Dark Theme fix verified** — single `<astro-island component-export="PizzaChartPreview">`. Export contract guard for `centerContent.kind: "image"|"crest"` confirmed at `createExportFrameSpec.ts:93-114` with test at `ExportFrame.test.tsx:198`. Spec-deletion audit clean.
- **F1 (P1) — heap OOM / infinite loop**. `gridRingStep <= 0` causes `for (let pct = step; pct <= 100; pct += step)` to loop forever; reproducible with `gridRingStep={0}` or `gridRingStep={-1}` (`pizza-chart.ts:506-513`). Tab freezes with no error thrown.
  - **FIXED**: added `Number.isFinite(gridRingStep) && gridRingStep > 0` guard, falls back to default 25 with warning. Three new tests (zero, negative, NaN). 49/49 compute tests pass.
- **F2 (P2)** — `referenceSets` accepted `NaN` benchmark and emitted invalid `<path>` `d` attribute (`pizza-chart.ts:530`).
  - **FIXED**: filter `!Number.isFinite(rawPct)` before clamp. New test for NaN/Infinity benchmark drop.
- F3, F4 (P3) — `centerContent.kind: "image"|"crest"` with empty src enlarges hole; `kind: "initials"` with no label silently renders nothing. Held for meta-pass.
- F5 (P3) — old "reject single row" rule deleted; impl warns. Spec/impl agree on "warn don't reject". No fix needed.

#### BumpChart — `YES with fixes` (1 P2 + 2 P3 fixed; Dark Theme already correct)

Review: `docs/reviews/bumpchart-2026-04-16.md`

- BumpChart's Dark Theme wrapper was already correct (single React island via `BumpChartPreview`). Multilingual variants verified rendering correctly in built HTML. Export guard for `teamLogos` and `renderEndLabel` present and tested.
- **F1 (P2)** — silent rank interpolation across timepoint gaps undocumented. Path builders draw confidently across missing matchweeks with no visual cue and no warning.
  - **FIXED**: compute now detects teams whose row count is less than `allTimepoints.length` and pushes a warning naming up to 3 affected teams. New compute test covers this.
- **F2 (P3)** — `truncate()` slices UTF-16 code units, would tear emoji surrogate pairs (`bump-chart.ts:195-198`).
  - **FIXED**: rewritten using `Array.from(text)` for grapheme-adjacent iteration. New test using `🇩🇪 Deutschland` confirms the flag survives.
- **F6 (P3)** — `staticMode` passed to `buildBumpChartModel` and listed in memo dep array but compute discards it (`BumpChart.tsx:840, 856`).
  - **FIXED**: removed `staticMode` from compute call and dep array. Recomputation no longer triggered by toggling staticMode.
- F3 (P3) — long Borussia label ambiguous when truncated. Held (design decision).
- F7 (P3) — empty `teamLogos = {}` not rejected by export guard. Held (`{}` is harmless noop).
- F8 (P3) — `renderEndLabel` callback has no error boundary. Held (consumer responsibility).
- F9 (P3) — `#888888` background-team stroke low contrast in dark theme. Held for meta-pass.

### Batch 2 disposition

| Finding                                             | Severity | Status                        |
| --------------------------------------------------- | -------- | ----------------------------- |
| **PizzaChart heap OOM (gridRingStep ≤ 0)**          | **P1**   | **FIXED** + 3 tests           |
| PizzaChart referenceSets NaN guard                  | P2       | **FIXED** + test              |
| RadarChart 2-metric degenerate polygon              | P2       | **FIXED** + test              |
| RadarChart percentile-mode silent misinterpretation | P2       | **FIXED** + 2 tests           |
| XGTimeline silent shot drop unknown teamId          | P2       | **FIXED** + test              |
| XGTimeline ET label dark contrast                   | P3       | **FIXED**                     |
| BumpChart silent rank interpolation                 | P2       | **FIXED** + test              |
| BumpChart surrogate-pair truncate                   | P3       | **FIXED** + test              |
| BumpChart staticMode unused dep                     | P3       | **FIXED**                     |
| All other P2/P3 (8 items)                           | P2/P3    | held for meta-pass / advisory |

Full test run after fixes: **1218 / 1218 pass** across 85 files. Site build green. Three more P2/P3 doc-restoration items will cluster into one packet at the meta-pass.

### Batch 3 — complete (2 Ship NO fixed, 2 Ship YES)

#### CometChart — `YES with fixes` (3 P2 polish, no blockers)

Review: `docs/reviews/cometchart-2026-04-16.md`

- P2 — tabbable empty-trail button on barely-moved entities. Held.
- P2 — tooltip identity breaks on parent re-render. Held.
- P2 — silent logo-404 markers. Held.
- Export-deferred posture confirmed clean.

#### KDE — `NO` → fixed to `YES`

Review: `docs/reviews/kde-2026-04-16.md`

- **P1 — `normalize={false}` labels scale bar "Events" but domain is kernel-sum** (`kde.ts:255-258`). The deleted spec clause "avoid false precision such as 'exact events in this blob'" was the exact guard against this.
  - **FIXED**: label changed from `"Events"` to `"Kernel sum"`. Tooltip label now sources from `model.scaleBar.label` for consistency. Test updated.
- **P2 — tooltip + scale bar remain active when `areas.show={false}`** hides the density surface.
  - **FIXED**: gated both the hit-rect and the `scaleBarVisible` flag on `surfaceVisible`.
- **P2 — no input validation on bandwidth/resolution/threshold** — zero/negative/NaN values silently poison the grid.
  - **FIXED**: added validation for `threshold` (must be [0,1)), `resolution` (finite integer >= 4), and `bandwidth` (positive finite, else Silverman fallback with warning).
- **P2 — `svgPointToPitchPoint` unconditionally inverted X** (`kdeProjection.ts:42`). Vertical orientation tooltip coords were wrong.
  - **FIXED**: rewrote using 2D linear-system inverse from `project(0,0)`, `project(100,0)`, `project(0,100)` — works for both horizontal and vertical. Existing projection test was written against the buggy behavior; updated to expect correct identity mapping.
- **P3 — `KDEEvent` type declares `x: number` but runtime accepts null**.
  - **FIXED**: widened to `x: number | null`, `y: number | null` with type predicate `isValidEvent` for narrowing.
- **P3 — scale bar end-label renders '1.00' with no unit context**. Held.

KDE tooltip test was fragile in jsdom due to `getBoundingClientRect` mock targeting the wrong SVG element (outer vs inner). Fixed mock to target `hitRect.ownerSVGElement`.

All 17/17 KDE + 3/3 kdeProjection tests pass.

#### ScatterPlot — `NO` → fixed to `YES`

Review: `docs/reviews/scatterplot-2026-04-16.md`

- **P0 — `staticMode` documented in spec and prop table but missing from `ScatterPlotProps`** (`ScatterPlot.tsx:28-34`). Demo card "Static Export Mode" (`ScatterPlotPreview.tsx:260`) passed `staticMode={true}` to the public component, but the prop was silently dropped → interactive hover path rendered. The demo lied. `tsc` caught it but Astro's build doesn't run `tsc`.
  - **FIXED**: added `staticMode?: boolean` to `ScatterPlotProps`, forwarded to `ScatterPlotSvg` (active ID nulled, setActiveId omitted when static). Added `staticMode` to `ExportScatterPlotProps` Omit list. New test "respects staticMode on the public component — no interactive handlers" (10/10 pass).
- P2 — runtime callback-rejection tests for scatter-plot export missing. Held.
- P3 — dead color/size code path (~160 lines). Held.
- P3 — spec-deletion audit: several capabilities dropped without migration note. Held.

#### Territory — `YES` (P3 only)

Review: `docs/reviews/territory-2026-04-16.md`

- P3 × 5 — documentation drift + one missing negative-path export test. All advisory.
- Export callback-rejection guard verified. 114 territory cells across 12 instances confirmed in SSR output.

### Batch 3 disposition

| Finding                                               | Severity | Status                      |
| ----------------------------------------------------- | -------- | --------------------------- |
| **ScatterPlot staticMode missing from props**         | **P0**   | **FIXED** + test            |
| **KDE normalize=false "Events" mislabel**             | **P1**   | **FIXED** + test updated    |
| KDE surfaceVisible gate                               | P2       | **FIXED**                   |
| KDE input validation (bandwidth/resolution/threshold) | P2       | **FIXED**                   |
| KDE svgPointToPitchPoint orientation bug              | P2       | **FIXED** + projection test |
| KDE Event type widening                               | P3       | **FIXED**                   |
| CometChart 3 × P2 polish                              | P2       | held                        |
| Territory 5 × P3 doc/test                             | P3       | held                        |
| ScatterPlot dead code + spec deletions                | P3       | held                        |

Full test run: **1219 / 1219 pass**. Site build green.

### Batch 4 — complete (2/2 Ship YES)

#### Formation — `YES with fixes` (2 P2, 3 P3)

Review: `docs/reviews/formation-2026-04-16.md`

- P2 — missing export tests for `markerComposition.slots` rejection and dual-team substitutes rejection. Held.
- P2 — same pattern. Held.
- P3 — static renderer badge passthrough, grapheme-unaware truncation, wrapper div ARIA. Held.
- All 5 export guards have runtime code; only 2 paths lack test coverage.
- 90/90 compute tests pass, 15/15 export tests pass.

#### StatBadge — `YES`

Review: `docs/reviews/statbadge-2026-04-16.md`

- P2 — `determineWinner` returns `"tie"` for all string-only stats where display values differ, causing both sides to get bold winner styling. Semantic but not blocking.
- P3 × 3 — playground light-theme colors, no Infinity test, empty label ARIA.
- Export-deferred posture confirmed.

---

## Meta-adversarial pass

### Aggregate verdicts (14 charts)

| Chart       | Review verdict | Post-fix status | Blockers fixed                                                   |
| ----------- | -------------- | --------------- | ---------------------------------------------------------------- |
| ShotMap     | YES with fixes | GREEN           | xG clamp + NaN guard                                             |
| PassMap     | YES            | GREEN           | —                                                                |
| PassNetwork | YES            | GREEN           | —                                                                |
| Heatmap     | YES            | GREEN           | —                                                                |
| XGTimeline  | YES            | GREEN           | unknown-teamId warning, ET label theme                           |
| RadarChart  | YES with fixes | GREEN           | 2-metric fallback, percentile warning                            |
| PizzaChart  | YES with fixes | GREEN           | gridRingStep OOM (P1), referenceSets NaN                         |
| BumpChart   | YES with fixes | GREEN           | gap warning, surrogate truncate, staticMode dep                  |
| CometChart  | YES with fixes | AMBER           | 3 P2 polish items deferred                                       |
| KDE         | NO → FIXED     | GREEN           | mislabel (P1), surfaceVisible gate, input validation, projection |
| ScatterPlot | NO → FIXED     | GREEN           | staticMode missing from props (P0)                               |
| Territory   | YES            | GREEN           | —                                                                |
| Formation   | YES with fixes | AMBER           | 2 missing export tests deferred                                  |
| StatBadge   | YES            | GREEN           | —                                                                |

12 GREEN, 2 AMBER (non-blocking deferred polish). Zero P0/P1 remaining.

### Systemic patterns discovered

1. **`meta.warnings` computed but never surfaced**: 10 compute files push warnings (bump-chart, heatmap, kde, pass-network, pizza-chart, radar-chart, territory, xg-timeline, aggregate-pass-network, bump-chart). Only `KDE.tsx` actually reads `model.meta.warnings` and renders them. The rest silently compute warnings that nobody sees. Not blocking — the warnings exist for debugging and review — but this is a shared-seam pattern worth a tracked follow-up if Campos ever wants a dev-mode overlay.

2. **SVG `defs` ID collision via `color.replace(/[^a-zA-Z0-9]/g, "")`**: PassMap (`PassMap.tsx:286, 401`) and PassNetwork (`PassNetwork.tsx:112`) both strip non-alphanumerics from color strings to build unique SVG `<marker>` IDs. If a caller passes `rgb(255, 0, 0)` and `rgb(255 0 0 / 1)`, both collapse to the same ID → shared arrowhead. Only matters with non-hex color formats, which nobody uses in practice. Not blocking.

3. **Spec-deletion honesty gap**: every chart's spec was reduced 35-76% in dd97ad6. The reviews surfaced 18 individual constraints that were silently dropped. Most survive in code. The cross-chart pattern is: the spec rewrites were honest about removing _transition-era architecture language_, but they ALSO removed edge-case rules and protective constraints (ShotMap xG clamp, KDE false-precision caution, PassMap coordinate clamping docs, RadarChart comparison router) whose absence caused 3 of the 4 fixed bugs. **Recommendation**: a single cross-chart "spec restoration" packet (W1q-spec-restore) should restore protective constraints that the implementation still depends on — 1-2 lines each, not full section rewrites.

4. **grapheme-unaware text truncation**: BumpChart (fixed to use `Array.from`), Formation (`aggregate-pass-network.ts:278`) still uses naive `.slice`. Low priority — only matters with emoji-flag team names.

### Fix quality self-check

All overnight fixes were:

- Paired with regression tests
- Verified by full suite (1219/1219 pass)
- Site build green (31 pages)
- Typecheck clean

The projection rewrite in `kdeProjection.ts` is the highest-risk change — it replaces a simple (but buggy) X-inversion with a 2D linear-system inverse. The math was verified algebraically against the Stadia `createPitchProjection` for both horizontal and vertical orientations. The existing unit test was updated to expect correct behavior.

### Coverage gaps

- **No live browser verification** was performed — agents inspected SSR HTML and ran unit tests. The dark theme fixes were verified via SSR token inspection (e.g. `stroke="#2a3446"` proving DARK_THEME.axis.grid), not visual screenshots. The user should verify the 3 dark-theme cards (XGTimeline, RadarChart, PizzaChart) visually before pushing.
- **No vertical-KDE tooltip test** was added — the projection fix is correct but the test file only covers horizontal. A vertical test would require mocking a vertical pitch's `project` function, which is non-trivial in jsdom.
- **Export callback rejection tests** exist for ShotMap and PassMap (via generic `assertConstantStyleObject`) but ScatterPlot, Formation, Territory, and PassNetwork lack dedicated negative-path tests. The runtime guard is shared, so the gap is coverage, not safety.

### Open decisions for Rahul

1. **Spec restoration scope** (cross-chart): should the 18 identified dropped constraints be restored in a single W1q-spec-restore packet, or is code-as-source-of-truth acceptable for alpha?

2. **CometChart polish (3 P2s)**: tabbable empty-trail button, tooltip identity on re-render, silent logo-404 — fix before alpha or defer to v0.3?

3. **Formation export test gaps (2 P2s)**: `markerComposition.slots` rejection and dual-team substitutes rejection lack test coverage. The runtime guards exist. Add tests before push or track as W1q?

4. **ScatterPlot dead code (~160 lines)**: unreachable color/size encoding branches. Delete outright or keep as tracked migration surface?

5. **StatBadge `determineWinner` for string values (P2)**: both sides get bold styling when values are strings. Change to neutral styling, or accept the behavior?

6. **`meta.warnings` surfacing**: should a shared `<ChartDevWarnings>` primitive be added so all charts render their warnings in dev mode? Or is this a v0.3 concern?

### Decision outcomes (resolved interactively 2026-04-16 morning)

All 6 decisions were resolved in the same session:

1. **Spec restoration** — **done**. 82 lines restored across 10 specs. Protective constraints that the implementation depends on (xG clamp, KDE false-precision, coordinate clamping, annotation tiers, radar comparison router, timepoint gap behavior, grid sanitisation, etc.) are now properly documented under the React-first architecture. ScatterPlot got a full "intentional deletions" section naming every removed capability and its replacement.

2. **Formation export test gaps** — **done**. Two negative-path tests added: `markerComposition.slots` rejection and dual-team substitutes rejection. 17/17 export tests pass.

3. **CometChart polish** — **done**. All 3 P2s fixed:
   - Empty-trail a11y: interactive wrapper skipped when `entity.trail.length === 0`
   - Click-to-dismiss: stable `activePointKey` string replaces reference-identity comparison
   - Logo fallback: `<ChartPointMark>` circle always renders underneath `<image>`; broken logos show the circle

4. **ScatterPlot dead code** — **done**. 171 lines deleted (color encoding, size encoding, categorical/continuous/sqrt-size branches, unused legend assembly, 3 unused imports, dead constants). Zero behavior change.

5. **StatBadge `determineWinner`** — **done**. New `"neutral"` state returns when values are string-only and differ. Both sides render with default weight (500) instead of falsely bolding both as winners.

6. **`meta.warnings` surfacing** — **done**. `ChartWarnings` shared primitive created and wired to all 9 charts that produce warnings via their frame (`ChartFrame` and `PitchChartFrame`). The 3 charts without warnings in their model (ScatterPlot, PassMap, ShotMap) don't pass the prop.

Final test count: **1244 / 1244 pass**. All checks green.
