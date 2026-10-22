# Automatic catalog sync

The `Publish GitHub Pages` workflow is the single owner of automatic imports and deployments. It checks every 15 minutes (7, 22, 37, and 52 minutes past each hour), on pushes to `main`, and through **Run workflow** in GitHub Actions. Manual runs must select `main`. No Codex session or local computer is required.

## Flow

1. Check out current explorer `main`. Scheduled, manual, and push runs share one concurrency group and do not cancel a deployment already in progress.
2. Resolve `useful-dev-resources/main` to an immutable commit and fetch `resources.json` and `LICENSE` from that exact commit. Never execute source-catalog code.
3. Validate required fields, HTTPS URLs, and the approved license before writing a snapshot. Preserve the upstream bytes, research notes, source commit, checksum, and license. If resources and license are unchanged, retain the existing metadata and import date.
4. Run all tests and snapshot checks. If they fail, do not commit or deploy.
5. Commit only changed snapshot files using GitHub's built-in token, then push without force. A concurrent human push causes a safe failure; the next run starts from current `main` and tries again.
6. Calculate a stable fingerprint of all deployable files except the generated `build.json`. Compare it with the public site's `build.json`. Upload and deploy only if content differs or the published manifest cannot be read. The generated manifest also records the explorer and catalog commits.

Publication happens in the same workflow as the bot commit. This matters because pushes made with `GITHUB_TOKEN` do not normally trigger another push workflow. The scheduled workflow validates its bot commit before deployment instead of relying on a second CI run.

## Failure recovery and activity

- Network or schema failure during import: keep the current committed snapshot and public site. The next run retries.
- Upstream license changes: stop for a human review of the new license; adjust the approved root LICENSE only after review.
- Concurrent push: fail the non-fast-forward push without overwriting any work; retry on the next run.
- Failure after committing but before deployment completes: the public fingerprint stays stale, so the next run retries publication even though catalog content is unchanged.
- No content changes: skip commits and deployment. After 45 days with no repository commits, write only `.github/catalog-sync-activity.json` and make one maintenance commit. This keeps repository activity ahead of GitHub's public scheduled-workflow inactivity cutoff. The maintenance file is not deployed.

Scheduling is best-effort. GitHub may delay or drop queued jobs during high load; later runs reconcile current content. If Actions is administratively disabled, branch rules prevent bot pushes, the account becomes ineligible for scheduled runs, or the repository is archived, those conditions need owner intervention.

## Controls and evidence

- **Run now:** open [Publish GitHub Pages](https://github.com/SeanShaffer88/dev-resource-explorer/actions/workflows/pages.yml), choose **Run workflow**, and select `main`.
- **Pause:** disable that workflow in Actions. This also pauses publishing on pushes and inactivity-maintenance commits.
- **Resume:** enable the workflow and run it manually if an immediate refresh is wanted.
- **Inspect:** check the job summary, the bot snapshot commit, [catalog metadata](https://seanshaffer88.github.io/dev-resource-explorer/data/meta.json), and [deployment manifest](https://seanshaffer88.github.io/dev-resource-explorer/build.json).

The publishing job has repository contents-write permission only to commit the known snapshot/maintenance paths. The deployment job has Pages-write and OIDC permissions. Pull-request CI has read-only access and cannot enter the publishing workflow. No permanent credential or additional external service is used.

Primary behavior references checked October 22, 2026: [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [workflow triggering with GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow).
