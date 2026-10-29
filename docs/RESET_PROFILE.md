# `i486-reset-v1`: bounded reset and ROM experiment

This opt-in experiment models the entry point of an Intel i486 DX, stepping 0,
not a complete processor or PC board. In particular it implements neither 32-bit
register access and control registers nor hardware interrupts, exception delivery,
BIOS services or disk boot. The existing direct-loader profiles and their entry
points do not change. The browser diagnostics are not a booted computer.

## Reset and map

The implemented visible state at reset is CS:IP=`F000:FFF0`, DX=`0400`, FLAGS
`0002`, the remaining implemented 16-bit general and segment registers zero. The
hidden CS base is `FFFF0000` and code limit is `FFFF`; the first byte fetch is
physical `FFFFFFF0`, not `000FFFF0`. DX is the low half of the reset signature
`0400 + revision ID` for the selected stepping. Zeroes for otherwise undefined
registers are deterministic choices for this experiment, not Intel guarantees.
The core does not model the full 32-bit or control/debug reset state, x87 or
self-test behavior. A20 starts enabled as a board choice.

The board maps 2 MiB RAM and one 64 KiB ROM image at physical `FFFF0000` through
`FFFFFFFF`, with a low alias at `000F0000` through `000FFFFF`. Both aliases
read the same immutable bytes; ROM wins over the overlapping RAM range. Writes to
ROM or unmapped physical addresses stop as unsupported platform accesses, not as
architecturally delivered exceptions. The ordinary A20 bit-20 gate is applied
before physical mapping; disabling it can therefore alter the high reset address.
A20 behavior is a profile contract and is not presented as a chipset emulation.
Reset restores volatile state and the original ROM, not a user disk operation.

## Implemented instructions

This profile uses the [segmentation slice](SEGMENT_PROFILE.md), including the
linked compute subset, with one additional control transfer:

| Encoding | Form | Semantics |
|---|---|---|
| `EA iw iw` | `JMP ptr16:16` | Fetch little-endian offset followed by selector, load IP and CS, set hidden CS base to selector × 16. Preserves flags; no stack effects. |

Both instruction fetch and CS-override memory accesses use the hidden CS base
until the far jump reloads it. A segment override never changes instruction fetch
or an implicit SS stack access. The segmentation profile's prefix budget and
unsupported-prefix policy apply. A truncated fetch, unmapped address or crossing
of the 16-bit code-segment limit stops diagnostically before register or memory
changes; this is not an implemented #GP. Its inherited sequential-IP wrapping
convention remains a known difference from 486 exception semantics. No far CALL,
interrupt, IRET, MOV SS, protected-mode transfer or exception delivery is implied.
See the linked matrices for every other supported form and flag rule.

## Original ROM diagnostic

`fixtures/firmware/reset-rom.mjs` is original project-authored Apache-2.0 code;
it builds a 65,536-byte image without external assembler or ROM. Fill all bytes
with `FF`, set offset `0000` to `BA E9 00 B0 52 EE F4`, and offset `FFF0` to
`EA 00 00 00 F0`. SHA-256 of those bytes:
`d975d5eb1769b8d250684045b981d592216dda892802ed60770a4eeaa791103e`.
Reproduce the hash with pinned Node 24.22.1:

```sh
node --input-type=module -e "import {resetRom} from './fixtures/firmware/reset-rom.mjs'; import {createHash} from 'node:crypto'; console.log(createHash('sha256').update(resetRom()).digest('hex'))"
```

The optional **486 reset ROM diagnostic** selector runs this image in the lab.
The initial far jump executes at `FFFFFFF0` and loads `F000:0000`, after which
instruction fetch comes from `000F0000`. The diagnostic executes `MOV DX,00E9`,
`MOV AL,52`, `OUT DX,AL`, and `HLT`; the actual guest output is `R`. This is a
reset/transfer proof, not firmware initialization, BIOS boot, a boot sector or a
console. Fixture hashes identify bytes, while executor traces establish the
observed path.

## Sources and boundaries

Intel, *i486 Microprocessor*, November 1989, order 240440-002,
[§6.2 and Table 6.2](https://bitsavers.trailing-edge.com/components/intel/80486/240440-002_i486_Microprocessor_Nov89.pdf)
describes reset register values and the 32-bit reset fetch address. Intel,
*Intel 64 and IA-32 Architectures Software Developer's Manual*, volume 3A,
[§9.1.4](https://www.intel.com/content/dam/support/us/en/documents/processors/pentium4/sb/25366821.pdf)
explains the special reset CS base and its replacement by a normal segment base
after a far control transfer. The latter is supplemental documentation, not
permission to infer later-processor instructions for the i486. The ROM aliases,
RAM size, A20 default, lab port and deterministic undefined-register choices are
this experiment's platform policy, not claims about a historical PC board.
