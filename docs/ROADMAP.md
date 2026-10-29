# Roadmap: earn each claim

| Milestone | Deliverable | Exit evidence |
|---|---|---|
| 0 — Foundation (this PR) | contracts, profile, original guest fixture | reference checks pass; independent review; no emulator claim |
| 1 — First real execution | diagnostic-real-v1 decoder, bus, output device, static UI | exact guest emits `K`, HLT; step/reset repeat; unsupported bytes stop; no hardcoded output |
| 2 — Real-mode core | incrementally published instruction/addressing matrix | independent vectors and differential tests, flags masking, segment edges, instruction-fetch failures |
| 3 — Platform and disks | selected PC map/devices, read-only base + overlays, lawful boot path | device order/IRQ tests, disk failure/reload/reset isolation, reproducible boot guest |
| 4 — 486 architectural expansion | exact CPU variant, protected mode, exceptions/paging, declared extensions | descriptor/privilege/page-fault and restart tests, trusted differential oracle, profile-specific guest suite |
| 5 — Audio and usability | lifecycle-safe retro audio, inspectable performance | reset/pause/restart/gesture tests; bounded resources; approximation visibly labeled |

Stages may overlap only where dependencies are explicit. Each PR should improve a
working slice and add failure evidence. Debugging aids, assemblers, generators,
reference models and differential tools are welcome when their purpose and versions
are recorded; the static shipped runtime remains minimal. Do not write an enormous
CPU before validating the first guest. Do not optimize away determinism to win an
unqualified benchmark. Compatibility claims name the tested guest/profile/version.
