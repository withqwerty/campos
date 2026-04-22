# Changelog

All notable changes to Campos will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and Campos follows [Semantic Versioning](https://semver.org/) with a pre-v1
alpha release cadence.

## [Unreleased]

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
