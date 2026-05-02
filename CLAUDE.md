# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in the public Campos repository.

Campos uses `AGENTS.md` as the primary, agent-neutral guidance file (also read
by Codex, Cursor, Aider, and similar tools). Read `AGENTS.md` first — it covers
what this repo is, the architecture, build commands, testing standards, and
commit conventions. Everything below adds only Claude-specific notes on top.

## Claude-specific Notes

- For broad codebase questions, launch the Explore agent. For known paths, use
  Read and Grep directly.
- For any visual change (component, demo, chart, or renderer), open the affected
  page in a browser and verify the rendered output before declaring the task
  complete. Passing typecheck, tests, and build is necessary but not sufficient
  for visual correctness.
- When unsure about provider-specific data shapes — Opta qualifier IDs,
  StatsBomb event types, coordinate origins — prefer reading the provider docs
  or canonical reference implementations (e.g. `kloppy`, `mplsoccer`) over
  guessing from training data. Provider mappings drift; guesses cost trust.
- Schema changes: edit the source under `schema/*.schema.json` and run
  `pnpm generate:schema`. Never hand-edit `packages/schema/src/generated.ts`.
- Treat types, JSDoc, and error messages as part of the public API surface.
  Changes there need the same care as changing exported functions.

## Scope of Work

Work on `campos-internal` (private monorepo) if you have access — it is the
source of truth, and the public `campos` repo is populated by export tooling.
If you only have this public repo, do not attempt to coordinate changes across
the deployed docs site — that lives in a separate repo and is not in scope here.
