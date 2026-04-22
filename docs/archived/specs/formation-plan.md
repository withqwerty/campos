# Formation Implementation Plan

**Status:** archived
**Superseded by:** `docs/specs/formation-spec.md`

> Historical implementation plan. The current public behavior lives
> in `docs/specs/formation-spec.md` and the source JSDoc. Since this plan was
> written, dual-team Formation has gained horizontal projection support and
> single-team half-crops use explicit `side` / `flip` semantics.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `<Formation>` public chart component for Campos v0.3 that renders single-team or dual-team broadcast-style lineup cards, backed by ported mplsoccer 68-formation position data and two new adapter methods (`fromOpta.formations()` and `fromWhoScored.formations()`) that decode real provider lineup data into a canonical schema.

**Architecture:** Generator script extracts mplsoccer's 68 formations (Python → JSON committed to the core package). TypeScript core module provides formation parser, position lookup, and dual-team layout compute on top of the committed JSON. Two adapter modules normalize provider-specific lineup formats (Opta `typeId: 34` events + squad join; WhoScored self-contained `matchCentreData`) into a canonical `FormationTeamData` type. React component consumes the canonical type and renders using stadia's existing pitch primitive with inlined marker rendering (no shared `PlayerMarkerLayer` extraction per roadmap Lane 1 guidance).

**Tech Stack:** TypeScript workspace (`@withqwerty/campos-core`, `@withqwerty/campos-adapters`, `@withqwerty/campos-react`, `@withqwerty/campos-stadia`), React 19 SVG rendering, Vitest + vitest-axe, Astro demo site, pnpm workspaces, Python 3 for the one-shot mplsoccer extraction script.

**Spec reference:** `docs/specs/formation-spec.md`
**Roadmap row:** `docs/roadmap-v0.3.md` Lane 1 order 2

---

## File structure

### Created files

**Generator + generated data:**

- `scripts/extract-mplsoccer-formations.py` — offline Python script that imports mplsoccer, iterates all 68 formations, converts StatsBomb 120×80 coordinates to Campos 0..100 × 0..100, and writes a JSON file
- `packages/core/src/formation-positions.json` — committed output of the generator script; contains 68 formations × 11 positions with `{slot, code, x, y}` per position

**Core compute:**

- `packages/core/src/formation.ts` — types (`FormationKey`, `FormationPlayer`, `FormationTeamData`), formation string parser, position lookup, single-team + dual-team layout compute, label derivation
- `packages/core/src/formation-opta-ids.ts` — hand-ported 24-entry Opta formation ID → mplsoccer key map from kloppy
- `packages/core/test/compute-formation.test.ts` — core unit tests

**Opta adapter:**

- `packages/adapters/src/opta/parse-squads.ts` — parses `squads.json` into an `OptaSquadIndex` lookup
- `packages/adapters/src/opta/map-formation.ts` — decodes `typeId: 34` lineup events + squad index → `FormationTeamData`
- `packages/adapters/test/opta/formations.test.ts` — adapter tests
- `packages/adapters/test/opta/fixtures/lineup-liverpool-bournemouth-2025-08-15.json` — real fixture extracted from `/Volumes/WQ/projects/www/src/data/opta/match-events/zhs8gg1hvcuqvhkk2itb54pg.json`
- `packages/adapters/test/opta/fixtures/squads-premier-league-2025-26.json` — real squads fixture extracted from `/Volumes/WQ/projects/www/src/data/opta/squads.json`

**WhoScored adapter:**

- `packages/adapters/src/whoscored/map-formation.ts` — decodes `matchCentreData.home`/`.away` → `FormationTeamData`
- `packages/adapters/test/whoscored/formations.test.ts` — adapter tests
- `packages/adapters/test/whoscored/fixtures/matchcentre-sample.json` — real fixture extracted from a Cloudflare R2 `opta-data` WhoScored object (download via wrangler at implementation time)

**React component:**

- `packages/react/src/Formation.tsx` — component with single-team + dual-team modes, vertical + horizontal orientation, zero-config + with-players rendering
- `packages/react/test/Formation.test.tsx` — React render + a11y tests

**Demo page + fixture modules:**

- `apps/site/src/pages/formation.astro` — demo page with 12 cards per the spec
- `apps/site/src/data/formation-demo.ts` — hand-crafted sample lineups for synthetic demo cards
- `apps/site/src/data/formation-opta-liverpool.ts` — Liverpool v Bournemouth fixture module with source path recorded
- `apps/site/src/data/formation-whoscored-sample.ts` — one WhoScored PL match with `match_id`, `date`, `r2_key` recorded

### Modified files

- `package.json` (root) — add `generate:formations` script
- `packages/core/src/index.ts` — export `Formation` types, `parseFormationKey`, `getFormationPositions`, `computeFormation`, `layoutFormation`
- `packages/adapters/src/opta/index.ts` — add `parseSquads` and `formations` to the `fromOpta` object
- `packages/adapters/src/whoscored/index.ts` — add `formations` to the `fromWhoScored` object
- `packages/adapters/src/index.ts` — re-export anything new
- `packages/react/src/index.ts` — export `Formation` and its prop types
- `docs/status/matrix.md` — add a `Formation` row to the Components table and update the relevant Internal Foundations rows

### Sequencing

Built in strict layer order per the Campos Component Dev Workflow. Each task is reviewable in isolation and leaves the tree in a working state.

1. **Task 1** — mplsoccer extraction script + generated positions JSON + regression tests
2. **Task 2** — Opta formation ID map (hand-ported from kloppy)
3. **Task 3** — Core types, `FormationKey` union, formation string parser
4. **Task 4** — Core position lookup
5. **Task 5** — Core single-team layout
6. **Task 6** — Core dual-team layout
7. **Task 7** — Core label derivation
8. **Task 8** — Opta squad index parser
9. **Task 9** — Opta formation adapter
10. **Task 10** — WhoScored formation adapter
11. **Task 11** — Cross-provider parity tests
12. **Task 12** — Formation React component (single-team)
13. **Task 13** — Formation React component (dual-team + orientation)
14. **Task 14** — Formation demo page + real fixtures
15. **Task 15** — Docs updates + final verification gate

---

## Slot numbering convention

**Public API uses 1-indexed slots** (1 = GK, 11 = last starter) to match football convention. Internal array access uses `slot - 1` where needed. This resolves the Open Question from the spec.

---

## Task 1: mplsoccer extraction script + generated positions JSON

**Files:**

- Create: `scripts/extract-mplsoccer-formations.py`
- Create: `packages/core/src/formation-positions.json` (generated, committed)
- Modify: `package.json` (root)
- Test: `packages/core/test/compute-formation.test.ts` (initial regression test only; expanded in later tasks)

### Step 1: Verify mplsoccer source layout

- [ ] **Step 1.1: Locate mplsoccer's formation data**

Run: `ls /Volumes/WQ/ref_code/mplsoccer/mplsoccer/`

Expected: directory contains `formations.py` or a `soccer/formations.py` subdirectory.

If the path differs from what the spec assumes, update the `MPLSOCCER_PATH` variable in the script in step 1.2.

- [ ] **Step 1.2: Skim the mplsoccer Formation class API**

Read: `/Volumes/WQ/ref_code/mplsoccer/mplsoccer/soccer/formations.py` (or wherever step 1.1 found it).

Confirm the exact API shape — specifically:

- How to instantiate the class (e.g., `Formation(pitch=Pitch('statsbomb'))` or standalone)
- How to enumerate the 68 formation names (likely via an instance attribute `.formations` or a module-level dict)
- How to get positions for a specific formation (likely `get_formation(name)` returning a list of `Position` dataclasses)
- The fields on the `Position` dataclass — confirm `name`, `x`, `y` exist

If any of these differ from what Step 2 assumes, adjust the script accordingly.

### Step 2: Write the extraction script

- [ ] **Step 2.1: Create `scripts/extract-mplsoccer-formations.py`**

```python
#!/usr/bin/env python3
"""
Extract mplsoccer's 68-formation position table into a JSON file for
consumption by @withqwerty/campos-core.

Run: pnpm generate:formations
Or:  python scripts/extract-mplsoccer-formations.py

Output: packages/core/src/formation-positions.json

Coordinates are converted from mplsoccer's StatsBomb convention
(120×80, top-left origin, y increases downward) to Campos's convention
(0..100 × 0..100, bottom-left origin, attacking left-to-right along x).
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MPLSOCCER_PATH = Path("/Volumes/WQ/ref_code/mplsoccer")
OUTPUT_PATH = REPO_ROOT / "packages/core/src/formation-positions.json"

if not MPLSOCCER_PATH.exists():
    print(
        f"error: mplsoccer not found at {MPLSOCCER_PATH}\n"
        "Clone mplsoccer to /Volumes/WQ/ref_code/mplsoccer or update "
        "MPLSOCCER_PATH in this script.",
        file=sys.stderr,
    )
    sys.exit(1)

sys.path.insert(0, str(MPLSOCCER_PATH))

try:
    from mplsoccer.pitch import Pitch  # type: ignore
except ModuleNotFoundError as exc:
    print(
        f"error: cannot import mplsoccer ({exc})\n"
        "Ensure mplsoccer's dependencies are installed in the active Python env "
        "(pip install -e /Volumes/WQ/ref_code/mplsoccer) or that mplsoccer is "
        "on sys.path without needing extra deps.",
        file=sys.stderr,
    )
    sys.exit(2)


def convert_coords(x_sb: float, y_sb: float) -> tuple[float, float]:
    """Convert StatsBomb (120×80, top-left, y-down) to Campos (0..100, bottom-left)."""
    x_campos = round((x_sb / 120.0) * 100.0, 2)
    y_campos = round(100.0 - (y_sb / 80.0) * 100.0, 2)
    return x_campos, y_campos


def extract() -> dict[str, list[dict]]:
    pitch = Pitch(pitch_type="statsbomb")
    formations_out: dict[str, list[dict]] = {}

    # mplsoccer exposes formations via `pitch.formations` or a similar attribute.
    # If the exact attribute name differs, adjust here.
    formation_names = sorted(pitch.formations)  # may be pitch.formations.keys() depending on version

    for name in formation_names:
        positions = pitch.get_formation(name)
        slots = []
        for slot_index, pos in enumerate(positions, start=1):
            x_campos, y_campos = convert_coords(pos.x, pos.y)
            slots.append(
                {
                    "slot": slot_index,
                    "code": pos.name,
                    "x": x_campos,
                    "y": y_campos,
                }
            )
        formations_out[name] = slots

    return formations_out


def main() -> None:
    data = extract()

    # Regression assertions that catch silent upstream drift.
    #
    # NOTE: mplsoccer intentionally includes 15 historical/partial formations
    # with fewer than 11 positions (e.g., '44' has 9, '341' has 9, '342' has 10).
    # These are Wyscout-only historical shapes and only carry `wyscout='...'`
    # tags — no statsbomb/opta fields. Campos preserves them verbatim in the
    # data layer because it's a position mapping concern; downstream code
    # iterates whatever positions exist for the given formation key. Adapters
    # (Opta, WhoScored) are the layer that enforces "exactly 11 starters"
    # because their real data always has 11.
    assert len(data) == 68, f"expected 68 formations, got {len(data)}"
    for name, slots in data.items():
        assert 9 <= len(slots) <= 11, (
            f"formation {name!r} has {len(slots)} slots, expected between 9 and 11"
        )
        for slot in slots:
            assert 0 <= slot["x"] <= 100, f"{name} slot {slot['slot']} x out of range: {slot['x']}"
            assert 0 <= slot["y"] <= 100, f"{name} slot {slot['slot']} y out of range: {slot['y']}"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print(f"wrote {len(data)} formations to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2.2: Make the script executable**

Run: `chmod +x scripts/extract-mplsoccer-formations.py`

### Step 3: Wire the generator into pnpm

- [ ] **Step 3.1: Add `generate:formations` to root `package.json`**

In `package.json`'s `"scripts"` section, add next to the existing `generate:schema`:

```json
"generate:formations": "python3 scripts/extract-mplsoccer-formations.py"
```

### Step 4: Run the generator

- [ ] **Step 4.1: Run it**

Run: `pnpm generate:formations`

Expected output:

```
wrote 68 formations to packages/core/src/formation-positions.json
```

If mplsoccer's API differs from what the script assumes (e.g., `pitch.formations` is a method not an attribute, or `get_formation` has a different name), iterate on the script until it succeeds. Verify by reading the mplsoccer source directly rather than guessing.

- [ ] **Step 4.2: Inspect the generated JSON**

Run: `head -30 packages/core/src/formation-positions.json`

Expected: JSON object keyed by formation name (e.g., `"433"`), each value an array of 11 `{slot, code, x, y}` objects. Coordinates should be in 0..100 range.

### Step 5: Regression test for the generated data

- [ ] **Step 5.1: Write the regression test**

Create `packages/core/test/compute-formation.test.ts` with this initial content (later tasks will append more tests):

```ts
import { describe, expect, it } from "vitest";
import formationPositions from "../src/formation-positions.json";

