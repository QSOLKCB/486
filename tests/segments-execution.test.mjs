import test from 'node:test';
import assert from 'node:assert/strict';
import {Machine} from '../machine/machine.mjs';
import {Bus} from '../bus/bus.mjs';
import {Cpu} from '../cpu/cpu.mjs';

// Fixed, independent 16-bit effective-address vectors. No executor address
// helpers or address decoder are imported into these expectations.
const forms = [
  {rm:0, offset:0x0120, defaultSegment:'ds'}, // BX+SI
  {rm:1, offset:0x0140, defaultSegment:'ds'}, // BX+DI
  {rm:2, offset:0x0320, defaultSegment:'ss'}, // BP+SI
  {rm:3, offset:0x0340, defaultSegment:'ss'}, // BP+DI
  {rm:4, offset:0x0020, defaultSegment:'ds'}, // SI
  {rm:5, offset:0x0040, defaultSegment:'ds'}, // DI
  {rm:6, offset:0x0300, defaultSegment:'ss'}, // BP (except mod=0)
  {rm:7, offset:0x0100, defaultSegment:'ds'}, // BX
];
const regs={ax:0x1357,cx:0x2468,dx:0x369a,bx:0x0100,sp:0x1000,bp:0x0300,si:0x0020,di:0x0040,cs:0,ds:0x1000,es:0x2000,ss:0x3000,flags:0x8d7};
const physical=(segment,offset)=>segment*16+offset;
const prefixes=[{byte:0x26,segment:'es'},{byte:0x2e,segment:'cs'},{byte:0x36,segment:'ss'},{byte:0x3e,segment:'ds'}];
const allSegments=['cs','ds','es','ss'];
function machine(program, registers=regs) {return new Machine({profile:'diagnostic-segments-v1',program:Uint8Array.from(program),registers});}
function addrCase(form,mode) {
 const direct=mode===0&&form.rm===6;
 return {modrm:(mode<<6)|form.rm,disp:direct?[0x34,0x12]:mode===1?[0xf0]:mode===2?[0x21,0]:[],
  offset:direct?0x1234:(form.offset+(mode===1?-16:mode===2?33:0))&0xffff,
  defaultSegment:direct?'ds':form.defaultSegment};
}
function putWord(bus,segment,off,value) {const p=physical(regs[segment],off);bus.write8(p,value&255);bus.write8(p+1,value>>>8);}
function getWord(bus,segment,off) {const p=physical(regs[segment],off);return bus.read8(p)|(bus.read8(p+1)<<8);}

test('MOV 8E/8C DS and ES cover every register source and destination',()=>{
 const words=['ax','cx','dx','bx','sp','bp','si','di'];
 for(const [seg,selector] of [['es',0],['ds',3]]) for(let reg=0;reg<8;reg++) {
  let m=machine([0x8e,0xc0|(selector<<3)|reg]);const prev={...m.cpu.registers};
  assert.equal(m.step().status,'retired',`load ${seg} from ${words[reg]}`);
  assert.equal(m.cpu.registers[seg],prev[words[reg]]);assert.equal(m.cpu.registers.flags,prev.flags);
  for(const key of Object.keys(prev)) if(![seg,'ip'].includes(key))assert.equal(m.cpu.registers[key],prev[key],key);
  m=machine([0x8c,0xc0|(selector<<3)|reg]);const before={...m.cpu.registers};
  assert.equal(m.step().status,'retired',`store ${seg} to ${words[reg]}`);
  assert.equal(m.cpu.registers[words[reg]],before[seg]);assert.equal(m.cpu.registers.flags,before.flags);
  for(const key of Object.keys(before)) if(![words[reg],'ip'].includes(key))assert.equal(m.cpu.registers[key],before[key],key);
 }
});

