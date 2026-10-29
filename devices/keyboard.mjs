// Apache-2.0. Lab-only printable-byte FIFO, not a PC keyboard controller.
export class LabKeyboard {
  constructor() { this.queue = []; this.dropped = 0; }
  enqueue(byte) {
    if (!Number.isInteger(byte) || byte < 0x20 || byte > 0x7e) throw new RangeError('keyboard accepts printable ASCII');
    if (this.queue.length === 256) { this.dropped++; return false; }
    this.queue.push(byte); return true;
  }
  read(port) {
    if (port === 0x64) return this.queue.length ? 1 : 0;
    if (port === 0x60) return this.queue.shift() ?? 0;
    throw new RangeError('invalid keyboard port');
  }
}
export function attachKeyboard(bus, machine) {
  machine.keyboard = new LabKeyboard();
  bus.registerPort(0x60, machine.keyboard); bus.registerPort(0x64, machine.keyboard);
}
export function keyboardEvent(event, machine) {
  if (event.type !== 'key') throw new RangeError('unknown input event');
  machine.keyboard.enqueue(event.byte);
}
