# Changelog

All notable changes to Campos will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and Campos follows [Semantic Versioning](https://semver.org/). Campos is in
pre-v1 beta: the five published packages release together on the `beta` tag.

For package-specific API and dependency notes, see the individual
[package changelogs](#package-changelogs). GitHub also publishes one pre-release
per package in the [Releases](https://github.com/withqwerty/campos/releases)
section.

## [Unreleased]

## [0.1.0-beta.6] - 2026-07-13

### Added

- Continuous tracking-frame and event-linked freeze-frame overlays for the
  React surface, including StatsBomb 360 freeze frames and a Metrica/kloppy
  tracking seam.

### Changed

- Provider projections and pass-recipient identity handling are more robust;
  shared chart rendering defaults and accessible overlays are improved.

## [0.1.0-beta.5] - 2026-06-28

### Added

- Reusable Opta event analysis packets plus Second Spectrum tracking and
  physical-window packets, retaining source evidence and provider context.

## [0.1.0-beta.4] - 2026-05-01

### Added

- Publishable pitch presets and a single-install type surface for the React
  package.

## [0.1.0-beta.3] - 2026-05-01

### Added

- First public beta release. APIs may still evolve before 1.0; breaking changes
  are called out in the package changelogs.

## [0.1.0-alpha.1] - 2026-04-23

### Fixed

- **`@withqwerty/campos-adapters`** — `fromUnderstat.shots()` no longer infers
  extra-time periods from the scrape-backed minute field. Understat's shot
  clock is minute-only, so raw values like `47` were previously ambiguous and
  values `>= 90` were incorrectly promoted to period 3/4. Campos now resolves
  this lossy seam by treating `46..90` as second-half regulation and `90+` as
  second-half stoppage time (`minute: 90, addedMinute: minute - 90,
period: 2`), and never invents extra-time periods from this provider.
- **`@withqwerty/campos-react`** — `computeXGTimeline` now derives
  `hasExtraTime` from explicit `period === 3 || 4` markers rather than from
  end-minute > 90, so Understat matches (which can never produce extra-time
  periods under the new adapter contract) no longer render spurious extra-time
  pills in the xG timeline.

### Changed

- Adapter contract and gap matrix now document Understat's minute-only shot
  clock limitation explicitly, so downstream consumers know this lossy edge
  is handled by policy rather than invention.

## [0.1.0-alpha.0] - 2026-04-22

### Added

- First public alpha release of Campos as a multi-package football UI library:
  canonical schema types, provider adapters, pitch primitives, React chart
  components, and server-side static export.
- Public package documentation, contributor guidance, and GitHub community
  workflows for issues, pull requests, and discussions.

### Changed

- `@withqwerty/campos-static` is now treated as a first-class Campos package and
  its published package contents are narrowed to the files needed by consumers.
- The docs/demo site is now maintained as a separate repo and consumes Campos
  through package entry points rather than monorepo source aliases.

## Package changelogs

- [Schema](packages/schema/CHANGELOG.md)
- [Adapters](packages/adapters/CHANGELOG.md)
- [Stadia](packages/stadia/CHANGELOG.md)
- [React](packages/react/CHANGELOG.md)
- [Static export](packages/static/CHANGELOG.md)
