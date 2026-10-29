import test from 'node:test';
import assert from 'node:assert/strict';
import {Machine} from '../machine/machine.mjs';
import {Cpu} from '../cpu/cpu.mjs';
import {Bus} from '../bus/bus.mjs';
const start=(bytes,registers={})=>new Machine({profile:'diagnostic-compute-v1',program:Uint8Array.from(bytes),registers});
const C=1,P=4,A=16,Z=64,S=128,O=2048;

test('Jcc opcodes evaluate all combinations of relevant flags without changing flags',()=>{
  // Order follows the instruction encodings, independent of the decoder.
  for(let bits=0;bits<32;bits++) {
    const c=!!(bits&1),p=!!(bits&2),z=!!(bits&4),s=!!(bits&8),o=!!(bits&16);
    const expected=[o,!o,c,!c,z,!z,c||z,!(c||z),s,!s,p,!p,s!==o,s===o,z||(s!==o),!z&&(s===o)];
    const flags=0x602|(c?C:0)|(p?P:0)|(z?Z:0)|(s?S:0)|(o?O:0);
    for(let cc=0;cc<16;cc++){
      const m=start([0x70+cc,0xfe],{flags});const result=m.step();
      assert.equal(result.status,'retired');assert.equal(m.cpu.registers.ip,expected[cc]?0x7c00:0x7c02,`condition ${cc}, flags ${flags.toString(16)}`);
      assert.equal(m.cpu.registers.flags,flags);
    }
  }
});

test('immediate ADD, SUB, CMP 8/16-bit groups execute and preserve other flags',()=>{
  const base=0x602;
  const vectors=[
    {bytes:[0x80,0xc0,1],ax:0x12ff,result:0x1200,flags:base|C|P|A|Z},
    {bytes:[0x80,0xe8,1],ax:0x1200,result:0x12ff,flags:base|C|P|A|S},
    {bytes:[0x80,0xf8,1],ax:0x1280,result:0x1280,flags:base|A|O},
    {bytes:[0x81,0xc0,1,0],ax:0xffff,result:0,flags:base|C|P|A|Z},
    {bytes:[0x81,0xe8,1,0],ax:0,result:0xffff,flags:base|C|P|A|S},
    {bytes:[0x81,0xf8,1,0],ax:0x8000,result:0x8000,flags:base|A|O|P},
  ];
  for(const v of vectors){const m=start(v.bytes,{ax:v.ax,flags:base});assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers.ax,v.result);assert.equal(m.cpu.registers.flags,v.flags);}
});

test('arithmetic direction and memory operands execute selected byte and word forms',()=>{
  for(const width of [8,16]) for(const direction of [0,2]) for(const [base,kind] of [[0x00,'add'],[0x28,'sub'],[0x38,'cmp']]) {
    const op=base+direction+(width===16?1:0),m=start([op,0x07],{ax:0x0203,bx:0x400,flags:0x602});
    m.bus.write8(0x400,5);m.bus.write8(0x401,0);
    const before=width===8?3:0x0203, lhs=direction?before:5,rhs=direction?5:before;
    const expected=(kind==='add'?lhs+rhs:lhs-rhs)&(width===8?255:65535);
    assert.equal(m.step().status,'retired');
    if(kind==='cmp'){assert.equal(m.cpu.registers.ax,0x0203);assert.equal(m.bus.read8(0x400),5);assert.equal(m.bus.read8(0x401),0);}
    else if(direction){assert.equal(m.cpu.registers.ax,width===8?0x0200|expected:expected);assert.equal(m.bus.read8(0x400),5);}
    else {assert.equal(m.cpu.registers.ax,0x0203);assert.equal(m.bus.read8(0x400),expected&255);if(width===16)assert.equal(m.bus.read8(0x401),expected>>>8);}
  }
});

