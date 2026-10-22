# Initial release validation

Checks performed on October 22, 2026.

## Automated

- Node.js 24.22.1 on Windows: all 13 tests passed.
- JavaScript syntax check passed for the application module.
- Catalog integrity check passed: 664 original entries, 660 distinct URLs, 75 categories, exact SHA-256, and retained upstream license.
- Relative asset references and unique HTML IDs passed checks.
- The publishable source check found no common credential patterns or local user-directory paths in the application, scripts, or tests.

## Browser

Checked in the embedded Chromium browser:

- Initial catalog load and featured resources.
- SQLite search: four matching resources, with SQLite first.
- Android and Java/Kotlin topic filters together: six matching resources.
- Resource detail dialog with original research date, review scope, retrieval status, and versioned source link.
- Save SQLite, reload, and verify the bookmark and search persist.
- Saved-only view and removing its last bookmark.
- No-results state and reset.
- Pagination from 24 to 48 cards.
- Responsive layouts at 320, 390, 768, and 1440 CSS pixels: no document-level horizontal overflow.
- No warning or error messages were reported by the browser console during these checks.

Screenshots: [desktop](explorer.png) and [mobile](mobile.png).

## Scope

This is application and snapshot validation, not a fresh audit of all catalog links. Real mobile hardware, Safari, Firefox, and assistive-technology testing were not performed. Topic tags are heuristic. Saved resources depend on local browser storage, and catalog updates require a reviewed import and deployment.

GitHub validation and deployment results are recorded in the repository’s [Actions history](https://github.com/SeanShaffer88/dev-resource-explorer/actions).
