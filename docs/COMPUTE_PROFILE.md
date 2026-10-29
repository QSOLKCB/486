# `diagnostic-compute-v1` instruction contract

This direct-loader lab profile inherits the original entry and 2 MiB memory map,
not a PC reset or BIOS. Default operand and address sizes are 16 bits; prefixes,
32-bit operations, architectural exception delivery and all unlisted forms stop
as unsupported. The profile owns E9 output only. Each complete instruction
increments one virtual tick. Instruction fetch crossing offset FFFF is unsupported
platform access; a completed instruction may advance or branch with 16-bit IP wrap.

| Encoding | Supported form | Defined flags |
|---|---|---|
| B0–B7 ib; B8–BF iw | MOV byte/word general register immediate | preserved |
| 88/89, 8A/8B /r | MOV r/m8 or r/m16 to/from register | preserved |
| 00–03 /r | ADD r/m8 or r/m16 to/from register | CF PF AF ZF SF OF |
| 28–2B /r | SUB r/m8 or r/m16 to/from register | CF PF AF ZF SF OF |
| 38–3B /r | CMP r/m8 or r/m16 against register (no result write) | CF PF AF ZF SF OF |
| 80/81 /0,/5,/7 | ADD/SUB/CMP r/m8 imm8 or r/m16 imm16 | CF PF AF ZF SF OF |
| 40–4F | INC/DEC word register | PF AF ZF SF OF; CF preserved |
| 70–7F cb; EB cb | Jcc rel8; JMP rel8 | preserved |
| 50–57; 58–5F | PUSH/POP word register | preserved |
| E8 cw; C3 | near CALL rel16; near RET | preserved |
| EE; F4 | OUT DX,AL to mapped port; HLT | preserved |

16-bit ModR/M forms accept mod=3 register and the complete 16-bit memory EA
matrix: BX+SI, BX+DI, BP+SI, BP+DI, SI, DI, BP, BX, plus mod=00/rm=110
absolute disp16. Mod=01 applies sign-extended disp8; mod=10 applies disp16;
effective offsets wrap to 16 bits before segment translation. BP-based EAs
use SS, other EAs and direct disp16 use DS. AH/CH/DH/BH alias the upper bytes
of AX/CX/DX/BX; AL/CL/DL/BL alias their lower bytes. Byte accesses are one
mapped byte; words are little-endian, route both bytes and reject any operand
spanning segment offset FFFF. Both addresses are validated before a word write.
On this restricted lab profile, failed memory routing and segment crossing stop
as unsupported-platform-access and leave instruction registers, flags, IP and
memory unchanged; this is not an assertion of a delivered CPU exception.

PUSH decrements SP by two modulo 65536, then stores a word at SS:SP; PUSH SP
uses its value before decrement (486 behavior). POP reads SS:SP, increments SP by
two modulo 65536, then writes the destination, including POP SP. CALL pushes
the IP following the entire instruction, then adds signed rel16 to that IP;
RET pops IP. Both branch targets and stack-pointer arithmetic are 16-bit.
Unmapped/cross-segment stack words stop before any stack-pointer or memory change.

References: Intel, *Intel486 Microprocessor Family Programmer's Reference Manual*
(1992), [sections 2.5.3–2.5.3.2 (memory operands and effective addresses),
3.2–3.4 (instruction behavior), 26.1 and Chapter 26 instruction entries](https://bitsavers.trailing-edge.com/components/intel/80486/1992_Intel_486_Programmers_Reference_Manual.pdf);
Intel, *80386 Programmer's Reference Manual* (1986), [Appendix A 16-bit
ModR/M table and default segments](https://pdos.csail.mit.edu/6.828/2018/readings/i386.pdf).
The profile intentionally stops diagnostically where complete 486 exception
behavior has not been built.
