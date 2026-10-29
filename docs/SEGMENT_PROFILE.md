# `diagnostic-segments-v1` instruction contract

This direct-loader profile retains the compute profile's 16-bit operand/address
sizes, 2 MiB RAM, enabled A20, instruction subset, direct entry, tick semantics,
E9 output and diagnostic boundaries. It is not a hardware reset, BIOS boot or
complete i486 model. Previous profiles are unchanged. Real-address segment loads
here set the visible 16-bit segment value; address translation uses value × 16.
No hidden descriptor state, protected-mode selector validation, interrupt or
exception delivery is implemented.

## Additional encodings

| Encoding | Form | Effects |
|---|---|---|
| `8E /0` | MOV ES, r/m16 | Load ES from a general 16-bit register or a little-endian word in memory; flags preserved. |
| `8E /3` | MOV DS, r/m16 | Load DS from a general 16-bit register or a little-endian word in memory; flags preserved. |
| `8C /0` | MOV r/m16, ES | Store ES to a general 16-bit register or a little-endian word in memory; flags preserved. |
| `8C /3` | MOV r/m16, DS | Store DS to a general 16-bit register or a little-endian word in memory; flags preserved. |
| `26`, `2E`, `36`, `3E` | ES, CS, SS, DS segment override, respectively | Select that segment for an explicit ModR/M memory operand in a supported instruction. A single prefix is accepted on supported instructions without an explicit memory operand but changes no segment selection. |

All the [compute profile](COMPUTE_PROFILE.md) ModR/M addressing forms are
supported, including register operands, direct disp16, signed displacement and
BP-based forms. Without an override BP-based forms use SS, other memory forms use
DS. A segment load from memory computes its address using the prior segment
registers, before changing its destination segment. Source and destination memory
words are checked little-endian accesses; crossing FFFF or an unmapped bus byte
stops as unsupported platform access before any change to registers, flags, IP
or RAM. Instruction bytes are always fetched using CS. Implicit stack accesses
for PUSH/POP/CALL/RET always use SS and are never redirected by an override.
These behaviors do not assert that a CPU exception was delivered.

`8E` and `8C` selectors other than ES (`/0`) and DS (`/3`) are unsupported;
this includes CS, SS, FS, GS and reserved selectors. CS loads, SS loads and their
interrupt/debug-shadow semantics, far transfers, protected-mode selectors,
FS/GS, operand-size/address-size, REP and LOCK prefixes are outside this slice.
They stop diagnostically; the profile does not present an unimplemented encoding
as an architectural exception.

## Prefix decoding and limits

The decoder recognizes the four segment-prefix bytes before a supported opcode,
records instruction bytes from the original CS:IP, and bounds total fetched
instruction bytes at 15. A second segment override in the same instruction is
not supported: the decoder scans the prefix run within the bound, then stops
before executing the opcode. This profile does **not** choose a last-prefix-wins
rule. Intel's later IA-32 encoding reference describes redundant prefixes from
the same group as undefined and processor-dependent; it is supplemental evidence,
not a claim that every 486 model behaves identically. An unsupported prefix from
a different class stops diagnostically as an unsupported opcode. Instructions
requiring more than 15 bytes stop as unsupported instruction, without fetching a
16th byte. The 486 reference describes an actual #GP on an overlong instruction;
this lab has not implemented exception delivery and does not call the diagnostic
stop a guest exception. A fetch that would cross CS offset FFFF or an unmapped
physical byte stops as unsupported platform access before mutation. If both the
segment boundary and byte budget would be exceeded on the next fetch, the
segment-boundary diagnostic takes precedence; no 16th byte is fetched. Completed
instruction IPs still wrap as specified by the compute profile. This inherited
sequential-wrap behavior differs from the 486 #GP described in §22.7 item 8.
Prefix bytes do
not retire separately, and a diagnostic stop leaves all state and device effects
unchanged.

References: Intel, *Intel486 Microprocessor Family Programmer's Reference Manual*
(1992), [§2.5.3 and §2.5.3.1 memory operands and default segment selection;
§22.7 items 6–8, real-address instruction-length and segment boundaries; Chapter 26 MOV and instruction
format](https://bitsavers.trailing-edge.com/components/intel/80486/1992_Intel_486_Programmers_Reference_Manual.pdf).
Intel, *Intel Architecture Software Developer's Manual Volume 2* (1997),
[§2.2 instruction prefixes](https://0x04.net/~mwk/doc/intel/24319101.pdf)
provides the supplemental same-group redundant-prefix qualification; it is not
substituted for a specific Intel486 stepping's behavior.
