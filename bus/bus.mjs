// Apache-2.0. Checked diagnostic-profile bus.
import { gateA20, realAddress } from '../contracts/reference.mjs';
const uint = (n, max, label) => {
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new RangeError(`${label} out of range`);
  return n;
};
export class PlatformAccess extends Error {
  constructor(message) { super(message); this.name = 'PlatformAccess'; }
}
export class Bus {
  #roms = [];
  constructor({size = 2 * 1024 * 1024, a20 = true} = {}) {
    uint(size, 0x100000000, 'RAM size');
    if (typeof a20 !== 'boolean') throw new TypeError('A20 state must be boolean');
    this.ram = new Uint8Array(size); this.a20 = a20; this.ports = new Map();
  }
  address(segment, offset) { return gateA20(realAddress(segment, offset), this.a20); }
  // Install explicit ROM mappings before execution. ROM has priority over RAM,
  // allowing a board profile to overlay a conventional-address ROM window.
  // Each alias is mapped separately; caller-owned bytes cannot mutate the ROM.
  mapROM(start, bytes) {
    uint(start, 0xffffffff, 'ROM start');
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new TypeError('ROM must be a nonempty Uint8Array');
    const end = start + bytes.length;
    if (end > 0x100000000) throw new RangeError('ROM extends beyond physical address space');
    if (this.#roms.some(rom => start < rom.end && rom.start < end)) throw new Error('ROM regions overlap');
    this.#roms.push({start, end, bytes: new Uint8Array(bytes)});
  }
  #romAt(address) { return this.#roms.find(rom => address >= rom.start && address < rom.end); }
  index(address) {
    uint(address, 0xffffffff, 'physical address');
    const gated = gateA20(address, this.a20);
    if (!this.#romAt(gated) && gated >= this.ram.length) throw new PlatformAccess(`unmapped physical address 0x${gated.toString(16)}`);
    return gated;
  }
  writableIndex(address) {
    const gated = this.index(address);
    if (this.#romAt(gated)) throw new PlatformAccess(`write to read-only ROM at physical address 0x${gated.toString(16)}`);
    return gated;
  }
  read8(address) { const gated = this.index(address), rom = this.#romAt(gated); return rom ? rom.bytes[gated - rom.start] : this.ram[gated]; }
  write8(address, value) { uint(value, 255, 'byte'); this.ram[this.writableIndex(address)] = value; }
  registerPort(port, device) {
    uint(port, 0xffff, 'port');
    if (this.ports.has(port)) throw new Error(`port 0x${port.toString(16)} already mapped`);
    if (!device || (typeof device.read !== 'function' && typeof device.write !== 'function')) throw new TypeError('invalid port device');
    this.ports.set(port, device);
  }
  in8(port) {
    uint(port, 0xffff, 'port'); const device = this.ports.get(port);
    if (!device || typeof device.read !== 'function') throw new PlatformAccess(`unmapped input port 0x${port.toString(16)}`);
    const value = device.read(port); return uint(value, 255, 'device input byte');
  }
  out8(port, value) {
    uint(port, 0xffff, 'port'); uint(value, 255, 'byte'); const device = this.ports.get(port);
    if (!device || typeof device.write !== 'function') throw new PlatformAccess(`unmapped output port 0x${port.toString(16)}`);
    device.write(port, value);
  }
}
