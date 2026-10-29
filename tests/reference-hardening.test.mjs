import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedEvents, generationGuard} from '../contracts/reference.mjs';

test('one-shot event iterators are validated and sorted without loss', () => {
  function* input() { yield {tick: 2, sequence: 0}; yield {tick: 1, sequence: 2}; yield {tick: 1, sequence: 1}; }
  assert.deepEqual(orderedEvents(input()).map(event => event.sequence), [1, 2, 0]);
  function* duplicates() { yield {tick: 0, sequence: 3}; yield {tick: 1, sequence: 3}; }
  assert.throws(() => orderedEvents(duplicates()), /duplicate/);
});

test('guard checks the synchronous commit after awaited work', async () => {
  const guard = generationGuard();
  const commit = guard.capture();
  let finish;
  const work = new Promise(resolve => { finish = resolve; });
  let state = 0;
  const pending = (async () => { const result = await work; return commit(() => {state = result;}); })();
  guard.reset(); finish(42);
  assert.equal(await pending, false);
  assert.equal(state, 0);
  assert.equal(guard.capture()(() => {state = 7;}), true);
  assert.equal(state, 7);
});
