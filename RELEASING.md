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
- You have tested the change in an actual consumer context — either the docs/demo site repo rendering the affected chart, or a throwaway project installing the dist-tag you plan to publish (`@beta` during beta, default tag for stable) and importing the component.

## Versioning policy

Campos follows [semver](https://semver.org) with a pre-v1 convention:

- **`0.x.y`** — pre-v1. Breaking changes between minor versions (`0.1.y` → `0.2.0`) are allowed and expected during beta.
- **Beta tag during beta** — release as `0.1.0-beta.N` pre-release versions published to the `beta` dist-tag, not `latest`. Consumers must opt in with `pnpm add @withqwerty/campos-react@beta`.
- **Promoting to `latest`** — when you decide a version is stable, use `npm dist-tag add` to move it to `latest` (see "Dist-tag promotion" below). Do not republish under a new version just to change the tag.

### When to bump

- **Bug fix, no API change** → bump beta counter. `0.1.0-beta.3` → `0.1.0-beta.4`.
- **New feature, additive only** → bump beta counter, note in CHANGELOG.
- **Breaking change during beta** → bump beta counter, loud note in CHANGELOG, consider whether the consuming users (if any) need a heads-up.
- **First stable release** → drop `-beta.N` suffix: `0.1.0-beta.4` → `0.1.0`. Publish with `--tag latest` (default).
- **Breaking change after first stable** → bump minor: `0.1.0` → `0.2.0`. Campos is pre-v1, so minor-version breaks are the semver convention for "allowed but please read the CHANGELOG."

## Release workflow

Campos uses [`changesets`](https://github.com/changesets/changesets) to drive version bumps, CHANGELOG entries, and npm publishes. The five `@withqwerty/campos-*` packages are declared as `fixed` in `.changeset/config.json`, so they always ship in lockstep. The `@withqwerty/campos-site` package is in `ignore` — changesets never versions or publishes it.

During beta, the workspace stays in changesets' **pre-release mode** (`pnpm exec changeset pre enter beta`), which produces `0.1.0-beta.N` versions on the `beta` dist-tag. When stabilising, exit pre-release with `pnpm exec changeset pre exit` and the next `release:version` will drop the `-beta.N` suffix.

### 1. Add a changeset for your change

In the same PR as your code change:

```bash
pnpm changeset
```

You'll be prompted to:

- pick which packages are affected (because of the `fixed` array, all five ship together regardless of what you pick, but choose the real ones for honest CHANGELOG attribution);
- pick the bump kind (`major` / `minor` / `patch`) — during beta pre-release, every bump maps to a new `beta.N` counter, so pick `patch` for bug fixes and `minor` for new features as a signal of intent;
- describe the change — write this as the CHANGELOG reader would want to read it ("what changed and why should I care"), not as a commit dump.

The tool writes a `.changeset/<random-name>.md` file. Commit it with your code.

### 2. When you're ready to release

```bash
pnpm release:version
```

This runs `changeset version && pnpm install --lockfile-only`, which:

- bumps `version` in all five library `package.json` files to the next pre-release counter;
- writes a new entry in `CHANGELOG.md` from all pending `.changeset/*.md` files;
- removes the processed changeset files;
- updates `pnpm-lock.yaml` to match.

Inspect the diff. If the CHANGELOG entry needs polish, edit it before committing.

### 3. Run full verification

```bash
pnpm check
pnpm build
```

All must be green. The version bumps can interact with resolution in surprising ways and the lockfile refresh sometimes surfaces peer-dep warnings that matter; cheaper to catch here than post-publish.

### 4. Commit and tag

```bash
git add packages/*/package.json CHANGELOG.md pnpm-lock.yaml .changeset
git commit -m "release: 0.1.0-beta.N"
git tag v0.1.0-beta.N
```

Use `release:` as the subject prefix so release commits are easy to filter in `git log`. Tag with a `v` prefix; the tag name is the version number.

### 5. Push commit and tag

```bash
git push origin main
git push origin v0.1.0-beta.N
```

Two separate pushes because tags don't ride along on a normal `git push`.

### 6. Publish to npm

```bash
pnpm release:publish
```

This runs `pnpm build && changeset publish`. In pre-release mode, `changeset publish` automatically uses the `beta` dist-tag and publishes only packages whose current version on npm is older than the local `package.json`. Packages in `ignore` (campos-site) are skipped.

If you're on a 2FA-protected npm account:

```bash
pnpm exec changeset publish --otp <code>
```

### 7. Verify the publish

```bash
npm view @withqwerty/campos-react versions --json
npm view @withqwerty/campos-react dist-tags
```

Confirm the new version is in the `versions` list and the `beta` dist-tag points to it.

Smoke-test in a throwaway project:

```bash
mkdir /tmp/campos-smoke-test && cd /tmp/campos-smoke-test
pnpm init
pnpm add react react-dom @withqwerty/campos-react@beta
# Write a small tsx file importing ShotMap, make sure it typechecks
rm -rf /tmp/campos-smoke-test
```

Done. The release is live on the `beta` tag.

## Manual release flow (fallback only)

If changesets is unavailable or in a broken state (e.g. `.changeset/pre.json` corrupted, a reverted version bump that left the tree inconsistent), the hand-rolled flow below still works. Don't use it for routine releases — it's here as a hotfix path.

1. Edit `version` in each of `packages/{schema,adapters,stadia,react,static}/package.json` to the new value. All five must match.
2. Hand-write a new entry at the top of `CHANGELOG.md` under a heading like `## [0.1.0-beta.N] - YYYY-MM-DD`, grouped by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) sections (`Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`).
3. `pnpm install` to refresh the lockfile.
4. Run `pnpm check` and `pnpm build` — must be green.
5. `git add packages/*/package.json CHANGELOG.md pnpm-lock.yaml && git commit -m "release: 0.1.0-beta.N"`
6. `git tag v0.1.0-beta.N`
7. `git push origin main && git push origin v0.1.0-beta.N`
8. `pnpm -r publish --access public --tag beta --no-git-checks`

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

npm allows unpublishing a version within 72 hours of its initial publish. Use this for clear mistakes only — accidentally shipping a broken `beta.0`, publishing to the wrong scope, etc.

```bash
command npm unpublish @withqwerty/campos-react@0.1.0-beta.3
```

Unpublishing a version is still recorded in npm's metadata. The version number is permanently burnt — you cannot republish `0.1.0-beta.3` later. Bump to `beta.4` and ship the fix.

### Older than 72 hours: `npm deprecate`

Deprecation doesn't remove the package, but it shows a warning on install:

```bash
command npm deprecate @withqwerty/campos-react@0.1.0-beta.3 "Broken, use @0.1.0-beta.4 instead"
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

Inside the monorepo, packages reference each other with `"@withqwerty/campos-schema": "workspace:*"` and similar. At publish time, pnpm rewrites these to concrete version numbers (`"@withqwerty/campos-schema": "0.1.0-beta.3"`) in the tarball's `package.json`. The source file on disk stays as `workspace:*`.

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

Check the dist-tag you're looking at: `npm view @withqwerty/campos-react dist-tags`. The `latest` tag may point to a stable version while new work ships to `beta`. That's by design, not a bug.

## Future improvements

Not blockers for beta releases. Worth adopting before v1:

- **Changesets** ([github.com/changesets/changesets](https://github.com/changesets/changesets)) for automated version management. Removes the manual step of bumping five library `package.json` files in lockstep.
- **CI-driven releases** via GitHub Actions so publishes happen on tag push, not manually from a laptop.
- **Per-package LICENSE files.** Currently LICENSE lives only at the repo root and doesn't ship in tarballs. A pre-pack script could copy it into each package directory.
- **Automated CHANGELOG generation** from conventional-commits style messages. Currently hand-written.
