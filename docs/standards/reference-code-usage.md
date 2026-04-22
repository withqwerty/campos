# Reference Code Usage

**Status:** active
**Scope:** how Campos uses `/Volumes/WQ/ref_code/` and web sources during design, implementation, and review
**Purpose:** define when reference code and public docs should inform scope, edge cases, and divergences without becoming source of truth

Campos should use the reference-code library to avoid solving already-solved football-specific problems from scratch. Campos should not inherit those implementations uncritically.

When local coverage is thin, when the user explicitly asks for web research, or
when the question is really about current public library behavior, use official
web docs and source pages as well.

## Default workflow

1. Start at `/Volumes/WQ/ref_code/INDEX.md`.
2. Identify whether the current primitive, layer, component, or adapter problem has real coverage there.
3. Inspect only the relevant repositories.
4. If local coverage is incomplete or the problem is current/fast-moving,
   inspect the relevant official web docs or source pages too.
5. Record what was learned:
   - scope and expected feature set
   - edge cases already handled or missed
   - implementation patterns worth reusing
   - reasons Campos should diverge

## Use by work type

### Adapter and coordinate work

- prefer `kloppy` for coordinate-system and provider-normalization cross-checks
- consult `socceraction` when action schemas or xT assumptions matter

When `kloppy` is the main reference, keep the explicit Campos boundary in mind:
Campos may pursue parity on adopted adapter seams, but it is not trying to
replace `kloppy` or mirror its whole event-plus-tracking scope. See
`docs/kloppy-relationship.md`.

### Static football-viz primitives and charts

- prefer `mplsoccer`

Examples:

- pitch framing
- pass arrows
- heatmaps
- Voronoi
- radar / pizza / bumpy

### Interactive browser-specific patterns

- prefer `d3-soccer`

Examples:

- interactive overlays
- linked views
- hover interactions on dense scenes

### Cross-cutting component-library concerns

When the work is about component-library design rather than football semantics,
prefer official docs for mature libraries that solve the same cross-cutting
problem.

Examples:

- Radix Primitives / Base UI for anatomy, state exposure, composition, and
  accessibility contracts
- shadcn/ui for open-code distribution, token discipline, and predictable
  usage conventions

## Divergence rule

Campos should improve on the reference implementations where needed:

- React-first component library: styling and visual decisions belong in components via callback-first style props, not in renderer-specific low-level logic
- stronger adapter contracts
- stricter fallbacks and empty states
- higher accessibility and responsive standards
- clearer public API boundaries

## Anti-patterns

Do not:

- cite a reference repo that does not actually cover the primitive or chart in question
- copy rendering details without understanding the data assumptions
- let official library docs override Campos’ chart-shaped, zero-config-first
  product direction
- let reference code override Campos source-of-truth docs
- treat absence of coverage in `/Volumes/WQ/ref_code` as evidence that the feature should not exist

## Recording requirement

Each component spec and adversarial review should include a short “Reference code consulted” section with:

- repositories consulted
- official web docs or source pages consulted, when used
- why they were relevant
- what Campos kept
- what Campos intentionally changed
