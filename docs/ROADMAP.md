# Roadmap: earn each claim

This is a sequence of bounded, independently reviewable stages, not a promise
that a passing diagnostic establishes PC or 486 compatibility. See
[SUPPORT.md](SUPPORT.md) and the versioned profiles for the precise supported
forms and current evidence. A later stage starts only when its prerequisites and
exit tests have been specified; planning a stage does not authorize implementing it.

| Stage | Status | Prerequisites and exit evidence |
|---|---|---|
| Foundation and first execution | **Completed for the stated diagnostic scope** | Original direct-loaded guest executes four instructions, emits `K` through OUT and halts; mutations and unsupported inputs have executor tests. Reference tests are not a CPU conformance suite. |
| Interactive lab devices | **Partial** | Guest-driven keyboard/text and the synthetic disk overlay work in their lab profiles. Replay, reset, persistence, export and failure paths have scoped evidence. The tiny lab disk is not ATA or floppy hardware, and the direct loader is not BIOS boot. |
| Real-mode instruction core | **Partial** | Arithmetic, 16-bit addressing, branches and near subroutines have a documented compute profile and targeted executor tests. Guest-controlled [segmentation](SEGMENT_PROFILE.md) has a separate bounded profile and executor tests. No single guest completes real mode. |
| PC board and genuine boot path | **Unimplemented** | Select and name a specific board/profile and memory/port/device map before implementation. Define CPU hardware reset state, ROM mapping, A20 control, interrupts, timers and an actual storage-controller interface. Supply original or separately rights-verified firmware and boot media with source, recipes and hashes; test reset-vector fetch through a reproducible firmware-to-boot-guest trace, controller/IRQ/device ordering, invalid media, reset and persistent overlay isolation. The lab disk does not satisfy this gate. |
| 486 architectural expansion | **Unimplemented** | Identify an exact 486 variant and manuals before implementing protected mode. Split descriptor tables and segment caches, mode transitions, privilege checks, exceptions, and paging into bounded stages with independent vectors, fault/restart and boundary tests; see below. |
| Audio and usability | **Unimplemented** | Specify a guest-driven PC speaker path and its timing/lifecycle contract first; test guest port/timer events, pause/reset, gesture unlock and resource release. Later devices and approximations require separately documented validation and labels. |

## Next bounded real-mode gates

Choose an instruction slice from an explicit real workload and publish its exact
encodings, operand and address widths, flags, memory/stack effects, unsupported
forms and diagnostics before claiming support. A sensible next slice after the
segmentation profile is selected byte/word logical operations and their immediate
forms, with a guest using their results. Do not infer all real-mode support from
that slice. Independent executor vectors must cover flag definitions, aliases,
all claimed ModR/M forms, segment overrides and defaults, A20, fetch and operand
boundaries, unsupported/truncated encodings and unchanged state on diagnostic stops.
Compare only architecturally defined bits against a named independent oracle where
practical. Demonstrate deterministic single-step, batch and reset behavior and
preserve the earlier guests in browser tests under `/486/`.

## PC board and boot prerequisites

Before selecting implementations, identify a concrete 486-era CPU/board model and
publish its reset state, RAM/ROM/holes/MMIO map, port routing, A20 and interrupt
wiring, clock/event policy and disk geometry. Introduce each selected device and
interrupt behavior with isolated positive, negative and ordering tests. A genuine
boot receipt must start at the documented hardware reset entry, fetch firmware from
its mapped ROM, follow a specified controller/firmware path into an original or
rights-verified boot guest, and record guest-visible output and state. A direct-loaded
fixture or lab-sector port transaction is not boot evidence. Keep imported originals
immutable, validate disk identity and ensure interrupted writes cannot publish partial
revisions; test failure/reload/reset and deterministic replay against the selected
hardware profile.

## Protected mode, privilege, exceptions and paging

Specify the intended 486 variant and relevant Intel manual sections first; do not
assume instructions or later-processor behavior. Make separate contracts and tests for:

1. Descriptor tables and hidden segment caches, descriptor types, bounds and
   invalid loads; distinguish visible selectors from cached state.
2. Mode entry/exit and control transfers, including reset and operand/address-size
   defaults. Check valid and invalid transitions against independent vectors.
3. Privilege and protection checks for code, data and stack access, including
   boundaries and violations, before making privilege claims.
4. Exception delivery with exact vector/error-code/stack effects and nested-fault
   boundaries. Test fault versus trap behavior, instruction restart and partial
   side effects for each implemented operation.
5. Paging translation, permissions, cross-page accesses, page-fault error codes,
   invalidation and restart; test interactions with segmentation and A20 under
   the chosen model. Do not present a diagnostic stop as an architectural fault.

x87 and any other extension require an explicit selected variant, separately
bounded scope, rights-safe guests and independent conformance evidence.

## Audio and usability prerequisites

Begin with a guest-controlled PC speaker tied to the chosen board's timer and port
semantics; virtual device events, not host audio callbacks or wall-clock time, own
the machine timing. Test deterministic register/event traces and sample-independent
replay, gesture-gated context creation, pause/resume silence, reset/disconnect,
repeated sessions and stale callback rejection. Document what timing and waveform
behavior is approximated. Broader sound-card or OPL claims require a separate
hardware profile and conformance evidence; do not label an approximation accurate.

Development tools, assemblers, generators and differential models are welcome when
their purpose, versions and scope are recorded. Keep the static runtime minimal,
retain fixture history, and make correctness and reproducibility prerequisites for
any performance claims. Browser checks and emulator tests name the actual commit,
profile, guest and environment; unrun evidence stays unrun.
