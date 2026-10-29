import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unsigned, signed, add, realAddress, gateA20, ramIndex, orderedEvents, generationGuard } from '../contracts/reference.mjs';

test('finite widths, sign boundaries, exact host-input validation', () => {
  for (const w of [8, 16, 32]) {
    const modulus = 2 ** w;
    assert.equal(unsigned(-1, w), modulus - 1);
    assert.equal(unsigned(modulus, w), 0);
    assert.equal(signed(modulus / 2, w), -modulus / 2);
    assert.equal(unsigned((1n << 80n) + 3n, w), 3);
    for (const bad of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '1'])
      assert.throws(() => unsigned(bad, w));
  }
  assert.equal(unsigned(0x80000000, 32), 2147483648);
  assert.equal(unsigned(0xffffffff, 32), 4294967295);
  for (const w of [0, 7, 64, '8']) assert.throws(() => unsigned(0, w));
});

test('ADD independent edge flags, including low-byte parity at larger widths', () => {
  assert.deepEqual(add(0x7f, 1, 8), { result: 128, cf: false, of: true, af: true, zf: false, sf: true, pf: false });
  assert.deepEqual(add(255, 1, 8), { result: 0, cf: true, of: false, af: true, zf: true, sf: false, pf: true });
  assert.deepEqual(add(0x80000000, 0x80000000, 32), { result: 0, cf: true, of: true, af: false, zf: true, sf: false, pf: true });
  assert.equal(add(0xffff, 1, 16).cf, true);
  assert.equal(add(0x7fffffff, 1, 32).of, true);
  assert.equal(add(0xff, 1, 16).pf, true);
  assert.throws(() => add(256, 0, 8));
  assert.throws(() => add(-1, 0, 32));
});

test('all 65536 8-bit ADD pairs against independent integer/bit oracle', () => {
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) {
    const r = (a + b) % 256;
    const actual = add(a, b, 8);
    assert.deepEqual(actual, { result: r, cf: a + b > 255,
      of: Boolean((~(a ^ b) & (a ^ r)) & 128), af: Boolean((a ^ b ^ r) & 16),
      zf: r === 0, sf: Boolean(r & 128), pf: r.toString(2).replaceAll('0', '').length % 2 === 0 });
  }
});

test('A20 gating is not RAM wrap or unconditional 20-bit truncation', () => {
  assert.equal(realAddress(0xffff, 0xffff), 0x10ffef);
  assert.equal(gateA20(0x100000, false), 0);
  assert.equal(gateA20(0x200000, false), 0x200000);
  assert.equal(gateA20(0xffffffff, false), 0xffefffff);
  assert.equal(gateA20(0x100000, true), 0x100000);
  assert.equal(ramIndex(0x1fffff, 0x200000), 0x1fffff);
  assert.throws(() => ramIndex(gateA20(0x200000, false), 0x200000));
  assert.throws(() => realAddress(0, 0x10000));
  assert.throws(() => gateA20(-1, false));
  assert.throws(() => gateA20(0, 0));
});

test('events sort by tick then unique sequence, without rewriting the input log', () => {
  const input = [{ tick: 3, sequence: 0 }, { tick: 1, sequence: 2 }, { tick: 1, sequence: 1 }];
  assert.deepEqual(orderedEvents(input).map(x => x.sequence), [1, 2, 0]);
  assert.deepEqual(input.map(x => x.sequence), [0, 2, 1]);
  assert.throws(() => orderedEvents([{ tick: 0, sequence: 1 }, { tick: 2, sequence: 1 }]));
  assert.throws(() => orderedEvents([{ tick: -1, sequence: 0 }]));
  assert.throws(() => orderedEvents([{ tick: 0, sequence: 0.5 }]));
});

test('a delayed pre-reset callback cannot mutate the new generation', async () => {
  const guard = generationGuard();
  const old = guard.capture();
  let value = 0;
  const pending = Promise.resolve().then(() => old(() => { value = 99; }));
  guard.reset();
  assert.equal(await pending, false);
  assert.equal(value, 0);
  assert.equal(guard.capture()(() => { value = 1; }), true);
  assert.equal(value, 1);
});

test('original diagnostic bytes and digest are reproducible; mutation is detected (not execution)', () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/diagnostics/hello.json', import.meta.url)));
  const expected = Buffer.from([0xba, 0xe9, 0, 0xb0, 0x4b, 0xee, 0xf4]);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(fixture.hex, expected.toString('hex'));
  assert.equal(fixture.length, expected.length);
  assert.equal(fixture.sha256, digest(expected));
  const mutated = Buffer.from(expected); mutated[4] ^= 1;
  assert.notEqual(digest(mutated), fixture.sha256);
  assert.equal(fixture.profile, 'diagnostic-real-v1');
  assert.equal(fixture.expected.outputHex, '4b');
});
