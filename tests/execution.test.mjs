import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Machine} from '../machine/machine.mjs';
import {Bus, PlatformAccess} from '../bus/bus.mjs';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/diagnostics/hello.json',import.meta.url)));
const bytes=Uint8Array.from(Buffer.from(fixture.hex,'hex'));
function execute(data, batch=10) { const m=new Machine({program:data}); m.resume(); while(m.state==='running')m.runBatch(batch); return m; }
test('original diagnostic executes four actual instructions and mutation changes output',()=>{
 const m=execute(bytes); assert.deepEqual(m.output,[0x4b]); assert.equal(m.state,'halted'); assert.equal(m.tick,4); assert.equal(m.cpu.registers.ip,0x7c07);
 const changed=bytes.slice(); changed[4]=0x58; assert.deepEqual(execute(changed).output,[0x58]);
});
test('unsupported, prefixes and absent ports stop with trace and no committed instruction effects',()=>{
 for(const b of [0x90,0x66]) { const m=execute(Uint8Array.of(b)); assert.equal(m.lastOutcome.status,'unsupported-instruction'); assert.deepEqual(m.lastOutcome.trace.start,{cs:0,ip:0x7c00}); assert.deepEqual(m.lastOutcome.trace.bytes,[b]); assert.equal(m.tick,0); assert.equal(m.cpu.registers.ip,0x7c00); }
 const m=execute(Uint8Array.of(0xba,0x12,0x00,0xee)); assert.equal(m.lastOutcome.status,'unsupported-platform-access'); assert.equal(m.tick,1); assert.equal(m.cpu.registers.ip,0x7c03); assert.deepEqual(m.output,[]);
});
test('checked memory and A20 routing',()=>{
 const b=new Bus({a20:false}); b.write8(0x100000,0x56); assert.equal(b.read8(0),0x56); assert.throws(()=>b.index(0x300000),PlatformAccess); assert.throws(()=>b.read8(0x400000),PlatformAccess); assert.throws(()=>b.write8(-1,0),RangeError);
});
test('profile boundaries and repeated halt do not retire',()=>{
 const m=execute(bytes); const tick=m.tick; assert.equal(m.step().retired,false); assert.equal(m.tick,tick);
 for (const opcode of [0xec,0xe4,0xbb]) {const rejected=execute(Uint8Array.of(opcode)); assert.equal(rejected.lastOutcome.status,'unsupported-instruction'); assert.equal(rejected.tick,0);}
 assert.throws(()=>new Machine({program:bytes,profile:'invented'}),RangeError);
});
test('pause, explicit step, reset, and batches are deterministic',()=>{
 const m=new Machine({program:bytes}); assert.equal(m.runBatch(5),0); assert.equal(m.tick,0);
 m.step(); assert.equal(m.tick,1); assert.equal(m.state,'paused'); m.resume(); m.runBatch(1); m.pause(); assert.equal(m.tick,2); assert.equal(m.runBatch(5),0);
 m.reset(); assert.equal(m.tick,0); assert.equal(m.generation,2); assert.deepEqual(m.output,[]);
 const a=execute(bytes,1),b=execute(bytes,10); assert.deepEqual(a.cpu.registers,b.cpu.registers); assert.deepEqual(a.output,b.output); assert.equal(a.tick,b.tick);
});
test('cross-segment instruction fetch stops without changing registers',()=>{
 const m=new Machine({program:bytes, registers:{ip:0xffff}}); m.bus.write8(0xffff,0xba); const result=m.step(); assert.equal(result.status,'unsupported-platform-access'); assert.equal(m.cpu.registers.ip,0xffff); assert.equal(m.cpu.registers.dx,0); assert.equal(m.tick,0); assert.deepEqual(result.trace.bytes,[0xba]);
});
test('events occur at instruction boundaries in sequence order and not while paused',()=>{
 const seen=[]; const m=new Machine({program:bytes,onEvent:e=>seen.push(e.sequence)});
 m.queueEvent({tick:0,sequence:2}); m.queueEvent({tick:0,sequence:1}); m.queueEvent({tick:1,sequence:3}); m.runBatch(2); assert.deepEqual(seen,[]);
 m.step(); assert.deepEqual(seen,[1,2]); m.step(); assert.deepEqual(seen,[1,2,3]); assert.throws(()=>m.queueEvent({tick:2,sequence:1}),RangeError);
});
test('text profile arithmetic flags, branches, and stores use guest state',()=>{
 // BX=ffff; INC BX preserves CF and sets ZF/AF/PF; branch JB and store AL to DS:BX.
 const m=new Machine({profile:'diagnostic-text-v1',registers:{ds:0xb800,flags:3},program:Uint8Array.of(0xbb,0xff,0xff,0x43,0x72,0x02,0xb0,0x58,0xb0,0x41,0x88,0x07,0xf4)});
 m.step(); m.step(); assert.equal(m.cpu.registers.bx,0); assert.equal(m.cpu.registers.flags & (1|4|16|64),1|4|16|64);
 m.resume(); m.runBatch(20); assert.equal(m.bus.read8(0xb8000),0x41); assert.equal(m.state,'halted');
});
test('text CMP flags and TEST flags determine branches without changing operands',()=>{
 // compare 7fff - ffff: borrow and signed overflow; then test zero clears CF/OF and sets ZF/PF.
 const m=new Machine({profile:'diagnostic-text-v1',program:Uint8Array.of(0xbb,0xff,0x7f,0x81,0xfb,0xff,0xff,0xb0,0x00,0xa8,0x01,0xf4)});
 m.step(); m.step(); assert.equal(m.cpu.registers.bx,0x7fff); assert.equal(m.cpu.registers.flags & (1|2048),1|2048);
 m.step(); m.step(); assert.equal(m.cpu.registers.flags & (1|2048),0); assert.equal(m.cpu.registers.flags & (64|4),64|4);
});
