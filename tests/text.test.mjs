import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Machine} from '../machine/machine.mjs';
import {LabKeyboard, attachKeyboard, keyboardEvent} from '../devices/keyboard.mjs';
import {echoProgram} from '../fixtures/diagnostics/echo.mjs';
const make = () => new Machine({program:echoProgram, profile:'diagnostic-text-v1', registers:{ds:0xb800}, setupBus:attachKeyboard, onEvent:keyboardEvent});
const event = (m, tick, sequence, byte) => m.queueEvent({tick,sequence,type:'key',byte});
test('original echo receipt and actual guest stores', async () => {
 const receipt=JSON.parse(await readFile(new URL('../fixtures/diagnostics/echo.json',import.meta.url)));
 assert.equal(echoProgram.length, receipt.length); assert.equal(Buffer.from(echoProgram).toString('hex'),receipt.hex);
 assert.equal(createHash('sha256').update(echoProgram).digest('hex'),receipt.sha256);
 const m=make(); event(m,0,0,65); event(m,0,1,65); m.resume(); m.runBatch(100);
 assert.deepEqual(Array.from(m.bus.ram.slice(0xb8000,0xb8004)),[65,7,65,7]);
 assert.equal(m.keyboard.queue.length,0);
});
test('event replay is independent of host batch size', () => {
 const run = size => { const m=make(); event(m,0,0,65); event(m,0,1,66); event(m,19,2,67); m.resume(); for(let n=0;n<100;n+=size) m.runBatch(Math.min(size,100-n)); return {r:m.cpu.registers, tick:m.tick, screen:Array.from(m.bus.ram.slice(0xb8000,0xb8008)), queue:m.keyboard.queue}; };
 assert.deepEqual(run(1),run(7)); assert.deepEqual(run(7),run(100));
});
test('pause, explicit step, and reset keep input and display lifecycle distinct', () => {
 const m=make(); event(m,0,0,90); assert.equal(m.runBatch(5),0); assert.equal(m.tick,0); assert.equal(m.keyboard.queue.length,0);
 m.step(); assert.equal(m.tick,1); assert.equal(m.state,'paused'); assert.equal(m.keyboard.queue.length,1);
 m.resume(); m.runBatch(12); m.pause(); const tick=m.tick; m.runBatch(5); assert.equal(m.tick,tick);
 assert.equal(m.bus.ram[0xb8000],90); m.reset(); assert.equal(m.tick,0); assert.equal(m.bus.ram[0xb8000],0); assert.equal(m.inputLog.length,0); assert.equal(m.keyboard.queue.length,0);
});
test('keyboard FIFO bounds and invalid input', () => {
 const k=new LabKeyboard(); for(let i=0;i<256;i++) assert.equal(k.enqueue(65),true);
 assert.equal(k.enqueue(66),false); assert.equal(k.dropped,1); assert.equal(k.read(0x64),1);
 for(let i=0;i<256;i++) assert.equal(k.read(0x60),65);
 assert.equal(k.read(0x64),0); assert.equal(k.read(0x60),0); assert.throws(()=>k.enqueue(10),RangeError);
});
test('guest wraps at last framebuffer cell', () => {
 const m=make(); m.cpu.registers.bx=3998; event(m,0,0,88); event(m,0,1,89); m.resume(); m.runBatch(100);
 assert.deepEqual(Array.from(m.bus.ram.slice(0xb8000+3998,0xb8000+4000)),[88,7]);
 assert.deepEqual(Array.from(m.bus.ram.slice(0xb8000,0xb8002)),[89,7]);
});
