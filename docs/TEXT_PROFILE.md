# `diagnostic-text-v1` extension

This is a direct-loader teaching profile, not a BIOS boot, VGA implementation or PC keyboard controller. It retains the `diagnostic-real-v1` 2 MiB RAM, enabled A20, initial FLAGS and 0000:7c00 entry. Its original echo guest starts with DS=B800h and BX=0; all other initial registers are as in the first profile. The host may inspect the 4,000 bytes starting at physical B8000h without side effects. They represent 80 columns by 25 rows, in row-major order: each cell is a character byte followed by an attribute byte. The guest writes attribute 07h. Printable ASCII 20h–7Eh is rendered; other values appear blank. The model is RAM, not VGA hardware or a font ROM.

The lab-only keyboard interface uses byte input port 64h: bit 0 is one if a key is queued, otherwise zero; other bits are zero. Byte input port 60h removes and returns the oldest key, or zero if empty. Host input is printable ASCII only, logged as a machine event with a virtual tick and unique sequence number; each delivered event appends a byte to a 256-byte FIFO. At capacity, the newest input is dropped and the drop count increments. Repeated keydown events are distinct inputs. Events are delivered before the next instruction at their assigned tick; paused automatic execution consumes neither events nor instructions, but explicit step processes the boundary. Reset clears the FIFO, input log, framebuffer and counters. Key input is accepted only while the lab input surface is focused.

The following encodings extend the base instruction subset; operand and address sizes are 16-bit with no prefixes. Other ModR/M forms remain unsupported. Every operation below preserves all flags except where specified. Sequential IP and branch destinations wrap to 16 bits. Memory and port accesses use the checked bus; an absent mapping stops as unsupported platform access.

| Encoding | Operation | Flags / side effects |
|---|---|---|
| `E4 ib` | IN AL,imm8 | Reads the specified port into AL, preserves AH and flags. |
| `EC` | IN AL,DX | Reads the DX port into AL, preserves AH and flags. |
| `A8 ib` | TEST AL,imm8 | AND without storing; CF and OF clear, SF/ZF/PF from 8-bit result; AF undefined. |
| `74 cb` | JZ rel8 | Branches when ZF=1, displacement sign-extended from the following IP; flags preserved. |
| `72 cb` | JB rel8 | Branches when CF=1, displacement sign-extended from the following IP; flags preserved. |
| `88 07` | MOV [BX],AL | Writes one byte at DS:BX; flags preserved. |
| `C6 07 ib` | MOV byte [BX],imm8 | Writes one byte at DS:BX; flags preserved. |
| `43` | INC BX | 16-bit increment; OF/SF/ZF/AF/PF defined, CF preserved. |
| `BB iw` | MOV BX,imm16 | Flags preserved. |
| `81 FB iw` | CMP BX,imm16 | 16-bit subtraction flags CF/OF/SF/ZF/AF/PF, without storing result. |
| `EB cb` | JMP rel8 | Signed relative branch; flags preserved. |

The echo guest polls status, reads one byte, writes character and attribute, advances BX by two, and wraps BX to zero at 4,000 bytes. Thus its display changes only through executed guest stores. Instruction ticks are scheduling units, not physical cycles. The application may bound work per animation frame, but batching must not change results given the same ordered event log and instruction budget.