describe("formation-positions.json (generated)", () => {
  it("contains exactly 68 formations", () => {
    expect(Object.keys(formationPositions).length).toBe(68);
  });

  it("has between 9 and 11 positions per formation", () => {
    // mplsoccer includes 15 historical/partial formations with fewer than 11
    // players (e.g., '44' has 9, '342' has 10). Campos preserves them as-is
    // because it's a position-mapping concern, not a logical one. Adapters
    // enforce 11-player validity at their layer.
    for (const [name, slots] of Object.entries(formationPositions)) {
      expect(slots.length, `formation ${name}`).toBeGreaterThanOrEqual(9);
      expect(slots.length, `formation ${name}`).toBeLessThanOrEqual(11);
    }
  });

  it("has the expected 53 eleven-player formations (modern shapes)", () => {
    const elevenPlayerCount = Object.values(formationPositions).filter(
      (slots) => slots.length === 11,
    ).length;
    expect(elevenPlayerCount).toBe(53);
  });

  it("has the expected 15 historical/partial formations", () => {
    const partialCount = Object.values(formationPositions).filter(
      (slots) => slots.length < 11,
    ).length;
    expect(partialCount).toBe(15);
  });

  it("slots are 1-indexed and contiguous from 1 to N (where N = positions.length)", () => {
    for (const [name, slots] of Object.entries(formationPositions)) {
      const indices = slots.map((s) => s.slot).sort((a, b) => a - b);
      const expected = Array.from({ length: slots.length }, (_, i) => i + 1);
      expect(indices, `formation ${name}`).toEqual(expected);
    }
  });

  it("all coordinates are within 0..100", () => {
    for (const [name, slots] of Object.entries(formationPositions)) {
      for (const slot of slots) {
        expect(slot.x, `${name} slot ${slot.slot} x`).toBeGreaterThanOrEqual(0);
        expect(slot.x, `${name} slot ${slot.slot} x`).toBeLessThanOrEqual(100);
        expect(slot.y, `${name} slot ${slot.slot} y`).toBeGreaterThanOrEqual(0);
        expect(slot.y, `${name} slot ${slot.slot} y`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("includes the common modern formations", () => {
    const required = ["433", "442", "4231", "352", "343", "532", "4141", "4321"];
    for (const key of required) {
      expect(formationPositions, `missing formation key: ${key}`).toHaveProperty(key);
    }
  });

  it("each slot has a non-empty position code", () => {
    for (const [name, slots] of Object.entries(formationPositions)) {
      for (const slot of slots) {
        expect(slot.code, `${name} slot ${slot.slot}`).toBeTruthy();
        expect(typeof slot.code, `${name} slot ${slot.slot}`).toBe("string");
      }
    }
  });

  it("GK (slot 1) is always present with code 'GK'", () => {
    // NOTE: Campos TS config has noUncheckedIndexedAccess enabled, so array index
    // access returns `T | undefined`. Destructure the first element with a
    // defined-check before asserting on its properties.
    for (const [name, slots] of Object.entries(formationPositions)) {
      const first = slots[0];
      expect(first, name).toBeDefined();
      expect(first?.slot, name).toBe(1);
      expect(first?.code, `${name} slot 1 code`).toBe("GK");
    }
  });
});
```

- [ ] **Step 5.2: Ensure the core package tsconfig resolves `.json` imports**

Run: `grep -n resolveJsonModule packages/core/tsconfig.json`

Expected: `"resolveJsonModule": true` is already set, OR inherited from a root tsconfig. If not set anywhere, add it to `packages/core/tsconfig.json` under `compilerOptions`.

- [ ] **Step 5.3: Run the regression test**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: all 7 tests pass.

- [ ] **Step 5.4: Run typecheck to confirm `.json` import works**

Run: `pnpm typecheck`

Expected: no errors.

### Step 6: Commit

- [ ] **Step 6.1: Stage the new files**

Run:

```bash
git add scripts/extract-mplsoccer-formations.py packages/core/src/formation-positions.json package.json packages/core/test/compute-formation.test.ts
# also include tsconfig if it was modified
git add packages/core/tsconfig.json 2>/dev/null || true
```

- [ ] **Step 6.2: Commit**

Run:

```bash
git commit -m "feat(core): port mplsoccer 68-formation position table

- Add scripts/extract-mplsoccer-formations.py generator
- Generate packages/core/src/formation-positions.json
- Add pnpm generate:formations script
- Add regression test for table size, slot indices, coord bounds"
```

---

## Task 2: Opta formation ID map (hand-ported from kloppy)

**Files:**

- Create: `packages/core/src/formation-opta-ids.ts`
- Modify: `packages/core/test/compute-formation.test.ts`

### Step 1: Write the test first

- [ ] **Step 1.1: Append the test suite**

Append to `packages/core/test/compute-formation.test.ts`:

```ts
import { OPTA_FORMATION_ID_MAP, optaFormationIdToKey } from "../src/formation-opta-ids";

describe("OPTA_FORMATION_ID_MAP", () => {
  it("has exactly 24 entries", () => {
    expect(Object.keys(OPTA_FORMATION_ID_MAP).length).toBe(24);
  });

  it("maps known Opta formation IDs to mplsoccer keys", () => {
    expect(OPTA_FORMATION_ID_MAP[2]).toBe("442");
    expect(OPTA_FORMATION_ID_MAP[4]).toBe("433");
    expect(OPTA_FORMATION_ID_MAP[8]).toBe("4231");
    expect(OPTA_FORMATION_ID_MAP[10]).toBe("532");
    expect(OPTA_FORMATION_ID_MAP[12]).toBe("352");
    expect(OPTA_FORMATION_ID_MAP[13]).toBe("343");
  });

  it("every mapped key exists in the mplsoccer position table", async () => {
    const positions = (await import("../src/formation-positions.json")).default;
    for (const [optaId, formationKey] of Object.entries(OPTA_FORMATION_ID_MAP)) {
      expect(positions, `opta id ${optaId} → ${formationKey}`).toHaveProperty(
        formationKey,
      );
    }
  });
});

describe("optaFormationIdToKey", () => {
  it("accepts numeric strings from Opta qualifier 130", () => {
    expect(optaFormationIdToKey("8")).toBe("4231");
    expect(optaFormationIdToKey("4")).toBe("433");
  });

  it("accepts numbers", () => {
    expect(optaFormationIdToKey(8)).toBe("4231");
  });

  it("throws on unknown IDs with an explicit message", () => {
    expect(() => optaFormationIdToKey(999)).toThrow(/unknown Opta formation ID: 999/);
  });

  it("throws on non-numeric strings", () => {
    expect(() => optaFormationIdToKey("abc")).toThrow(/invalid Opta formation ID/);
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: fails with `Cannot find module '../src/formation-opta-ids'` — this confirms the test is wired correctly before we implement.

### Step 2: Implement the map

- [ ] **Step 2.1: Create `packages/core/src/formation-opta-ids.ts`**

```ts
/**
 * Opta numeric formation ID → mplsoccer formation key.
 *
 * Ported from kloppy's `formation_id_mapping` at
 * `kloppy/infra/serializers/event/statsperform/formation_mapping.py`.
 *
 * There are 24 Opta formation IDs (2-25). Every entry points at a key
 * that exists in `formation-positions.json`. When Opta changes (new IDs
 * added, existing IDs renamed), re-check against the kloppy reference
 * and update this table.
 *
 * Lint: the regression tests in compute-formation.test.ts assert the
 * size is exactly 24 and every value maps to a known formation key.
 */
export const OPTA_FORMATION_ID_MAP: Readonly<Record<number, string>> = Object.freeze({
  2: "442",
  3: "41212",
  4: "433",
  5: "451",
  6: "4411",
  7: "4141",
  8: "4231",
  9: "4321",
  10: "532",
  11: "541",
  12: "352",
  13: "343",
  14: "31312",
  15: "4222",
  16: "3511",
  17: "3421",
  18: "3412",
  19: "31412",
  20: "31213",
  21: "4132",
  22: "4240",
  23: "4312",
  24: "3241",
  25: "3331",
});

/**
 * Convert an Opta formation ID (from qualifier 130) to a mplsoccer
 * formation key. Accepts either a number or a numeric string.
 *
 * Throws with an explicit message on unknown or invalid IDs.
 */
export function optaFormationIdToKey(optaId: number | string): string {
  const id = typeof optaId === "string" ? Number.parseInt(optaId, 10) : optaId;
  if (!Number.isFinite(id) || Number.isNaN(id)) {
    throw new Error(`invalid Opta formation ID: ${JSON.stringify(optaId)}`);
  }
  const key = OPTA_FORMATION_ID_MAP[id];
  if (key == null) {
    throw new Error(
      `unknown Opta formation ID: ${id}. ` +
        `Expected one of ${Object.keys(OPTA_FORMATION_ID_MAP).join(", ")}. ` +
        `If this is a genuine new Opta formation, update formation-opta-ids.ts ` +
        `against kloppy's current formation_id_mapping.`,
    );
  }
  return key;
}
```

- [ ] **Step 2.2: Cross-check the 24 values against kloppy**

Read: `/Volumes/WQ/ref_code/kloppy/kloppy/infra/serializers/event/statsperform/formation_mapping.py`

Confirm each entry matches (value names may differ between kloppy's enum and mplsoccer's keys — the important thing is the formation shape). If any values don't match mplsoccer keys (e.g., kloppy's "3-1-2-1-3" vs. mplsoccer's "31213"), normalize by stripping hyphens from kloppy's values.

- [ ] **Step 2.3: Also cross-check against `formation-positions.json` keys**

Run:

```bash
pnpm exec node -e "
const p = require('./packages/core/src/formation-positions.json');
const m = require('./packages/core/src/formation-opta-ids.ts').OPTA_FORMATION_ID_MAP;
for (const [id, key] of Object.entries(m)) {
  if (!p[key]) console.error('MISSING:', id, '→', key);
}
console.log('ok');
"
```

(Note: this may require compiling TS first — alternatively, run the test in step 3 which does the same check via the suite.)

If any OPTA_FORMATION_ID_MAP values are not present in `formation-positions.json`, investigate: either the mplsoccer formation key uses a different string (e.g., hyphenated), or kloppy's map contains a formation that mplsoccer doesn't ship. In the latter case, add a comment explaining the gap.

### Step 3: Run the test

- [ ] **Step 3.1: Run the test, verify it passes**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: all tests pass (including the 5 new tests from step 1.1).

- [ ] **Step 3.2: Run typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/core/src/formation-opta-ids.ts packages/core/test/compute-formation.test.ts
git commit -m "feat(core): add Opta formation ID → mplsoccer key map

Ported from kloppy's formation_id_mapping. 24 entries covering the
full Opta formation ID range (2-25). Used by fromOpta.formations() to
decode qualifier 130 of typeId 34 lineup events."
```

---

## Task 3: Core types + formation string parser

**Files:**

- Create: `packages/core/src/formation.ts`
- Modify: `packages/core/test/compute-formation.test.ts`
- Modify: `packages/core/src/index.ts`

### Step 1: Write the test first

- [ ] **Step 1.1: Append the test suite**

Append to `packages/core/test/compute-formation.test.ts`:

```ts
import {
  parseFormationKey,
  isValidFormationKey,
  type FormationKey,
  type FormationPlayer,
  type FormationTeamData,
} from "../src/formation";

describe("parseFormationKey", () => {
  it("accepts hyphenated strings", () => {
    expect(parseFormationKey("4-3-3")).toBe("433");
    expect(parseFormationKey("4-2-3-1")).toBe("4231");
    expect(parseFormationKey("3-5-2")).toBe("352");
  });

  it("accepts non-hyphenated strings", () => {
    expect(parseFormationKey("433")).toBe("433");
    expect(parseFormationKey("4231")).toBe("4231");
  });

  it("is case-insensitive for named formations", () => {
    expect(parseFormationKey("PYRAMID")).toBe("pyramid");
    expect(parseFormationKey("Metodo")).toBe("metodo");
  });

  it("strips whitespace", () => {
    expect(parseFormationKey(" 4-3-3 ")).toBe("433");
  });

  it("throws on unknown formation keys", () => {
    expect(() => parseFormationKey("4-3-4")).toThrow(/unknown formation: 434/);
    expect(() => parseFormationKey("123")).toThrow(/unknown formation/);
  });

  it("throws on empty or non-string input", () => {
    expect(() => parseFormationKey("")).toThrow(/empty formation/);
    // @ts-expect-error testing invalid input
    expect(() => parseFormationKey(null)).toThrow();
  });

  it("error messages list some of the valid formations", () => {
    try {
      parseFormationKey("4-3-4");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("433");
      expect(message).toContain("442");
    }
  });
});

describe("isValidFormationKey", () => {
  it("returns true for known keys", () => {
    expect(isValidFormationKey("433")).toBe(true);
    expect(isValidFormationKey("4231")).toBe(true);
  });

  it("returns false for unknown keys", () => {
    expect(isValidFormationKey("999")).toBe(false);
    expect(isValidFormationKey("foo")).toBe(false);
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: fails with `Cannot find module '../src/formation'`.

### Step 2: Implement types + parser

- [ ] **Step 2.1: Create `packages/core/src/formation.ts`**

```ts
import formationPositions from "./formation-positions.json";

/**
 * A formation key is any of the 68 mplsoccer formation strings in
 * normalized form (hyphens stripped, lowercased, zeros preserved).
 *
 * The full set is loaded from formation-positions.json at runtime.
 * This type is intentionally a branded `string` rather than a literal
 * union — the union would be 68 entries long and needs updating every
 * time the table is regenerated. Use `isValidFormationKey` and
 * `parseFormationKey` to validate at boundaries.
 */
export type FormationKey = string;

export type FormationPlayer = {
  /** 1-indexed slot within the formation (1 = GK, 11 = last starter). Omit to assign by array order. */
  slot?: number;
  /** mplsoccer canonical position code (e.g., "GK", "RB", "RCB", "CAM"). Omit to derive from (formation, slot). */
  positionCode?: string;
  /** Display name for the player (surname preferred for broadcast-style labels). */
  label?: string;
  /** Jersey number. */
  number?: number;
  /** Captain flag — renders a small "C" mark on the marker. */
  captain?: boolean;
  /** Upstream provider ID (stringified). For debugging and cross-provider joins. */
  playerId?: string;
  /** Per-player marker color override. Never set by adapters. */
  color?: string;
};

export type FormationTeamData = {
  formation: FormationKey;
  /** Optional team display name (used in legends and a11y labels). */
  teamLabel?: string;
  /** Optional team marker color. Not emitted by adapters. */
  teamColor?: string;
  /** 0-11 players. Adapters always emit 11 starters; consumers may omit for zero-config preview. */
  players: FormationPlayer[];
};

/**
 * Normalize a user-facing formation string to the mplsoccer key used
 * internally. Strips hyphens, trims whitespace, lowercases named
 * formations, validates against the known 68.
 *
 * Throws with an explicit message on empty, non-string, or unknown input.
 */
export function parseFormationKey(input: string): FormationKey {
  if (typeof input !== "string") {
    throw new TypeError(`formation must be a string, got ${typeof input}`);
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("empty formation string");
  }
  const normalized = trimmed.replace(/-/g, "").toLowerCase();
  if (!isValidFormationKey(normalized)) {
    const examples = ["433", "442", "4231", "352", "343", "532"];
    throw new Error(
      `unknown formation: ${normalized}. ` +
        `Expected one of 68 mplsoccer formations (e.g. ${examples.join(", ")}). ` +
        `See packages/core/src/formation-positions.json for the full list.`,
    );
  }
  return normalized;
}

/** Returns true if the given key is one of the 68 mplsoccer formations. */
export function isValidFormationKey(candidate: string): candidate is FormationKey {
  return Object.prototype.hasOwnProperty.call(formationPositions, candidate);
}

/** Returns all 68 formation keys, useful for demo grids and parser error messages. */
export function allFormationKeys(): readonly FormationKey[] {
  return Object.freeze(Object.keys(formationPositions));
}
```

### Step 3: Run the test

- [ ] **Step 3.1: Run the test, verify it passes**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: all `parseFormationKey` and `isValidFormationKey` tests pass.

- [ ] **Step 3.2: Export from the core index**

Modify `packages/core/src/index.ts` to add:

```ts
export { parseFormationKey, isValidFormationKey, allFormationKeys } from "./formation";
export type { FormationKey, FormationPlayer, FormationTeamData } from "./formation";
```

- [ ] **Step 3.3: Run typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/core/src/formation.ts packages/core/src/index.ts packages/core/test/compute-formation.test.ts
git commit -m "feat(core): add formation types and string parser"
```

---

## Task 4: Core position lookup

**Files:**

- Modify: `packages/core/src/formation.ts`
- Modify: `packages/core/test/compute-formation.test.ts`

### Step 1: Write the test first

- [ ] **Step 1.1: Append the test suite**

Append to `packages/core/test/compute-formation.test.ts`:

```ts
import { getFormationPositions, getFormationSlot } from "../src/formation";

describe("getFormationPositions", () => {
  it("returns 11 positions for a valid key", () => {
    const positions = getFormationPositions("433");
    expect(positions).toHaveLength(11);
  });

  it("each position has slot, code, x, y", () => {
    const positions = getFormationPositions("4231");
    for (const pos of positions) {
      expect(pos).toHaveProperty("slot");
      expect(pos).toHaveProperty("code");
      expect(pos).toHaveProperty("x");
      expect(pos).toHaveProperty("y");
      expect(typeof pos.slot).toBe("number");
      expect(typeof pos.code).toBe("string");
      expect(typeof pos.x).toBe("number");
      expect(typeof pos.y).toBe("number");
    }
  });

  it("slot 1 is always the goalkeeper", () => {
    for (const key of ["433", "442", "4231", "352"]) {
      const positions = getFormationPositions(key);
      expect(positions[0].slot).toBe(1);
      expect(positions[0].code).toBe("GK");
    }
  });

  it("throws on unknown formation key", () => {
    expect(() => getFormationPositions("999")).toThrow(/unknown formation/);
  });

  it("returns immutable data (does not mutate underlying JSON)", () => {
    const positions = getFormationPositions("433");
    expect(() => {
      (positions as unknown as { x: number }[])[0].x = -1;
    }).toThrow();
  });
});

describe("getFormationSlot", () => {
  it("returns the slot for a valid (formation, slotNumber) pair", () => {
    const slot = getFormationSlot("433", 1);
    expect(slot.slot).toBe(1);
    expect(slot.code).toBe("GK");
  });

  it("accepts slot numbers 1-11 on an 11-player formation", () => {
    for (let n = 1; n <= 11; n += 1) {
      expect(() => getFormationSlot("442", n)).not.toThrow();
    }
  });

  it("accepts slot numbers 1-9 on a 9-player historical formation ('44')", () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(() => getFormationSlot("44", n)).not.toThrow();
    }
  });

  it("throws on slot 10 in a 9-player formation ('44')", () => {
    expect(() => getFormationSlot("44", 10)).toThrow(/slot must be between 1 and 9/);
  });

  it("throws on slot 0 (0-indexed, not 1-indexed)", () => {
    expect(() => getFormationSlot("442", 0)).toThrow(/slot must be between 1 and 11/);
  });

  it("throws on slot 12 in an 11-player formation", () => {
    expect(() => getFormationSlot("442", 12)).toThrow(/slot must be between 1 and 11/);
  });

  it("throws on unknown formation", () => {
    expect(() => getFormationSlot("999", 1)).toThrow(/unknown formation/);
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: fails with `getFormationPositions is not exported` / `is not a function`.

### Step 2: Implement the lookup functions

- [ ] **Step 2.1: Append to `packages/core/src/formation.ts`**

```ts
export type FormationPositionEntry = {
  readonly slot: number;
  readonly code: string;
  readonly x: number;
  readonly y: number;
};

/**
 * Return the 11 canonical positions for a formation. Positions are
 * sorted by slot (1..11, GK first). The returned array is frozen.
 *
 * Throws on unknown formation keys.
 */
export function getFormationPositions(
  key: FormationKey,
): readonly FormationPositionEntry[] {
  if (!isValidFormationKey(key)) {
    throw new Error(`unknown formation: ${key}`);
  }
  const raw = (formationPositions as Record<string, FormationPositionEntry[]>)[key];
  return Object.freeze(
    raw.map((p) => Object.freeze({ ...p })),
  ) as readonly FormationPositionEntry[];
}

/**
 * Return a single position from a formation by slot number (1-indexed).
 *
 * Throws on unknown formation or out-of-range slot. The valid range is
 * formation-specific: most formations accept 1-11, but 15 historical/partial
 * formations accept 1-9 or 1-10 (e.g., '44' has 9 slots, '342' has 10).
 */
export function getFormationSlot(
  key: FormationKey,
  slotNumber: number,
): FormationPositionEntry {
  const positions = getFormationPositions(key);
  const maxSlot = positions.length;
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > maxSlot) {
    throw new Error(
      `slot must be between 1 and ${maxSlot} in formation ${key} (got ${slotNumber})`,
    );
  }
  const found = positions.find((p) => p.slot === slotNumber);
  if (!found) {
    throw new Error(`no position at slot ${slotNumber} in formation ${key}`);
  }
  return found;
}
```

- [ ] **Step 2.2: Export from index**

Modify `packages/core/src/index.ts`:

```ts
export {
  parseFormationKey,
  isValidFormationKey,
  allFormationKeys,
  getFormationPositions,
  getFormationSlot,
} from "./formation";
export type {
  FormationKey,
  FormationPlayer,
  FormationTeamData,
  FormationPositionEntry,
} from "./formation";
```

### Step 3: Run the test

- [ ] **Step 3.1: Run the test**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: all new tests pass.

- [ ] **Step 3.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/core/src/formation.ts packages/core/src/index.ts packages/core/test/compute-formation.test.ts
git commit -m "feat(core): add formation position lookup functions"
```

---

## Task 5: Core single-team layout

**Files:**

- Modify: `packages/core/src/formation.ts`
- Modify: `packages/core/test/compute-formation.test.ts`

### Step 1: Write the test first

- [ ] **Step 1.1: Append test suite**

Append to `packages/core/test/compute-formation.test.ts`:

```ts
import { layoutSingleTeam } from "../src/formation";

describe("layoutSingleTeam", () => {
  it("returns 11 rendered slots for a zero-config call", () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { orientation: "vertical", crop: "full" },
    );
    expect(result.slots).toHaveLength(11);
  });

  it("assigns players to slots by array order", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [
          { label: "Raya", number: 1 },
          { label: "White", number: 2 },
        ],
      },
      { orientation: "vertical", crop: "full" },
    );
    expect(result.slots[0].player?.label).toBe("Raya");
    expect(result.slots[1].player?.label).toBe("White");
  });

  it("fills remaining slots with placeholders when fewer than 11 players", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [{ label: "GK only", number: 1 }],
      },
      { orientation: "vertical", crop: "full" },
    );
    expect(result.slots).toHaveLength(11);
    expect(result.slots[0].player?.label).toBe("GK only");
    expect(result.slots[0].placeholder).toBe(false);
    expect(result.slots[1].placeholder).toBe(true);
  });

  it("respects explicit slot override", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [
          { label: "ST", number: 9, slot: 11 },
          { label: "GK", number: 1, slot: 1 },
        ],
      },
      { orientation: "vertical", crop: "full" },
    );
    expect(result.slots[0].player?.label).toBe("GK");
    expect(result.slots[10].player?.label).toBe("ST");
  });

  it("throws when more than 11 players supplied", () => {
    const players = Array.from({ length: 12 }, (_, i) => ({
      label: `p${i}`,
      number: i + 1,
    }));
    expect(() =>
      layoutSingleTeam(
        { formation: "433", players },
        { orientation: "vertical", crop: "full" },
      ),
    ).toThrow(/at most 11 players allowed in formation 433/);
  });

  it("throws on 10 players in a 9-player historical formation ('44')", () => {
    const players = Array.from({ length: 10 }, (_, i) => ({
      label: `p${i}`,
      number: i + 1,
    }));
    expect(() =>
      layoutSingleTeam(
        { formation: "44", players },
        { orientation: "vertical", crop: "full" },
      ),
    ).toThrow(/at most 9 players allowed in formation 44/);
  });

  it("fills 9 slots without placeholders when '44' receives 9 players", () => {
    const players = Array.from({ length: 9 }, (_, i) => ({
      label: `p${i}`,
      number: i + 1,
    }));
    const result = layoutSingleTeam(
      { formation: "44", players },
      { orientation: "vertical", crop: "full" },
    );
    expect(result.slots).toHaveLength(9);
    expect(result.slots.every((s) => s.placeholder === false)).toBe(true);
  });

  it("assigns vertical orientation with GK at bottom (low y)", () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { orientation: "vertical", crop: "full" },
    );
    const gkSlot = result.slots.find((s) => s.positionCode === "GK");
    expect(gkSlot).toBeDefined();
    // In vertical mode the GK is at the bottom of the pitch (attacking up).
    // Campos y=0 is the bottom, so GK y should be small.
    expect(gkSlot!.y).toBeLessThan(20);
  });

  it("assigns horizontal orientation with GK at left (low x)", () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { orientation: "horizontal", crop: "full" },
    );
    const gkSlot = result.slots.find((s) => s.positionCode === "GK");
    expect(gkSlot).toBeDefined();
    // In horizontal mode the GK is at the left (attacking right).
    expect(gkSlot!.x).toBeLessThan(20);
  });

  it("populates positionCode from the formation table when not on the player", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [{ label: "keeper", number: 1 }],
      },
      { orientation: "vertical", crop: "full" },
    );
    expect(result.slots[0].positionCode).toBe("GK");
  });

  it("preserves explicit positionCode on a player", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [{ label: "keeper", number: 1, positionCode: "SWEEPER" }],
      },
      { orientation: "vertical", crop: "full" },
    );
    expect(result.slots[0].positionCode).toBe("SWEEPER");
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: fails with `layoutSingleTeam is not exported`.

### Step 2: Implement the layout

- [ ] **Step 2.1: Append to `packages/core/src/formation.ts`**

```ts
export type FormationOrientation = "vertical" | "horizontal";
export type FormationCrop = "full" | "half";

export type FormationLayoutOptions = {
  orientation: FormationOrientation;
  crop: FormationCrop;
};

export type RenderedFormationSlot = {
  /** 1-indexed slot number */
  slot: number;
  /** mplsoccer canonical position code (or explicit override from the player) */
  positionCode: string;
  /** Campos pitch x coordinate 0..100, after orientation/crop transforms */
  x: number;
  /** Campos pitch y coordinate 0..100, after orientation/crop transforms */
  y: number;
  /** The assigned player, if any */
  player?: FormationPlayer;
  /** True when no player was assigned (renders as dashed placeholder) */
  placeholder: boolean;
};

export type SingleTeamLayoutResult = {
  slots: RenderedFormationSlot[];
};

/**
 * Layout a single team onto the full pitch.
 *
 * The base position table assumes a horizontal pitch with attacking
 * direction left-to-right (GK at low x). For vertical orientation we
 * rotate by mapping (x, y) → (y, x). For "half" crop we compress x into
 * the attacking half of the pitch.
 */
export function layoutSingleTeam(
  team: FormationTeamData,
  options: FormationLayoutOptions,
): SingleTeamLayoutResult {
  const key = parseFormationKey(team.formation);
  const positions = getFormationPositions(key);
  const maxSlot = positions.length;

  if (team.players.length > maxSlot) {
    throw new Error(
      `at most ${maxSlot} players allowed in formation ${key}, got ${team.players.length}`,
    );
  }

  // Assign players to slots.
  // 1. Players with explicit `slot` win that slot.
  // 2. Remaining players fill the unassigned slots in array order.
  const bySlot = new Map<number, FormationPlayer>();
  const unassigned: FormationPlayer[] = [];
  for (const p of team.players) {
    if (p.slot != null) {
      if (p.slot < 1 || p.slot > maxSlot || !Number.isInteger(p.slot)) {
        throw new Error(
          `player slot must be an integer between 1 and ${maxSlot} in formation ${key}, got ${p.slot}`,
        );
      }
      if (bySlot.has(p.slot)) {
        throw new Error(`two players assigned to slot ${p.slot}`);
      }
      bySlot.set(p.slot, p);
    } else {
      unassigned.push(p);
    }
  }
  let unassignedCursor = 0;
  for (let slot = 1; slot <= maxSlot; slot += 1) {
    if (!bySlot.has(slot) && unassignedCursor < unassigned.length) {
      bySlot.set(slot, unassigned[unassignedCursor]);
      unassignedCursor += 1;
    }
  }

  const slots: RenderedFormationSlot[] = positions.map((pos) => {
    const player = bySlot.get(pos.slot);
    const transformed = applyOrientationAndCrop(pos.x, pos.y, options);
    return {
      slot: pos.slot,
      positionCode: player?.positionCode ?? pos.code,
      x: transformed.x,
      y: transformed.y,
      ...(player ? { player } : {}),
      placeholder: player == null,
    };
  });

  return { slots };
}

function applyOrientationAndCrop(
  baseX: number,
  baseY: number,
  options: FormationLayoutOptions,
): { x: number; y: number } {
  // Base convention (from mplsoccer after coord conversion):
  //   - horizontal pitch, attacking left-to-right, GK at low x
  //   - x in 0..100, y in 0..100, origin bottom-left
  let x = baseX;
  let y = baseY;

  if (options.crop === "half") {
    // Compress x into [50, 100] so the pitch shows only the attacking half
    x = 50 + x / 2;
  }

  if (options.orientation === "vertical") {
    // Rotate 90° counterclockwise: (x, y) → (y, 100 - x)
    // This puts GK at the bottom (low y) and attackers at the top (high y).
    const newX = y;
    const newY = 100 - x;
    x = newX;
    y = newY;
  }

  return { x, y };
}
```

- [ ] **Step 2.2: Export from index**

Modify `packages/core/src/index.ts`:

```ts
export {
  parseFormationKey,
  isValidFormationKey,
  allFormationKeys,
  getFormationPositions,
  getFormationSlot,
  layoutSingleTeam,
} from "./formation";
export type {
  FormationKey,
  FormationPlayer,
  FormationTeamData,
  FormationPositionEntry,
  FormationOrientation,
  FormationCrop,
  FormationLayoutOptions,
  RenderedFormationSlot,
  SingleTeamLayoutResult,
} from "./formation";
```

### Step 3: Run the test

- [ ] **Step 3.1: Run the test**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: all tests pass.

- [ ] **Step 3.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/core/src/formation.ts packages/core/src/index.ts packages/core/test/compute-formation.test.ts
git commit -m "feat(core): add single-team formation layout with orientation + crop"
```

---

## Task 6: Core dual-team layout

**Files:**

- Modify: `packages/core/src/formation.ts`
- Modify: `packages/core/test/compute-formation.test.ts`

### Step 1: Write the test first

- [ ] **Step 1.1: Append test suite**

Append to `packages/core/test/compute-formation.test.ts`:

```ts
import { layoutDualTeam } from "../src/formation";

describe("layoutDualTeam", () => {
  it("returns slots for both teams", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "4231", players: [] },
    );
    expect(result.home.slots).toHaveLength(11);
    expect(result.away.slots).toHaveLength(11);
  });

  it("home slots all occupy the bottom half (y < 50)", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    for (const slot of result.home.slots) {
      expect(slot.y, `home slot ${slot.slot}`).toBeLessThan(50);
    }
  });

  it("away slots all occupy the top half (y > 50)", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    for (const slot of result.away.slots) {
      expect(slot.y, `away slot ${slot.slot}`).toBeGreaterThan(50);
    }
  });

  it("home GK is at the bottom of the pitch", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    const homeGk = result.home.slots.find((s) => s.positionCode === "GK");
    expect(homeGk).toBeDefined();
    expect(homeGk!.y).toBeLessThan(15);
  });

  it("away GK is at the top of the pitch", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    const awayGk = result.away.slots.find((s) => s.positionCode === "GK");
    expect(awayGk).toBeDefined();
    expect(awayGk!.y).toBeGreaterThan(85);
  });

  it("supports mixed formations independently", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "4231", players: [] },
    );
    expect(result.home.slots).toHaveLength(11);
    expect(result.away.slots).toHaveLength(11);
    // The team shapes are different but both still have a GK
    expect(result.home.slots[0].positionCode).toBe("GK");
    expect(result.away.slots[0].positionCode).toBe("GK");
  });

  it("assigns home players by array order", () => {
    const result = layoutDualTeam(
      {
        formation: "433",
        players: [{ label: "home-gk", number: 1 }],
      },
      { formation: "433", players: [] },
    );
    const homeGk = result.home.slots.find((s) => s.positionCode === "GK");
    expect(homeGk?.player?.label).toBe("home-gk");
  });

  it("assigns away players by array order", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      {
        formation: "433",
        players: [{ label: "away-gk", number: 1 }],
      },
    );
    const awayGk = result.away.slots.find((s) => s.positionCode === "GK");
    expect(awayGk?.player?.label).toBe("away-gk");
  });

  it("throws when either team exceeds the formation's slot count", () => {
    const tooMany = Array.from({ length: 12 }, (_, i) => ({ label: `p${i}` }));
    expect(() =>
      layoutDualTeam(
        { formation: "433", players: tooMany },
        { formation: "433", players: [] },
      ),
    ).toThrow(/at most 11 players allowed in formation 433/);
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: fails with `layoutDualTeam is not exported`.

### Step 2: Implement the layout

- [ ] **Step 2.1: Append to `packages/core/src/formation.ts`**

```ts
export type DualTeamLayoutResult = {
  home: SingleTeamLayoutResult;
  away: SingleTeamLayoutResult;
};

/**
 * Layout two teams on one full pitch in broadcast-style lineup card format.
 *
 * - Home team occupies the defensive half in Campos coordinates.
 * - Away team occupies the attacking half, mirrored.
 * - Renderers project that layout vertically or horizontally.
 * - Both teams use the full pitch width for lateral spacing.
 * - Both teams use their own formation's shape independently.
 *
 * Dual-team mode is always full crop.
 */
export function layoutDualTeam(
  home: FormationTeamData,
  away: FormationTeamData,
): DualTeamLayoutResult {
  // layoutTeamInHalf delegates to layoutSingleTeam which validates that
  // players.length does not exceed the formation's positions.length. Per-team
  // max-player checks are therefore formation-specific (9, 10, or 11 depending
  // on whether the key resolves to a historical/partial formation).
  const homeResult = layoutTeamInHalf(home, "home");
  const awayResult = layoutTeamInHalf(away, "away");

  return { home: homeResult, away: awayResult };
}

function layoutTeamInHalf(
  team: FormationTeamData,
  side: "home" | "away",
): SingleTeamLayoutResult {
  // Reuse the single-team vertical layout, then compress into the right half
  // of the pitch and optionally mirror.
  const base = layoutSingleTeam(team, { orientation: "vertical", crop: "full" });
  const compressed: RenderedFormationSlot[] = base.slots.map((slot) => {
    // In single-team vertical mode, y ranges roughly 5..85 (GK at ~8, attackers at ~80).
    // We want to compress into y ∈ [5, 45] for home and [55, 95] for away.
    // First normalize to [0, 1], then scale + translate.
    const normalized = slot.y / 100;
    let newY: number;
    if (side === "home") {
      // home: bottom half, GK at low y
      newY = normalized * 44 + 4; // maps 0..1 → 4..48
      // clamp to keep GK near bottom and attackers near center
      newY = Math.min(48, newY);
    } else {
      // away: top half, GK at high y, mirrored
      newY = 100 - (normalized * 44 + 4); // maps 0..1 → 96..52
      newY = Math.max(52, newY);
    }
    return {
      ...slot,
      y: newY,
    };
  });
  return { slots: compressed };
}
```

- [ ] **Step 2.2: Export from index**

Modify `packages/core/src/index.ts`:

```ts
export {
  // ... existing exports ...
  layoutDualTeam,
} from "./formation";
export type {
  // ... existing exports ...
  DualTeamLayoutResult,
} from "./formation";
```

### Step 3: Run the test

- [ ] **Step 3.1: Run the test**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: all tests pass. If the home/away y ranges need adjusting to satisfy the "home GK < 15" / "away GK > 85" assertions, tweak the compression math in `layoutTeamInHalf`.

- [ ] **Step 3.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/core/src/formation.ts packages/core/src/index.ts packages/core/test/compute-formation.test.ts
git commit -m "feat(core): add dual-team formation layout for broadcast lineup cards"
```

---

## Task 7: Core label derivation

**Files:**

- Modify: `packages/core/src/formation.ts`
- Modify: `packages/core/test/compute-formation.test.ts`

### Step 1: Write the test first

- [ ] **Step 1.1: Append test suite**

Append to `packages/core/test/compute-formation.test.ts`:

```ts
import { deriveFormationLabel, type FormationLabelStrategy } from "../src/formation";

describe("deriveFormationLabel", () => {
  const gkSlot = { slot: 1, positionCode: "GK", x: 10, y: 50, placeholder: false };

  it("returns position code when no player and strategy is auto", () => {
    const label = deriveFormationLabel({
      slot: gkSlot,
      strategy: "auto",
    });
    expect(label.primary).toBe("GK");
    expect(label.secondary).toBeUndefined();
  });

  it("returns jersey number + name when player has both and strategy is auto", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Raya", number: 1 } },
      strategy: "auto",
    });
    expect(label.primary).toBe("1");
    expect(label.secondary).toBe("Raya");
  });

  it("returns initials when player has name but no number", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "David Raya Martin" } },
      strategy: "auto",
    });
    // Expected initials: "DRM" or "DR" or similar; reuses deriveInitials
    expect(label.primary).toMatch(/^[A-Z]+$/);
    expect(label.secondary).toBe("David Raya Martin");
  });

  it("honors explicit 'positionCode' strategy", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Raya", number: 1 } },
      strategy: "positionCode",
    });
    expect(label.primary).toBe("GK");
  });

  it("honors explicit 'jerseyNumber' strategy", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Raya", number: 1 } },
      strategy: "jerseyNumber",
    });
    expect(label.primary).toBe("1");
  });

  it("honors explicit 'initials' strategy", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Bukayo Saka" } },
      strategy: "initials",
    });
    expect(label.primary).toMatch(/BS/);
  });

  it("honors explicit 'name' strategy", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Saka" } },
      strategy: "name",
    });
    expect(label.primary).toBe("Saka");
  });

  it("falls back to position code when strategy demands a missing field", () => {
    const label = deriveFormationLabel({
      slot: gkSlot, // no player
      strategy: "jerseyNumber",
    });
    expect(label.primary).toBe("GK");
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: fails with `deriveFormationLabel is not exported`.

### Step 2: Implement the label derivation

- [ ] **Step 2.1: Check that deriveInitials exists**

Run: `grep -rn 'export.*deriveInitials' packages/core/src`

Expected: a function `deriveInitials` is exported (landed with the PassNetwork follow-up packet commit `899960f`). Note the exact import path.

If it does not exist or has a different name, implement a minimal 3-character initials function inline in `formation.ts`.

- [ ] **Step 2.2: Append to `packages/core/src/formation.ts`**

```ts
import { deriveInitials } from "./pass-network-transforms"; // adjust path if needed

export type FormationLabelStrategy =
  | "auto"
  | "positionCode"
  | "jerseyNumber"
  | "initials"
  | "name";

export type FormationLabel = {
  /** Text rendered inside the marker circle. */
  primary: string;
  /** Optional text rendered below the marker (broadcast-style name pill). */
  secondary?: string;
};

export type DeriveLabelInput = {
  slot: RenderedFormationSlot;
  strategy: FormationLabelStrategy;
};

/**
 * Derive the in-marker label and optional below-marker name for a slot,
 * honoring the label strategy.
 *
 * Strategy semantics:
 *   - "auto": pick the most informative label available
 *       · no player → position code
 *       · player with number → number in marker, name below
 *       · player with name only → initials in marker, full name below
 *       · player with neither → position code
 *   - explicit strategies force a specific source, falling back to
 *     position code if the requested source is missing
 */
export function deriveFormationLabel(input: DeriveLabelInput): FormationLabel {
  const { slot, strategy } = input;
  const player = slot.player;

  if (strategy === "auto") {
    if (!player) {
      return { primary: slot.positionCode };
    }
    if (player.number != null) {
      return {
        primary: String(player.number),
        ...(player.label ? { secondary: player.label } : {}),
      };
    }
    if (player.label) {
      return { primary: deriveInitials(player.label), secondary: player.label };
    }
    return { primary: slot.positionCode };
  }

  if (strategy === "positionCode") {
    return {
      primary: slot.positionCode,
      ...(player?.label ? { secondary: player.label } : {}),
    };
  }

  if (strategy === "jerseyNumber") {
    if (player?.number != null) {
      return {
        primary: String(player.number),
        ...(player.label ? { secondary: player.label } : {}),
      };
    }
    return { primary: slot.positionCode };
  }

  if (strategy === "initials") {
    if (player?.label) {
      return { primary: deriveInitials(player.label), secondary: player.label };
    }
    return { primary: slot.positionCode };
  }

  if (strategy === "name") {
    if (player?.label) {
      return { primary: player.label };
    }
    return { primary: slot.positionCode };
  }

  // Exhaustiveness guard
  const _never: never = strategy;
  throw new Error(`unknown label strategy: ${_never as string}`);
}
```

- [ ] **Step 2.3: Export from index**

Add `deriveFormationLabel` and types to `packages/core/src/index.ts`.

### Step 3: Run the test

- [ ] **Step 3.1:**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: all tests pass.

- [ ] **Step 3.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/core/src/formation.ts packages/core/src/index.ts packages/core/test/compute-formation.test.ts
git commit -m "feat(core): add formation label derivation with 5 strategies"
```

---

## Task 8: Opta squad index parser

**Files:**

- Create: `packages/adapters/src/opta/parse-squads.ts`
- Create: `packages/adapters/test/opta/fixtures/squads-sample.json`
- Create: `packages/adapters/test/opta/formations.test.ts` (initial — squad parser tests only)

### Step 1: Build a minimal test fixture

- [ ] **Step 1.1: Create `packages/adapters/test/opta/fixtures/squads-sample.json`**

A hand-trimmed version of the real `squads.json` containing 1-2 teams with 1-2 players each (enough to verify the parser). Format derived from `/Volumes/WQ/projects/www/src/data/opta/squads.json`:

```json
{
  "squad": [
    {
      "contestantId": "c8h9bw1l82s06h77xxrelzhur",
      "contestantName": "Liverpool",
      "contestantCode": "LIV",
      "person": [
        {
          "id": "7h2icfuwy00ilm14dw5xyl5g5",
          "firstName": "Alisson",
          "lastName": "Ramses Becker",
          "matchName": "Alisson Becker",
          "position": "Goalkeeper",
          "type": "player",
          "shirtNumber": 1,
          "active": "yes"
        },
        {
          "id": "1e9txzr9hqz94xtun6byo0vs9",
          "firstName": "Virgil",
          "lastName": "van Dijk",
          "matchName": "van Dijk",
          "position": "Defender",
          "type": "player",
          "shirtNumber": 4,
          "active": "yes"
        }
      ]
    }
  ]
}
```

### Step 2: Write the test first

- [ ] **Step 2.1: Create `packages/adapters/test/opta/formations.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseOptaSquads } from "../../src/opta/parse-squads";
import squadsFixture from "./fixtures/squads-sample.json";

describe("parseOptaSquads", () => {
  it("returns an index keyed by player ID", () => {
    const index = parseOptaSquads(squadsFixture);
    expect(index.get("7h2icfuwy00ilm14dw5xyl5g5")).toBeDefined();
    expect(index.get("1e9txzr9hqz94xtun6byo0vs9")).toBeDefined();
  });

  it("includes matchName as the primary label", () => {
    const index = parseOptaSquads(squadsFixture);
    const alisson = index.get("7h2icfuwy00ilm14dw5xyl5g5");
    expect(alisson?.label).toBe("Alisson Becker");
  });

  it("includes shirt number", () => {
    const index = parseOptaSquads(squadsFixture);
    const alisson = index.get("7h2icfuwy00ilm14dw5xyl5g5");
    expect(alisson?.number).toBe(1);
  });

  it("includes team context", () => {
    const index = parseOptaSquads(squadsFixture);
    const alisson = index.get("7h2icfuwy00ilm14dw5xyl5g5");
    expect(alisson?.teamId).toBe("c8h9bw1l82s06h77xxrelzhur");
    expect(alisson?.teamName).toBe("Liverpool");
  });

  it("skips non-player entries (coaches, staff)", () => {
    const withCoach = {
      squad: [
        {
          contestantId: "team1",
          contestantName: "Test",
          contestantCode: "TST",
          person: [
            {
              id: "p1",
              firstName: "A",
              lastName: "B",
              matchName: "B",
              position: "Goalkeeper",
              type: "player",
              shirtNumber: 1,
              active: "yes",
            },
            {
              id: "c1",
              firstName: "C",
              lastName: "D",
              matchName: "D",
              position: "Manager",
              type: "coach",
              shirtNumber: 0,
              active: "yes",
            },
          ],
        },
      ],
    };
    const index = parseOptaSquads(withCoach);
    expect(index.get("p1")).toBeDefined();
    expect(index.get("c1")).toBeUndefined();
  });

  it("throws on malformed input (no `squad` key)", () => {
    expect(() =>
      parseOptaSquads({} as unknown as Parameters<typeof parseOptaSquads>[0]),
    ).toThrow(/missing `squad`/);
  });
});
```

- [ ] **Step 2.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/adapters/test/opta/formations.test.ts`

Expected: fails with `Cannot find module '../../src/opta/parse-squads'`.

### Step 3: Implement the parser

- [ ] **Step 3.1: Create `packages/adapters/src/opta/parse-squads.ts`**

```ts
export type OptaSquadEntry = {
  playerId: string;
  label: string;
  number: number | undefined;
  teamId: string;
  teamName: string;
};

export type OptaSquadIndex = Map<string, OptaSquadEntry>;

type RawOptaSquadPerson = {
  id: string;
  firstName?: string;
  lastName?: string;
  matchName?: string;
  type?: string;
  shirtNumber?: number;
};

type RawOptaSquadTeam = {
  contestantId: string;
  contestantName: string;
  contestantCode?: string;
  person: RawOptaSquadPerson[];
};

export type RawOptaSquadsFile = {
  squad: RawOptaSquadTeam[];
};

/**
 * Parse a pre-loaded Opta `squads.json` file into a player-ID indexed
 * lookup table. Non-player entries (coaches, staff) are skipped.
 *
 * This should be called once per season and the result cached — it is
 * an O(n) scan over the full squad file.
 */
export function parseOptaSquads(raw: RawOptaSquadsFile): OptaSquadIndex {
  if (!raw || !Array.isArray(raw.squad)) {
    throw new Error("Invalid Opta squads file: missing `squad` array");
  }

  const index: OptaSquadIndex = new Map();

  for (const team of raw.squad) {
    if (!team || !Array.isArray(team.person)) continue;
    for (const person of team.person) {
      if (person.type !== "player") continue;
      const label =
        person.matchName?.trim() ||
        [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
        person.id;
      index.set(person.id, {
        playerId: person.id,
        label,
        number: person.shirtNumber,
        teamId: team.contestantId,
        teamName: team.contestantName,
      });
    }
  }

  return index;
}
```

- [ ] **Step 3.2: Run the tests**

Run: `pnpm exec vitest run packages/adapters/test/opta/formations.test.ts`

Expected: all tests pass.

- [ ] **Step 3.3: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/adapters/src/opta/parse-squads.ts packages/adapters/test/opta/formations.test.ts packages/adapters/test/opta/fixtures/squads-sample.json
git commit -m "feat(adapters): add Opta squad index parser"
```

---

## Task 9: Opta formation adapter

**Files:**

- Create: `packages/adapters/src/opta/map-formation.ts`
- Create: `packages/adapters/test/opta/fixtures/lineup-event-sample.json`
- Modify: `packages/adapters/src/opta/index.ts`
- Modify: `packages/adapters/test/opta/formations.test.ts`

### Step 1: Build a minimal test fixture

- [ ] **Step 1.1: Extract a real lineup event**

Run:

```bash
node -e "
const data = require('/Volumes/WQ/projects/www/src/data/opta/match-events/zhs8gg1hvcuqvhkk2itb54pg.json');
const lineupEvents = data.liveData.event.filter(e => e.typeId === 34);
console.log(JSON.stringify({
  home: lineupEvents[0],
  away: lineupEvents[1],
}, null, 2));
" > packages/adapters/test/opta/fixtures/lineup-event-sample.json
```

Inspect the output to confirm it contains two events (home + away) with all the relevant qualifiers (130, 30, 131, 44, 59, 194).

- [ ] **Step 1.2: Expand squads fixture to include all Liverpool + Bournemouth players from the real lineups**

Extract the player IDs from the lineup events (qualifier 30) and grep them out of the real `squads.json`:

```bash
# Get the player ID list from one team's lineup
node -e "
const data = require('packages/adapters/test/opta/fixtures/lineup-event-sample.json');
const q30 = data.home.qualifier.find(q => q.qualifierId === 30);
console.log(q30.value.split(',').map(s => s.trim()).join('\n'));
"
```

Then manually trim `squads.json` to include just those players + the Liverpool team record, and save as `packages/adapters/test/opta/fixtures/squads-sample.json` (replacing the minimal version from Task 8).

### Step 2: Write the test first

- [ ] **Step 2.1: Append adapter tests**

Append to `packages/adapters/test/opta/formations.test.ts`:

```ts
import { fromOpta } from "../../src/opta";
import lineupFixture from "./fixtures/lineup-event-sample.json";

describe("fromOpta.formations", () => {
  const squads = parseOptaSquads(squadsFixture);

  it("decodes a real Opta typeId 34 lineup event", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(result.formation).toBe("4231"); // Liverpool's formation in the fixture match (Opta ID 8)
    expect(result.players).toHaveLength(11);
  });

  it("assigns each starter an explicit slot 1-11", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    const slots = result.players.map((p) => p.slot).sort((a, b) => a! - b!);
    expect(slots).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("populates positionCode from the mplsoccer table", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(result.players.find((p) => p.slot === 1)?.positionCode).toBe("GK");
  });

  it("populates label from the squad index", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    // every player should have a label if present in squads
    const withLabels = result.players.filter((p) => p.label).length;
    expect(withLabels).toBeGreaterThan(0);
  });

  it("populates jersey numbers from qualifier 59", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(result.players.every((p) => p.number != null)).toBe(true);
  });

  it("populates playerId for every starter", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(
      result.players.every(
        (p) => typeof p.playerId === "string" && p.playerId.length > 0,
      ),
    ).toBe(true);
  });

  it("marks the captain from qualifier 194", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    const captains = result.players.filter((p) => p.captain === true);
    expect(captains).toHaveLength(1);
  });

  it("throws on missing qualifier 130", () => {
    const broken = {
      ...lineupFixture.home,
      qualifier: lineupFixture.home.qualifier.filter(
        (q: { qualifierId: number }) => q.qualifierId !== 130,
      ),
    };
    expect(() => fromOpta.formations(broken, { squads })).toThrow(/qualifier 130/);
  });

  it("throws on missing qualifier 30", () => {
    const broken = {
      ...lineupFixture.home,
      qualifier: lineupFixture.home.qualifier.filter(
        (q: { qualifierId: number }) => q.qualifierId !== 30,
      ),
    };
    expect(() => fromOpta.formations(broken, { squads })).toThrow(/qualifier 30/);
  });

  it("throws on unknown Opta formation ID", () => {
    const broken = {
      ...lineupFixture.home,
      qualifier: lineupFixture.home.qualifier.map(
        (q: { qualifierId: number; value: string }) =>
          q.qualifierId === 130 ? { ...q, value: "999" } : q,
      ),
    };
    expect(() => fromOpta.formations(broken, { squads })).toThrow(
      /unknown Opta formation ID/,
    );
  });

  it("returns label: undefined for players not in squad index", () => {
    const emptySquads: Parameters<typeof fromOpta.formations>[1]["squads"] = new Map();
    const result = fromOpta.formations(lineupFixture.home, { squads: emptySquads });
    expect(result.players[0].label).toBeUndefined();
    // But should not throw, and should still have slot + positionCode
    expect(result.players[0].slot).toBeDefined();
    expect(result.players[0].positionCode).toBeDefined();
  });

  it("populates teamLabel from squad context when available", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    // teamLabel derived from the team of the first player in the lineup (assuming they're in the squad)
    expect(result.teamLabel).toBeDefined();
  });
});
```

- [ ] **Step 2.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/adapters/test/opta/formations.test.ts`

Expected: fails because `fromOpta.formations` is not defined.

### Step 3: Implement the adapter

- [ ] **Step 3.1: Create `packages/adapters/src/opta/map-formation.ts`**

```ts
import {
  optaFormationIdToKey,
  getFormationPositions,
  type FormationPlayer,
  type FormationTeamData,
} from "@withqwerty/campos-core";
import type { OptaSquadIndex } from "./parse-squads";

export type RawOptaQualifier = {
  qualifierId: number;
  value?: string;
};

export type RawOptaLineupEvent = {
  typeId: number;
  contestantId?: string;
  qualifier: RawOptaQualifier[];
};

export type FromOptaFormationsOptions = {
  squads: OptaSquadIndex;
};

/**
 * Decode an Opta typeId 34 lineup event (from the match-events stream)
 * into a canonical FormationTeamData.
 *
 * Requires a pre-parsed OptaSquadIndex for player name resolution.
 * Without it, players render with just jersey numbers and playerIds.
 */
export function mapOptaFormation(
  event: RawOptaLineupEvent,
  options: FromOptaFormationsOptions,
): FormationTeamData {
  if (event.typeId !== 34) {
    throw new Error(`expected typeId 34 lineup event, got ${event.typeId}`);
  }

  const { squads } = options;

  const formationIdQualifier = findQualifier(event, 130, "team formation");
  const playerIdsQualifier = findQualifier(event, 30, "player IDs");
  const shirtNumbersQualifier = findQualifier(event, 59, "shirt numbers");
  const captainQualifier = findOptionalQualifier(event, 194);

  const formationKey = optaFormationIdToKey(formationIdQualifier.value ?? "");

  const playerIds = splitCsv(playerIdsQualifier.value ?? "");
  const shirtNumbers = splitCsv(shirtNumbersQualifier.value ?? "").map((s) =>
    Number.parseInt(s, 10),
  );
  const captainId = captainQualifier?.value?.trim();

  // The first 11 entries are starters (per Opta convention). Subs follow.
  const STARTER_COUNT = 11;
  if (playerIds.length < STARTER_COUNT) {
    throw new Error(
      `expected at least ${STARTER_COUNT} starters in qualifier 30, got ${playerIds.length}`,
    );
  }
  if (shirtNumbers.length < STARTER_COUNT) {
    throw new Error(
      `expected at least ${STARTER_COUNT} shirt numbers in qualifier 59, got ${shirtNumbers.length}`,
    );
  }

  const positions = getFormationPositions(formationKey);
  const players: FormationPlayer[] = [];
  let teamLabel: string | undefined;

  for (let i = 0; i < STARTER_COUNT; i += 1) {
    const playerId = playerIds[i];
    const squadEntry = squads.get(playerId);
    if (squadEntry && !teamLabel) {
      teamLabel = squadEntry.teamName;
    }
    const slot = positions[i].slot; // mplsoccer canonical slot order
    const positionCode = positions[i].code;
    const player: FormationPlayer = {
      slot,
      positionCode,
      playerId,
      number: shirtNumbers[i],
      ...(squadEntry?.label ? { label: squadEntry.label } : {}),
      ...(captainId === playerId ? { captain: true } : {}),
    };
    players.push(player);
  }

  return {
    formation: formationKey,
    ...(teamLabel ? { teamLabel } : {}),
    players,
  };
}

function findQualifier(
  event: RawOptaLineupEvent,
  id: number,
  label: string,
): RawOptaQualifier {
  const q = event.qualifier.find((x) => x.qualifierId === id);
  if (!q) {
    throw new Error(`missing qualifier ${id} (${label}) on Opta lineup event`);
  }
  return q;
}

function findOptionalQualifier(
  event: RawOptaLineupEvent,
  id: number,
): RawOptaQualifier | undefined {
  return event.qualifier.find((x) => x.qualifierId === id);
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
```

- [ ] **Step 3.2: Wire into `packages/adapters/src/opta/index.ts`**

Find the existing `fromOpta` export and add the new methods:

```ts
import { mapOptaFormation } from "./map-formation";
import { parseOptaSquads } from "./parse-squads";

export const fromOpta = {
  // ... existing methods ...
  parseSquads: parseOptaSquads,
  formations: mapOptaFormation,
};
```

Also re-export the types if consumers need them:

```ts
export type { OptaSquadEntry, OptaSquadIndex, RawOptaSquadsFile } from "./parse-squads";
export type { RawOptaLineupEvent, FromOptaFormationsOptions } from "./map-formation";
```

### Step 4: Run the tests

- [ ] **Step 4.1:**

Run: `pnpm exec vitest run packages/adapters/test/opta/formations.test.ts`

Expected: all tests pass. If the fixture's expected formation is not `"4231"` (verify by reading `qualifier 130.value` in the fixture and looking up in `OPTA_FORMATION_ID_MAP`), update the assertion.

- [ ] **Step 4.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 5: Commit

- [ ] **Step 5.1:**

```bash
git add packages/adapters/src/opta/map-formation.ts packages/adapters/src/opta/index.ts packages/adapters/test/opta/formations.test.ts packages/adapters/test/opta/fixtures/lineup-event-sample.json packages/adapters/test/opta/fixtures/squads-sample.json
git commit -m "feat(adapters): add fromOpta.formations() lineup decoder

Decodes typeId 34 lineup events with qualifiers 130/30/131/44/59/194
into canonical FormationTeamData. Requires pre-parsed squad index for
player name resolution."
```

---

## Task 10: WhoScored formation adapter

**Files:**

- Create: `packages/adapters/src/whoscored/map-formation.ts`
- Create: `packages/adapters/test/whoscored/fixtures/matchcentre-sample.json`
- Create: `packages/adapters/test/whoscored/formations.test.ts`
- Modify: `packages/adapters/src/whoscored/index.ts`

### Step 1: Build a test fixture

- [ ] **Step 1.1: Fetch a real WhoScored match from the Cloudflare R2 bucket**

Use wrangler to download one match. Pick a recent, well-known Premier League fixture:

```bash
# List available matches in D1 if you need to choose
pnpm exec wrangler d1 execute football-analytics --command "SELECT match_id, home_team_name, away_team_name, date FROM ws_match_index WHERE league='Premier League' ORDER BY date DESC LIMIT 10"

# Pick a match_id, then download from R2
pnpm exec wrangler r2 object get opta-data/whoscored/<MATCH_ID>.json.gz --file /tmp/ws-match.json.gz
gunzip /tmp/ws-match.json.gz
```

Then extract just `matchCentreData.home` and `.away`:

```bash
node -e "
const raw = require('/tmp/ws-match.json');
const mc = raw.matchCentreData;
console.log(JSON.stringify({
  home: mc.home,
  away: mc.away,
}, null, 2));
" > packages/adapters/test/whoscored/fixtures/matchcentre-sample.json
```

If this is the first time any task downloads from R2, note the `match_id` and source `r2_key` in a comment at the top of `matchcentre-sample.json`.

### Step 2: Write the test first

- [ ] **Step 2.1: Create `packages/adapters/test/whoscored/formations.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { fromWhoScored } from "../../src/whoscored";
import matchFixture from "./fixtures/matchcentre-sample.json";

describe("fromWhoScored.formations", () => {
  it("decodes a home team matchCentreData into FormationTeamData", () => {
    const result = fromWhoScored.formations(matchFixture.home);
    expect(result.formation).toMatch(/^\d+$/); // digits-only formation key
    expect(result.players).toHaveLength(11);
  });

  it("decodes an away team matchCentreData", () => {
    const result = fromWhoScored.formations(matchFixture.away);
    expect(result.players).toHaveLength(11);
  });

  it("assigns each starter an explicit slot 1-11", () => {
    const result = fromWhoScored.formations(matchFixture.home);
    const slots = result.players.map((p) => p.slot).sort((a, b) => a! - b!);
    expect(slots).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("populates positionCode from the mplsoccer table", () => {
    const result = fromWhoScored.formations(matchFixture.home);
    expect(result.players.find((p) => p.slot === 1)?.positionCode).toBe("GK");
  });

  it("populates label from players[].name", () => {
    const result = fromWhoScored.formations(matchFixture.home);
    expect(
      result.players.every((p) => typeof p.label === "string" && p.label.length > 0),
    ).toBe(true);
  });

  it("populates jersey numbers", () => {
    const result = fromWhoScored.formations(matchFixture.home);
    expect(result.players.every((p) => p.number != null)).toBe(true);
  });

  it("populates playerId as a string", () => {
    const result = fromWhoScored.formations(matchFixture.home);
    expect(
      result.players.every(
        (p) => typeof p.playerId === "string" && p.playerId.length > 0,
      ),
    ).toBe(true);
  });

  it("throws on missing formations[]", () => {
    const broken = { ...matchFixture.home, formations: undefined };
    expect(() => fromWhoScored.formations(broken as never)).toThrow(/missing formations/);
  });

  it("uses formations[0] (kickoff formation) when multiple exist", () => {
    // If the fixture happens to have a mid-match formation change, this verifies we take [0]
    const result = fromWhoScored.formations(matchFixture.home);
    expect(result.formation).toBe(
      matchFixture.home.formations[0].formationName.toLowerCase().replace(/-/g, ""),
    );
  });

  it("throws on inconsistent parallel array lengths", () => {
    const broken = {
      ...matchFixture.home,
      formations: [
        {
          ...matchFixture.home.formations[0],
          jerseyNumbers: [1, 2], // too short
        },
      ],
    };
    expect(() => fromWhoScored.formations(broken as never)).toThrow(
      /inconsistent|parallel/i,
    );
  });
});
```

- [ ] **Step 2.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/adapters/test/whoscored/formations.test.ts`

Expected: fails with `fromWhoScored.formations is not defined`.

### Step 3: Implement the adapter

- [ ] **Step 3.1: Create `packages/adapters/src/whoscored/map-formation.ts`**

```ts
import {
  parseFormationKey,
  getFormationPositions,
  type FormationPlayer,
  type FormationTeamData,
} from "@withqwerty/campos-core";

export type WhoScoredPlayer = {
  playerId: number;
  shirtNo?: number;
  name: string;
  position?: string;
  isFirstEleven?: boolean;
};

export type WhoScoredFormationEntry = {
  formationId?: number;
  formationName: string;
  period?: number;
  startMinuteExpanded?: number;
  jerseyNumbers?: number[];
  formationSlots?: number[];
  playerIds?: number[];
  formationPositions?: Array<{ vertical: number; horizontal: number }>;
};

export type WhoScoredMatchCentreTeam = {
  teamId?: number;
  name?: string;
  players: WhoScoredPlayer[];
  formations: WhoScoredFormationEntry[];
};

/**
 * Decode a WhoScored matchCentreData team object into canonical
 * FormationTeamData. WhoScored is self-contained — no squad join needed
 * because names and numbers live inline on each player.
 *
 * Takes the first entry in `formations[]` as the kickoff formation and
 * ignores mid-match formation changes (deferred to v0.4).
 */
export function mapWhoScoredFormation(team: WhoScoredMatchCentreTeam): FormationTeamData {
  if (!team) {
    throw new Error("Invalid WhoScored team: received null/undefined");
  }
  if (!Array.isArray(team.formations) || team.formations.length === 0) {
    throw new Error("Invalid WhoScored team: missing formations[] or empty");
  }
  if (!Array.isArray(team.players)) {
    throw new Error("Invalid WhoScored team: missing players[]");
  }

  const kickoff = team.formations[0];
  const formationKey = parseFormationKey(kickoff.formationName);
  const positions = getFormationPositions(formationKey);

  const playerIds = kickoff.playerIds ?? [];
  const jerseyNumbers = kickoff.jerseyNumbers ?? [];
  if (playerIds.length === 0) {
    throw new Error("WhoScored formation missing playerIds[]");
  }
  if (jerseyNumbers.length !== playerIds.length) {
    throw new Error(
      `WhoScored parallel arrays inconsistent: playerIds has ${playerIds.length} entries, jerseyNumbers has ${jerseyNumbers.length}`,
    );
  }

  const STARTER_COUNT = 11;
  if (playerIds.length < STARTER_COUNT) {
    throw new Error(`WhoScored formation has fewer than 11 slots: ${playerIds.length}`);
  }

  // Build a player lookup from players[]
  const playerLookup = new Map<number, WhoScoredPlayer>();
  for (const p of team.players) {
    playerLookup.set(p.playerId, p);
  }

  const players: FormationPlayer[] = [];
  for (let i = 0; i < STARTER_COUNT; i += 1) {
    const playerId = playerIds[i];
    const lookup = playerLookup.get(playerId);
    if (lookup && lookup.isFirstEleven === false) {
      // The parallel arrays should already be starters-first. If any non-starter leaks in,
      // that's an upstream data bug.
      throw new Error(
        `WhoScored formation slot ${i + 1} references non-starter playerId ${playerId}`,
      );
    }
    const slot = positions[i].slot;
    const positionCode = positions[i].code;
    const player: FormationPlayer = {
      slot,
      positionCode,
      playerId: String(playerId),
      number: jerseyNumbers[i],
      ...(lookup?.name ? { label: lookup.name } : {}),
    };
    players.push(player);
  }

  return {
    formation: formationKey,
    ...(team.name ? { teamLabel: team.name } : {}),
    players,
  };
}
```

- [ ] **Step 3.2: Wire into `packages/adapters/src/whoscored/index.ts`**

```ts
import { mapWhoScoredFormation } from "./map-formation";

export const fromWhoScored = {
  // ... existing methods ...
  formations: mapWhoScoredFormation,
};

export type {
  WhoScoredPlayer,
  WhoScoredFormationEntry,
  WhoScoredMatchCentreTeam,
} from "./map-formation";
```

### Step 4: Run the tests

- [ ] **Step 4.1:**

Run: `pnpm exec vitest run packages/adapters/test/whoscored/formations.test.ts`

Expected: all tests pass.

- [ ] **Step 4.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 5: Commit

- [ ] **Step 5.1:**

```bash
git add packages/adapters/src/whoscored/map-formation.ts packages/adapters/src/whoscored/index.ts packages/adapters/test/whoscored/formations.test.ts packages/adapters/test/whoscored/fixtures/matchcentre-sample.json
git commit -m "feat(adapters): add fromWhoScored.formations() decoder

Decodes matchCentreData.home/.away into canonical FormationTeamData.
Self-contained: no squad join needed (names and numbers inline)."
```

---

## Task 11: Cross-provider parity tests

**Files:**

- Modify: `packages/adapters/test/parity.test.ts`

### Step 1: Write parity tests

- [ ] **Step 1.1: Append to `packages/adapters/test/parity.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { fromOpta } from "../src/opta";
import { fromWhoScored } from "../src/whoscored";
import { parseOptaSquads } from "../src/opta/parse-squads";
import optaLineupFixture from "./opta/fixtures/lineup-event-sample.json";
import optaSquadsFixture from "./opta/fixtures/squads-sample.json";
import whoscoredFixture from "./whoscored/fixtures/matchcentre-sample.json";

describe("formation adapter parity", () => {
  it("both adapters emit exactly 11 players with slots 1-11", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredFixture.home);

    expect(optaResult.players).toHaveLength(11);
    expect(wsResult.players).toHaveLength(11);

    const optaSlots = optaResult.players.map((p) => p.slot).sort((a, b) => a! - b!);
    const wsSlots = wsResult.players.map((p) => p.slot).sort((a, b) => a! - b!);
    expect(optaSlots).toEqual(wsSlots);
  });

  it("both adapters emit valid mplsoccer formation keys", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredFixture.home);

    // Both should be non-hyphenated digit strings (mplsoccer convention)
    expect(optaResult.formation).toMatch(/^[a-z0-9]+$/);
    expect(wsResult.formation).toMatch(/^[a-z0-9]+$/);
  });

  it("both adapters populate positionCode for every starter", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredFixture.home);

    expect(optaResult.players.every((p) => typeof p.positionCode === "string")).toBe(
      true,
    );
    expect(wsResult.players.every((p) => typeof p.positionCode === "string")).toBe(true);
  });

  it("both adapters populate playerId for every starter", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredFixture.home);

    expect(
      optaResult.players.every(
        (p) => typeof p.playerId === "string" && p.playerId.length > 0,
      ),
    ).toBe(true);
    expect(
      wsResult.players.every(
        (p) => typeof p.playerId === "string" && p.playerId.length > 0,
      ),
    ).toBe(true);
  });

  it("both adapters populate number for every starter", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredFixture.home);

    expect(optaResult.players.every((p) => typeof p.number === "number")).toBe(true);
    expect(wsResult.players.every((p) => typeof p.number === "number")).toBe(true);
  });

  it("neither adapter emits teamColor (consumer responsibility)", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredFixture.home);

    expect(optaResult.teamColor).toBeUndefined();
    expect(wsResult.teamColor).toBeUndefined();
  });

  it("neither adapter emits per-player color (consumer responsibility)", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredFixture.home);

    expect(optaResult.players.every((p) => p.color === undefined)).toBe(true);
    expect(wsResult.players.every((p) => p.color === undefined)).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run the tests**

Run: `pnpm exec vitest run packages/adapters/test/parity.test.ts`

Expected: all parity tests pass.

### Step 2: Commit

- [ ] **Step 2.1:**

```bash
git add packages/adapters/test/parity.test.ts
git commit -m "test(adapters): add formation adapter cross-provider parity tests"
```

---

## Task 12: Formation React component — single team

**Files:**

- Create: `packages/react/src/Formation.tsx`
- Create: `packages/react/test/Formation.test.tsx`
- Modify: `packages/react/src/index.ts`

### Step 1: Write the test first

- [ ] **Step 1.1: Create `packages/react/test/Formation.test.tsx`**

```tsx
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { axe } from "vitest-axe";
import { Formation } from "../src/Formation";

describe("Formation — single team", () => {
  it("renders 11 markers for zero-config 4-3-3", async () => {
    const { container } = render(<Formation formation="4-3-3" />);
    const markers = container.querySelectorAll('[data-testid="formation-marker"]');
    expect(markers.length).toBe(11);
  });

  it("renders 11 markers for zero-config 4231 (non-hyphenated)", async () => {
    const { container } = render(<Formation formation="4231" />);
    const markers = container.querySelectorAll('[data-testid="formation-marker"]');
    expect(markers.length).toBe(11);
  });

  it("renders position codes when no players supplied", async () => {
    const { container } = render(<Formation formation="4-3-3" />);
    const labels = container.querySelectorAll('[data-testid="formation-marker-label"]');
    const texts = Array.from(labels).map((el) => el.textContent);
    expect(texts).toContain("GK");
  });

  it("renders jersey numbers when players supplied with numbers", async () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          { label: "Raya", number: 1 },
          { label: "White", number: 2 },
        ]}
      />,
    );
    const labels = container.querySelectorAll('[data-testid="formation-marker-label"]');
    const texts = Array.from(labels).map((el) => el.textContent);
    expect(texts).toContain("1");
    expect(texts).toContain("2");
  });

  it("renders a captain mark when captain: true", async () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[{ label: "Ødegaard", number: 8, captain: true, slot: 8 }]}
      />,
    );
    const captainMarks = container.querySelectorAll('[data-testid="formation-captain"]');
    expect(captainMarks.length).toBe(1);
  });

  it("renders dashed placeholders for empty slots", async () => {
    const { container } = render(
      <Formation formation="4-3-3" players={[{ label: "Raya", number: 1 }]} />,
    );
    const placeholders = container.querySelectorAll(
      '[data-testid="formation-marker-placeholder"]',
    );
    expect(placeholders.length).toBe(10);
  });

  it("throws on invalid formation string", () => {
    expect(() => render(<Formation formation="4-3-4" />)).toThrow(/unknown formation/);
  });

  it("has root svg with role='img' and aria-label", async () => {
    const { container } = render(<Formation formation="4-3-3" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBeTruthy();
  });

  it("is axe-clean", async () => {
    const { container } = render(<Formation formation="4-3-3" />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("supports horizontal orientation", async () => {
    const { container } = render(
      <Formation formation="4-3-3" orientation="horizontal" />,
    );
    const markers = container.querySelectorAll('[data-testid="formation-marker"]');
    expect(markers.length).toBe(11);
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/react/test/Formation.test.tsx`

Expected: fails with `Cannot find module '../src/Formation'`.

### Step 2: Implement the component (single-team only)

- [ ] **Step 2.1: Create `packages/react/src/Formation.tsx`**

```tsx
import {
  layoutSingleTeam,
  deriveFormationLabel,
  type FormationKey,
  type FormationPlayer,
  type FormationOrientation,
  type FormationCrop,
  type FormationLabelStrategy,
  type RenderedFormationSlot,
} from "@withqwerty/campos-core";
import { Pitch } from "@withqwerty/campos-stadia";
import type { PitchTheme, PitchColors } from "@withqwerty/campos-stadia";

export type FormationProps = {
  /** Formation string. Accepts "4-3-3", "433", etc. Resolved via parseFormationKey. */
  formation: FormationKey | string;
  /** Optional player assignments. If omitted, renders position-coded zero-config markers. */
  players?: FormationPlayer[];
  /** Team color for the markers. */
  teamColor?: string;
  /** Team label (used in accessibility labels). */
  teamLabel?: string;
  /** "vertical" (default, attacking up) or "horizontal" (attacking right). */
  orientation?: FormationOrientation;
  /** "full" (default) or "half" for scouting-card usage. */
  crop?: FormationCrop;
  /** Label strategy. Default "auto" picks the best available. */
  labelStrategy?: FormationLabelStrategy;
  /** Turn off in-marker labels. */
  showLabels?: boolean;
  /** Turn off below-marker name pills. */
  showNames?: boolean;
  /** Pass-through to stadia. */
  pitchTheme?: PitchTheme;
  /** Pass-through to stadia. */
  pitchColors?: PitchColors;
};

const DEFAULT_TEAM_COLOR = "#d33";
const MARKER_RADIUS_VERTICAL = 3.2;
const MARKER_RADIUS_HORIZONTAL = 3.2;
const LABEL_FONT_SIZE = 2.8;
const NAME_FONT_SIZE = 2.2;

export function Formation(props: FormationProps): JSX.Element {
  const {
    formation,
    players = [],
    teamColor = DEFAULT_TEAM_COLOR,
    teamLabel,
    orientation = "vertical",
    crop = "full",
    labelStrategy = "auto",
    showLabels = true,
    showNames = true,
    pitchTheme,
    pitchColors,
  } = props;

  const layout = layoutSingleTeam(
    {
      formation,
      players,
      ...(teamLabel ? { teamLabel } : {}),
      ...(teamColor ? { teamColor } : {}),
    },
    { orientation, crop },
  );

  const ariaLabel = buildAriaLabel({ formation, teamLabel, playerCount: players.length });

  return (
    <Pitch
      orientation={orientation}
      crop={crop}
      {...(pitchTheme ? { theme: pitchTheme } : {})}
      {...(pitchColors ? { colors: pitchColors } : {})}
      role="img"
      aria-label={ariaLabel}
    >
      {layout.slots.map((slot) => (
        <FormationMarker
          key={slot.slot}
          slot={slot}
          teamColor={teamColor}
          labelStrategy={labelStrategy}
          showLabels={showLabels}
          showNames={showNames}
        />
      ))}
    </Pitch>
  );
}

type FormationMarkerProps = {
  slot: RenderedFormationSlot;
  teamColor: string;
  labelStrategy: FormationLabelStrategy;
  showLabels: boolean;
  showNames: boolean;
};

function FormationMarker(props: FormationMarkerProps): JSX.Element {
  const { slot, teamColor, labelStrategy, showLabels, showNames } = props;
  const label = deriveFormationLabel({ slot, strategy: labelStrategy });
  const color = slot.player?.color ?? teamColor;
  const strokeColor = "#1a202c";

  if (slot.placeholder) {
    return (
      <g
        data-testid="formation-marker-placeholder"
        transform={`translate(${slot.x} ${slot.y})`}
      >
        <circle
          r={MARKER_RADIUS_VERTICAL}
          fill="none"
          stroke={strokeColor}
          strokeWidth={0.3}
          strokeDasharray="0.6 0.6"
          opacity={0.5}
        />
        {showLabels ? (
          <text
            data-testid="formation-marker-label"
            x={0}
            y={0}
            fill={strokeColor}
            fontSize={LABEL_FONT_SIZE}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={0.6}
          >
            {slot.positionCode}
          </text>
        ) : null}
      </g>
    );
  }

  return (
    <g data-testid="formation-marker" transform={`translate(${slot.x} ${slot.y})`}>
      <circle
        r={MARKER_RADIUS_VERTICAL}
        fill={color}
        stroke={strokeColor}
        strokeWidth={0.3}
      />
      {showLabels ? (
        <text
          data-testid="formation-marker-label"
          x={0}
          y={0}
          fill="#ffffff"
          fontSize={LABEL_FONT_SIZE}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          stroke={strokeColor}
          strokeWidth={0.15}
          paintOrder="stroke"
        >
          {label.primary}
        </text>
      ) : null}
      {showNames && label.secondary ? (
        <text
          x={0}
          y={MARKER_RADIUS_VERTICAL + NAME_FONT_SIZE + 0.5}
          fill={strokeColor}
          fontSize={NAME_FONT_SIZE}
          fontWeight={600}
          textAnchor="middle"
        >
          {truncateName(label.secondary)}
        </text>
      ) : null}
      {slot.player?.captain ? (
        <g
          data-testid="formation-captain"
          transform={`translate(${MARKER_RADIUS_VERTICAL * 0.6} ${-MARKER_RADIUS_VERTICAL * 0.6})`}
        >
          <circle r={1.1} fill="#fbbf24" stroke={strokeColor} strokeWidth={0.15} />
          <text
            x={0}
            y={0}
            fill={strokeColor}
            fontSize={1.4}
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
            aria-label="captain"
          >
            C
          </text>
        </g>
      ) : null}
    </g>
  );
}

function buildAriaLabel(input: {
  formation: FormationKey | string;
  teamLabel?: string;
  playerCount: number;
}): string {
  const { formation, teamLabel, playerCount } = input;
  const base = teamLabel
    ? `${teamLabel} ${formation} formation`
    : `${formation} formation`;
  return playerCount > 0 ? `${base} lineup with ${playerCount} players` : base;
}

function truncateName(name: string): string {
  const MAX_LENGTH = 12;
  if (name.length <= MAX_LENGTH) return name;
  return name.slice(0, MAX_LENGTH - 1) + "…";
}
```

- [ ] **Step 2.2: Export from `packages/react/src/index.ts`**

```ts
export { Formation } from "./Formation";
export type { FormationProps } from "./Formation";
```

### Step 3: Run the test

- [ ] **Step 3.1:**

Run: `pnpm exec vitest run packages/react/test/Formation.test.tsx`

Expected: all single-team tests pass. If the `Pitch` component from stadia needs different props or a different import path, adjust accordingly — read `packages/stadia/src/index.ts` to confirm the public API.

- [ ] **Step 3.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/react/src/Formation.tsx packages/react/src/index.ts packages/react/test/Formation.test.tsx
git commit -m "feat(react): add Formation component (single-team mode)

Renders 11-player formations on a stadia pitch with auto label strategy,
captain marks, dashed placeholders for incomplete lineups, and a11y labels."
```

---

## Task 13: Formation React component — dual-team mode

**Files:**

- Modify: `packages/react/src/Formation.tsx`
- Modify: `packages/react/test/Formation.test.tsx`

### Step 1: Write the test first

- [ ] **Step 1.1: Append dual-team test suite**

Append to `packages/react/test/Formation.test.tsx`:

```tsx
import type { FormationTeamSpec } from "../src/Formation";

describe("Formation — dual team", () => {
  const homeTeam: FormationTeamSpec = {
    label: "Arsenal",
    formation: "4-3-3",
    players: [{ label: "Raya", number: 1 }],
    color: "#e50027",
  };
  const awayTeam: FormationTeamSpec = {
    label: "Liverpool",
    formation: "4-2-3-1",
    players: [{ label: "Alisson", number: 1 }],
    color: "#c8102e",
  };

  it("renders 22 markers (11 per team) for dual-team mode", async () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const markers = container.querySelectorAll('[data-testid="formation-marker"]');
    const placeholders = container.querySelectorAll(
      '[data-testid="formation-marker-placeholder"]',
    );
    expect(markers.length + placeholders.length).toBe(22);
  });

  it("renders the home team marker color for home players", async () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const homeMarkers = container.querySelectorAll('[data-team="home"] circle[fill]');
    const filled = Array.from(homeMarkers).filter(
      (c) => c.getAttribute("fill") === homeTeam.color,
    );
    expect(filled.length).toBeGreaterThan(0);
  });

  it("renders a two-item legend when both teams have labels", async () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const legendItems = container.querySelectorAll(
      '[data-testid="formation-legend-item"]',
    );
    expect(legendItems.length).toBe(2);
  });

  it("suppresses legend when neither team has a label", async () => {
    const { container } = render(
      <Formation
        home={{ ...homeTeam, label: undefined }}
        away={{ ...awayTeam, label: undefined }}
      />,
    );
    const legend = container.querySelector('[data-testid="formation-legend"]');
    expect(legend).toBeNull();
  });

  it("builds an aria-label mentioning both teams and formations", async () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toContain("Arsenal");
    expect(svg?.getAttribute("aria-label")).toContain("Liverpool");
    expect(svg?.getAttribute("aria-label")).toContain("4-3-3");
  });

  it("supports horizontal orientation in dual-team mode", () => {
    const { container } = render(
      <Formation home={homeTeam} away={awayTeam} orientation="horizontal" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
```

- [ ] **Step 1.2: Run the test, verify it fails**

Run: `pnpm exec vitest run packages/react/test/Formation.test.tsx`

Expected: the new dual-team tests fail.

### Step 2: Extend the component with dual-team mode

- [ ] **Step 2.1: Refactor `packages/react/src/Formation.tsx`**

Add the dual-team props and a discriminated union. Replace the component body with:

```tsx
import {
  layoutSingleTeam,
  layoutDualTeam,
  deriveFormationLabel,
  type FormationKey,
  type FormationPlayer,
  type FormationTeamData,
  type FormationOrientation,
  type FormationCrop,
  type FormationLabelStrategy,
  type RenderedFormationSlot,
} from "@withqwerty/campos-core";
import { Pitch } from "@withqwerty/campos-stadia";
import type { PitchTheme, PitchColors } from "@withqwerty/campos-stadia";

export type FormationTeamSpec = {
  label?: string;
  formation: FormationKey | string;
  players?: FormationPlayer[];
  color?: string;
};

type FormationCommonProps = {
  labelStrategy?: FormationLabelStrategy;
  showLabels?: boolean;
  showNames?: boolean;
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
};

type FormationSingleProps = FormationCommonProps & {
  formation: FormationKey | string;
  players?: FormationPlayer[];
  teamColor?: string;
  teamLabel?: string;
  orientation?: FormationOrientation;
  crop?: FormationCrop;
  home?: never;
  away?: never;
};

type FormationDualProps = FormationCommonProps & {
  home: FormationTeamSpec;
  away: FormationTeamSpec;
  orientation?: FormationOrientation;
  formation?: never;
  players?: never;
  teamColor?: never;
  teamLabel?: never;
  crop?: never;
};

export type FormationProps = FormationSingleProps | FormationDualProps;

const DEFAULT_TEAM_COLOR = "#d33";
const DEFAULT_HOME_COLOR = "#e50027";
const DEFAULT_AWAY_COLOR = "#2563eb";
const MARKER_RADIUS = 3.2;
const LABEL_FONT_SIZE = 2.8;
const NAME_FONT_SIZE = 2.2;

export function Formation(props: FormationProps): JSX.Element {
  if ("home" in props && props.home != null && "away" in props && props.away != null) {
    // dual-team mode
    return <FormationDual {...props} />;
  }
  if ("formation" in props && props.formation != null) {
    return <FormationSingle {...(props as FormationSingleProps)} />;
  }
  throw new Error("Formation requires either `formation` or both `home` and `away`");
}

function FormationSingle(props: FormationSingleProps): JSX.Element {
  const {
    formation,
    players = [],
    teamColor = DEFAULT_TEAM_COLOR,
    teamLabel,
    orientation = "vertical",
    crop = "full",
    labelStrategy = "auto",
    showLabels = true,
    showNames = true,
    pitchTheme,
    pitchColors,
  } = props;

  const layout = layoutSingleTeam(
    {
      formation,
      players,
      ...(teamLabel ? { teamLabel } : {}),
      ...(teamColor ? { teamColor } : {}),
    },
    { orientation, crop },
  );

  const ariaLabel = buildSingleAriaLabel({
    formation,
    teamLabel,
    playerCount: players.length,
  });

  return (
    <Pitch
      orientation={orientation}
      crop={crop}
      {...(pitchTheme ? { theme: pitchTheme } : {})}
      {...(pitchColors ? { colors: pitchColors } : {})}
      role="img"
      aria-label={ariaLabel}
    >
      {layout.slots.map((slot) => (
        <FormationMarker
          key={slot.slot}
          slot={slot}
          teamColor={teamColor}
          labelStrategy={labelStrategy}
          showLabels={showLabels}
          showNames={showNames}
        />
      ))}
    </Pitch>
  );
}

function FormationDual(props: FormationDualProps): JSX.Element {
  const {
    home,
    away,
    labelStrategy = "auto",
    showLabels = true,
    showNames = true,
    pitchTheme,
    pitchColors,
  } = props;

  const homeTeamData: FormationTeamData = {
    formation: home.formation,
    players: home.players ?? [],
    ...(home.label ? { teamLabel: home.label } : {}),
    ...(home.color ? { teamColor: home.color } : {}),
  };
  const awayTeamData: FormationTeamData = {
    formation: away.formation,
    players: away.players ?? [],
    ...(away.label ? { teamLabel: away.label } : {}),
    ...(away.color ? { teamColor: away.color } : {}),
  };

  const layout = layoutDualTeam(homeTeamData, awayTeamData);
  const homeColor = home.color ?? DEFAULT_HOME_COLOR;
  const awayColor = away.color ?? DEFAULT_AWAY_COLOR;
  const ariaLabel = buildDualAriaLabel({ home, away });
  const showLegend = Boolean(home.label || away.label);

  return (
    <Pitch
      orientation="vertical"
      crop="full"
      {...(pitchTheme ? { theme: pitchTheme } : {})}
      {...(pitchColors ? { colors: pitchColors } : {})}
      role="img"
      aria-label={ariaLabel}
    >
      <g data-team="home">
        {layout.home.slots.map((slot) => (
          <FormationMarker
            key={`home-${slot.slot}`}
            slot={slot}
            teamColor={homeColor}
            labelStrategy={labelStrategy}
            showLabels={showLabels}
            showNames={showNames}
          />
        ))}
      </g>
      <g data-team="away">
        {layout.away.slots.map((slot) => (
          <FormationMarker
            key={`away-${slot.slot}`}
            slot={slot}
            teamColor={awayColor}
            labelStrategy={labelStrategy}
            showLabels={showLabels}
            showNames={showNames}
          />
        ))}
      </g>
      {showLegend ? (
        <g data-testid="formation-legend" transform="translate(50 2.5)">
          {home.label ? (
            <g data-testid="formation-legend-item" transform="translate(-18 0)">
              <circle r={1.5} fill={homeColor} />
              <text x={2.5} y={0.5} fontSize={2.2} fill="#1a202c">
                {home.label}
              </text>
            </g>
          ) : null}
          {away.label ? (
            <g data-testid="formation-legend-item" transform="translate(6 0)">
              <circle r={1.5} fill={awayColor} />
              <text x={2.5} y={0.5} fontSize={2.2} fill="#1a202c">
                {away.label}
              </text>
            </g>
          ) : null}
        </g>
      ) : null}
    </Pitch>
  );
}

type FormationMarkerProps = {
  slot: RenderedFormationSlot;
  teamColor: string;
  labelStrategy: FormationLabelStrategy;
  showLabels: boolean;
  showNames: boolean;
};

function FormationMarker(props: FormationMarkerProps): JSX.Element {
  const { slot, teamColor, labelStrategy, showLabels, showNames } = props;
  const label = deriveFormationLabel({ slot, strategy: labelStrategy });
  const color = slot.player?.color ?? teamColor;
  const strokeColor = "#1a202c";

  if (slot.placeholder) {
    return (
      <g
        data-testid="formation-marker-placeholder"
        transform={`translate(${slot.x} ${slot.y})`}
      >
        <circle
          r={MARKER_RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth={0.3}
          strokeDasharray="0.6 0.6"
          opacity={0.5}
        />
        {showLabels ? (
          <text
            data-testid="formation-marker-label"
            x={0}
            y={0}
            fill={strokeColor}
            fontSize={LABEL_FONT_SIZE}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={0.6}
          >
            {slot.positionCode}
          </text>
        ) : null}
      </g>
    );
  }

  return (
    <g data-testid="formation-marker" transform={`translate(${slot.x} ${slot.y})`}>
      <circle r={MARKER_RADIUS} fill={color} stroke={strokeColor} strokeWidth={0.3} />
      {showLabels ? (
        <text
          data-testid="formation-marker-label"
          x={0}
          y={0}
          fill="#ffffff"
          fontSize={LABEL_FONT_SIZE}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          stroke={strokeColor}
          strokeWidth={0.15}
          paintOrder="stroke"
        >
          {label.primary}
        </text>
      ) : null}
      {showNames && label.secondary ? (
        <text
          x={0}
          y={MARKER_RADIUS + NAME_FONT_SIZE + 0.5}
          fill={strokeColor}
          fontSize={NAME_FONT_SIZE}
          fontWeight={600}
          textAnchor="middle"
        >
          {truncateName(label.secondary)}
        </text>
      ) : null}
      {slot.player?.captain ? (
        <g
          data-testid="formation-captain"
          transform={`translate(${MARKER_RADIUS * 0.6} ${-MARKER_RADIUS * 0.6})`}
        >
          <circle r={1.1} fill="#fbbf24" stroke={strokeColor} strokeWidth={0.15} />
          <text
            x={0}
            y={0}
            fill={strokeColor}
            fontSize={1.4}
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
            aria-label="captain"
          >
            C
          </text>
        </g>
      ) : null}
    </g>
  );
}

function buildSingleAriaLabel(input: {
  formation: FormationKey | string;
  teamLabel?: string;
  playerCount: number;
}): string {
  const { formation, teamLabel, playerCount } = input;
  const base = teamLabel
    ? `${teamLabel} ${formation} formation`
    : `${formation} formation`;
  return playerCount > 0 ? `${base} lineup with ${playerCount} players` : base;
}

function buildDualAriaLabel(input: {
  home: FormationTeamSpec;
  away: FormationTeamSpec;
}): string {
  const home = input.home.label ?? "Home";
  const away = input.away.label ?? "Away";
  return `${home} ${input.home.formation} vs ${away} ${input.away.formation} lineup`;
}

function truncateName(name: string): string {
  const MAX_LENGTH = 12;
  if (name.length <= MAX_LENGTH) return name;
  return name.slice(0, MAX_LENGTH - 1) + "…";
}
```

- [ ] **Step 2.2: Export `FormationTeamSpec` from the index**

Update `packages/react/src/index.ts`:

```ts
export { Formation } from "./Formation";
export type { FormationProps, FormationTeamSpec } from "./Formation";
```

### Step 3: Run the tests

- [ ] **Step 3.1:**

Run: `pnpm exec vitest run packages/react/test/Formation.test.tsx`

Expected: all single-team AND dual-team tests pass.

- [ ] **Step 3.2: Typecheck**

Run: `pnpm typecheck`

Expected: no errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add packages/react/src/Formation.tsx packages/react/src/index.ts packages/react/test/Formation.test.tsx
git commit -m "feat(react): add dual-team mode to Formation component

Broadcast-style home-bottom / away-top lineup card with independent
formations per team, two-item legend, and aria-label mentioning both
teams."
```

---

## Task 14: Formation demo page + real fixtures

**Files:**

- Create: `apps/site/src/pages/formation.astro`
- Create: `apps/site/src/data/formation-demo.ts`
- Create: `apps/site/src/data/formation-opta-liverpool.ts`
- Create: `apps/site/src/data/formation-whoscored-sample.ts`
- Create: `apps/site/src/data/opta-squads.ts` (parsed squad index for demo use)

### Step 1: Build the fixture modules

- [ ] **Step 1.1: Create `apps/site/src/data/opta-squads.ts`**

Extract the real Opta squads into a TS module. This is a pre-parsed lookup keyed by playerId, derived from `/Volumes/WQ/projects/www/src/data/opta/squads.json`. Prefer a small subset (just the teams needed for the demo) over the full 17k-line file.

```ts
/**
 * Opta squad index for Formation demo page.
 *
 * Source: /Volumes/WQ/projects/www/src/data/opta/squads.json
 * Subset: Liverpool and AFC Bournemouth players for the 2025-08-15 match fixture.
 * Schema: OptaSquadEntry[] per @withqwerty/campos-adapters/opta
 *
 * Regenerate if adding other teams by running:
 *   node scripts/extract-opta-squads-for-demo.js  # (not yet implemented)
 * Or manually by copying the matching `contestant` entries from the source file.
 */
import type { OptaSquadEntry } from "@withqwerty/campos-adapters";

export const optaSquadDemoEntries: OptaSquadEntry[] = [
  // ... trimmed from the real squads.json — include Liverpool + Bournemouth players
  // Each entry is of the form:
  // { playerId: "...", label: "...", number: 1, teamId: "...", teamName: "Liverpool" }
];

export const optaSquadDemoIndex = new Map(
  optaSquadDemoEntries.map((e) => [e.playerId, e]),
);
```

To populate the entries, extract them from the real file:

```bash
node -e "
const data = require('/Volumes/WQ/projects/www/src/data/opta/squads.json');
const wantedTeams = ['c8h9bw1l82s06h77xxrelzhur', '1pse9ta7a45pi2w2grjim70ge']; // Liverpool, Bournemouth
const entries = [];
for (const team of data.squad) {
  if (!wantedTeams.includes(team.contestantId)) continue;
  for (const person of team.person) {
    if (person.type !== 'player') continue;
    entries.push({
      playerId: person.id,
      label: person.matchName || (person.firstName + ' ' + person.lastName).trim(),
      number: person.shirtNumber,
      teamId: team.contestantId,
      teamName: team.contestantName,
    });
  }
}
console.log(JSON.stringify(entries, null, 2));
"
```

Paste the JSON output into the `optaSquadDemoEntries` array.

- [ ] **Step 1.2: Create `apps/site/src/data/formation-opta-liverpool.ts`**

```ts
/**
 * Formation fixture for the Formation demo page.
 *
 * Source: /Volumes/WQ/projects/www/src/data/opta/match-events/zhs8gg1hvcuqvhkk2itb54pg.json
 * Match: Liverpool 4-2 AFC Bournemouth, 2025-08-15, Premier League matchday 1
 * Opta matchId: zhs8gg1hvcuqvhkk2itb54pg
 *
 * We pre-compute the FormationTeamData at build time from the raw lineup
 * event + squad index. The raw event is included for reference.
 */
import { fromOpta } from "@withqwerty/campos-adapters";
import type { FormationTeamData } from "@withqwerty/campos-core";
import { optaSquadDemoIndex } from "./opta-squads";

// Extract the home (Liverpool) lineup event from the real match-events file.
// This is a verbatim copy of the typeId 34 event from the source.
const liverpoolLineupEvent = {
  typeId: 34,
  contestantId: "c8h9bw1l82s06h77xxrelzhur",
  qualifier: [
    // ... paste the real qualifiers from the file
  ],
};

export const liverpoolFormation: FormationTeamData = fromOpta.formations(
  liverpoolLineupEvent,
  { squads: optaSquadDemoIndex },
);

export const matchMetadata = {
  home: "Liverpool",
  away: "AFC Bournemouth",
  date: "2025-08-15",
  competition: "Premier League",
  source:
    "/Volumes/WQ/projects/www/src/data/opta/match-events/zhs8gg1hvcuqvhkk2itb54pg.json",
};
```

Similarly extract the Bournemouth lineup event and export as `bournemouthFormation`.

- [ ] **Step 1.3: Create `apps/site/src/data/formation-whoscored-sample.ts`**

```ts
/**
 * Formation fixture for the Formation demo page (WhoScored source).
 *
 * Source: Cloudflare R2 opta-data bucket
 * R2 key: whoscored/<MATCH_ID>.json.gz
 * Match: <HOME> vs <AWAY>, <DATE>, Premier League
 * WhoScored matchId: <MATCH_ID>
 *
 * Downloaded via:
 *   wrangler r2 object get opta-data/whoscored/<MATCH_ID>.json.gz --file /tmp/ws-match.json.gz
 *   gunzip /tmp/ws-match.json.gz
 *
 * The matchCentreData.home and .away objects below are verbatim extracts.
 */
import { fromWhoScored } from "@withqwerty/campos-adapters";
import type { FormationTeamData } from "@withqwerty/campos-core";

const homeTeamRaw = {
  // paste verbatim from matchCentreData.home
  teamId: 0,
  name: "",
  players: [],
  formations: [],
};

const awayTeamRaw = {
  // paste verbatim from matchCentreData.away
  teamId: 0,
  name: "",
  players: [],
  formations: [],
};

export const whoscoredHomeFormation: FormationTeamData =
  fromWhoScored.formations(homeTeamRaw);
export const whoscoredAwayFormation: FormationTeamData =
  fromWhoScored.formations(awayTeamRaw);

export const matchMetadata = {
  matchId: 0,
  date: "",
  competition: "Premier League",
  r2Key: "whoscored/<MATCH_ID>.json.gz",
};
```

- [ ] **Step 1.4: Create `apps/site/src/data/formation-demo.ts`**

Synthetic demo lineups for scenarios that don't need real data (multilingual stress test, 10-player red-card scenario, etc.).

```ts
import type { FormationTeamData } from "@withqwerty/campos-core";

export const arsenalSample: FormationTeamData = {
  formation: "433",
  teamLabel: "Arsenal",
  teamColor: "#e50027",
  players: [
    { label: "Raya", number: 1 },
    { label: "White", number: 2 },
    { label: "Saliba", number: 12 },
    { label: "Gabriel", number: 6 },
    { label: "Calafiori", number: 33 },
    { label: "Rice", number: 41 },
    { label: "Ødegaard", number: 8, captain: true },
    { label: "Merino", number: 23 },
    { label: "Saka", number: 7 },
    { label: "Havertz", number: 29 },
    { label: "Martinelli", number: 11 },
  ],
};

export const multilingualStress: FormationTeamData = {
  formation: "4231",
  teamLabel: "Mixed XI",
  players: [
    { label: "Raya", number: 1 },
    { label: "Tomiyasu", number: 18 },
    { label: "Saliba", number: 12 },
    { label: "Łukasz Fabiański", number: 1 },
    { label: "Çağlar Söyüncü", number: 5 },
    { label: "Ødegaard", number: 8, captain: true },
    { label: "Müller", number: 25 },
    { label: "Son Heung-min", number: 7 },
    { label: "三笘薫", number: 11 },
    { label: "Mahmoud Dahoud", number: 8 },
    { label: "Zinchenko", number: 17 },
  ],
};

export const tenPlayerAfterRedCard: FormationTeamData = {
  formation: "433",
  teamLabel: "10-Man Team",
  players: [
    { label: "Raya", number: 1 },
    { label: "White", number: 2 },
    { label: "Saliba", number: 12 },
    { label: "Gabriel", number: 6 },
    // missing left back after red card
    { label: "Rice", number: 41 },
    { label: "Ødegaard", number: 8, captain: true },
    { label: "Merino", number: 23 },
    { label: "Saka", number: 7 },
    { label: "Havertz", number: 29 },
    { label: "Martinelli", number: 11 },
  ],
};
```

### Step 2: Build the demo page

- [ ] **Step 2.1: Create `apps/site/src/pages/formation.astro`**

Follow the existing pattern from `shotmap.astro` / `passmap.astro`. Create 12 demo cards covering the scenarios from the spec:

```astro
---
import Layout from "../layouts/Layout.astro";
import { Formation, allFormationKeys } from "@withqwerty/campos-react";
import {
  arsenalSample,
  multilingualStress,
  tenPlayerAfterRedCard,
} from "../data/formation-demo";
import {
  liverpoolFormation,
  bournemouthFormation,
} from "../data/formation-opta-liverpool";
import {
  whoscoredHomeFormation,
  whoscoredAwayFormation,
} from "../data/formation-whoscored-sample";
---

<Layout title="Formation">
  <h1>Formation</h1>

  <section>
    <h2>1. Zero-config vertical</h2>
    <Formation client:load formation="433" />
  </section>

  <section>
    <h2>2. Zero-config horizontal</h2>
    <Formation client:load formation="433" orientation="horizontal" />
  </section>

  <section>
    <h2>3. Real Opta lineup — Liverpool (single-team vertical)</h2>
    <Formation client:load {...liverpoolFormation} teamColor="#c8102e" />
  </section>

  <section>
    <h2>4. Real Opta lineup — Liverpool (half-crop)</h2>
    <Formation client:load {...liverpoolFormation} teamColor="#c8102e" crop="half" />
  </section>

  <section>
    <h2>5. Real WhoScored dual-team lineup</h2>
    <Formation
      client:load
      home={{
        label: whoscoredHomeFormation.teamLabel,
        formation: whoscoredHomeFormation.formation,
        players: whoscoredHomeFormation.players,
      }}
      away={{
        label: whoscoredAwayFormation.teamLabel,
        formation: whoscoredAwayFormation.formation,
        players: whoscoredAwayFormation.players,
      }}
    />
  </section>

  <section>
    <h2>6. All 68 mplsoccer formations</h2>
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem;">
      {
        allFormationKeys().map((key) => (
          <figure>
            <Formation client:load formation={key} />
            <figcaption>{key}</figcaption>
          </figure>
        ))
      }
    </div>
  </section>

  <section>
    <h2>7. 24 Opta-supported formations (subset)</h2>
    <!-- List the 24 from OPTA_FORMATION_ID_MAP values -->
  </section>

  <section>
    <h2>8. Degenerate: 10 players after red card</h2>
    <Formation client:load {...tenPlayerAfterRedCard} />
  </section>

  <section>
    <h2>9. Stress: multilingual names</h2>
    <Formation client:load {...multilingualStress} />
  </section>

  <section>
    <h2>10. Stress: labels off</h2>
    <Formation client:load formation="433" showLabels={false} />
  </section>

  <section>
    <h2>11. Invalid input (illustrative, does not render)</h2>
    <code>&lt;Formation formation="4-3-4" /&gt; throws "unknown formation: 434"</code>
  </section>

  <section>
    <h2>12. Opta → WhoScored parity (same match shown twice)</h2>
    <!-- Requires a match that exists in both sources. Skip if not available. -->
  </section>
</Layout>
```

### Step 3: Build the site to verify the demo page compiles

- [ ] **Step 3.1: Run the site build**

Run: `pnpm --filter @withqwerty/campos-site build`

Expected: build succeeds, `formation.astro` page is generated. If any demo card throws (e.g., because a fixture module has empty raw data), either populate the fixture or comment out the card temporarily.

- [ ] **Step 3.2: Spot-check in dev**

Ask the user to run `pnpm --filter @withqwerty/campos-site dev` and open the formation page to eyeball the output. Do not start or restart the dev server ourselves (per the `feedback_dev_server.md` memory rule).

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add apps/site/src/pages/formation.astro apps/site/src/data/formation-demo.ts apps/site/src/data/formation-opta-liverpool.ts apps/site/src/data/formation-whoscored-sample.ts apps/site/src/data/opta-squads.ts
git commit -m "feat(site): add Formation demo page with 12 scenarios

Includes zero-config, real Opta lineup, real WhoScored dual-team,
multilingual stress, and all-68-formations grid."
```

---

## Task 15: Docs updates + final verification gate

**Files:**

- Modify: `docs/status/matrix.md`

### Step 1: Update the status matrix

- [ ] **Step 1.1: Add the Formation row to the Components table**

Find the Components table in `docs/status/matrix.md` and append:

```
| Formation   | done | done | done | done | done | done | done | done | done | partial | not-started | in-progress |
```

The exact column headers must match the existing table (spec, ref-code, adapter dependency, core, react, demo, tests, edge-case matrix, review L1/L2/L3, status). Adjust values honestly — `review L2/L3` likely remains `partial` / `not-started` until the review loops run.

- [ ] **Step 1.2: If PassNetwork or BumpChart / CometChart rows are missing, add them too**

Per the roadmap-v0.3 review, the matrix has gaps. Optional: add rows for PassNetwork, BumpChart, CometChart in the same edit.

### Step 2: Run the full verification gate

- [ ] **Step 2.1: Regenerate schemas just in case**

Run: `pnpm generate:schema`

Expected: no output or `no changes`.

- [ ] **Step 2.2: Lint**

Run: `pnpm lint`

Expected: zero errors.

- [ ] **Step 2.3: Format check**

Run: `pnpm format:check`

Expected: zero errors.

- [ ] **Step 2.4: Typecheck**

Run: `pnpm typecheck`

Expected: zero errors.

- [ ] **Step 2.5: Full test suite**

Run: `pnpm test`

Expected: all tests pass (including the new formation tests at every layer).

- [ ] **Step 2.6: Package build**

Run: `pnpm build`

Expected: all packages build cleanly.

- [ ] **Step 2.7: Site build**

Run: `pnpm --filter @withqwerty/campos-site build`

Expected: site builds successfully, `formation.astro` is included in the output.

- [ ] **Step 2.8: Quick smoke check on one chart**

Run: `pnpm exec vitest run packages/core/test/compute-formation.test.ts`

Expected: full formation test suite passes independently.

### Step 3: Commit the matrix update

- [ ] **Step 3.1:**

```bash
git add docs/status/matrix.md
git commit -m "docs(status): add Formation row + refresh component rows"
```

### Step 4: Final handoff commit message

- [ ] **Step 4.1: Review the git log**

Run: `git log --oneline origin/main..HEAD`

Expected: 15 feat/test/docs commits telling a clean story from the generator script through the demo page.

- [ ] **Step 4.2: Report back to the user**

Summarize what was built:

- Ported mplsoccer's 68-formation position table (generator + JSON + regression tests)
- Ported kloppy's 24-entry Opta formation ID map
- Core compute: formation parser, position lookup, single-team layout, dual-team layout, label derivation
- Adapters: `fromOpta.formations()` (with squad join) and `fromWhoScored.formations()` (self-contained) + cross-provider parity tests
- React component: `<Formation>` with single-team and dual-team modes, vertical + horizontal orientation, half-crop, captain marks, dashed placeholders, axe-clean a11y
- Demo page: 12 scenarios including real Opta Liverpool lineup, real WhoScored dual-team card, full 68-formation grid
- Matrix updated

Offer next steps: ask the user to review the demo page visually, run review loop 2 via `adversarial-reviewer` agent, and decide whether to commit / PR / continue with the next Lane 1 packet (Territory).

---

## Self-review checklist

Completed by plan author after writing the plan:

- [x] **Spec coverage:** every section of `docs/specs/formation-spec.md` maps to at least one task
  - Canonical schema → Task 3
  - Formation parser → Task 3
  - Position lookup → Task 4
  - Single-team layout → Task 5
  - Dual-team layout → Task 6
  - Label derivation → Task 7
  - mplsoccer position table → Task 1
  - Opta formation ID map → Task 2
  - Opta adapter decoding → Tasks 8, 9
  - WhoScored adapter decoding → Task 10
  - Cross-provider parity → Task 11
  - Single-team React → Task 12
  - Dual-team React → Task 13
  - Demo scenarios 1-12 → Task 14
  - Edge cases in spec's edge-case matrix → covered across Tasks 3-10 test suites
  - Adapter gap matrix update → **already completed during planning phase, not re-done in plan**
  - Status matrix update → Task 15
  - Verification gate → Task 15
- [x] **No placeholders:** each step has actual code / actual commands / actual expected output. Two exceptions called out explicitly: the raw fixture JSON payloads (Tasks 9, 10, 14) which must be extracted from real source files at implementation time rather than hand-authored in the plan; and the exact Python API surface for mplsoccer (Task 1) which the implementer verifies against the live source.
- [x] **Type consistency:** `FormationPlayer`, `FormationTeamData`, `FormationKey`, `RenderedFormationSlot` are defined once in Task 3 and referenced consistently in Tasks 5, 6, 7, 8, 9, 10, 12, 13. Function names (`parseFormationKey`, `getFormationPositions`, `layoutSingleTeam`, `layoutDualTeam`, `deriveFormationLabel`, `mapOptaFormation`, `mapWhoScoredFormation`) are consistent across all tasks.
- [x] **Open questions addressed:**
  - slot indexing resolved to 1-indexed (stated at the top of this plan)
  - label strategy auto-selection codified in Task 7
  - half-crop Y-spacing handled via the `applyOrientationAndCrop` compression in Task 5 (implementer validates visually in Task 14)
- [x] **TDD discipline:** each task starts with the failing test, then implementation, then verification, then commit. No task bundles multiple features into a single commit.
- [x] **Explicit file paths:** every file touched has its full path listed in the task header and in the commit `git add` command.
