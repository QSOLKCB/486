// Apache-2.0. Deterministic lifecycle; no host scheduling.
import { Bus } from '../bus/bus.mjs';
import { Cpu } from '../cpu/cpu.mjs';
import { orderedEvents } from '../contracts/reference.mjs';
export class Machine {
  #rom;
  constructor({program, rom, profile='diagnostic-real-v1', registers={}, setupBus=()=>{}, onEvent=()=>{}} = {}) {
    if (profile === 'i486-reset-v1') {
      if (!(rom instanceof Uint8Array) || rom.length !== 0x10000) throw new RangeError('reset ROM must be exactly 65536 bytes');
      if (program !== undefined || Object.keys(registers).length) throw new TypeError('reset profile does not accept a direct-loader program or register overrides');
      this.#rom = new Uint8Array(rom);
    } else {
      if (!(program instanceof Uint8Array)) throw new TypeError('program must be Uint8Array');
      if (rom !== undefined) throw new TypeError('ROM is not supported by this profile');
      if (program.length > 2 * 1024 * 1024 - 0x7c00) throw new RangeError('program exceeds lab RAM');
      this.program = program.slice();
    }
    this.profile = profile; this.initialRegisters = {...registers};
    this.setupBus=setupBus; this.onEvent=onEvent; this.generation=0; this.reset();
  }
  reset() {
    this.generation++; this.bus = new Bus();
    if (this.profile === 'i486-reset-v1') {
      this.bus.mapROM(0xffff0000, this.#rom);
      this.bus.mapROM(0x000f0000, this.#rom);
    } else this.bus.ram.set(this.program, 0x7c00);
    this.output=[]; this.bus.registerPort(0xe9, {write:(_port, value)=>this.output.push(value)});
    this.cpu=new Cpu(this.bus,{profile:this.profile,registers:this.initialRegisters});
    this.tick=0; this.state='paused'; this.lastOutcome=null; this.events=[]; this.inputLog=[];
    this.setupBus(this.bus,this);
  }
  queueEvent(event) {
    const candidate = {...event};
    if (!Number.isSafeInteger(candidate.tick) || candidate.tick < this.tick || !Number.isSafeInteger(candidate.sequence) || candidate.sequence < 0) throw new RangeError('invalid event time or sequence');
    if (this.inputLog.some(e=>e.sequence === candidate.sequence)) throw new RangeError('duplicate event sequence');
    this.inputLog.push(candidate); this.events=orderedEvents([...this.events,candidate]);
  }
  step() {
    if (this.state === 'halted' || this.state === 'stopped') return {...this.lastOutcome, retired:false};
    while (this.events.length && this.events[0].tick === this.tick) this.onEvent(this.events.shift(), this);
    const outcome = this.cpu.step(); this.lastOutcome=outcome;
    if (outcome.retired) this.tick++;
    if (outcome.status === 'halted') this.state='halted';
    else if (!outcome.retired) this.state='stopped';
    return outcome;
  }
  pause() { if (this.state==='running') this.state='paused'; }
  resume() { if (this.state==='paused') this.state='running'; }
  runBatch(limit) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) throw new RangeError('invalid batch limit');
    let count=0; while (this.state==='running' && count<limit) { this.step(); count++; }
    return count;
  }
}
