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
- Ran `npm install` (lockfile managed externally) and `npm run lint` successfully.
- Latest audit snapshot (post-gulp upgrade): 15 vulnerabilities remain (5 low / 6 high / 4 critical), concentrated in legacy browserify/minifier tooling and transitive peer gaps.

## Outstanding Issues
1. **Build chain validation**
   - Re-run representative gulp tasks (`gulp lint`, `gulp build`, targeted watch flows) to confirm there are no regressions after the v5 migration.
   - Track any lingering advisories from gulp plugins (e.g., `gulp-header`) and evaluate maintained alternatives if they surface.
2. **`uglifyify` package**
   - Still surfaces due to bundled `terser` < 5.14.2 inside its dependency tree.
   - Options: migrate the Browserify minification step to a maintained alternative (e.g., `babel-minify` or native `terser` plugin) or drop `uglifyify` entirely if no longer required.
3. **Residual transitive advisories**
   - Post-migration audit: rerun `npm audit --json` to confirm only unavoidable issues remain. Document rationale for any accepted risk.
4. **Documentation & tests**
   - After refactors, rerun the full validation suite (`npm run lint`, targeted gulp tasks, key unit tests) to ensure the build remains stable.

## Suggested Next Session Plan
1. Exercise core gulp 5 flows (`gulp lint`, `gulp build`, and watch mode) to shake out incompatibilities or plugin deprecations.
2. Evaluate removal of `uglifyify`: confirm Browserify config (`gulpfile.js`) and `scripts/patchUglifyify.js` implications.
3. Review PostCSS/Gulp compatibility after upgrades and add targeted tests for CSS build outputs.
4. Once major swaps are done, regenerate the audit report and capture results for compliance notes.

Keep `next-steps.prompt.md` updated as progress continues so morning sessions can pick up with clear context.
