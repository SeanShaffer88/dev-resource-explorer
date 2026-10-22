# Contributing

Keep the explorer small, accessible, and usable as a static site. Prefer browser APIs and Node’s standard library to new dependencies unless a concrete requirement justifies them.

Resource additions and corrections belong in [useful-dev-resources](https://github.com/SeanShaffer88/useful-dev-resources), following its contribution instructions. Import a reviewed catalog commit with the sync command; do not rewrite the snapshot by hand or remove research caveats.

For interface changes, run `npm test` and `npm run check`, then exercise the affected behavior in a browser. Check narrow and wide layouts, keyboard focus, the no-results state, and dialog dismissal. For catalog logic, add tests for meaningful edge cases rather than mirroring implementation details.

Do not commit credentials, private details, local machine paths, dependency directories, or personal bookmarks. Keep GitHub Actions pinned to reviewed commits, and preserve the restricted workflow permissions. Workflow changes should not allow pull requests to deploy.
