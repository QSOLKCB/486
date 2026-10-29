import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Machine} from '../machine/machine.mjs';
import {makeSegmentProgram, segmentDataOffsets} from '../fixtures/diagnostics/segments.mjs';

const make=(program=makeSegmentProgram())=>new Machine({program,profile:'diagnostic-segments-v1'});
const run=(m,batch)=>{m.resume(); while(m.state==='running' && m.tick<500) m.runBatch(batch); return m;};
const capture=m=>({registers:{...m.cpu.registers},tick:m.tick,output:[...m.output],state:m.state,
 ss:m.bus.ram[0x0100],ds:m.bus.ram[0x10100],es:Array.from(m.bus.ram.slice(0x20100,0x20102)),unrelated:m.bus.ram[0x30100],stack:Array.from(m.bus.ram.slice(0xfffc,0x10000))});
test('guest loads data segments and executes distinct default and override accesses',async()=>{
 const receipt=JSON.parse(await readFile(new URL('../fixtures/diagnostics/segments.json',import.meta.url)));
 const image=makeSegmentProgram(); assert.equal(image.length,receipt.length);assert.equal(createHash('sha256').update(image).digest('hex'),receipt.sha256);
 const m=make();assert.equal(m.cpu.registers.ds,0);assert.equal(m.cpu.registers.es,0);
 const result=capture(run(m,7)); assert.equal(result.state,'halted');assert.equal(result.tick,receipt.expected.retiredInstructions);
 assert.deepEqual(result.output,[0x56]);assert.equal(result.ss,3);assert.equal(result.ds,0x21);assert.deepEqual(result.es,[0x11,0x56]);assert.equal(result.unrelated,0x77);assert.deepEqual(result.stack,[0,1,0x2b,0x7c]);
 for(const [key,hex] of Object.entries(receipt.expected.registersHex)) assert.equal(result.registers[key],parseInt(hex,16),key);
});
test('selected data affects guest output while unrelated segment data does not',()=>{
 const selected=makeSegmentProgram();selected[segmentDataOffsets.es]=0x12;const a=run(make(selected),100);assert.equal(a.state,'halted');assert.deepEqual(a.output,[0x57]);assert.equal(a.bus.ram[0x20101],0x57);
 const unrelated=makeSegmentProgram();unrelated[segmentDataOffsets.unrelated]=0x88;const b=run(make(unrelated),100);assert.equal(b.state,'halted');assert.deepEqual(b.output,[0x56]);assert.equal(b.bus.ram[0x30100],0x88);
});
test('segment guest replay agrees for stepping, batches, pause/resume and reset',()=>{
 const stepped=make();while(stepped.state==='paused'&&stepped.tick<500)stepped.step();
 const a=run(make(),1),b=run(make(),7),c=run(make(),1000);assert.deepEqual(capture(stepped),capture(a));assert.deepEqual(capture(a),capture(b));assert.deepEqual(capture(b),capture(c));
 const m=make();m.resume();m.runBatch(9);m.pause();const before=capture(m);assert.equal(m.runBatch(20),0);assert.deepEqual(capture(m),before);m.resume();while(m.state==='running')m.runBatch(7);assert.deepEqual(capture(m),capture(c));
 m.reset();assert.equal(m.tick,0);assert.equal(m.cpu.registers.ds,0);assert.equal(m.cpu.registers.es,0);assert.deepEqual(capture(run(m,7)),capture(c));
});
test('instruction-by-instruction segment defaults, overrides and SS stack effects',()=>{
 const m=make();
 const until=ip=>{while(m.cpu.registers.ip!==ip && m.state==='paused' && m.tick<100)m.step();assert.equal(m.cpu.registers.ip,ip);};
 until(0x7c1a);assert.equal(m.cpu.registers.ax&255,0x21); // unprefixed [BX] read from DS
 until(0x7c1d);assert.equal(m.cpu.registers.ax&255,0x32); // ES:[BX]
 until(0x7c20);assert.equal(m.cpu.registers.ax&255,0x35); // unprefixed BP uses SS
 until(0x7c24);assert.equal(m.cpu.registers.ax&255,0x56); // explicit DS:[BP]
 until(0x7c2d);assert.equal(m.cpu.registers.sp,0xfffe);assert.deepEqual(Array.from(m.bus.ram.slice(0xfffe,0x10000)),[0x2b,0x7c]);assert.deepEqual(Array.from(m.bus.ram.slice(0x2fffe,0x30000)),[0,0]);
 m.step();assert.equal(m.cpu.registers.sp,0xfffc);assert.deepEqual(Array.from(m.bus.ram.slice(0xfffc,0xfffe)),[0,1]);assert.deepEqual(Array.from(m.bus.ram.slice(0x2fffc,0x2fffe)),[0,0]);
});
