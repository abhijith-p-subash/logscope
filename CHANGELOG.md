# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] — 2026-08-27

Documentation only — no code, CLI, or UI changes. The published tarball is
identical to 0.1.0 apart from the README.

### Fixed

- Every link in the README is now absolute. The relative form (`./LICENSE`,
  `./docs/…`) resolves against the repository tree on GitHub, but npmjs.com has
  no repository tree — so the licence link and all eight documentation links
  were dead for anyone reading the package page.
- Badge URLs carry `cacheSeconds`, so a badge fetched before the package existed
  can no longer stick as a cached "package not found" image.

## [0.1.0] — 2026-08-26

First public release.

### Added

- **`logscope` (default, alias `watch`)** — watch a folder, serve the web UI, and
  open the browser. New exports dropped into the folder appear live.
- **`logscope ui` (alias `app`)** — launch the web UI on its own, watching no
  directory. Files are added by dropping them onto the window and are held in
  memory only.
- **`logscope open <file>`** — open a single log file directly.
- **`logscope scan <path>`** — terminal trace summary, with `--json` for CI use
  (exits non-zero when the logs contain errors).
- **`logscope report <path>`** — self-contained, PII-redacted HTML evidence
  bundle for attaching to a defect ticket.
- Reassembly of pretty-printed JSON that CloudWatch shredded across many events,
  with a rejoin count.
- Trace reconstruction by correlation id (`@requestId`, `trace_id`, and friends).
- JSON, NDJSON, CSV, and CloudWatch Insights `results` input, auto-detected.
- Multi-file merge by timestamp with per-file colour coding.
- Search supporting AND, `"phrases"`, `-exclude`, `a | b`, `/regex/`, and
  `field:value` including keys inside the JSON payload.
- Trace waterfall, run diff, golden-path deviation, error clustering,
  concurrency lens, and an agent iteration tree for LLM-pipeline logs.
- Optional defaults from `~/.logscope.json` (`port`, `dir`, `open`).

### Fixed

- `--version` reported a hardcoded `0.0.0` instead of the installed version.
- `port` in `~/.logscope.json` was silently ignored: the `--port` flag declared a
  default, which always shadowed the config file value.
- `scan` printed "1 errors" and "1 files" — counts now agree with their nouns.
- The published tarball omitted `docs/`, so every documentation link in the
  README 404'd on npmjs.com.

[Unreleased]: https://github.com/abhijith-p-subash/logscope/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/abhijith-p-subash/logscope/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/abhijith-p-subash/logscope/releases/tag/v0.1.0
