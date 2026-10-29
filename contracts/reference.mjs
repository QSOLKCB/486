// Apache-2.0. Specification helpers only: not a CPU or conformance oracle.
function width(w) {
  if (![8, 16, 32].includes(w)) throw new RangeError('width must be 8, 16 or 32');
  return BigInt(w);
}
function integer(x) {
  if (typeof x === 'bigint') return x;
  if (!Number.isSafeInteger(x)) throw new TypeError('expected exact integer');
  return BigInt(x);
}
export function unsigned(x, w) {
  return Number(BigInt.asUintN(Number(width(w)), integer(x)));
}
export function signed(x, w) {
  return Number(BigInt.asIntN(Number(width(w)), integer(x)));
}
function bounded(x, max) {
  if (!Number.isSafeInteger(x) || x < 0 || x > max) throw new RangeError('out of range');
  return x;
}
// ADD only, normalized word operands. Does not merge EFLAGS or implement ADC.
export function add(a, b, w) {
  width(w);
  bounded(a, 2 ** w - 1); bounded(b, 2 ** w - 1);
  const result = unsigned(BigInt(a) + BigInt(b), w);
  const signedSum = signed(a, w) + signed(b, w);
  let ones = 0;
  for (let v = result & 255; v; v >>>= 1) ones += v & 1;
  return { result, cf: a + b >= 2 ** w, of: signedSum < -(2 ** (w - 1)) || signedSum >= 2 ** (w - 1),
    af: (a & 15) + (b & 15) > 15, zf: result === 0, sf: result >= 2 ** (w - 1), pf: ones % 2 === 0 };
}
export function realAddress(segment, offset) {
  return bounded(segment, 0xffff) * 16 + bounded(offset, 0xffff);
}
export function gateA20(address, enabled) {
  bounded(address, 0xffffffff);
  if (typeof enabled !== 'boolean') throw new TypeError('A20 state must be boolean');
  return enabled ? address : Number(BigInt(address) & ~(1n << 20n));
}
// Lab RAM map only. No guest-fault claim; future buses route ROM/MMIO separately.
export function ramIndex(address, length) {
  bounded(address, 0xffffffff); bounded(length, 0x100000000);
  if (address >= length) throw new RangeError('unmapped lab address');
  return address;
}
export function orderedEvents(events) {
  const snapshot = [...events];
  const seen = new Set();
  for (const { tick, sequence } of snapshot) {
    bounded(tick, Number.MAX_SAFE_INTEGER); bounded(sequence, Number.MAX_SAFE_INTEGER);
    if (seen.has(sequence)) throw new RangeError('duplicate event sequence');
    seen.add(sequence);
  }
  return snapshot.sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);
}
// Guard the synchronous state commit after awaiting, not an async operation that
// continues after this check. A reset cannot cancel work already in progress.
export function generationGuard() {
  let generation = 0n;
  return {
    reset() { generation += 1n; },
    capture() {
      const captured = generation;
      return callback => {
        if (captured !== generation) return false;
        callback();
        return true;
      };
    }
  };
}
