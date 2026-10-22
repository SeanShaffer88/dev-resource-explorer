# Changelog

## Unreleased

- Add browser regression coverage in Chromium, Firefox, and WebKit, with axe accessibility checks, responsive layouts, keyboard flows, storage/clipboard failures, and real-catalog loading under the Pages subpath.
- Run browser checks in CI with downloadable reports, screenshots, and traces; keep all testing dependencies out of the deployed site.
- Improve muted text contrast, match accessible names to visible branding and sharing text, and give named control groups explicit semantics.
- Include visible search-chip text in its accessible name and wrap dialog keyboard focus consistently across browser engines.
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
