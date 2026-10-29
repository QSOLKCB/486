import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('browser check resolves a CommonJS Playwright package without an override', async (t) => {
  // Run the actual script in isolation with the same default package-resolution
  // route used by a normal Playwright install. The sentinel proves that the
  // resolved module's chromium.launch was called, without launching a browser.
  const root = await mkdtemp(join(tmpdir(), '486-resolution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts'), { recursive: true });
  await mkdir(join(root, 'scripts', 'node_modules', 'playwright'), { recursive: true });
  await copyFile(fileURLToPath(new URL('../scripts/browser-check.mjs', import.meta.url)), join(root, 'scripts', 'browser-check.mjs'));
  await writeFile(join(root, 'scripts', 'node_modules', 'playwright', 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.cjs' }));
  await writeFile(join(root, 'scripts', 'node_modules', 'playwright', 'index.cjs'), "module.exports = { chromium: { launch() { throw new Error('PLAYWRIGHT_LAUNCH_REACHED'); } } };\n");
  const env = { ...process.env };
  delete env.PLAYWRIGHT_MODULE;
  delete env.CHROMIUM_PATH;
  delete env.CHROMIUM_EXTRA_ARGS;
  env.SCREENSHOT_DIR = join(root, 'screenshots');
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'browser-check.mjs')], { env, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /PLAYWRIGHT_LAUNCH_REACHED/);
});