test('MOV 8E/8C memory forms use all default segments, overrides and displacement encodings',()=>{
 for(const form of forms) for(const mode of [0,1,2]) {
  const v=addrCase(form,mode);
  for(const prefix of [null,...prefixes]) for(const [target,selector] of [['es',0],['ds',3]]) {
   const selected=prefix?.segment??v.defaultSegment;
   const head=prefix?[prefix.byte]:[];
   const code=[...head,0x8e,v.modrm|(selector<<3),...v.disp];
   let m=machine(code);
   for(const [i,s] of allSegments.entries())putWord(m.bus,s,v.offset,0x4100+i);
   putWord(m.bus,selected,v.offset,0x5678);
   const prior={...m.cpu.registers};assert.equal(m.step().status,'retired',`8e ${form.rm} ${mode} ${selected} ${target}`);
   assert.equal(m.cpu.registers[target],0x5678);assert.equal(m.cpu.registers.flags,prior.flags);
   assert.equal(m.cpu.registers.ip,0x7c00+code.length);
   for(const key of Object.keys(prior))if(![target,'ip'].includes(key))assert.equal(m.cpu.registers[key],prior[key],key);
   const storeCode=[...head,0x8c,v.modrm|(selector<<3),...v.disp];m=machine(storeCode);
   for(const [i,s] of allSegments.entries())putWord(m.bus,s,v.offset,0x4100+i);
   const expected=m.cpu.registers[target];assert.equal(m.step().status,'retired',`8c ${form.rm} ${mode} ${selected} ${target}`);
   for(const [i,s] of allSegments.entries())assert.equal(getWord(m.bus,s,v.offset),s===selected?expected:0x4100+i,`8c ${form.rm} ${mode} ${selected} ${s}`);
   assert.equal(m.cpu.registers.flags,regs.flags);assert.equal(m.cpu.registers.ip,0x7c00+storeCode.length);
  }
 }
});

test('segment overrides select exact byte/word MOV and arithmetic operands without persisting',()=>{
 // Independent arithmetic oracle: signed range checking and nibble arithmetic,
 // not the executor's flag helpers. Arithmetic flags are CF PF AF ZF SF OF.
 const arithmetic=(a,b,width,subtract)=>{
  const mod=2**width,sign=mod/2,raw=subtract?a-b:a+b,result=((raw%mod)+mod)%mod;
  const signed=x=>x>=sign?x-mod:x;
  const signedRaw=subtract?signed(a)-signed(b):signed(a)+signed(b);
  let bits=0;
  if(subtract?a<b:raw>=mod)bits|=1;
  if(((result&255).toString(2).split('1').length-1)%2===0)bits|=4;
  if(subtract?(a&15)<(b&15):(a&15)+(b&15)>15)bits|=16;
  if(result===0)bits|=64;if(result>=sign)bits|=128;
  if(signedRaw < -sign || signedRaw >= sign)bits|=2048;
  return {result,flags:(regs.flags&~0x8d5)|bits};
 };
 for(const p of prefixes) for(const op of [0x88,0x89,0x8a,0x8b,0x00,0x01,0x02,0x03,0x28,0x29,0x2a,0x2b,0x38,0x39,0x3a,0x3b,0x80,0x81]) {
  const immediate=op===0x80||op===0x81;
  const code=[p.byte,op,0x46,0,...(immediate?(op===0x80?[1]:[1,0]):[])];
  const m=machine(code);for(const [i,s] of allSegments.entries())putWord(m.bus,s,0x300,0x0101+i);
  const before=Object.fromEntries(allSegments.map(s=>[s,getWord(m.bus,s,0x300)]));
  const wide=!!(op&1),mod=wide?65536:256,reg=wide?regs.ax:regs.ax&255,mem=before[p.segment]%mod;
  let expectedAx=regs.ax,expectedWord=before[p.segment],expectedFlags=regs.flags;
  if(op===0x88||op===0x89)expectedWord=wide?reg:(expectedWord&0xff00)|reg;
  else if(op===0x8a||op===0x8b)expectedAx=wide?mem:(regs.ax&0xff00)|mem;
  else {
   const cmp=op>=0x38&&op<=0x3b,subtract=op>=0x28&&op<=0x3b;
   const toReg=!immediate&&!!(op&2),a=toReg?reg:mem,b=immediate?1:toReg?mem:reg;
   const expected=arithmetic(a,b,wide?16:8,subtract);expectedFlags=expected.flags;
   if(!cmp) {if(toReg)expectedAx=wide?expected.result:(regs.ax&0xff00)|expected.result;
    else expectedWord=wide?expected.result:(expectedWord&0xff00)|expected.result;}
  }
  assert.equal(m.step().status,'retired',`opcode ${op.toString(16)} prefix ${p.byte.toString(16)}`);
  assert.equal(m.cpu.registers.ax,expectedAx,`AX opcode ${op.toString(16)} prefix ${p.byte.toString(16)}`);
  assert.equal(m.cpu.registers.flags,expectedFlags,`flags opcode ${op.toString(16)} prefix ${p.byte.toString(16)}`);
  for(const s of allSegments)assert.equal(getWord(m.bus,s,0x300),s===p.segment?expectedWord:before[s],`memory opcode ${op.toString(16)} segment ${s}`);
 }
 // ES override on first load, followed by default SS on second load.
 const m=machine([0x26,0x8b,0x46,0,0x8b,0x4e,0]);putWord(m.bus,'es',0x300,0x1234);putWord(m.bus,'ss',0x300,0x5678);
 assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ax,0x1234);
 assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.cx,0x5678);
});

