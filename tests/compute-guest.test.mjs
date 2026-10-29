import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Machine} from '../machine/machine.mjs';
import {makeComputeProgram, computeRegisters, computeDataOffset} from '../fixtures/diagnostics/compute.mjs';

const make = (program=makeComputeProgram()) => new Machine({program, profile:'diagnostic-compute-v1', registers:computeRegisters});
const run = (m, batch) => {m.resume(); while(m.state==='running' && m.tick<1000) m.runBatch(batch); return m;};
const capture = m => ({registers:{...m.cpu.registers}, tick:m.tick, output:[...m.output], data:Array.from(m.bus.ram.slice(0x7c80,0x7c84)), stack:Array.from(m.bus.ram.slice(0x200fa,0x20100)),state:m.state});
test('original compute guest receipt and real loop, stack and return', async () => {
 const receipt=JSON.parse(await readFile(new URL('../fixtures/diagnostics/compute.json',import.meta.url)));
 const program=makeComputeProgram(); assert.equal(program.length,receipt.length);
 assert.equal(createHash('sha256').update(program).digest('hex'),receipt.sha256);
 const m=run(make(program),7), observed=capture(m);
 assert.equal(observed.state,'halted'); assert.equal(observed.tick,receipt.expected.retiredInstructions);
 assert.deepEqual(observed.output,[0x46]); assert.deepEqual(observed.data,[0x10,0x11,0x12,0x13]);
 assert.deepEqual(observed.stack,[0x22,0x22,0x34,0x12,0x12,0x7c]);
 for (const [register, value] of Object.entries(receipt.expected.registersHex)) assert.equal(observed.registers[register],parseInt(value,16),register);
});
test('guest result follows input data, and BP reads saved BX from SS', () => {
 const bytes=makeComputeProgram(); bytes[computeDataOffset+3]=0x14; const m=make(bytes);
 while(m.cpu.registers.ip!==0x7c23 && m.state!=='stopped' && m.tick<1000) m.step();
 // MOV BX,[BP+2] at 7c20 has just loaded saved BX from the SS stack;
 // DS:00fe contains zero and cannot have supplied this value.
 assert.equal(m.cpu.registers.ip,0x7c23); assert.equal(m.cpu.registers.bx,0x1234);
 run(m,100); assert.equal(m.state,'halted'); assert.deepEqual(m.output,[0x47]);
});
test('single steps, host batches, pause/resume and reset replay agree', () => {
 const step=make(); while(step.state==='paused' && step.tick<1000) step.step();
 const a=run(make(),1), b=run(make(),7), c=run(make(),1000);
 assert.deepEqual(capture(step),capture(a)); assert.deepEqual(capture(a),capture(b)); assert.deepEqual(capture(b),capture(c));
 const m=make(); m.resume(); m.runBatch(9); m.pause(); const prior=capture(m); assert.equal(m.runBatch(9),0); assert.deepEqual(capture(m),prior);
 m.resume(); while(m.state==='running') m.runBatch(7); assert.deepEqual(capture(m),capture(c));
 m.reset(); assert.equal(m.tick,0); assert.equal(m.state,'paused'); assert.deepEqual(capture(run(m,7)),capture(c));
});
