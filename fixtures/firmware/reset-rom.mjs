// Original Apache-2.0 reset diagnostic. This is not BIOS firmware.
// Layout and byte encodings are deliberately explicit and reproducible.
export function resetRom() {
  const rom = new Uint8Array(0x10000).fill(0xff);
  // F000:0000: MOV DX,00E9; MOV AL,'R'; OUT DX,AL; HLT.
  rom.set([0xba, 0xe9, 0x00, 0xb0, 0x52, 0xee, 0xf4], 0);
  // Physical FFFFFFF0: JMP FAR F000:0000, reloading the hidden CS base.
  rom.set([0xea, 0x00, 0x00, 0x00, 0xf0], 0xfff0);
  return rom;
}
