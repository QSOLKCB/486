# Terra handoff

## Start here

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

## First gate, not the whole implementation finish line

A user can step four actual guest instructions, see `K`, see HLT, reset and repeat.
The code cannot report success after unsupported execution. Continue only after
this gate passes; it is not a substitute for the interactive lab below.

## Useful implementation handoff finish line

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
