import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const checker = fileURLToPath(new URL('../scripts/check-push-whitespace.mjs', import.meta.url));
test('push whitespace checks all introduced commits and fallback snapshots', t => {
  const dir = mkdtempSync(join(tmpdir(), '486-push-check-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  function git(...args) {
    const r = spawnSync('git', args, {cwd: dir, encoding: 'utf8'});
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  }
  function commit(value, message) {
    writeFileSync(join(dir, 'file.txt'), value); git('add', 'file.txt');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  }
  function check(before, after) {return spawnSync(process.execPath, [checker, before, after], {cwd: dir, encoding: 'utf8'});}
  git('init', '-q');
  const base = commit('clean\n', 'base');
  const bad = commit('bad  \n', 'bad intermediate');
  const fixed = commit('fixed\n', 'clean final');
  assert.notEqual(check(base, fixed).status, 0, 'intermediate bad commit must fail even if fixed later');
  assert.equal(check(bad, fixed).status, 0, 'clean net and commit pass');
  assert.notEqual(check(fixed, bad).status, 0, 'force rewind that restores whitespace must fail');
  assert.notEqual(check('0'.repeat(40), bad).status, 0, 'new branch snapshot must be checked');
  assert.notEqual(check('f'.repeat(40), bad).status, 0, 'unavailable old tip snapshot must be checked');
  assert.equal(check('f'.repeat(40), fixed).status, 0, 'clean fallback snapshot passes');
});
