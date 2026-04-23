# Changelog

All notable changes to Campos will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and Campos follows [Semantic Versioning](https://semver.org/) with a pre-v1
alpha release cadence.

## [Unreleased]

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