test('unsupported and truncated encodings do not change state or memory',()=>{
  for(const bytes of [[0x66],[0x80,0xc8,0x99],[0x81,0xf0,0xff,0xff],[0x90]]){
    const m=start(bytes,{ax:0x1234,flags:0x8d7});const before={...m.cpu.registers};const outcome=m.step();
    assert.equal(outcome.status,'unsupported-instruction');assert.equal(outcome.retired,false);assert.deepEqual(m.cpu.registers,before);
  }
  // An immediate or ModR/M displacement which would cross the CS limit stops
  // before committing the instruction, with the fetched bytes retained.
  for(const [ip,bytes] of [[0xffff,[0xb8]],[0xfffe,[0x8b,0x86]]]){
    const m=start([0xf4],{ip,bp:0x1111,flags:0x8d7});bytes.forEach((b,i)=>m.bus.write8(ip+i,b));const before={...m.cpu.registers};const o=m.step();
    assert.equal(o.status,'unsupported-platform-access');assert.equal(o.retired,false);assert.deepEqual(o.trace.bytes,bytes);assert.deepEqual(m.cpu.registers,before);
  }
});

test('arithmetic word destinations reject cross-segment and mapped-edge access atomically',()=>{
  for(const op of [0x01,0x29,0x81]){
    let m=start(op===0x81?[op,0x07,1,0]:[op,0x07],{ax:1,bx:0xffff,flags:0x8d7});
    m.bus.write8(0xffff,0x5a);const before={...m.cpu.registers};const o=m.step();
    assert.equal(o.status,'unsupported-platform-access');assert.deepEqual(m.cpu.registers,before);assert.equal(m.bus.read8(0xffff),0x5a);
    const bus=new Bus({size:0x10000});const program=op===0x81?[op,0x07,1,0]:[op,0x07];program.forEach((b,i)=>bus.write8(0x7c00+i,b));bus.write8(0xffff,0x5a);
    const cpu=new Cpu(bus,{profile:'diagnostic-compute-v1',registers:{ax:1,ds:0x800,bx:0x7fff,flags:0x8d7}});const prior={...cpu.registers};
    assert.equal(cpu.step().status,'unsupported-platform-access');assert.deepEqual(cpu.registers,prior);assert.equal(bus.read8(0xffff),0x5a);
  }
});

test('all immediate register MOV encodings preserve unrelated register bytes and flags',()=>{
  const names=['ax','cx','dx','bx','sp','bp','si','di'];
  const regs={ax:0x1122,cx:0x3344,dx:0x5566,bx:0x7788,sp:0x9999,bp:0xaaaa,si:0xbbbb,di:0xcccc,flags:0x8d7};
  for(let id=0;id<8;id++){
    let m=start([0xb0+id,0x5a],regs);assert.equal(m.step().status,'retired');
    const key=names[id%4],expected=id<4?(regs[key]&0xff00)|0x5a:(regs[key]&0xff)|0x5a00;
    for(const name of names)assert.equal(m.cpu.registers[name],name===key?expected:regs[name]);assert.equal(m.cpu.registers.flags,regs.flags);
    m=start([0xb8+id,0x34,0x12],regs);assert.equal(m.step().status,'retired');
    for(let j=0;j<8;j++)assert.equal(m.cpu.registers[names[j]],j===id?0x1234:regs[names[j]]);assert.equal(m.cpu.registers.flags,regs.flags);
  }
});

test('INC/DEC all word-register opcodes preserve carry and compute signed boundary flags',()=>{
  const names=['ax','cx','dx','bx','sp','bp','si','di'];
  for(let id=0;id<8;id++)for(const dec of [false,true]){
    const init=dec?0x8000:0x7fff; const m=start([(dec?0x48:0x40)+id],{[names[id]]:init,flags:0x603});
    assert.equal(m.step().status,'retired');assert.equal(m.cpu.registers[names[id]],dec?0x7fff:0x8000);
    assert.equal(m.cpu.registers.flags,dec?0xe17:0xe97); // CF/IF/DF + OF/AF and result flags
  }
});

test('immediate arithmetic groups read and write memory with CMP leaving bytes untouched',()=>{
  for(const [digit,result] of [[0,8],[5,2],[7,5]]){
    for(const width of [8,16]){
      const m=start([width===8?0x80:0x81,(digit<<3)|7,3,...(width===16?[0]:[])],{bx:0x400,flags:0x602});
      m.bus.write8(0x400,5);m.bus.write8(0x401,0);
      assert.equal(m.step().status,'retired');assert.equal(m.bus.read8(0x400),result);assert.equal(m.bus.read8(0x401),0);
    }
  }
});
