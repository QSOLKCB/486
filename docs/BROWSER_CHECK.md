# Optional browser integration check

The static app has no runtime dependencies. The integration check uses Node.js
24.22.1 and an independently installed Playwright plus Chromium; it is not run
by the foundation reference CI. From the repository root, with Playwright
available to Node, run:

```sh
node scripts/browser-check.mjs
```

The script serves the checkout locally under `/486/`, exercises the real app,
and saves five screenshots in a new temporary directory (printed at the end).
`SCREENSHOT_DIR` can choose a different directory. `PLAYWRIGHT_MODULE` may point
to an absolute Playwright entry module when the package is installed elsewhere;
`CHROMIUM_PATH` may point to an existing Chromium executable. An optional JSON
array in `CHROMIUM_EXTRA_ARGS` supplies browser-specific launch arguments.

The updated receipt used the default `require.resolve('playwright')` path,
without `PLAYWRIGHT_MODULE`: Playwright 1.62.1 resolved its CommonJS `index.js`,
and the check passed with Chromium 153.0.8010.0
from the `@sparticuz/chromium` 153.0.0 development package, on Linux and Node
24.22.1. Playwright was made visible using `NODE_PATH`; the documented Node
command itself was unchanged. That headless environment required its SwiftShader libraries on
`LD_LIBRARY_PATH` and `CHROMIUM_EXTRA_ARGS='["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--single-process","--no-zygote"]'`.
These are test-environment settings, not shipped app dependencies or a
recommendation to disable sandboxing on a normal desktop. Firefox was not tested.
The script verifies guest outputs including the compute and segmentation guests, controls, focus and repeated input, disk
persistence and export, malformed and same-name imports, and page/console errors.
It does not prove complete x86, PC or browser compatibility.

For a staged Pages artifact, copy this script into its `scripts/` directory for
verification only and set `CHECK_RENDERED_DOCS=1`. The check additionally opens
Support, follows a rendered profile link and returns to the lab under `/486/`.
The test script itself is not included in the published artifact.

## Rendered Pages documentation

The manual Pages job stages the static files and runs
`node scripts/render-pages.mjs _site` with Node 24.22.1. The renderer uses the
vendored build-only Marked parser; its provenance is recorded in
[the parser receipt](../tools/marked/README.md). The unbuilt checkout keeps its
Markdown documentation and Support link unchanged. To check the rendered site,
serve the staged tree under `/486/` and run the optional browser check against
that tree with `CHECK_RENDERED_DOCS=1`; the check verifies Support and a profile
link render as HTML and return to the lab. Its test script is tooling, not part
of the published artifact.
