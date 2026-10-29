// Apache-2.0. Original lab guest, assembled directly from documented opcodes.
// Reads sector 0 byte 0 ('A'), outputs it, writes 'Z' through the overlay,
// reloads the sector, outputs that byte and halts. No expected result is used
// by the runtime.
const movDX = port => [0xba,port,0];
const movAL = value => [0xb0,value];
const out = [0xee];
const input = [0xec];
export const diskGuest = Uint8Array.from([
  ...movDX(0xd0), ...movAL(0), ...out,
  ...movDX(0xd3), ...movAL(1), ...out,
  ...movDX(0xd1), ...movAL(0), ...out,
  ...movDX(0xd2), ...input, ...movDX(0xe9), ...out,
  ...movDX(0xd2), ...movAL(0x5a), ...out,
  ...movDX(0xd3), ...movAL(2), ...out,
  ...movAL(1), ...out,
  ...movDX(0xd2), ...input, ...movDX(0xe9), ...out,
  0xf4,
]);
