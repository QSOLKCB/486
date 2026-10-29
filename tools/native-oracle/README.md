# Optional native x86 arithmetic differential check

This optional development check compares the compute profile's register-destination
ADD, SUB and CMP encodings (`00/01`, `28/29`, `38/39`, ModR/M `D8`) against
actual native x86-64 arithmetic. The C oracle does not import emulator helpers.
It generates 8,192 operand pairs per width with the 32-bit LCG state seeded at
`0x04862026` (multiplier 1664525, increment 1013904223), executing all three
operations at both 8 and 16 bits: 49,152 cases. It compares the destination and
only defined arithmetic flags CF, PF, AF, ZF, SF and OF (mask `0x08d5`). CMP
preserves its destination. No undefined flag is compared.

On an x86-64 Linux host with GCC and Node 24.22.1, from the repository root:

```sh
node tools/native-oracle/check.mjs
```

The script compiles `alu.c` with `gcc -std=c11 -O2 -Wall -Wextra`, runs the
binary from a temporary directory, and removes it. No compiler or package is a
runtime dependency of the browser app. The implementation receipt passed all
49,152 comparisons on AMD EPYC 9V74 using GCC 13.3.0 (Ubuntu
13.3.0-6ubuntu2~24.04), Node 24.22.1. This establishes only those tested
register forms against the host processor; it does not validate memory addressing,
other encodings, real-mode exception behavior or complete 80486 conformance.