test('segment override does not redirect CS instruction fetch, register instructions or SS stack operations',()=>{
 for(const p of prefixes) {
  // The operand prefix before PUSH/CALL/RET is semantically inert for the
  // implicit SS:SP stack, and must never select another code source.
  const m=machine([p.byte,0x50,p.byte,0xe8,0x01,0,0xf4,p.byte,0xc3],{...regs,ax:0xbeef});
  for(const s of ['ds','es','ss'])m.bus.write8(physical(regs[s],0x7c00),0xf4);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.sp,0x0ffe);
  assert.equal(getWord(m.bus,'ss',0x0ffe),0xbeef);
  for(const s of ['ds','es','cs'])assert.equal(getWord(m.bus,s,0x0ffe),0);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ip,0x7c07);assert.equal(getWord(m.bus,'ss',0x0ffc),0x7c06);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ip,0x7c06);assert.equal(m.cpu.registers.sp,0x0ffe);
  assert.equal(m.step().status,'halted');assert.equal(m.cpu.registers.flags,regs.flags);
 }
 for(const p of prefixes){const m=machine([p.byte,0xb8,0xef,0xbe]);assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ax,0xbeef);}
});

test('CMP consumes the override-selected operand and sets defined flags',()=>{
 for(const p of prefixes) {
  const m=machine([p.byte,0x3b,0x46,0]);
  for(const s of allSegments)putWord(m.bus,s,0x300,0x7777);
  putWord(m.bus,p.segment,0x300,regs.ax);
  assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ax,regs.ax);
  // Equal subtraction gives ZF, PF and reserved bit 1; no CF, AF, SF or OF.
  assert.equal(m.cpu.registers.flags&0x8d5,0x44);
 }
});

test('unsupported segment selectors and prefix combinations stop without effects',()=>{
 for(const op of [0x8c,0x8e]) for(const selector of [1,2,4,5,6,7]) for(const mode of [0,3]) {
  const modrm=(mode<<6)|(selector<<3)|7;
  const m=machine([op,modrm]);m.bus.write8(physical(regs.ds,regs.bx),0x44);m.bus.write8(physical(regs.ds,regs.bx)+1,0x55);
  const before={...m.cpu.registers},outcome=m.step();
  assert.equal(outcome.status,'unsupported-instruction',`opcode ${op.toString(16)} selector ${selector} mode ${mode}`);
  assert.equal(outcome.retired,false);assert.deepEqual(m.cpu.registers,before);assert.deepEqual(m.output,[]);
  assert.equal(m.bus.read8(physical(regs.ds,regs.bx)),0x44);assert.equal(m.bus.read8(physical(regs.ds,regs.bx)+1),0x55);
 }
 for(const code of [[0x26,0x3e,0x8b,0x07],[0x26,0x26,0x8b,0x07],[0x64,0x8b,0x07],[0x65,0x8b,0x07],[0x66,0x8b,0x07],[0x67,0x8b,0x07],[0xf0,0x8b,0x07],[0xf2,0x8b,0x07],[0xf3,0x8b,0x07]]) {
  const m=machine(code),before={...m.cpu.registers},outcome=m.step();
  assert.equal(outcome.status,'unsupported-instruction',code.map(x=>x.toString(16)).join(' '));assert.equal(outcome.retired,false);
  assert.deepEqual(m.cpu.registers,before);assert.deepEqual(m.output,[]);
 }
});

