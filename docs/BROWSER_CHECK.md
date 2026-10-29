# Optional browser integration check

The static app has no runtime dependencies. The integration check uses Node.js
24.22.1 and an independently installed Playwright plus Chromium; it is not run
by the foundation reference CI. From the repository root, with Playwright
available to Node, run:

```sh
node scripts/browser-check.mjs
```

The script serves the checkout locally under `/486/`, exercises the real app,
and saves three screenshots in a new temporary directory (printed at the end).
`SCREENSHOT_DIR` can choose a different directory. `PLAYWRIGHT_MODULE` may point
to an absolute Playwright entry module when the package is installed elsewhere;
`CHROMIUM_PATH` may point to an existing Chromium executable. An optional JSON
array in `CHROMIUM_EXTRA_ARGS` supplies browser-specific launch arguments.

The implementation receipt used Playwright 1.62.1 and Chromium 153.0.8010.0
from the `@sparticuz/chromium` 153.0.0 development package, on Linux and Node
24.22.1. That headless environment required its SwiftShader libraries on
`LD_LIBRARY_PATH` and `CHROMIUM_EXTRA_ARGS='["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--single-process","--no-zygote"]'`.
These are test-environment settings, not shipped app dependencies or a
recommendation to disable sandboxing on a normal desktop. Firefox was not tested.
The script verifies the guest output, controls, focus and repeated input, disk
persistence and export, malformed and same-name imports, and page/console errors.
It does not prove complete x86, PC or browser compatibility.
