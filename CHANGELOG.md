# Changelog

## Unreleased

- Automatically check the source catalog every 15 minutes on GitHub, validate changes, commit snapshots, and republish changed content.
- Preserve import dates for unchanged data and retry missing or stale deployments using a public content fingerprint.
- Retain the last good snapshot on failed validation or license changes; keep quiet repositories active with maintenance commits after 45 days.
- Add integration tests for imports, provenance, failure preservation, and deployment decisions.

## 1.0.0 — 2026-10-22

- Searchable catalog with category, collection, and inferred platform/language topic filters.
- Consolidated resource cards with complete per-entry provenance in detail dialogs.
- Browser-local bookmarks, shareable search links, three sort modes, and incremental loading.
- Responsive layout, keyboard navigation, visible focus, dialog semantics, and data-load/no-results states.
- Reviewed catalog snapshot with an exact source commit, checksum, and upstream MIT notice.
- Dependency-free import, development server, automated checks, and GitHub Pages workflows.
