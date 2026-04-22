# Releasing Campos

This is the operational runbook for publishing new versions of the `@withqwerty/campos-*` packages to npm. It covers day-to-day release work: prerequisites, versioning, the publish flow, post-publish verification, and what to do when things go wrong.

Audience: anyone cutting a release, including future-you.

## Published packages

Five packages currently publish to npm under the `@withqwerty` scope:

| Package                       | Role                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `@withqwerty/campos-schema`   | Canonical TypeScript types generated from JSON schemas       |
| `@withqwerty/campos-adapters` | Provider normalization (Opta, StatsBomb, WhoScored, Wyscout) |
| `@withqwerty/campos-stadia`   | React pitch primitives                                       |
| `@withqwerty/campos-react`    | React SVG chart components, compute logic, and main entry    |
| `@withqwerty/campos-static`   | Node-side SVG/PNG export for the stable export contract      |

The docs/demo site is not part of this package release workflow. It should live
in a separate site repo and consume published package versions or packed
artifacts explicitly.

## Prerequisites

Before cutting a release, confirm all of:

- You are logged into npm as a member of the `@withqwerty` organization. Run `command npm whoami` — this should print your username. Run `command npm org ls withqwerty <your-username>` — this should show your role as `owner` or `admin`.
- Your working tree is clean and on `main`. `git status` should show nothing modified and nothing staged.
- `main` is up to date with `origin/main`. `git pull --ff-only` before anything else.
- Full verification passes locally:
  ```bash
  pnpm install
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm lint
  pnpm format:check
  ```
  All must be green. No shortcuts.
- If the docs/demo site is part of the release validation, run its build in the
  separate site repo against the package versions you intend to publish.
- You have tested the change in an actual consumer context — either the docs/demo site repo rendering the affected chart, or a throwaway project installing the dist-tag you plan to publish (`@alpha` during alpha, default tag for stable) and importing the component.

## Versioning policy

Campos follows [semver](https://semver.org) with a pre-v1 convention:

- **`0.x.y`** — pre-v1. Breaking changes between minor versions (`0.1.y` → `0.2.0`) are allowed and expected during alpha.
- **Alpha tag during alpha** — release as `0.1.0-alpha.N` pre-release versions published to the `alpha` dist-tag, not `latest`. Consumers must opt in with `pnpm add @withqwerty/campos-react@alpha`.
- **Promoting to `latest`** — when you decide a version is stable, use `npm dist-tag add` to move it to `latest` (see "Dist-tag promotion" below). Do not republish under a new version just to change the tag.

### When to bump

- **Bug fix, no API change** → bump alpha counter. `0.1.0-alpha.3` → `0.1.0-alpha.4`.
- **New feature, additive only** → bump alpha counter, note in CHANGELOG.
- **Breaking change during alpha** → bump alpha counter, loud note in CHANGELOG, consider whether the consuming users (if any) need a heads-up.
- **First stable release** → drop `-alpha.N` suffix: `0.1.0-alpha.4` → `0.1.0`. Publish with `--tag latest` (default).
- **Breaking change after first stable** → bump minor: `0.1.0` → `0.2.0`. Campos is pre-v1, so minor-version breaks are the semver convention for "allowed but please read the CHANGELOG."

## Release workflow

The release process is currently manual — no changesets, no automated version management. This is intentional for alpha; we may adopt changesets before v1.

### 1. Decide the version

Pick the next version number based on the policy above. Example: you're on `0.1.0-alpha.2` and fixing a bug → next version is `0.1.0-alpha.3`.

### 2. Bump versions in all library package manifests kept in lockstep

Edit `version` in these five `package.json` files to the new version:

- `packages/schema/package.json`
- `packages/adapters/package.json`
- `packages/stadia/package.json`
- `packages/react/package.json`
- `packages/static/package.json`

All five library package versions must match. Version skew between workspace packages is a bug waiting to happen.

### 3. Update CHANGELOG.md

Add a new entry at the top of `CHANGELOG.md`. Follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) convention: group by `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`.

Write for the person reading on npmjs.com's package page — a useful release note, not a commit dump. "What changed and why should I care." Example:

```markdown
## [0.1.0-alpha.3] — 2026-04-25

### Fixed

- `<Heatmap>` no longer crashes on empty `events` arrays. Previously
  threw `TypeError: Cannot read properties of undefined` at the scale
  computation step.

### Changed

- `autoPitchLines` default is now `true` for dark colorscales across
  both `<Heatmap>` and `<KDE>` (was: only Heatmap).
```

### 4. Regenerate the lockfile

```bash
pnpm install
```

This picks up the version bumps in `workspace:*` dependency resolution. The lockfile should change (updated version references). If it doesn't change, you probably forgot to bump a version.

### 5. Run full verification

