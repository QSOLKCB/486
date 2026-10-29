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

test('large rev-list streams without Node output-buffer limits and reports failures', t => {
  const dir = mkdtempSync(join(tmpdir(), '486-rev-list-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const fakeGit = join(dir, 'git');
  const streamModule = new URL('../scripts/stream-push-commits.mjs', import.meta.url).href;
  // Over 2 MiB of valid rev-list output: well beyond spawnSync's 1 MiB default.
  // The visit callback is in-process so the regression remains fast and does
  // not create 30,000 git repositories or git-diff subprocesses.
  writeFileSync(fakeGit, `#!${process.execPath}\nconst line = 'a'.repeat(40) + ' ' + 'b'.repeat(40) + '\\n';\nif (process.env.FAKE_GIT_MODE === 'failure') { process.exitCode = 3; }\nelse if (process.env.FAKE_GIT_MODE === 'invalid') { process.stdout.write('not-a-sha\\n'); }\nelse { process.stdout.write(line.repeat(30000)); }\n`, {mode: 0o755});
  const env = {...process.env, PATH: `${dir}:${process.env.PATH}`};
  const run = (mode, body) => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {streamPushCommits} from ${JSON.stringify(streamModule)}; ${body}`],
    {encoding: 'utf8', env: {...env, FAKE_GIT_MODE: mode}, timeout: 15000});
  const large = run('large', `let count=0; const actual=await streamPushCommits('range',(commit,parent)=>{if(commit!=='a'.repeat(40)||parent!=='b'.repeat(40))throw Error('invalid record'); count++;}); if(actual!==30000||count!==30000)throw Error('bad count'); console.log('passed');`);
  assert.equal(large.status, 0, large.stderr); assert.match(large.stdout, /passed/);
  const failed = run('failure', `await streamPushCommits('range',()=>{});`);
  assert.notEqual(failed.status, 0); assert.match(failed.stderr, /git rev-list failed \(3\)/);
  const invalid = run('invalid', `await streamPushCommits('range',()=>{});`);
  assert.notEqual(invalid.status, 0); assert.match(invalid.stderr, /Invalid commit record/);
  const interrupted = run('large', `await streamPushCommits('range',()=>{throw Error('visitor failed');});`);
  assert.notEqual(interrupted.status, 0); assert.match(interrupted.stderr, /visitor failed/);
});
