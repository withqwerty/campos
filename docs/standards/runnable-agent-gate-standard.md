# Runnable Agent Gate Standard

**Status:** active
**Scope:** turning Campos ship standards into repeatable runnable gates for components, primitives, adapters, and demo pages
**Purpose:** define how to combine deterministic checks with agent-driven review so release readiness can be evaluated the same way every time

Campos already has good review standards, but most of them are prose-only. This document defines how to make them executable without pretending that an adversarial or visual review is the same thing as a unit test.

The short version:

- deterministic checks stay deterministic
- agent reviews become versioned gate steps with fixed inputs and fixed output shape
- the gate runner fails on blocking findings and writes review artefacts for humans to fix against

This is a release gate, not a replacement for core/react/unit/integration tests.

## What “runnable” means in Campos

A runnable gate must:

1. take a declared review target
2. know which standards apply to that target
3. run deterministic commands first
4. run one or more fixed-prompt agent reviews after the deterministic layer is green
5. write machine-locatable review artefacts
6. exit with a pass/fail status based on a clear severity policy

If a check cannot affect exit status, it is not part of the runnable gate. It may still be useful as an advisory review.

## Review Target Types

Campos has at least four review target types:

- `component`
- `primitive-family`
- `adapter`
- `demo-page`

Each target type uses a different combination of standards.

## Applicable Standards By Target Type

### Component

Use:

- `docs/standards/component-ship-checklist.md`
- `docs/standards/component-state-review-standard.md`
- `docs/standards/demo-page-standard.md`
- `docs/standards/react-renderer-conventions.md`
- `docs/templates/review-adversarial.md`

### Primitive family

Use:

- `docs/standards/component-ship-checklist.md`
- `docs/standards/component-state-review-standard.md`
- `docs/standards/react-renderer-conventions.md`
- `docs/templates/review-adversarial.md`

### Adapter

Use:

- `docs/standards/adapter-gap-matrix.md`
- `docs/standards/adapter-method-matrix.md`
- `docs/standards/reference-code-usage.md`
- `docs/templates/review-adversarial.md`

### Demo page

Use:

- `docs/standards/demo-page-standard.md`
- `docs/standards/component-state-review-standard.md`
- `docs/templates/review-adversarial.md`

## Gate Structure

Every runnable gate has three phases.

### Phase A: deterministic checks

These are normal commands and must run first.

Examples:

- `pnpm typecheck`
- `pnpm exec vitest run packages/react/test/Heatmap.test.tsx`
- `pnpm --filter @withqwerty/campos-site build`
- `pnpm lint`
- `pnpm format:check`

If Phase A fails, stop. Do not run the agent phases and do not report “review complete”.

### Phase B: agent review checks

These are non-deterministic in implementation but deterministic in contract.

Use versioned agent prompts with:

- fixed target
- fixed required inputs
- fixed output schema
- fixed severity taxonomy
- fixed ship verdict field

Current built-in review agents already cover the two most important review dimensions:

- `.claude/agents/adversarial-reviewer.md`
- `.claude/agents/visual-verifier.md`

If those agent briefs change materially, the gate standard version has changed.

### Phase C: gate evaluation

The runner parses the output artefacts and converts them to a gate verdict.

At minimum the runner must read:

- `Ship:`
- `Blockers remaining:`
- finding severities
- confidence level if present

The runner should fail when the report shape is malformed or missing.

## Severity Policy

The gate must use a stable failure policy.

### Beta / preview release

Allowed:

- open `P2` and `P3` findings
- known gaps recorded in docs
- advisory visual polish findings

Blocked by:

- any `P0` or `P1`
- malformed or missing review artefacts
- failed deterministic checks
- undocumented unsupported behavior presented as supported

### Stable release

Allowed:

- open `P3` items only, if explicitly documented as non-blocking

Blocked by:

- any `P0`, `P1`, or `P2`
- missing review loop artefacts
- docs/demo/API drift that changes the public contract
- failed deterministic checks

## Required Artefacts

Each gate run must leave behind:

- one manifest describing the target and commands
- one or more review reports in `docs/reviews/`
- one machine-readable summary file, or a summary block that can be parsed reliably

Suggested report paths:

- `docs/reviews/<target>-loop2-YYYY-MM-DD.md`
- `docs/reviews/<target>-loop3-YYYY-MM-DD.md`

Suggested summary path:

- `docs/reviews/<target>-gate-summary.json`

## Manifest Shape

The gate runner should not infer scope from file names. Give it a manifest.

Suggested shape:

