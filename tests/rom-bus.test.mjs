import test from 'node:test';
import assert from 'node:assert/strict';
import {Bus, PlatformAccess} from '../bus/bus.mjs';

test('sparse ROM aliases read identical copied bytes and block writes, including RAM overlays', () => {
  const bus = new Bus({size: 0x100000});
  const image = Uint8Array.of(0xea, 0x12, 0x34, 0x56);
  bus.write8(0xffff0, 0x77);
  bus.mapROM(0xffff0, image);
  bus.mapROM(0xfffffff0, image);
  image[0] = 0x00;
  assert.equal(bus.read8(0xffff0), 0xea);
  assert.equal(bus.read8(0xfffffff0), 0xea);
  assert.equal(bus.read8(0xfffffff3), 0x56);
  assert.throws(() => bus.write8(0xffff0, 0x99), PlatformAccess);
  assert.throws(() => bus.write8(0xfffffff0, 0x99), PlatformAccess);
  assert.equal(bus.ram[0xffff0], 0x77);
  assert.equal(bus.read8(0xffff0), 0xea);
  assert.throws(() => bus.read8(0xfffffff4), PlatformAccess);
  assert.throws(() => bus.read8(0xfffeffff), PlatformAccess);
});

test('ROM mapping copies a Buffer view instead of retaining its backing storage', () => {
  const bus = new Bus({size: 32});
  const backing = Buffer.from([0x99, 0xea, 0x12, 0x34, 0x88]);
  const image = backing.subarray(1, 4);
  bus.mapROM(100, image);
  backing.fill(0);
  assert.deepEqual([bus.read8(100), bus.read8(101), bus.read8(102)], [0xea, 0x12, 0x34]);
  assert.throws(() => bus.write8(100, 0), PlatformAccess);
});

test('ROM mapping rejects invalid and overlapping ranges without modifying existing mappings', () => {
  const bus = new Bus({size: 32});
  bus.mapROM(100, Uint8Array.of(1, 2, 3));
  assert.throws(() => bus.mapROM(102, Uint8Array.of(4, 5)), /overlap/);
  assert.throws(() => bus.mapROM(99, Uint8Array.of(4, 5)), /overlap/);
  assert.throws(() => bus.mapROM(0xffffffff, Uint8Array.of(4, 5)), RangeError);
  assert.throws(() => bus.mapROM(0, new Uint8Array()), TypeError);
  assert.throws(() => bus.mapROM(-1, Uint8Array.of(1)), RangeError);
  assert.equal(bus.read8(100), 1);
  assert.throws(() => bus.read8(99), PlatformAccess);
  bus.mapROM(103, Uint8Array.of(4));
  assert.equal(bus.read8(103), 4);
});

test('A20 gating precedes ROM lookup and controls both reads and writes', () => {
  const bus = new Bus({size: 0x1000, a20: false});
  bus.mapROM(0xffeffff0, Uint8Array.of(0x42));
  bus.mapROM(0xfffffff0, Uint8Array.of(0x99));
  assert.equal(bus.read8(0xfffffff0), 0x42);
  assert.throws(() => bus.write8(0xfffffff0, 0x33), PlatformAccess);
  bus.a20 = true;
  assert.equal(bus.read8(0xfffffff0), 0x99);
  assert.equal(bus.index(0xfffffff0), 0xfffffff0);
  assert.throws(() => bus.writableIndex(0xfffffff0), PlatformAccess);
  assert.throws(() => bus.read8(0xffffffef), PlatformAccess);
});