Re-run the prerequisite checks (all seven commands from the top of this doc). Yes, even though you already ran them before starting. The version bumps can interact with resolution in surprising ways, and it's cheaper to catch a regression here than after publish.

### 6. Commit the version bump

```bash
git add packages/*/package.json CHANGELOG.md pnpm-lock.yaml
git commit -m "release: 0.1.0-alpha.3"
```

Use `release:` as the scope prefix so release commits are easy to filter in `git log`.

### 7. Tag the release

```bash
git tag v0.1.0-alpha.3
```

Tag with a `v` prefix. The tag name is the version number.

### 8. Push commit and tag

```bash
git push origin main
git push origin v0.1.0-alpha.3
```

The two pushes are separate because tags don't go with a normal `git push`.

### 9. Publish to npm

```bash
pnpm -r publish --access public --tag alpha --no-git-checks
```

Flag-by-flag:

- `-r` — recursive, publish all workspace packages that aren't private.
- `--access public` — first-time publish of a scoped package requires this. Subsequent publishes don't, but it's harmless to always include.
- `--tag alpha` — publish to the `alpha` dist-tag instead of `latest`. Consumers won't see these on `pnpm add @withqwerty/campos-react` by default — they have to explicitly opt in with `@alpha`.
- `--no-git-checks` — skip pnpm's built-in "is working tree clean" check. We run our own checks in step 5, and pnpm's check can fail spuriously on unrelated untracked files.

pnpm will publish each package in dependency order, rewriting `workspace:*`
references to concrete version numbers in each published tarball automatically.

### 10. Verify the publish

```bash
npm view @withqwerty/campos-react versions --json
npm view @withqwerty/campos-react dist-tags
```

Confirm the new version appears in the `versions` list and the `alpha` dist-tag points to it.

Smoke-test the install in a throwaway project:

```bash
mkdir /tmp/campos-smoke-test && cd /tmp/campos-smoke-test
pnpm init
pnpm add react react-dom @withqwerty/campos-react@alpha
# Write a small tsx file importing ShotMap, make sure it typechecks
```

### 11. Clean up

```bash
rm -rf /tmp/campos-smoke-test
```

Done. The release is live on the `alpha` tag.

## Dist-tag promotion

When a version is stable enough to be the default for `pnpm add @withqwerty/campos-react`, promote it to `latest`:

```bash
for pkg in schema adapters stadia react static; do
  command npm dist-tag add @withqwerty/campos-$pkg@0.1.0 latest
done
```

Replace `0.1.0` with the version you're promoting. This is instant and
reversible — if you need to roll back the `latest` tag, point it at an earlier
version the same way.

Note: dist-tag changes do not re-publish anything. They just update pointer labels on the registry.

## Rollback and deprecation

Things will go wrong. Options, in order of severity:

### Within 72 hours of publish: `npm unpublish`

npm allows unpublishing a version within 72 hours of its initial publish. Use this for clear mistakes only — accidentally shipping a broken `alpha.0`, publishing to the wrong scope, etc.

```bash
command npm unpublish @withqwerty/campos-react@0.1.0-alpha.3
```

Unpublishing a version is still recorded in npm's metadata. The version number is permanently burnt — you cannot republish `0.1.0-alpha.3` later. Bump to `alpha.4` and ship the fix.

### Older than 72 hours: `npm deprecate`

Deprecation doesn't remove the package, but it shows a warning on install:

```bash
command npm deprecate @withqwerty/campos-react@0.1.0-alpha.3 "Broken, use @0.1.0-alpha.4 instead"
```

Repeat for each package. This is the right tool for "don't use this version" once anyone outside your control might have installed it.

### Do not force-republish

Never try to republish a version over an existing one. npm rejects this and it would be dangerous if it didn't. Bump the version and publish forward.

## Load-bearing gotchas

These are things you must not accidentally undo during a release.

### `pnpm.overrides` in root `package.json`

The root `package.json` has:

```jsonc
// inside root package.json
"pnpm": {
  "overrides": {
    "react": "19.2.5",
    "react-dom": "19.2.5"
  }
}
```

This pins react and react-dom to a single version across the entire workspace. It is **required** — removing it causes 154 tests to fail with "invalid hook call: multiple copies of React" errors. Root cause: `@testing-library/react` and local demo consumers can otherwise resolve separate React patch versions. The override forces them to unify.

When upgrading React, update the override version **and** the consumer ranges in `packages/react/package.json`, `packages/stadia/package.json`, and `packages/static/package.json` in the same commit. If the site repo remains a workspace consumer elsewhere, update it in lockstep there too. Then `pnpm install --force` to re-resolve everything.

The override affects only the local monorepo resolution. It is not published.

### `@withqwerty/campos-static` tarball shape

