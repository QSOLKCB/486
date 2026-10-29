import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Machine} from '../machine/machine.mjs';
import {resetRom} from '../fixtures/firmware/reset-rom.mjs';

test('original reset ROM executes through both aliases and repeats after reset', () => {
  const rom=resetRom();
  assert.equal(createHash('sha256').update(rom).digest('hex'), 'd975d5eb1769b8d250684045b981d592216dda892802ed60770a4eeaa791103e');
  const machine=new Machine({profile:'i486-reset-v1',rom});
  // The caller cannot mutate the installed ROM or its next reset image.
  rom[0xfff0]=0xf4;
  assert.equal(machine.cpu.registers.cs,0xf000);
  assert.equal(machine.cpu.registers.ip,0xfff0);
  assert.equal(machine.cpu.csBase,0xffff0000);
  assert.equal(machine.bus.read8(0xfffffff0),0xea);
  assert.equal(machine.bus.read8(0x000ffff0),0xea);
  const first=machine.step();
  assert.deepEqual(first.trace.bytes,[0xea,0,0,0,0xf0]);
  assert.deepEqual(first.trace.start,{cs:0xf000,ip:0xfff0});
  assert.equal(machine.cpu.registers.ip,0);
  assert.equal(machine.cpu.csBase,0x000f0000);
  const following=[];
  for(let i=0;i<4 && machine.state!=='halted' && machine.state!=='stopped';i++) following.push(machine.step().trace.bytes);
  assert.equal(machine.state,'halted');
  assert.deepEqual(following,[[0xba,0xe9,0],[0xb0,0x52],[0xee],[0xf4]]);
  assert.deepEqual(machine.output,[0x52]);
  const end={...machine.cpu.registers};
  machine.reset(); machine.resume();
  for(let i=0;i<2 && machine.state==='running';i++) machine.runBatch(3);
  assert.equal(machine.state,'halted'); assert.deepEqual(machine.output,[0x52]);
  assert.deepEqual(machine.cpu.registers,end); assert.equal(machine.tick,5);
});

test('reset profile enforces its image and loader boundary', () => {
  assert.throws(()=>new Machine({profile:'i486-reset-v1',rom:new Uint8Array(1)}),/65536/);
  assert.throws(()=>new Machine({profile:'i486-reset-v1',rom:resetRom(),program:new Uint8Array()}),/direct-loader/);
  assert.throws(()=>new Machine({profile:'i486-reset-v1',rom:resetRom(),registers:{ip:0}}),/overrides/);
  assert.throws(()=>new Machine({program:new Uint8Array(),rom:resetRom()}),/ROM/);
});
