// Check each introduced commit, plus the net tree delta for rewinds/force pushes.
// With an unavailable old tip, audit the entire resulting tree instead.
import {spawnSync} from 'node:child_process';
import {streamPushCommits} from './stream-push-commits.mjs';

const [before, after] = process.argv.slice(2);
if (![before, after].every(value => /^[0-9a-f]{40}$/.test(value ?? ''))) {
  throw new Error('Expected two 40-character push SHAs');
}
function git(args, allowFailure = false) {
  const result = spawnSync('git', args, {encoding: 'utf8'});
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
    throw new Error(`git ${args[0]} failed (${result.status})`);
  }
  return result;
}
const zero = '0'.repeat(40);
if (after === zero) { console.log('Deleted ref: no resulting tree to check.'); process.exit(0); }
git(['cat-file', '-e', `${after}^{commit}`]);
const emptyTree = git(['hash-object', '-w', '-t', 'tree', '--stdin'], true);
// hash-object requires stdin EOF; spawnSync uses an empty input by default.
if (emptyTree.status !== 0) throw new Error('Could not construct empty tree');
const empty = emptyTree.stdout.trim();
if (before === zero || git(['cat-file', '-e', `${before}^{commit}`], true).status !== 0) {
  console.log('Old tip unavailable; auditing the complete resulting tree.');
  git(['diff', '--check', empty, after]);
} else {
  git(['diff', '--check', before, after]);
  const count = await streamPushCommits(`${before}..${after}`, (commit, parent) => {
    git(['diff', '--check', parent ?? empty, commit]);
  });
  console.log(`Checked net delta and ${count} introduced commit(s).`);
}
