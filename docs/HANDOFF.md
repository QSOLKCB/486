# Terra handoff

## Current status and next work

The foundation contracts and original direct-loaded `K` diagnostic are implemented.
The text/keyboard guest, synthetic lab-disk guest with local overlay, and bounded
arithmetic/addressing/subroutine guest exist as separate profiles. The [guest-controlled segmentation slice](SEGMENT_PROFILE.md) is a
separate opt-in profile; consult its support matrix and fixture receipt for its
tested scope. These are
partial real-mode and lab-device capabilities, not BIOS boot, ATA/floppy hardware,
complete real mode or a 486 compatibility claim. The separate
[i486-reset-v1](RESET_PROFILE.md) experiment adds a reset-vector ROM diagnostic;
it does not yet boot a disk or provide BIOS services.

Begin new work by inspecting current main and its history, reading AGENTS.md,
architecture, invariants, support matrix, profile docs and the evidence-gated
[roadmap](ROADMAP.md). Record the baseline commit and run the unchanged tests on
the pinned Node version. Preserve the event-iterator, generation-guard and push
whitespace hardening, all prior fixtures, disk data and browser workflows. Keep
CPU and devices independent from the DOM, storage completion timing and audio.

The next boot gate is a separately specified software-interrupt/IVT and firmware
service slice: define INT/IRET frame and returned FLAGS behavior, guest installation
of vectors, explicit unsupported-service errors and independent boundary tests.
Then build and prove a real 512-byte-sector boot path and an original guest-run
console, including keyboard wait scheduling and line editing. The existing disk has
16-byte sectors; a new, versioned block interface and persistence contract are
required, not an undocumented reinterpretation of existing images. Neither the
reset diagnostic nor its `R` output is evidence of a BIOS or booted OS. The
roadmap retains the other hardware, protected-mode, paging and audio prerequisites.

Deliver a reviewable PR with exact commit, commands, passed/failed/unrun checks,
fixture provenance and screenshots if the UI changes. Leave merge, release and
Pages deployment to the maintainer.

## Historical handoff: completed first-lab work

The text below records the original handoff and its evidence gates. It is preserved
as historical context, not an instruction to rebuild the already delivered lab.

### Original start here

Start with milestone 1, then grow a useful interactive diagnostic lab in gated PRs.
Do not attempt the whole 486 roadmap in one change. The harness is support: use tools,
reference models and generators where helpful, and disclose what they establish.
There is no “pure model” requirement or claim about how any vendor trained a model.

1. Read the diagnostic profile and contracts. Run `node --test` unchanged.
2. Implement a real bounded decoder for the four listed encodings, checked bus
   routing and port-e9 capture. Keep it importable without DOM/AudioContext.
3. Execute the original fixture through that code. Assert guest output and final
   state; mutate the guest immediate and prove the output changes. Test unsupported
   opcode/prefix and unmapped accesses. Do not import expected output into execution.
4. Add a small static UI showing profile, registers, guest output, stopped reason,
   and run/pause/step/reset. A plain module script is enough; no framework needed.
5. Test replay across batch sizes, repeated reset, pause and stale callback rejection.
   Report browser tests actually run, separately from Node/reference results.

The lab loader starts at 0000:7c00; do not market this as hardware reset or BIOS boot.
No upstream source/binaries, external disk images, full OPL3, JIT, x87, protected mode
or paging are required for this slice. A future feature is not grounds to weaken
current checks. Propose a better contract explicitly if implementation reveals an
error; attach counterexample, source and regression test.

### Historical first gate, not the whole implementation finish line

A user can step four actual guest instructions, see `K`, see HLT, reset and repeat.
The code cannot report success after unsupported execution. Continue only after
this gate passes; it is not a substitute for the interactive lab below.

### Historical useful implementation handoff finish line

Extend the documented profile and original guests in small, tested increments:

- Add a minimal text framebuffer and keyboard input path. Define memory/port
  interfaces and supported instructions before coding; an original guest must echo
  real injected keystrokes to the rendered display. Test focus, repeated keys,
  pause/resume and reset. Do not fake output in the UI.
- Add a small virtual-disk path with a read-only imported/original base and
  identity-keyed transactional overlays. A guest-driven diagnostic reads a known
  sector, writes an overlay, rereads it, and verifies persistence after reload.
  Test reset during a pending write, abort/quota failure, and same-name different
  bases. An original generated test image needs source, recipe and hash.
- Expose profile/support limitations, registers, stop reasons and disk save status
  in the static UI. Verify deterministic replay across host batch sizes and export
  exact committed disk bytes. This is a useful retro-PC lab, not yet DOS/full486.

Keep each extension independently reviewable; if the environment or scope blocks a
gate, deliver the working earlier gate and identify the exact remaining work, not
a fabricated completion claim. Audio and full architectural expansion remain later
roadmap work unless explicitly selected.

CPU tests and browser
checks describe exact coverage and gaps. Deliver a draft PR with commit, commands,
results and screenshots if UI changed. Leave merge/release/deployment to the user.
