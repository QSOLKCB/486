// Apache-2.0. Original hand-encoded guest; see compute.json for the full receipt.
// Direct loader: CS:IP=0000:7c00, DS=0000, SS:SP=2000:0100, BP=2222.
// Bytes at 0000:7c80 are data, not opcodes or an expected-output fixture.
export const computeDataOffset = 0x80;
export const computeRegisters = Object.freeze({ds:0, ss:0x2000, sp:0x0100, bp:0x2222});
export function makeComputeProgram() {
  const program = new Uint8Array(computeDataOffset + 4);
  program.set([
    0xba,0xe9,0x00,        // mov dx, 00e9h
    0xbb,0x34,0x12,        // mov bx, 1234h
    0xbe,0x80,0x7c,        // mov si, 7c80h
    0xb9,0x04,0x00,        // mov cx, 4
    0xb8,0x00,0x00,        // mov ax, 0
    0xe8,0x02,0x00,        // call sum (relative to following instruction)
    0xee,                  // out dx, al
    0xf4,                  // hlt
    0x53,                  // sum: push bx
    0x55,                  // push bp
    0x89,0xe5,             // mov bp, sp
    0x8a,0x1c,             // loop: mov bl, [si] (DS)
    0x00,0xd8,             // add al, bl
    0x46,                  // inc si
    0x49,                  // dec cx
    0x75,0xf8,             // jnz loop
    0x8b,0x5e,0x02,        // mov bx, [bp+2] (SS; saved BX)
    0x5d,                  // pop bp
    0x5b,                  // pop bx
    0xc3                   // ret
  ]);
  program.set([0x10,0x11,0x12,0x13], computeDataOffset);
  return program;
}
