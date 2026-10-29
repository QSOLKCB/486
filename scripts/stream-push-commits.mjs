// Stream rev-list output rather than buffering a potentially large push history.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

export async function streamPushCommits(range, visit) {
  const child = spawn('git', ['rev-list', '--reverse', '--parents', range],
    {stdio: ['ignore', 'pipe', 'inherit']});
  // Always resolve: an early spawn/exit error must not become an unhandled
  // rejection while a consumer is processing an earlier line.
  const completion = new Promise(resolve => {
    child.once('error', error => resolve({error}));
    child.once('close', (code, signal) => resolve({code, signal}));
  });
  const lines = createInterface({input: child.stdout, crlfDelay: Infinity});
  let count = 0;
  try {
    for await (const line of lines) {
      const [commit, ...parents] = line.split(' ');
      if (!commit || ![commit, ...parents].every(id => /^[0-9a-f]{40}$/.test(id))) {
        throw new Error('Invalid commit record from git rev-list');
      }
      await visit(commit, parents[0]);
      count++;
    }
  } catch (error) {
    lines.close(); child.kill(); await completion;
    throw error;
  }
  const result = await completion;
  if (result.error) throw result.error;
  if (result.code !== 0) throw new Error(`git rev-list failed (${result.code ?? result.signal})`);
  return count;
}