`@withqwerty/campos-static` is published, but it should stay on a narrow
`files` allowlist just like `@withqwerty/campos-react` and
`@withqwerty/campos-adapters`.

Why this matters:

- TypeScript project-reference builds can emit sibling workspace output under
  `dist/react`, `dist/schema`, and `dist/stadia`.
- The published package only needs its own entry files plus `dist/src`.
- Shipping the inlined sibling output bloats the tarball substantially and
  creates misleading duplicate package contents for consumers.

Before publishing `@withqwerty/campos-static`, always run:

```bash
cd packages/static
npm publish --dry-run
```

The tarball should contain the package entry files and `dist/src`, not the
inlined sibling workspace outputs.

### `workspace:*` is rewritten automatically

Inside the monorepo, packages reference each other with `"@withqwerty/campos-schema": "workspace:*"` and similar. At publish time, pnpm rewrites these to concrete version numbers (`"@withqwerty/campos-schema": "0.1.0-alpha.3"`) in the tarball's `package.json`. The source file on disk stays as `workspace:*`.

You do not need to manually update `workspace:*` references during a release. Do not try.

### The `files` field is an explicit allowlist

`packages/adapters/package.json`, `packages/react/package.json`, and
`packages/static/package.json` have a narrow `files` list:

```json
"files": [
  "dist/index.js",
  "dist/index.js.map",
  "dist/index.d.ts",
  "dist/index.d.ts.map",
  "dist/src",
  "README.md"
]
```

This is intentional. Without the narrowing, `files: ["dist"]` would include sibling workspace-dependency output directories such as `dist/schema/` and `dist/stadia/` that TypeScript's project-reference build can emit alongside the main package output. That inlining bloats `@withqwerty/campos-react` from ~380 kB unpacked to over 1 MB, and risks type identity conflicts at the consumer.

If you change the build system or update the tsconfig project references, you may need to revisit this. If a release starts shipping unexpectedly large tarballs, re-run `pnpm -r publish --dry-run` and audit the file listing for inlined deps.

### sharp is an optional peer dep in campos-static

`packages/static/package.json` declares:

```json
"peerDependencies": {
  "sharp": "^0.34.0"
},
"peerDependenciesMeta": {
  "sharp": { "optional": true }
}
```

The optional peer matches the `try { await import("sharp") } catch` pattern in `packages/static/src/index.tsx`. Consumers who only use `renderStaticSvg` don't need sharp. Consumers who call `renderStaticPng` do.

Do not move sharp back to `dependencies` — that would force every consumer to install a ~30 MB native binary even if they never call the PNG function.

## Troubleshooting

### "Peer dep warnings on install"

Usually cosmetic. pnpm prints warnings for missing optional peers (like `sharp`) and for React version mismatches within allowed ranges. As long as the warnings don't include "multiple copies of React," they're safe to ignore.

If you see "multiple copies of React" — the `pnpm.overrides` block is missing or the version is wrong. See the "load-bearing gotchas" section.

### "403 Forbidden" on publish

Three possible causes:

1. **Not logged in**: `command npm whoami` should print your username. If not, `command npm login`.
2. **Not a member of `@withqwerty`**: `command npm org ls withqwerty <your-username>` should show your role. If not, an org owner must add you.
3. **First-time publish of a scoped package without `--access public`**: scoped packages default to private (paid). Add `--access public` to the publish command. Our release workflow already includes this.

### "Package not found" after publish

Wait 30 seconds and try again. npm registry has a cache propagation delay. `npm view` usually shows the new version within a minute, but the CDN that serves `pnpm add` can lag up to a few minutes. If it's still missing after 5 minutes, check https://status.npmjs.org.

### `pnpm publish` fails on one package but succeeds on others

This is fine. pnpm publish is idempotent — already-published versions are skipped on retry. Fix whatever failed, then re-run the same `pnpm -r publish` command. Only the unpublished packages will be attempted.

### Lockfile shows changes after publish

Normal. `pnpm publish` may update the lockfile with resolution metadata. Stage and commit as `chore: update lockfile after release` if it bothers you.

### `npm view` shows an old version

Check the dist-tag you're looking at: `npm view @withqwerty/campos-react dist-tags`. The `latest` tag may point to a stable version while new work ships to `alpha`. That's by design, not a bug.

## Future improvements

Not blockers for alpha releases. Worth adopting before v1:

- **Changesets** ([github.com/changesets/changesets](https://github.com/changesets/changesets)) for automated version management. Removes the manual step of bumping five library `package.json` files in lockstep.
- **CI-driven releases** via GitHub Actions so publishes happen on tag push, not manually from a laptop.
- **Per-package LICENSE files.** Currently LICENSE lives only at the repo root and doesn't ship in tarballs. A pre-pack script could copy it into each package directory.
- **Automated CHANGELOG generation** from conventional-commits style messages. Currently hand-written.
