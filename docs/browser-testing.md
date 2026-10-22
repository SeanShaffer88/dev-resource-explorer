# Browser and accessibility regression checks

The suite protects browsing behavior without adding packages to the deployed website. It runs against the local static site at `/dev-resource-explorer/`, matching GitHub Pages relative URL behavior. No upstream resource websites are visited.

## Run and diagnose

Use Node 22.12+ (CI uses Node 24):

```sh
npm ci
npx playwright install chromium firefox webkit
npm test
npm run check
npm run test:browser

# Focus on one engine or see the report from the last run.
npm run test:browser -- --project=firefox
npm run test:browser:report
```

On Linux, use `npx playwright install --with-deps chromium firefox webkit` to install the required operating-system libraries too. The suite owns port 4183 and refuses to reuse an unrelated running server. It does not require a separate `npm start`.

The **Validate explorer** workflow runs on pushes to `main` and pull requests. Each browser has a separate read-only Ubuntu 24.04 job. There are no automatic retries: an unexplained failure remains a failure. Download the `browser-report-<engine>` artifact for the HTML report and axe JSON attachments; failed cases also retain a screenshot and Playwright trace. Artifacts expire after 14 days. Locally, use `npx playwright show-trace <trace.zip>` to inspect an individual failure. Reports and browser binaries are not committed or deployed.

The catalog's scheduled Pages job continues to run its unit and integrity checks independently. It does not install three browsers on every 15-minute catalog check. Application CI does not gate that independent Pages workflow; validate application changes before merging or pushing them to `main` and check the resulting Actions runs.

## What is covered

Each engine defines 17 scenarios:

- Phrase search combined with category, platform, language, and collection filters; URL reload and clearing filters.
- Featured/name/research-date sorting, incremental loading, and focus on the first newly loaded resource.
- Bookmark persistence after reload, synchronization between tabs, and focus recovery when removing the last saved resource.
- Blocked browser storage with visit-only bookmarks; successful shared-search round trips with private bookmarks excluded; clipboard failure fallback.
- Empty results, the live result-count status, removable filters, and reset behavior.
- Keyboard skip link, `/` search shortcut, detail and about dialog names, focus sequence, Escape dismissal, and return to the opening control. Duplicate-entry notes and the exact versioned provenance link remain visible.
- HTTP failure, invalid JSON, and invalid catalog schema, with a usable error state and no uncaught page exception.
- 320, 390, 768, and 1440 CSS-pixel layouts, including expanded mobile category controls, dialog overflow, and document horizontal overflow.
- A separate smoke test using the actual bundled catalog and metadata, with relative module/data requests under the Pages subpath. Expected counts come from metadata so catalog growth does not make the test brittle.

Sixteen scenarios use a small deterministic catalog (32 entries, 31 distinct URLs, duplicate notes, and enough resources to paginate). The real-snapshot smoke test has no catalog mocks. Clipboard tests substitute only the clipboard API boundary; they test application behavior without assuming identical OS permission prompts. The cross-tab bookmark case uses real browser storage.

Windows WebKit 27.2 does not Tab-focus links in this test environment; Alt+Tab also did not reach the skip link. That one skip-link reachability test is explicitly marked `fixme` on Windows WebKit, rather than silently starting with programmatic focus. It remains enabled on Linux CI and in Chromium/Firefox. Other WebKit keyboard/dialog tests remain enabled. See the [upstream keyboard-preference discussion](https://github.com/microsoft/playwright/issues/5609). Two workers keep local browser memory use bounded; retries remain disabled.

axe runs WCAG 2.0/2.1/2.2 A/AA-tagged rules in the loaded catalog, empty/error, expanded-filter, and dialog states. Every detected violation fails its test. No rule is disabled and no element is excluded. Attachments retain `incomplete` results that require review; an incomplete result is not proof of conformance. Initial scans caught low-contrast secondary text, a named generic container without a role, and accessible names missing visible control text. Those findings are fixed in the application, not suppressed in the tests.

## Tool selection and provenance

Checked on 2026-10-22 against the shared catalog, package metadata, and primary documentation. The catalog already includes Playwright and axe-core, so no duplicate catalog entry was added.

| Candidate | Decision | Fit and limits |
| --- | --- | --- |
| Playwright Test 1.64.1, Apache-2.0 | Selected, development only | One runner for Chromium, Firefox, and WebKit, isolated contexts, role-based locators, screenshots, and traces. Node >=20; project minimum is higher because of axe integration. |
| @axe-core/playwright 4.14.0, MPL-2.0 | Selected, development only | Browser-rendered accessibility checks and review-required results. Requires Node >=22.12. Does not establish complete WCAG conformance. |
| Existing Node built-in test runner | Retained | Fast pure-logic and sync integration tests; cannot verify rendering, browser focus, or the accessibility tree. |

Versions are exact in `package.json` and transitive dependencies are locked. The static app retains zero runtime dependencies and only `site/` is deployed. Upstream testing-tool licenses remain applicable to those development packages. Recheck engine support, Node requirements, licenses, and advisories when updating them. See [Playwright installation](https://playwright.dev/docs/intro), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), and [axe-core scope and license](https://github.com/dequelabs/axe-core).

## Manual checklist and limits

Local validation on 2026-10-22, Windows with Node 24.22.1: 50 browser cases passed, one Windows-WebKit skip-link case marked `fixme`, zero failures, zero retries; all 22 Node tests and the catalog integrity check passed. Engines: Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2. `npm audit --omit=optional` reported no known vulnerabilities in the installed dependency set at that time; this is not a source audit.

The passing run still includes axe review-required findings for decorative glyphs, close-button symbols, partially obscured category rows, and some about-dialog text/background calculations. These are retained in the reports. The detected violations are fixed; those incomplete calculations and the manual checklist below are not represented as a full accessibility pass.

Record the date, OS, browser/assistive technology, result, and any follow-up issue when performing this checklist. Do not turn an unperformed check into a pass.

| Check | Recorded status on 2026-10-22 |
| --- | --- |
| Keyboard: Tab to skip link, Enter to results, `/` to search, filter without a pointer, operate notes/about dialogs, Escape, and return focus | Agent-operated embedded Chromium review passed for the skip link, `/` search, detail-dialog Tab/Shift+Tab boundary wrap, Escape, and focus return. Remaining checklist paths have automated coverage; no human assistive-technology review was performed. |
| Visual: inspect focus visibility, reading order, narrow controls, clipped text, and dialog scrolling at 320/390/768/1440px | Agent inspected visible skip-link/dialog focus and desktop/390px results after the changes; automated overflow and axe checks cover all four widths. Initial-release visual checks are in [validation.md](validation.md). |
| NVDA with Firefox/Chromium: navigate headings/landmarks; hear control names, result changes, bookmark state, dialog name/content, and errors; confirm dismissal returns to the right control | Not performed. Requires actual screen-reader output review. |
| VoiceOver with Safari on macOS/iOS: repeat search, saved view, mobile category expansion, and dialog navigation; test touch exploration | Not performed. |
| 200%/400% zoom, text spacing, forced colors, and reduced motion | Not yet manually reviewed. |

WebKit is Playwright's automated engine build, not the installed Safari product. Chromium and Firefox desktop automation does not establish real mobile-device or screen-reader usability. Automated scans cannot fully assess meaning, reading order, live announcements, visual focus quality, or every interactive state. This is regression coverage, not a complete accessibility audit or a fresh audit of catalog links.