test('prefixed segment loads and stores reject incomplete fetch and invalid word operands without partial state',()=>{
 for(const op of [0x8c,0x8e]) {
  // The encoded memory operand itself spans offset FFFF, so neither the
  // destination segment/register nor the low byte can change.
  let m=machine([0x26,op,0x1f],{...regs,bx:0xffff});
  const p=physical(regs.es,0xffff);m.bus.write8(p,0x44);m.bus.write8(physical(regs.es,0),0x55);
  let before={...m.cpu.registers},outcome=m.step();
  assert.equal(outcome.status,'unsupported-platform-access');assert.equal(outcome.retired,false);assert.deepEqual(m.cpu.registers,before);
  assert.equal(m.bus.read8(p),0x44);assert.equal(m.bus.read8(physical(regs.es,0)),0x55);
  // A mapped low byte and unmapped high byte also leave state untouched.
  const bus=new Bus({size:0x10000});[0x26,op,0x1f].forEach((b,i)=>bus.write8(0x7c00+i,b));bus.write8(0xffff,0x44);
  const cpu=new Cpu(bus,{profile:'diagnostic-segments-v1',registers:{...regs,es:0x0800,bx:0x7fff}});before={...cpu.registers};outcome=cpu.step();
  assert.equal(outcome.status,'unsupported-platform-access');assert.equal(outcome.retired,false);assert.deepEqual(cpu.registers,before);assert.equal(bus.read8(0xffff),0x44);
 }
 for(const code of [[0x26],[0x26,0x8e],[0x26,0x8e,0x1e,0x34]]) {
  // Put each incomplete sequence against CS:FFFF. The decoder must not wrap
  // to fetch an opcode, ModR/M or displacement byte from CS:0000.
  const bus=new Bus();const start=0x10000-code.length;code.forEach((b,i)=>bus.write8(start+i,b));
  const cpu=new Cpu(bus,{profile:'diagnostic-segments-v1',registers:{...regs,ip:start}});const before={...cpu.registers},outcome=cpu.step();
  assert.equal(outcome.status,'unsupported-platform-access');assert.equal(outcome.retired,false);assert.deepEqual(cpu.registers,before);
 }
});

test('segment-overridden word access honors per-byte A20 gating',()=>{
 // ES:000F -> FFFFF, 100000. The physical A20 gate clears bit 20 for
 // the second byte while preserving the first.
 const bus=new Bus({a20:false});[0x26,0x89,0x07].forEach((b,i)=>bus.write8(0x7c00+i,b));
 const cpu=new Cpu(bus,{profile:'diagnostic-segments-v1',registers:{ax:0xa5c3,bx:0x000f,es:0xffff}});
 assert.equal(cpu.step().status,'retired');assert.equal(bus.read8(0xfffff),0xc3);assert.equal(bus.read8(0),0xa5);
});

test('prefix scanning has a 15-byte budget and never reads a sixteenth byte',()=>{
 const validLength=machine([...Array(14).fill(0x26),0xf4]);const before={...validLength.cpu.registers};let outcome=validLength.step();
 assert.equal(outcome.status,'unsupported-instruction');assert.equal(outcome.retired,false);assert.equal(outcome.trace.bytes.length,15);assert.deepEqual(validLength.cpu.registers,before);
 const tooLong=machine([...Array(15).fill(0x26),0xf4]);const prior={...tooLong.cpu.registers};
 const reads=[];const originalRead=tooLong.bus.read8.bind(tooLong.bus);tooLong.bus.read8=address=>{reads.push(address);return originalRead(address);};
 outcome=tooLong.step();
 assert.equal(outcome.status,'unsupported-instruction');assert.equal(outcome.retired,false);assert.match(outcome.reason,/15-byte/);
 assert.deepEqual(outcome.trace.bytes,Array(15).fill(0x26));assert.equal(reads.length,15);assert.ok(!reads.includes(0x7c0f));
 assert.deepEqual(tooLong.cpu.registers,prior);assert.deepEqual(tooLong.output,[]);
});

test('older compute and diagnostic profiles do not acquire the new encodings',()=>{
 for(const profile of ['diagnostic-real-v1','diagnostic-text-v1','diagnostic-disk-v1','diagnostic-compute-v1'])for(const code of [[0x8e,0xd8],[0x8c,0xd8],[0x26,0x89,0x07]]) {
  const m=new Machine({profile,program:Uint8Array.from(code),registers:regs});const prior={...m.cpu.registers};const result=m.step();
  assert.equal(result.status,'unsupported-instruction',`${profile} ${code.map(x=>x.toString(16)).join(' ')}`);
  assert.equal(result.retired,false);assert.deepEqual(m.cpu.registers,prior);assert.deepEqual(m.output,[]);
 }
});

test('segment boundary takes priority when a prefix run fills bytes FFF1 through FFFF',()=>{
 const bus=new Bus();for(let address=0xfff1;address<=0xffff;address++)bus.write8(address,0x26);
 const reads=[];const originalRead=bus.read8.bind(bus);bus.read8=address=>{reads.push(address);return originalRead(address);};
 const cpu=new Cpu(bus,{profile:'diagnostic-segments-v1',registers:{...regs,ip:0xfff1}});const before={...cpu.registers};
 const result=cpu.step();assert.equal(result.status,'unsupported-platform-access');assert.match(result.reason,/segment boundary/);
 assert.equal(result.retired,false);assert.equal(result.trace.bytes.length,15);assert.equal(reads.length,15);
 assert.deepEqual(reads,Array.from({length:15},(_,i)=>0xfff1+i));assert.deepEqual(cpu.registers,before);
});
