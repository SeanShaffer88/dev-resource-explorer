# Dev Resource Explorer

**Find your next building block.** A fast, browser-based explorer for Sean Shaffer’s [development resource catalog](https://github.com/SeanShaffer88/useful-dev-resources).

[Open the explorer](https://SeanShaffer88.github.io/dev-resource-explorer/) · [Source catalog](https://github.com/SeanShaffer88/useful-dev-resources) · [Releases](https://github.com/SeanShaffer88/dev-resource-explorer/releases)

![The explorer showing its searchable resource collection](docs/explorer.png)

## What it does

- Search names, categories, and descriptions, including quoted phrases.
- Browse 75 categories and filter by collection, platform topic, and language topic.
- Save useful resources in this browser and return to them later.
- Share a link with the current search and filters. Bookmarks are never included.
- Open original links and inspect the full research notes for each catalog entry.
- Switch between featured, alphabetical, and research-date sorting.
- Use a responsive interface with native controls, keyboard focus indicators, a skip link, and modal detail panels. Press `/` to focus search; Escape closes a dialog.

The initial snapshot contains **664 source entries and 660 distinct resource URLs**, imported on **October 22, 2026** from catalog commit [`e068d788cf3a7deb65cec129186ad9db1e665d2f`](https://github.com/SeanShaffer88/useful-dev-resources/commit/e068d788cf3a7deb65cec129186ad9db1e665d2f). Duplicate URLs appear as one card; their original entries and evidence remain intact. The app computes counts from its data rather than hard-coding them.

## Run locally

Install [Node.js](https://nodejs.org/) 22.12 or later (24 recommended), then:

```sh
git clone https://github.com/SeanShaffer88/dev-resource-explorer.git
cd dev-resource-explorer
npm start
```

Open the printed local URL, normally `http://127.0.0.1:4173`. Running the site requires **no package installation and no build step**. Browser tests have separate development dependencies. The site itself only requires a modern browser and a static HTTP server. Opening `index.html` with a `file:` URL is unsupported because the browser needs to fetch local JSON and JavaScript modules.

## Validate

```sh
npm test
npm run check

# Browser and accessibility regression tests (first install)
npm ci
npx playwright install chromium firefox webkit
npm run test:browser
```

Node’s built-in test runner checks search, composed filters, duplicate preservation, sorting, query URLs, bookmark recovery, inferred tags, and unsafe link rejection. The check script verifies the catalog SHA-256, source metadata, license, asset paths, duplicate HTML IDs, and common accidental credential/path patterns. These checks do not audit the linked resources or replace a security review.

Playwright exercises user journeys in Chromium, Firefox, and WebKit, including keyboard navigation, saved resources, failed loads, shared searches, and four layout widths. axe checks WCAG A/AA rules through 2.2 in selected states. CI runs these checks on application pushes and pull requests and retains reports for 14 days. See [browser testing and accessibility scope](docs/browser-testing.md) for setup, coverage, failure triage, and the manual checklist. Automated WebKit coverage is not a Safari or real-device test, and automated accessibility checks do not replace screen-reader review.

## Automatic catalog sync

GitHub Actions checks the source catalog every 15 minutes, at minutes 7, 22, 37, and 52 of each hour. It also checks on pushes to `main` and manual runs of **Publish GitHub Pages**. Scheduling runs on GitHub and does not depend on a local computer. GitHub may delay scheduled jobs; the interval is not an exact delivery guarantee.

Each run resolves the catalog's `main` branch to one commit and downloads its resource index and license from that commit. If the content changed, the workflow validates it, runs the tests, commits the snapshot as `github-actions[bot]`, and publishes it in the same workflow. It uses the repository's short-lived `GITHUB_TOKEN`; no personal token or cross-repository secret is required.

Unchanged checks preserve the snapshot date and original source commit. Changes only to catalog documentation do not create snapshot commits. A published content fingerprint prevents unnecessary deployments and lets the next check retry a failed deployment, even when the snapshot was already committed. Validation failures keep the existing public site intact and appear in [Actions](https://github.com/SeanShaffer88/dev-resource-explorer/actions/workflows/pages.yml).

After 45 days with no repository commits, a small maintenance commit keeps the authorized schedule active ahead of GitHub's 60-day public-repository inactivity cutoff. This does not change the catalog or republish unchanged content. Disable **Publish GitHub Pages** in Actions to pause the schedule and its maintenance commits; re-enable it to resume.

Browsing still reads the bundled snapshot and never calls the GitHub API. See [automatic sync design and recovery](docs/automatic-sync.md) for the operational details.

### Import manually

```sh
# Download the latest public main commit, preserving its exact source bytes.
npm run sync

# Or import a specific reviewed commit.
npm run sync -- --ref FULL_40_CHARACTER_COMMIT_SHA

# Or read committed files from an existing catalog checkout.
npm run sync -- --source ../useful-dev-resources

npm test
npm run check
git diff -- site/data
```

The importer copies `resources.json` and the upstream license, and writes `site/data/meta.json` with the commit, import date, counts, and SHA-256. It refuses non-HTTPS links, embedded credentials, invalid required fields, and a license differing from the approved root `LICENSE` (apart from line endings and surrounding whitespace). Empty historical HTTP-status fields remain empty in the data and display as “Not recorded.” `--date YYYY-MM-DD` can explicitly record the actual import date; the default uses America/Chicago. Unchanged files do not get a new import date.

Push application changes to `main` as usual. The workflow automatically reconciles the latest upstream catalog, tests it, and deploys only `site/` when its content differs from the published site. An intentionally pinned older catalog will be replaced on the next run unless automatic syncing is disabled.

## Publish your own copy

1. Fork this repository.
2. Enable GitHub Pages with **GitHub Actions** as the source in repository settings.
3. Push to `main` or manually run **Publish GitHub Pages**.

The relative asset URLs work under a project path. For your own collection, adjust the importer’s source repository, validation provenance, authorship links, and license notices before publishing. Preserve the original catalog attribution when retaining its data.

## Evidence and privacy

Research dates and review scopes belong to the original catalog. A snapshot import is **not** a new maintenance, security, licensing, or compatibility audit. Platform and language labels are heuristic discovery topics inferred from the catalog text; absence or presence of a topic does not establish actual support. “Featured” is a small selection of general starting points, not a quality ranking.

Bookmarks are local to the browser and origin. If storage is blocked, they work only for that visit. There are no analytics, accounts, cookies set by the app, external fonts, or runtime dependencies. GitHub Pages and linked websites apply their own privacy policies. Search terms placed in URLs are visible to anyone you share those URLs with.

## Project structure

```text
site/                  Deployable static website
  app.js               UI rendering, dialogs, local bookmarks, and URL state
  catalog.js           Pure catalog normalization, search, and filtering
  data/                Exact source snapshot, provenance, and catalog license
scripts/               Local server, import, and validation commands
test/                  Node built-in test suite
e2e/                   Playwright journeys and axe accessibility checks
playwright.config.js   Browser matrix, local Pages subpath, and reports
.github/workflows/     Validation and GitHub Pages publication
docs/                  Screenshot and validation record
```

## License

MIT, copyright 2026 Sean Shaffer. The catalog’s original MIT notice is preserved in [site/data/CATALOG-LICENSE.txt](site/data/CATALOG-LICENSE.txt). Referenced projects and websites retain their own licenses and terms.
