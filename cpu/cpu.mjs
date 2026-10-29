// Apache-2.0. Bounded real-mode decoder for the documented lab profiles.
import { PlatformAccess } from '../bus/bus.mjs';
import { stepCompute } from './compute.mjs';
const CF = 1, PF = 4, AF = 16, ZF = 64, SF = 128, OF = 2048;
const parity = n => { let p = 0; for (let i = 0; i < 8; i++) p ^= (n >> i) & 1; return p === 0; };
function setFlag(f, mask, value) { return value ? f | mask : f & ~mask; }
function common(f, n, width) {
  f = setFlag(f, ZF, n === 0); f = setFlag(f, SF, !!(n & (1 << (width - 1))));
  return setFlag(f, PF, parity(n & 255));
}
export class Cpu {
  constructor(bus, {profile = 'diagnostic-real-v1', registers = {}} = {}) {
    if (!['diagnostic-real-v1', 'diagnostic-text-v1', 'diagnostic-disk-v1', 'diagnostic-compute-v1', 'diagnostic-segments-v1'].includes(profile)) throw new RangeError('unknown profile');
    this.bus = bus; this.profile = profile;
    this.registers = {ax:0,bx:0,cx:0,dx:0,si:0,di:0,bp:0,sp:0,cs:0,ds:0,es:0,ss:0,ip:0x7c00,flags:2,...registers};
    for (const [name, value] of Object.entries(this.registers)) if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new RangeError(`invalid register ${name}`);
    this.halted = false;
  }
  step() {
    if (this.profile === 'diagnostic-compute-v1' || this.profile === 'diagnostic-segments-v1') return stepCompute(this);
    const r = this.registers, start = {cs:r.cs, ip:r.ip}, bytes = [];
    const trace = {profile:this.profile, start, bytes};
    if (this.halted) return {status:'halted', retired:false, trace, reason:'CPU halted'};
    let cursor = r.ip; let wrapped = false;
    const fetch = () => { if (wrapped) throw new PlatformAccess('instruction crosses the 16-bit code segment boundary'); if (bytes.length >= 15) throw new Error('decoder budget exceeded'); const b = this.bus.read8(this.bus.address(r.cs,cursor)); bytes.push(b); wrapped = cursor === 0xffff; cursor = (cursor + 1) & 0xffff; return b; };
    const word = () => { const lo = fetch(); return lo | (fetch() << 8); };
    const rel = n => n < 128 ? n : n - 256;
    const unsupported = reason => ({status:'unsupported-instruction', retired:false, trace, reason});
    try {
      const op = fetch(); let action; let mnemonic;
      const allowed = this.profile === 'diagnostic-real-v1' ? [0xba,0xb0,0xee,0xf4] : [0xba,0xbb,0xb0,0xee,0xec,0xe4,0xa8,0x74,0x72,0xeb,0x43,0x88,0xc6,0x81,0xf4];
      if (!allowed.includes(op)) return unsupported(`opcode not supported by ${this.profile}`);
      switch (op) {
        case 0xba: { const v=word(); mnemonic='MOV DX, imm16'; action=()=>{r.dx=v;}; break; }
        case 0xbb: { const v=word(); mnemonic='MOV BX, imm16'; action=()=>{r.bx=v;}; break; }
        case 0xb0: { const v=fetch(); mnemonic='MOV AL, imm8'; action=()=>{r.ax=(r.ax & 0xff00)|v;}; break; }
        case 0xee: mnemonic='OUT DX, AL'; action=()=>this.bus.out8(r.dx,r.ax & 255); break;
        case 0xec: mnemonic='IN AL, DX'; action=()=>{r.ax=(r.ax & 0xff00)|this.bus.in8(r.dx);}; break;
        case 0xe4: { const port=fetch(); mnemonic='IN AL, imm8'; action=()=>{r.ax=(r.ax & 0xff00)|this.bus.in8(port);}; break; }
        case 0xa8: { const v=fetch(); mnemonic='TEST AL, imm8'; action=()=>{const n=(r.ax & 255)&v; r.flags=common(r.flags & ~(CF|OF),n,8);}; break; }
        case 0x74: { const d=rel(fetch()); mnemonic='JZ rel8'; action=()=>{if (r.flags & ZF) cursor=(cursor+d)&0xffff;}; break; }
        case 0x72: { const d=rel(fetch()); mnemonic='JB rel8'; action=()=>{if (r.flags & CF) cursor=(cursor+d)&0xffff;}; break; }
        case 0xeb: { const d=rel(fetch()); mnemonic='JMP rel8'; action=()=>{cursor=(cursor+d)&0xffff;}; break; }
        case 0x43: mnemonic='INC BX'; action=()=>{const a=r.bx,n=(a+1)&0xffff; let f=common(r.flags,n,16); f=setFlag(f,AF,(a&15)===15); r.flags=setFlag(f,OF,a===0x7fff); r.bx=n;}; break;
        case 0x88: { const modrm=fetch(); if(modrm!==0x07) return unsupported('unsupported MOV encoding'); mnemonic='MOV [BX], AL'; action=()=>this.bus.write8(this.bus.address(r.ds,r.bx),r.ax&255); break; }
        case 0xc6: { const modrm=fetch(); if(modrm!==0x07) return unsupported('unsupported MOV encoding'); const v=fetch(); mnemonic='MOV byte [BX], imm8'; action=()=>this.bus.write8(this.bus.address(r.ds,r.bx),v); break; }
        case 0x81: { const modrm=fetch(); if(modrm!==0xfb) return unsupported('unsupported CMP encoding'); const v=word(); mnemonic='CMP BX, imm16'; action=()=>{const a=r.bx,n=(a-v)&0xffff; let f=common(r.flags,n,16); f=setFlag(f,CF,a<v); f=setFlag(f,AF,(a&15)<(v&15)); r.flags=setFlag(f,OF,!!((a^v)&(a^n)&0x8000));}; break; }
        case 0xf4: mnemonic='HLT'; action=()=>{this.halted=true;}; break;
        default: return unsupported(`unsupported opcode 0x${op.toString(16).padStart(2,'0')}`);
      }
      trace.mnemonic=mnemonic; action(); r.ip=cursor;
      return {status:this.halted?'halted':'retired', retired:true, trace, reason:this.halted?'HLT executed':null};
    } catch (error) {
      if (error instanceof PlatformAccess) return {status:'unsupported-platform-access', retired:false, trace, reason:error.message};
      throw error;
    }
  }
}
