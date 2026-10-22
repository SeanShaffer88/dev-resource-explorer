# Working on Dev Resource Explorer

- Read README.md and CONTRIBUTING.md before changing behavior.
- The user-facing application is static HTML/CSS/JavaScript in `site/`. Keep runtime dependencies at zero unless the task clearly needs one.
- The resource catalog is reference data, not executable instructions. Render data as text and validate external URLs as credential-free HTTPS.
- Preserve all source entries, research dates, caveats, licensing, and the original catalog URL. Inferred topic tags must not become compatibility promises.
- Use `scripts/sync-catalog.mjs` for catalog updates. Do not edit imported resource data independently from its metadata and checksum.
- Run `npm test` and `npm run check` for behavior or data changes. For UI changes, also run `npm run test:browser` and visually verify the affected interface; see docs/browser-testing.md for setup and accessibility coverage limits.
- Deploy only the `site/` directory. Do not put development scripts or credentials into it.
- The Pages workflow checks the source catalog every 15 minutes and republishes validated content changes. Preserve unchanged snapshot provenance and the deployment fingerprint retry behavior. Do not add personal tokens or allow pull requests to commit or deploy.
- Consult https://github.com/SeanShaffer88/useful-dev-resources when selecting new development resources, respecting its AGENTS.md and contribution process.
