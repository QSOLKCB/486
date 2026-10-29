# Invariants: what must remain true

These are falsifiable design contracts, not a proof of an emulator. “Semantic”
means guest-visible behavior for the selected profile; “architectural” below
means project structure/lifecycle, not an invented x86 law. The current harness
covers only the explicitly listed reference operations in the test plan.

## Semantic contracts

**S1 — Finite words.** For width w in {8,16,32}, `U_w(x)=x mod 2^w` in `[0,2^w)`;
`I_w(x)=U_w(x)` below `2^(w-1)`, otherwise `U_w(x)-2^w`. Validate host inputs before
normalizing. JS bitwise operators coerce to signed 32-bit (except unsigned shift);
`1 << 32` is not 2^32. Number is exact only within safe-integer bounds: never use
Number multiplication as a general 32×32→64 implementation. Use split limbs or
BigInt with explicit truncation for wide intermediates.

**S2 — Flags belong to instructions.** The ADD reference gives CF from unsigned
carry, OF from signed overflow, AF from low-nibble carry, ZF/SF from the truncated
result and PF from even parity of its low byte. That is **ADD only**, not a universal
ALU formula. SUB uses borrow; ADC/SBB include incoming carry; INC/DEC preserve CF;
logic, shifts (including zero/masked counts), multiplication, division and decimal
adjust have separate rules. MOV must preserve flags. Record defined, preserved,
forced and undefined flags per encoding/width. Differential comparisons mask
undefined bits; reserved bits and flag loading depend on CPU/mode/privilege.

**S3 — Addressing is a pipeline.** Operand/effective-offset calculation and its
address-size rules → segment translation and checks → paging if enabled → physical
bus width → board A20 gate → map lookup. Do not normalize a bad host input into a
valid pointer. The reference real-mode helper covers only normal segment<<4 +
16-bit offset, not hidden descriptor caches, unreal mode or fault checks. In the
chosen 32-bit bus, disabled A20 clears address bit 20; it is **not modulo 1 MiB**
for all addresses and never modulo allocated RAM. Unaligned/multibyte accesses
route each required byte and follow instruction-specific fault/commit ordering.
TypedArray out-of-bounds behavior is not an emulated bus response. RAM bounds,
segment violations, paging faults and unmapped bus regions are distinct concepts.

**S4 — No fabricated execution.** Unsupported valid encodings stop diagnostically;
they do not advance successfully or emit expected guest output from the harness.
Only a genuine decoder/executor can establish guest conformance. HALT, pause,
unsupported-stop and architectural exception are distinct states.

## Architectural/lifecycle contracts

**A1 — Determinism.** Given profile version, initial state/base+overlay identity,
ordered input log and execution budget, repeated runs produce identical defined
state and output. Events use nonnegative integer virtual ticks and unique sequence
numbers; order is `(tick, sequence)`, not callback arrival order. For the diagnostic,
deliver tick-t events before the next instruction at tick t; a retired instruction
(including HLT) increments tick once. Halted/unsupported steps retire nothing. Automatic execution while paused consumes
no ticks or events; an explicit UI single-step executes one instruction (and its
boundary events) while leaving automatic execution paused.
An empty diagnostic event source means HLT remains halted until reset. Future IRQ
wake-up/time advancement must be separately specified; do not invent it here.

**A2 — Reset is scoped and cancels stale work.** Increment a session generation
before rebuilding volatile machine state. Old I/O promises, worker messages,
timers and audio callbacks cannot mutate the new generation. Cold reset reloads
the declared initial RAM/register/device/event state and tick zero, keeping the
selected committed disk overlay. “Discard overlay” is a separate explicit action;
“reload disk” preserves identity and committed revisions. Reset neither claims to
match hardware reset nor silently erases user data. Snapshot replay records the
profile, input log, tick, base hash and committed overlay revision.

**A3 — One bus owner.** Memory/port ranges do not overlap unless a profile explicitly
specifies priority/aliasing. CPU and DMA use the same routing contract. Device
side effects occur exactly as defined per access; debug inspection is side-effect
free. Undefined RAM/port behavior must be an explicit profile choice.

**A4 — Disk identity and atomic publication.** Immutable originals are keyed by
cryptographic content hash plus byte length; logical sector size and schema/profile
are validated metadata. Names/paths are display labels, not identity. Overlays key
sectors by base identity and revision; same-named different disks cannot collide.
A multi-sector write stages changes, validates every range and publishes data plus
revision in one transaction. Failure/abort/quota errors leave the last committed
revision readable; completion is reported only after transaction completion, never
an individual request success. Reset cancels publication into the active machine;
persistence already committed stays committed. Serialize competing writers or
reject stale revisions. Browser eviction is possible: provide export and honest
save status, not promises of permanent storage. Export = exact base plus one
committed overlay snapshot; do not alter the imported original.

**A5 — Audio is a bounded resource, not the clock.** User gesture unlocks audio;
one session owns its graph. Pause/reset/stop silence it, disconnect retired nodes,
release references and close/reuse contexts deliberately. Stale completions cannot
restart old audio. Deterministic device register events are distinct from host
sample delivery/latency. A synth approximation must be labeled as such; no claim of
accurate OPL3, Sound Blaster or cycle timing without corresponding conformance tests.

**A6 — Evidence is reproducible.** Guest bytes have source/recipe, exact length,
hash, license and expected observations. Keep historical fixtures; a changed oracle
needs an explained version, not a rewritten history. A green contract test proves
only its assertion about its inputs. Emulator, browser and guest evidence must
name the actual implementation commit, profile, fixture and environment.