```json
{
  "target": "Heatmap",
  "kind": "component",
  "releaseLevel": "beta",
  "specPath": "docs/specs/heatmap-spec.md",
  "matrixRow": "Heatmap",
  "demoPage": "apps/site/src/pages/heatmap.astro",
  "reviewOutputs": [
    "docs/reviews/heatmap-loop2-2026-04-14.md",
    "docs/reviews/heatmap-loop3-2026-04-14.md"
  ],
  "deterministicChecks": [
    "pnpm exec vitest run packages/react/test/Heatmap.test.tsx",
    "pnpm --filter @withqwerty/campos-site build"
  ],
  "agentChecks": [
    {
      "agent": "adversarial-reviewer",
      "round": "loop2",
      "requiredInputs": [
        "docs/specs/heatmap-spec.md",
        "docs/status/matrix.md",
        "docs/templates/review-adversarial.md"
      ]
    },
    {
      "agent": "visual-verifier",
      "round": "loop3",
      "requiredInputs": [
        "docs/standards/demo-page-standard.md",
        "apps/site/src/pages/heatmap.astro"
      ]
    }
  ]
}
```

The exact file format can be JSON, JSONC, YAML, or TypeScript config. The important thing is that the contract is explicit and parseable.

## Output Contract For Agent Reviews

Do not parse arbitrary prose. Require the agent report to include stable headings.

Minimum required fields:

- target
- round
- files reviewed
- findings
- severity for each finding
- ship verdict
- blockers remaining
- follow-up issues required

For adversarial reviews, the existing `docs/templates/review-adversarial.md` is already close. Tighten it if needed, but do not allow each run to improvise its own structure.

## Recommended Gate Profiles

### `component-beta`

Run:

- targeted tests
- site build
- adversarial review loop 2
- visual verification loop 3, or a documented “blocked because no running site” result

Pass when:

- deterministic checks pass
- no `P0` or `P1`
- docs/demo/spec are close enough that users can try the component honestly

### `component-stable`

Run:

- `pnpm check`
- site build
- adversarial review loop 2
- release-readiness loop 3
- visual verification
- component state review

Pass when:

- deterministic checks pass
- no `P0`, `P1`, or `P2`
- matrix/docs/readme/demo are aligned

### `adapter-beta`

Run:

- fixture-backed adapter tests
- typecheck
- adversarial adapter review

Pass when:

- deterministic checks pass
- no hidden provider assumptions remain undocumented
- lossy mappings are explicit

### `adapter-stable`

Run:

- full adapter test suite for the touched provider/product
- typecheck
- adversarial adapter review
- documentation alignment review

Pass when:

- deterministic checks pass
- provider/version support is explicit
- no unresolved `P0` to `P2`

## Agent Reviews Are Not Snapshot Tests

Do not treat an agent review as a golden-file renderer test.

Good uses:

- completeness checking
- contradiction detection
- demo quality review
- edge-case attack generation
- docs/API drift detection

Bad uses:

- pixel-perfect screenshot approval
- flaky “looks good” pass/fail with no findings schema
- replacing deterministic tests

## Recommended Implementation Pattern

If Campos adds a gate runner, implement it as:

1. load manifest
2. run deterministic commands
3. stop on failure
4. invoke the named agent reviews with fixed prompts and fixed output paths
5. parse the generated reports
6. emit one summary object
7. exit non-zero when the release-level policy is violated

Keep the runner small. The policy belongs in docs and manifests, not in opaque code.

## What To Make Machine-Enforced First

Start with the smallest useful scope.

Phase 1:

- parse manifest
- run deterministic checks
- require existing review markdown files to exist and contain required headings
- fail if blockers are present

Phase 2:

- invoke agent reviews automatically
- parse severity blocks and verdicts
- write gate summaries

Phase 3:

- add CI jobs for changed targets only
- publish review artefacts as CI outputs

## Current Recommendation For Campos

Yes, Campos should make standards runnable, but not by trying to collapse everything into Vitest.

The right model is:

- keep product behavior in unit/integration/browser tests
- add a gate manifest per release target
- run agent reviews as structured quality gates
- fail beta/stable release lanes based on severity policy

That gives you something actionable:

- the agent can report concrete fixes
- the runner can block release
- the repo keeps the evidence in `docs/reviews/`

## Minimum Next Step

Add a small gate runner only after this standard is accepted.

The first implementation should support one target type:

- `component-beta`

and one output action:

- produce a review summary and non-zero exit on blockers

That is enough to prove the pattern without overbuilding it.
