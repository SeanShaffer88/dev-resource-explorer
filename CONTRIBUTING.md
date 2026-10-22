# Contributing

Keep the explorer small, accessible, and usable as a static site. Prefer browser APIs and Node’s standard library to new dependencies unless a concrete requirement justifies them.

Resource additions and corrections belong in [useful-dev-resources](https://github.com/SeanShaffer88/useful-dev-resources), following its contribution instructions. The Pages workflow imports validated changes from its main branch every 15 minutes. Use the sync command for local development; do not rewrite the snapshot by hand or remove research caveats. A license change requires manual review before adjusting the approved LICENSE.

For interface changes, run `npm test`, `npm run check`, and `npm run test:browser`, then visually check the affected interface. See [browser testing](docs/browser-testing.md) for the one-time browser installation and manual accessibility checklist. Keep browser assertions about user-visible behavior, use the deterministic catalog for edge cases, and retain the real-snapshot smoke test. Do not silence accessibility rules or accept retries as a fix for unexplained failures. For catalog logic, add tests for meaningful edge cases rather than mirroring implementation details.

Do not commit credentials, private details, local machine paths, dependency directories, or personal bookmarks. Keep GitHub Actions pinned to reviewed commits, and preserve the restricted workflow permissions. Workflow changes should not allow pull requests to deploy.

Sync and deployment changes must cover unchanged imports, failed input validation, exact source bytes/provenance, and retrying a stale deployment. Keep auto-commits limited to the three snapshot files or the dedicated inactivity-maintenance file; never force-push. The CI workflow remains read-only; only the main-branch publishing job can write snapshots.
