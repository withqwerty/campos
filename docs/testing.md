# Testing

**Status:** active testing standard
**Scope:** quality bar and evaluation approach that shipped and future components should satisfy

Campos uses a two-layer testing approach: a 12-axis quality bar that every component must pass, and blind agent evaluations that verify real-world discoverability.

## 12-axis quality bar

Every component is tested against 12 quality axes before it ships. This isn't a vague "we tested it" claim -- each axis has specific pass criteria and dedicated tests.

| #   | Axis              | What it tests                                                                                       | Example                                                                  |
| --- | ----------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | **Empty**         | Empty array or no data produces a graceful placeholder -- never throws                              | `<ShotMap shots={[]} />` shows "No shot data" with pitch shell           |
| 2   | **Sparse**        | 1 data point renders with visible markers, sensible layout                                          | Single shot on a half-pitch, not a broken or blank chart                 |
| 3   | **Dense**         | 500+ shots, large pass sets -- no overflow, no performance cliff                                    | 500 shots render with alpha transparency, under 100ms                    |
| 4   | **Missing**       | null numerics, undefined strings -- every field has a fallback                                      | null xG uses minimum marker size; null player name shows "Unknown"       |
| 5   | **Extreme**       | xG > 1.0, coordinates outside [0,100] -- clamped, never corrupted                                   | `{ xg: -0.5 }` clamps to 0; `{ x: 150 }` clamps to 100                   |
| 6   | **Text edges**    | Unicode (Ødegaard), CJK (张伟), RTL (عمر), 60-char names                                            | All render without clipping or encoding errors                           |
| 7   | **Responsive**    | Renders correctly at 400, 800, and 1280px container widths                                          | Shot map markers stay visible and non-overlapping at 400px               |
| 8   | **Themeable**     | Light and dark themes via `ThemeProvider` context; pitch theme via nanostores                       | Goal markers use the correct token in both light and dark themes         |
| 9   | **Composable**    | Works inside `ExportComposition`, `DemoCard`, and alongside other charts on a page                  | Chart renders cleanly in a static export card without side effects       |
| 10  | **React hygiene** | No console errors or warnings, no global state mutations, no `useEffect` leaks                      | `vitest-axe` `toHaveNoViolations()` passes; no React StrictMode warnings |
| 11  | **Accessibility** | WCAG AA contrast ratios on both themes, accessible label on figure, colour is not the only encoding | Body-part shapes (circle/diamond/square) + outcome colours               |
| 12  | **Tested**        | Every axis above has at least one dedicated test                                                    | Checklist comment at the top of each test file                           |

### Current status

All 14 shipped components are GREEN across all 12 axes. See `docs/status/matrix.md` for per-component detail.

Run the full suite:

```bash
pnpm test
```

## Blind agent evaluations

> **Historical note:** The evaluations below (S0–S3) were conducted against the Python v0 library. They remain useful as evidence that agent-discoverability works, but the components, commands, and API patterns are from that era. The principle (fresh agents discover components from source code alone) still applies to the current React library.

Campos is designed for AI coding agents. We test this by running blind evaluation sessions -- fresh AI agents that have never seen the library before are given natural-language prompts and must discover, import, and correctly use Campos components.

### How it works

1. A fresh Claude Code session is started via `claude -p` (no prior conversation context)
2. The agent is given a natural-language prompt like "Build me a player report for Mohamed Salah"
3. The agent can read the Campos source code but gets no tutorials or documentation
4. We score each output against a frozen rubric on 4 metrics

### Scoring metrics

| Metric              | What it measures                                                      | Threshold                |
| ------------------- | --------------------------------------------------------------------- | ------------------------ |
| **M1 -- Selection** | Did the agent pick the right component for the task?                  | >= 85%                   |
| **M2 -- Schema**    | Did the agent construct valid schema objects with no invented fields? | = 100%                   |
| **M3 -- Execution** | Did the generated code run without errors?                            | >= 70%                   |
| **M4 -- Quality**   | Does the visual output make sense for the task?                       | >= 60% PASS + BORDERLINE |

