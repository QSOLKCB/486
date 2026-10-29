import test from 'node:test';
import assert from 'node:assert/strict';
import { Machine } from '../machine/machine.mjs';
import { Bus } from '../bus/bus.mjs';
import { Cpu } from '../cpu/cpu.mjs';
const stackAddress = off => 0x20000 + off; // SS=2000h
const word = (bus,off) => bus.read8(stackAddress(off)) | (bus.read8(stackAddress(off+1)) << 8);

test('nested near calls save following IPs and unwind balanced stack in SS', () => {
  // CALL outer; HLT; [padding]; outer: PUSH AX; CALL inner; POP AX; RET;
  // [padding]; inner: PUSH BX; POP BX; RET.
  const program=Uint8Array.of(0xe8,0x04,0x00,0xf4,0x90,0x90,0x90,0x50,0xe8,0x04,0x00,0x58,0xc3,0x90,0x90,0x53,0x5b,0xc3);
  const m=new Machine({profile:'diagnostic-compute-v1',program,registers:{ax:0xabcd,bx:0x1234,sp:0x1000,ss:0x2000,ds:0x1000,flags:0x8d7}});
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ip,0x7c07);assert.equal(m.cpu.registers.sp,0x0ffe);assert.equal(word(m.bus,0xffe),0x7c03);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0x0ffc);assert.equal(word(m.bus,0xffc),0xabcd);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ip,0x7c0f);assert.equal(m.cpu.registers.sp,0x0ffa);assert.equal(word(m.bus,0xffa),0x7c0b);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0x0ff8);assert.equal(word(m.bus,0xff8),0x1234);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0x0ffa);assert.equal(m.cpu.registers.bx,0x1234);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ip,0x7c0b);assert.equal(m.cpu.registers.sp,0x0ffc);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ax,0xabcd);assert.equal(m.cpu.registers.sp,0x0ffe);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ip,0x7c03);assert.equal(m.cpu.registers.sp,0x1000);
  assert.equal(m.cpu.registers.flags,0x8d7);assert.equal(m.step().status,'halted');assert.equal(m.tick,9);
  // DS at the same offsets has not received the stack frames.
  for(const off of [0xff8,0xffa,0xffc,0xffe]) assert.equal(m.bus.read8(0x10000+off),0);
});

test('PUSH SP stores its pre-decrement value; POP SP installs the popped value', () => {
  let m=new Machine({profile:'diagnostic-compute-v1',program:Uint8Array.of(0x54),registers:{sp:0x1000,ss:0x2000,flags:0x8d7}});
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0xffe);assert.equal(word(m.bus,0xffe),0x1000);assert.equal(m.cpu.registers.flags,0x8d7);
  m=new Machine({profile:'diagnostic-compute-v1',program:Uint8Array.of(0x5c),registers:{sp:0x1000,ss:0x2000,flags:0x8d7}});
  m.bus.write8(stackAddress(0x1000),0x34);m.bus.write8(stackAddress(0x1001),0x12);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0x1234);assert.equal(m.cpu.registers.flags,0x8d7);
});

test('stack address arithmetic wraps before access, but word access never crosses a segment', () => {
  // SP=1 decrements to FFFF on PUSH/CALL. SP=FFFF is invalid for POP/RET.
  for(const [code,sp] of [[[0x50],1],[[0xe8,0,0],1],[[0x58],0xffff],[[0xc3],0xffff]]) {
    const m=new Machine({profile:'diagnostic-compute-v1',program:Uint8Array.from(code),registers:{ax:0x1234,sp,ss:0x2000,flags:0x8d7}});
    m.bus.write8(stackAddress(0xffff),0x6a);m.bus.write8(stackAddress(0),0x7b);const before={...m.cpu.registers};
    const outcome=m.step();assert.equal(outcome.status,'unsupported-platform-access',code.toString());assert.equal(outcome.retired,false);
    assert.deepEqual(m.cpu.registers,before);assert.equal(m.bus.read8(stackAddress(0xffff)),0x6a);assert.equal(m.bus.read8(stackAddress(0)),0x7b);
  }
  // SP=0 wraps to FFFE, which is a valid two-byte stack location.
  const m=new Machine({profile:'diagnostic-compute-v1',program:Uint8Array.of(0x50,0x58),registers:{ax:0xaabb,sp:0,ss:0x2000}});
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0xfffe);assert.equal(word(m.bus,0xfffe),0xaabb);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0);assert.equal(m.cpu.registers.ax,0xaabb);
});

test('unmapped second stack byte stops PUSH, CALL, POP and RET without partial effects', () => {
  // SS:7FFF = physical FFFF, followed by an unmapped second byte.
  for(const [code,sp] of [[[0x50],0x8001],[[0xe8,0,0],0x8001],[[0x58],0x7fff],[[0xc3],0x7fff]]) {
    const bus=new Bus({size:0x10000});for(let i=0;i<code.length;i++)bus.write8(0x7c00+i,code[i]);bus.write8(0xffff,0x55);
    const cpu=new Cpu(bus,{profile:'diagnostic-compute-v1',registers:{ax:0x1234,sp,ss:0x800,flags:0x8d7}});const before={...cpu.registers};
    const outcome=cpu.step();assert.equal(outcome.status,'unsupported-platform-access',code.toString());assert.equal(outcome.retired,false);
    assert.deepEqual(cpu.registers,before);assert.equal(bus.read8(0xffff),0x55);
  }
});
