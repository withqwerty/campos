# Adversarial Review Template

**Status:** draft template

## Header

- Review target:
- Round:
- Date:
- Scope:
- Inputs reviewed:

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`, then list only the relevant repositories actually inspected.

| Repo    | Why it was relevant | What it revealed | Why Campos should follow or diverge |
| ------- | ------------------- | ---------------- | ----------------------------------- |
| example | example             | example          | example                             |

## Review method

- premise challenge
- contradiction detection
- failure-scenario construction
- edge-case attack
- test-plan challenge

## Findings

List findings from highest severity to lowest severity.

### Finding N: title

- Confidence:
- Severity:
- Blocks:
- Problem:
- Failure scenario:
- Required fix:

## Required checks by loop

### Loop 1: spec review

Check for:

- undefined terms
- contradictory types across docs
- missing provider fields
- hidden adapter assumptions
- untestable claims
- scope creep

### Loop 2: implementation review

Check for:

- core/render separation violations
- renderer-only logic hiding product semantics
- missing demo coverage
- missing regression tests
- degraded empty/fallback behavior
- accessibility regressions

### Loop 3: release-readiness review

Check for:

- docs no longer matching implementation
- open risks not recorded
- partial adapter support presented as full support
- review comments “addressed” without proof

## Close-out

- Ship:
- Blockers remaining:
- Follow-up issues required:
- Status matrix updated:

## Gate summary

The JSON block below is required. The gate runner (`pnpm agent-gate`) reads
the last ` ```json ` block in this file — do not add other JSON blocks after
this one.

Required fields: `ship`, `blockersRemaining`, `findings`.
Each finding must have `severity` (P0–P3) and `title`.

```json
{
  "target": "",
  "round": "",
  "ship": "YES | YES with fixes | NO",
  "blockersRemaining": false,
  "findings": [{ "severity": "P0", "title": "example blocker" }]
}
```
