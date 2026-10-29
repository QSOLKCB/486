// Independent byte vectors for the reset descriptor cache and far jump.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Bus} from '../bus/bus.mjs';
import {Cpu} from '../cpu/cpu.mjs';

const resetCpu = (bus, registers={}) => new Cpu(bus,{profile:'i486-reset-v1',registers});

test('reset fetch uses high hidden CS base; far jump loads normal real-mode CS base',()=>{
  const bus=new Bus();
  bus.mapROM(0xfffffff0,Uint8Array.of(0xea,0x34,0x12,0x00,0xf0));
  bus.mapROM(0xf1234,Uint8Array.of(0xb0,0x4b,0xf4));
  const cpu=resetCpu(bus), r=cpu.registers;
  assert.deepEqual([r.cs,r.ip,cpu.csBase,r.dx,r.flags],[0xf000,0xfff0,0xffff0000,0x0400,2]);
  const first=cpu.step();
  assert.deepEqual(first.trace.start,{cs:0xf000,ip:0xfff0});
  assert.deepEqual(first.trace.bytes,[0xea,0x34,0x12,0x00,0xf0]);
  assert.equal(first.trace.mnemonic,'JMP ptr16:16');
  assert.deepEqual([r.cs,r.ip,cpu.csBase,r.flags],[0xf000,0x1234,0xf0000,2]);
  assert.deepEqual(cpu.step().trace.bytes,[0xb0,0x4b]);
  assert.equal(r.ax,0x4b);
  assert.equal(cpu.step().status,'halted');
});

test('far jump decodes both little-endian words and preserves flags',()=>{
  const bus=new Bus();
  bus.mapROM(0xfffffff0,Uint8Array.of(0xea,0x78,0x56,0x34,0x12));
  bus.ram.set([0x2e,0x8a,0x06,0,0],0x179b8);
  bus.write8(0x12340,0xa5);
  const cpu=resetCpu(bus,{flags:0x8d7});
  assert.equal(cpu.step().status,'retired');
  assert.deepEqual([cpu.registers.cs,cpu.registers.ip,cpu.csBase,cpu.registers.flags],[0x1234,0x5678,0x12340,0x8d7]);
  assert.equal(cpu.step().status,'retired');
  assert.equal(cpu.registers.ax,0xa5);
});

test('CS override addresses use hidden base before far jump, not the visible selector',()=>{
  const bus=new Bus();
  bus.mapROM(0xffff0000,Uint8Array.of(0x6d));
  bus.mapROM(0xfffffff0,Uint8Array.of(0x2e,0x8a,0x06,0,0));
  bus.write8(0xf0000,0x99);
  const cpu=resetCpu(bus);
  assert.equal(cpu.step().status,'retired');
  assert.equal(cpu.registers.ax,0x6d);
});

test('far jump decode failure is non-mutating and unsupported in prior profiles',()=>{
  const bus=new Bus(); bus.mapROM(0xfffffff0,Uint8Array.of(0xea,0x34,0x12,0x00));
  const cpu=resetCpu(bus),before={...cpu.registers},base=cpu.csBase;
  const result=cpu.step();
  assert.equal(result.status,'unsupported-platform-access');
  assert.deepEqual(result.trace.bytes,[0xea,0x34,0x12,0x00]);
  assert.deepEqual(cpu.registers,before); assert.equal(cpu.csBase,base);
  const legacy=new Bus(); legacy.write8(0x7c00,0xea);
  assert.equal(new Cpu(legacy,{profile:'diagnostic-segments-v1'}).step().status,'unsupported-instruction');
});

test('far jump crossing code-segment end does not change CS, IP or hidden base',()=>{
  const bus=new Bus(); bus.mapROM(0xfffffffc,Uint8Array.of(0xea,0x34,0x12,0x00));
  const cpu=resetCpu(bus,{ip:0xfffc}),before={...cpu.registers};
  const result=cpu.step();
  assert.equal(result.status,'unsupported-platform-access');
  assert.match(result.reason,/code segment boundary/);
  assert.deepEqual(cpu.registers,before); assert.equal(cpu.csBase,0xffff0000);
});

test('word arithmetic into a RAM/ROM boundary changes neither byte nor flags',()=>{
  const bus=new Bus();
  bus.mapROM(0xfffffff0,Uint8Array.of(0xea,0,0,0,0));
  bus.ram.set([0x81,0x06,0x00,0x30,0x01,0x00],0);
  bus.ram[0x3000]=0xff; bus.mapROM(0x3001,Uint8Array.of(0));
  const cpu=resetCpu(bus,{flags:0x8d7}); cpu.step();
  const before={...cpu.registers}; const result=cpu.step();
  assert.equal(result.status,'unsupported-platform-access');
  assert.match(result.reason,/read-only ROM/);
  assert.deepEqual(cpu.registers,before); assert.equal(bus.read8(0x3000),0xff);assert.equal(bus.read8(0x3001),0);
});
