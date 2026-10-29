# Test plan and evidence boundaries

## Foundation reference checks

The original reference suite exercises `contracts/reference.mjs` and the diagnostic fixture:

- width/input rejection, wrapping and signed interpretation at 8/16/32 bits;
- ADD flags on independent edge vectors and exhaustive 8-bit sums against a
  separate arithmetic oracle (not a CPU conformance suite);
- real-mode address addition, A20 bit clearing above 2 MiB and explicit RAM bounds;
- stable event ordering and rejected duplicate/invalid event identities;
- generation invalidation of a delayed callback after reset;
- exact seven-byte original diagnostic and SHA-256, including mutation rejection.

The reference BigInt arithmetic is deliberately simple, not the future hot path.
The original seven checks remain unchanged. The current CI job is named
**foundation-contracts**; it now also runs the added Node execution and device
tests, but its name is not a claim of broad emulator conformance. See
[SUPPORT.md](SUPPORT.md) for implementation and browser evidence boundaries.

## Required as implementation lands

| Stage | Positive checks | Negative/edge checks |
|---|---|---|
| First execution | actual fixture emits one `4b`; 4 retired instructions then halted; repeat reset/step | changed immediate changes actual output; unknown opcode/prefix and absent port stop; no extra retirement while halted or automatically paused; explicit single-step retires exactly one |
| Instruction core | independent per-instruction vectors; differential oracle with version/options; every supported width/form | carry/borrow/overflow/AF/PF; preserved and undefined flags; zero/masked shifts; decode truncation and 15-byte limit; divide faults; segment and cross-map edges |
| Scheduler | same state/trace with host batches 1, 7, 1000; replay logged inputs | same-tick order; automatic pause consumes no events; reset rejects delayed old callbacks; IRQ wake behavior when introduced |
| Disks | same base+revision reopens; export byte comparison; committed overlay survives reset | identical names/different hashes; geometry mismatch; OOB sectors; quota/abort/mid-write failures; reload during write; stale writer and schema migration |
| PC/486 | lawful reproducible guest output; descriptor/paging/interrupt traces | guest fault vs unsupported distinction; fault restart and REP partial progress; privilege and page-boundary writes |
| Browser/audio | run/pause/step/reset; keyboard focus; gesture resume; clean repeated sessions | blocked autoplay, hidden tab, context close race, stale worker output, resource growth, persistence denied/evicted |

Compare only architecturally defined outputs. An independent oracle must not import
the same helper being tested. Store a counterexample as a fixture when fixing a bug;
record expected and actual observations, not only a boolean. Randomized tests use
recorded seeds; include deterministic boundary cases even when fuzzing is available.

## PR receipt

State commit/tree, profile, runner/browser versions, commands, passed/failed/unrun,
fixture hashes and limitations. Check actual emulator imports when claiming emulator
coverage. CI checks the PR commit/merge ref; report which was run. Never call manual
inspection, fixture hashing or reference-unit coverage a successful boot.

## Reference and push-check hardening

`orderedEvents` snapshots an iterable once before validation and ordering, so a
one-shot iterator is not exhausted during validation. The reference generation
guard checks only at callback entry: await asynchronous work first, then guard a
synchronous commit. It cannot cancel a callback that has already started.

For push events CI checks both the net tree delta and each newly introduced commit
against its first parent. A rewind therefore cannot silently restore whitespace;
an intermediate bad commit is also checked even if a later commit fixes it. If
the previous tip is missing (for example, a new branch or an unavailable
force-push tip), CI checks the entire resulting tree against the empty tree. This
fallback checks only the final snapshot; it cannot establish whether individual
introduced commits are whitespace-free. Deleted refs skip the job. Pull requests
continue to check their merge-ref delta.
