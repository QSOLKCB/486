// Apache-2.0. Original deterministic synthetic media: four 16-byte sectors.
// Recipe: byte i = (i * 7 + 0x41) modulo 256, i = 0..63.
export function makeLabDisk() { return Uint8Array.from({length:64},(_,i)=>(i*7+0x41)&255); }
