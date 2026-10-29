# Architecture

## Profiles, not compatibility by implication

The name is a destination. The running lab implements only the profiles described below and their linked extensions.
Profiles are versioned contracts; any addition must specify reset state, mapped
resources, supported instructions and observable timing before claiming support.

**`diagnostic-real-v1` (first implementation target):** pedagogical real-mode
instruction subset, 16-bit default operand/address size, 32-bit physical address
representation, 2 MiB zero-initialized RAM, no ROM, no BIOS, no paging, no external
interrupt sources. Loader places the original diagnostic at physical `0x7c00` and
starts CS:IP=`0000:7c00`, all other visible general/segment registers zero,
FLAGS=`0x0002`, A20 enabled. This is a loader entry, **not the i486 hardware reset
vector or a boot sector boot**. Full hidden CPU state must be defined when introduced.
Port `0xe9` is an intentional lab-only byte-output device. No other port/device
is present. First supported encodings: `BA iw` (MOV DX,imm16), `B0 ib` (MOV AL,imm8),
`EE` (OUT DX,AL), `F4` (HLT). Prefixes are initially unsupported, not ignored.
Only decoder-delivered output `4b` then halted status constitutes guest success.
The UI must identify this limited profile, not say “486 compatible.”

An unmapped physical access or absent port stops this lab profile with an
`unsupported-platform-access` diagnostic. It is not automatically a guest CPU
exception. A future PC profile must specify ROM, MMIO, holes/open-bus behavior,
port defaults, reset-vector mapping, chipset/A20 control and interrupt routing.

**Implemented extensions:** [diagnostic-text-v1](TEXT_PROFILE.md) and
[diagnostic-disk-v1](DISK_PROFILE.md), and
[diagnostic-compute-v1](COMPUTE_PROFILE.md) specify the additional instruction and
device behavior. See [support and evidence](SUPPORT.md) for tested boundaries.

**Future `pc486-*`:** choose an exact CPU variant and documented board model before
adding protected mode, paging, privilege, interrupts, x87, BIOS or OS claims. Do not
inherit modern x86 instructions, CPUID or behavior merely because a modern manual
mentions them. Each version has a support matrix and incompatibility list.

## Ownership and seams (proposed layout)

| Module | Owns | Must not own |
|---|---|---|
| `cpu/` | architectural registers, decode/execute, exceptions | DOM, audio, storage |
| `bus/` | checked address/port routing; memory map | instruction flags |
| `devices/` | device registers and deterministic transitions | host wall-clock scheduling |
| `machine/` | profile, virtual time, event order, reset generation | UI presentation |
| `storage/` | immutable base identity, transactional overlay revisions | CPU execution |
| `ui/` | controls, rendering, user gesture audio adapter | guest state mutation bypasses |

A single owner mutates machine state. Worker execution is optional later, not a
prerequisite. A worker boundary must use versioned messages and reset-generation
IDs. Host callbacks enqueue input; they never execute guest code reentrantly.

`step()` returns a structured outcome (retired, halted, guest exception, or
unsupported implementation/platform) plus a trace record. It has a bounded decode
budget; instruction fetch must not run off into an unbounded prefix loop. An
unsupported instruction includes start CS:IP, fetched bytes, profile and reason;
its partially decoded operands must not cause committed writes or port effects.
Architecturally invalid instructions raise guest #UD only once that distinction
is implemented correctly. Faults, traps and restartable operations need their own
commit rules; do not impose universal all-or-nothing semantics on REP or devices.

Execution uses bounded host batches; rendering can skip frames but cannot skip
machine transitions. Instruction ticks in the diagnostic are scheduling units,
not claimed i486 cycles. No wall-clock, random source or audio callback affects CPU
results. See [invariants](INVARIANTS.md) for replay, reset and storage rules.