### S0 eval (20 tasks, stubs only)

The initial validation tested whether agents could discover and use 3 stub components (player_hero, percentile_ribbon, shot_map) across 20 diverse prompts.

| Metric       |              Result               | Threshold |
| ------------ | :-------------------------------: | :-------: |
| M1 Selection |         **100%** (20/20)          |  >= 85%   |
| M2 Schema    |         **100%** (20/20)          |  = 100%   |
| M3 Execution |         **100%** (20/20)          |  >= 70%   |
| M4 Quality   | **100%** (16 PASS + 4 BORDERLINE) |  >= 60%   |

Key finding: agents consistently discovered components from source code alone. The main pain point was multi-component composition (8/20 tasks needed it, every agent invented a different hack). This directly motivated the `compose()` helper.

### S2 eval (5 tasks, new components)

After building RadarChart, upgrading PercentileRibbon, and adding compose(), we ran targeted evaluations:

- Radar chart (basic + reversed scales) — note: comparison-mode eval coverage was retired when comparison was removed from the component; see `docs/specs/radarchart-spec.md` decision section
- Full scouting report via `compose([hero, ribbon, shots])`
- Percentile ribbon with comparison overlay and title

**Result: 5/5 PASS, 0 BORDERLINE, 0 FAIL.** The `compose()` helper eliminated the composition hacks entirely.

### S3 eval (4 tasks, remaining components)

After shipping PercentileGroup, CategoryScoreCard, RankedList, and PlayerHero 12-axis:

- Percentile group with aggregate score
- Category score card with comparison
- Ranked list (top 10 scorers)
- Full dashboard composing 4 components

**Result: 4/4 PASS.** All new components were correctly discovered and used in blind sessions.

## Audience audit

> **Historical note:** This audit was conducted when Campos was a Python library. The finding (developers hand-roll 50–130 lines of custom chart code) remains valid motivation for the React library; the specific repos and Python examples are from that era.

Before building Campos, we audited 10 open-source Python football apps on GitHub to verify the target audience actually hand-rolls the components we propose to replace.

**Finding: 5/5 qualifying gaps found.** Each gap was a component where the author wrote 50+ lines of custom matplotlib code that Campos replaces with 5-10 lines.

| Gap                    | Repo                             | Lines replaced | Campos equivalent                |
| ---------------------- | -------------------------------- | :------------: | -------------------------------- |
| Percentile pizza chart | MS3B09/Botola-Scout              |      ~94       | `percentile_ribbon(rows)`        |
| Player hero card       | MS3B09/Botola-Scout              |      ~137      | `player_hero(player, club=club)` |
| Shot map (5 outcomes)  | MS3B09/Botola-Scout              |      ~68       | `shot_map(shots)`                |
| Shot map + stat badges | adlihs/streamlit_shot_map        |      ~130      | `shot_map(shots)`                |
| Full-pitch shot map    | TwinAnalytics/statsbomb-explorer |      ~138      | `shot_map(shots)`                |

4 of 5 gaps were chart components, confirming the chart-first build order.

## Code review process

Every component goes through a code review cycle after implementation:

1. **Implement** -- build the component with 12-axis tests
2. **Review** -- automated code review checks for bugs, API consistency, missing edge cases, test quality
3. **Fix** -- address all critical and medium issues
4. **Eval** -- run blind agent evaluation to verify discoverability
5. **Refine** -- if evals surface issues, fix and re-eval

Issues caught by code review during development:

- NaN sort order bug in PlayerTable (values sorted to wrong end)
- Missing `title` and `comparison_label` parameters on PercentileRibbon (API inconsistency)
- Unbound variable risk in RadarChart legend code
- Missing CJK/RTL text edge tests across multiple components
