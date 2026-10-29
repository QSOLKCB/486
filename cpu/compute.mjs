// Apache-2.0. Bounded direct-loader real-mode computation profile.
import { PlatformAccess } from '../bus/bus.mjs';
const CF=1, PF=4, AF=16, ZF=64, SF=128, OF=2048;
class DecodeLimit extends Error {}
const segmentPrefixes = new Map([[0x26,'es'],[0x2e,'cs'],[0x36,'ss'],[0x3e,'ds']]);
const flag=(f,bit,on)=>on ? f|bit : f&~bit;
const wordRegs=['ax','cx','dx','bx','sp','bp','si','di'];
const byteRegs=['ax','cx','dx','bx','ax','cx','dx','bx'];
function getReg(r, id, width) {
  if(width===16) return r[wordRegs[id]];
  return (r[byteRegs[id]] >>> (id<4 ? 0:8)) & 0xff;
}
function setReg(r,id,width,value) {
  if(width===16) {r[wordRegs[id]]=value&0xffff;return;}
  const key=byteRegs[id], shift=id<4 ? 0:8, mask=0xff<<shift;
  r[key]=(r[key]&~mask)|((value&0xff)<<shift);
}
function arithmetic(r,kind,a,b,width) {
  const mask=width===8 ? 0xff:0xffff, sign=width===8 ? 0x80:0x8000;
  const sub=kind!=='add', raw=sub ? a-b:a+b, n=raw&mask;
  let f=r.flags;
  f=flag(f,CF,sub ? a<b : raw>mask);
  f=flag(f,AF,!!((a^b^n)&0x10));
  f=flag(f,OF,!!((sub ? ((a^b)&(a^n)) : (~(a^b)&(a^n)))&sign));
  f=flag(f,ZF,n===0);f=flag(f,SF,!!(n&sign));
  let x=n&0xff, parity=0; for(let i=0;i<8;i++){parity^=x&1;x>>>=1;}
  f=flag(f,PF,parity===0);r.flags=f;
  return n;
}
export function stepCompute(cpu) {
  const r=cpu.registers,bus=cpu.bus, start={cs:r.cs,ip:r.ip},bytes=[];
  const trace={profile:cpu.profile,start,bytes};
  if(cpu.halted) return {status:'halted',retired:false,trace,reason:'CPU halted'};
  let cursor=r.ip, wrapped=false;
  const resetProfile=cpu.profile==='i486-reset-v1';
  const segmented=cpu.profile==='diagnostic-segments-v1'||resetProfile;
  const codeAddress=off=>resetProfile ? (cpu.csBase + off) >>> 0 : bus.address(r.cs,off);
  let segmentOverride=null;
  const fetch=()=>{if(wrapped)throw new PlatformAccess('instruction crosses the 16-bit code segment boundary');if(bytes.length>=15){if(segmented)throw new DecodeLimit('instruction exceeds 15-byte decoder limit');throw new Error('decoder budget exceeded');}const v=bus.read8(codeAddress(cursor));bytes.push(v);wrapped=cursor===0xffff;cursor=(cursor+1)&0xffff;return v;};
  const word=()=>{const lo=fetch();return lo|(fetch()<<8);};
  const signed8=x=>x<0x80?x:x-0x100;
  const signed16=x=>x<0x8000?x:x-0x10000;
  const unsupported=reason=>({status:'unsupported-instruction',retired:false,trace,reason});
  // Check both bytes before either read/write; offsets never wrap within a word.
  function addresses(seg,off,width,write=false,code=false) {
    if(width===16 && off===0xffff)throw new PlatformAccess('word crosses the 16-bit segment boundary');
    const address=offset=>code ? codeAddress(offset) : bus.address(seg,offset);
    const validate=write ? bus.writableIndex.bind(bus) : bus.index.bind(bus);
    const a=address(off); validate(a);
    if(width===8)return [a];
    const b=address(off+1);validate(b);return [a,b];
  }
  function readMem(seg,off,width,code=false) {const a=addresses(seg,off,width,false,code);const lo=bus.read8(a[0]);return width===8?lo:lo|(bus.read8(a[1])<<8);}
  function writeMem(seg,off,width,value,code=false) {const a=addresses(seg,off,width,true,code);bus.write8(a[0],value&255);if(width===16)bus.write8(a[1],(value>>>8)&255);}
  function modrm(width) {
    const m=fetch(),mod=m>>>6,reg=(m>>>3)&7,rm=m&7;
    if(mod===3)return {reg,operand:{read:()=>getReg(r,rm,width),write:v=>setReg(r,rm,width,v)}};
    let off,usesBP=false;
    if(mod===0&&rm===6)off=word();
    else {
      const sums=[()=>r.bx+r.si,()=>r.bx+r.di,()=>r.bp+r.si,()=>r.bp+r.di,()=>r.si,()=>r.di,()=>r.bp,()=>r.bx];
      off=sums[rm]();usesBP=rm===2||rm===3||rm===6;
      if(mod===1)off+=signed8(fetch());else if(mod===2)off+=word();
    }
    off&=0xffff; const seg=segmentOverride ? r[segmentOverride] : usesBP?r.ss:r.ds;
    return {reg,operand:{read:()=>readMem(seg,off,width,resetProfile && segmentOverride==='cs'),write:v=>writeMem(seg,off,width,v,resetProfile && segmentOverride==='cs')}};
  }
  function condition(cc) {
    const c=!!(r.flags&CF),p=!!(r.flags&PF),z=!!(r.flags&ZF),s=!!(r.flags&SF),o=!!(r.flags&OF);
    return [o,!o,c,!c,z,!z,c||z,!c&&!z,s,!s,p,!p,s!==o,s===o,z||(s!==o),!z&&(s===o)][cc];
  }
  const initialFlags=r.flags;
  try {
    let op=fetch(),prefixCount=0;
    if(segmented) {
      while(segmentPrefixes.has(op)) {
        prefixCount++;
        if(prefixCount===1) segmentOverride=segmentPrefixes.get(op);
        op=fetch();
      }
      if(prefixCount>1)return unsupported('multiple segment override prefixes are unsupported');
    }
    let action,mnemonic;
    if(op>=0xb0&&op<=0xbf){const width=op<0xb8?8:16,id=op&7,v=width===8?fetch():word();mnemonic=`MOV r${width}, imm${width}`;action=()=>setReg(r,id,width,v);}
    else if(segmented&&(op===0x8e||op===0x8c)){const d=modrm(16),segment=d.reg===0?'es':d.reg===3?'ds':null;if(!segment)return unsupported('unsupported segment register selector');mnemonic=op===0x8e?`MOV ${segment.toUpperCase()}, r/m16`:`MOV r/m16, ${segment.toUpperCase()}`;action=()=>{if(op===0x8e)r[segment]=d.operand.read();else d.operand.write(r[segment]);};}
    else if(op>=0x88&&op<=0x8b){const width=(op&1)?16:8,toReg=!!(op&2),d=modrm(width);mnemonic=`MOV r/m${width}, r${width}`;action=()=>{if(toReg)setReg(r,d.reg,width,d.operand.read());else d.operand.write(getReg(r,d.reg,width));};}
    else if((op>=0x00&&op<=0x03)||(op>=0x28&&op<=0x2b)||(op>=0x38&&op<=0x3b)){
      const width=(op&1)?16:8,toReg=!!(op&2),kind=op<4?'add':op<0x38?'sub':'cmp',d=modrm(width);
      mnemonic=`${kind.toUpperCase()} r/m${width}, r${width}`;
      action=()=>{const reg=getReg(r,d.reg,width),mem=d.operand.read(),a=toReg?reg:mem,b=toReg?mem:reg;
        const n=arithmetic(r,kind,a,b,width);if(kind!=='cmp'){if(toReg)setReg(r,d.reg,width,n);else d.operand.write(n);}};
    }
    else if(op===0x80||op===0x81){const width=op===0x80?8:16,d=modrm(width);if(![0,5,7].includes(d.reg))return unsupported('unsupported immediate arithmetic group');const v=width===8?fetch():word(),kind=d.reg===0?'add':d.reg===5?'sub':'cmp';mnemonic=`${kind.toUpperCase()} r/m${width}, imm${width}`;action=()=>{const a=d.operand.read();const n=arithmetic(r,kind,a,v,width);if(kind!=='cmp')d.operand.write(n);};}
    else if(op>=0x40&&op<=0x4f){const id=op&7,dec=!!(op&8);mnemonic=`${dec?'DEC':'INC'} r16`;action=()=>{const cf=r.flags&CF,n=arithmetic(r,dec?'sub':'add',getReg(r,id,16),1,16);r.flags=(r.flags&~CF)|cf;setReg(r,id,16,n);};}
    else if(op>=0x70&&op<=0x7f){const d=signed8(fetch());mnemonic='Jcc rel8';action=()=>{if(condition(op&15))cursor=(cursor+d)&0xffff;};}
    else if(op===0xeb){const d=signed8(fetch());mnemonic='JMP rel8';action=()=>{cursor=(cursor+d)&0xffff;};}
    else if(resetProfile&&op===0xea){const target=word(),segment=word();mnemonic='JMP ptr16:16';action=()=>{r.cs=segment;cpu.csBase=segment*16;cursor=target;};}
    else if(op>=0x50&&op<=0x57){const id=op&7;mnemonic='PUSH r16';action=()=>{const v=getReg(r,id,16),sp=(r.sp-2)&0xffff;writeMem(r.ss,sp,16,v);r.sp=sp;};}
    else if(op>=0x58&&op<=0x5f){const id=op&7;mnemonic='POP r16';action=()=>{const v=readMem(r.ss,r.sp,16);r.sp=(r.sp+2)&0xffff;setReg(r,id,16,v);};}
    else if(op===0xe8){const d=signed16(word());mnemonic='CALL rel16';action=()=>{const sp=(r.sp-2)&0xffff;writeMem(r.ss,sp,16,cursor);r.sp=sp;cursor=(cursor+d)&0xffff;};}
    else if(op===0xc3){mnemonic='RET';action=()=>{const target=readMem(r.ss,r.sp,16);r.sp=(r.sp+2)&0xffff;cursor=target;};}
    else if(op===0xee){mnemonic='OUT DX, AL';action=()=>bus.out8(r.dx,r.ax&255);}
    else if(op===0xf4){mnemonic='HLT';action=()=>{cpu.halted=true;};}
    else return unsupported(`unsupported opcode 0x${op.toString(16).padStart(2,'0')}`);
    trace.mnemonic=mnemonic;action();r.ip=cursor;
    return {status:cpu.halted?'halted':'retired',retired:true,trace,reason:cpu.halted?'HLT executed':null};
  } catch(error) {if(error instanceof DecodeLimit)return unsupported(error.message);if(error instanceof PlatformAccess){r.flags=initialFlags;return {status:'unsupported-platform-access',retired:false,trace,reason:error.message};}throw error;}
}
