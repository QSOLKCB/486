// Apache-2.0. Original hand-encoded direct-loader guest; see segments.json.
// Initial state is the base loader state. The guest itself loads DS and ES.
// Image offsets are physical addresses minus the loader's 0x7c00 origin.
export const segmentDataOffsets = Object.freeze({ds:0x10100-0x7c00, es:0x20100-0x7c00, unrelated:0x30100-0x7c00});
export function makeSegmentProgram() {
  const program = new Uint8Array(segmentDataOffsets.unrelated + 1);
  program.set([
    0xba,0xe9,0x00,        // mov dx, 00e9h
    0xb8,0x00,0x10,        // mov ax, 1000h
    0x8e,0xd8,             // mov ds, ax
    0xb8,0x00,0x20,        // mov ax, 2000h
    0x8e,0xc0,             // mov es, ax
    0xbb,0x00,0x01,        // mov bx, 0100h
    0xbd,0x00,0x01,        // mov bp, 0100h
    0xb0,0x03,             // mov al, 03h
    0x88,0x46,0x00,        // mov [bp+0], al (SS:0100)
    0x8a,0x07,             // mov al, [bx] (DS:0100)
    0x26,0x02,0x07,        // add al, es:[bx]
    0x02,0x46,0x00,        // add al, [bp+0] (SS:0100)
    0x3e,0x02,0x46,0x00,   // add al, ds:[bp+0] (DS:0100)
    0x26,0x88,0x47,0x01,   // mov es:[bx+1], al
    0xe8,0x02,0x00,        // call save_restore; stack uses SS
    0xee,                  // out dx, al
    0xf4,                  // hlt
    0x26,0x53,             // es: push bx (still SS stack)
    0xbb,0x34,0x12,        // mov bx, 1234h
    0x3e,0x5b,             // ds: pop bx (still SS stack)
    0xc3                   // ret (SS stack)
  ]);
  program[segmentDataOffsets.ds] = 0x21;
  program[segmentDataOffsets.es] = 0x11;
  program[segmentDataOffsets.unrelated] = 0x77;
  return program;
}
