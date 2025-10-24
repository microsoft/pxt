# Next Steps for Vulnerability Remediation

## Completed Work
- Upgraded core dependencies with known advisories:
  - `dompurify` → 3.3.0
  - `sanitize-html` → 2.17.0
  - `cssnano` → 5.1.15
  - `postcss` → 8.5.6
  - `rtlcss` → 4.3.0
  - `mocha` → 10.8.2
  - `pouchdb` / `pouchdb-adapter-memory` → 7.3.1
  - `terser` → 5.31.6
  - `highlight.js` dev dependency → 10.7.3 (bundled `highlight.pack.js` refreshed)
  - Added `autoprefixer` 10.4.20 for the PostCSS pipeline.
- Replaced the legacy Node HTTP helper with `axios` and removed the `request` dependency.
- Updated `cli/cli.ts` CSS build to run `postcss([autoprefixer, cssnano])` with the new API.
- Upgraded build tooling to `gulp` 5.0.1 (`gulp-cli` 3.1.0, `gulp-replace` 1.1.4) to reduce deprecated transitive dependencies.
- Retired `uglifyify` (and the patch script), relying on the Terser post-build pass for production minification while keeping Blockly assets excluded.
- Ran `npm install` (lockfile managed externally) and `npm run lint` successfully.
- Latest audit snapshot (post-uglifyify removal): 13 vulnerabilities remain (5 low / 4 high / 4 critical), concentrated in legacy browserify/minifier chain and transitive peer gaps.

## Outstanding Issues
1. **Build chain validation**
   - Re-run representative gulp tasks (`gulp lint`, `gulp build`, targeted watch flows) to confirm there are no regressions after the v5 migration.
   - Track any lingering advisories from gulp plugins (e.g., `gulp-header`) and evaluate maintained alternatives if they surface.
2. **Residual transitive advisories**
   - Post-migration audit: rerun `npm audit --json` to confirm only unavoidable issues remain. Document rationale for any accepted risk.
3. **Documentation & tests**
   - After refactors, rerun the full validation suite (`npm run lint`, targeted gulp tasks, key unit tests) to ensure the build remains stable.
4. **Browserify minification validation**
   - Sanity-check that production bundles remain minified via the Terser pass (size spot-checks, smoke testing) and adjust exclusions if additional packages need to be skipped.

## Suggested Next Session Plan
1. Exercise core gulp 5 flows (`gulp lint`, `gulp build`, and watch mode) to shake out incompatibilities or plugin deprecations.
2. Review PostCSS/Gulp compatibility after upgrades and add targeted tests for CSS build outputs.
3. Validate the new minification flow (post-build Terser) and document any size/perf deltas versus prior behavior.
4. Once major swaps are done, regenerate the audit report and capture results for compliance notes.

Keep `next-steps.prompt.md` updated as progress continues so morning sessions can pick up with clear context.
