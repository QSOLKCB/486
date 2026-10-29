# Support and evidence

The direct-loader lab is an early diagnostic subset. It does not claim an i486
hardware reset, a boot sector, BIOS, DOS, VGA, ATA, floppy, or game compatibility.
No CPU exception, protected mode, paging, x87, JIT, audio, interrupts, DMA, cycle
accuracy or equivalent MHz is implemented. A retired instruction is one virtual
scheduling tick, not a hardware cycle.

| Profile | Implemented behavior | Evidence and limits |
|---|---|---|
| `diagnostic-real-v1` | 2 MiB RAM, A20 enabled, `0000:7c00` loader; MOV DX/AL immediate, OUT DX,AL, HLT; lab port E9 | Original seven-byte guest emits `K` then halts; a changed immediate changes actual output. Unsupported encodings and unmapped accesses stop diagnostically. |
| `diagnostic-compute-v1` | A bounded 8/16-bit arithmetic, 16-bit addressing and near-subroutine instruction slice | Original guest sums four data bytes via a loop and CALL/RET, preserving registers on the SS stack and emitting `F`. Mutating input changes the output. See the [exact matrix](COMPUTE_PROFILE.md). |
| `diagnostic-segments-v1` | Adds guest DS/ES MOV and four segment overrides to the compute slice | Original guest loads DS and ES, uses DS, ES and SS, emits `V`; selected input mutation changes the output. [Exact encodings and diagnostic limits](SEGMENT_PROFILE.md). |
| `diagnostic-text-v1` | Adds a limited instruction subset, 80×25 character/attribute RAM at B8000h, and lab keyboard ports | Original guest polls the FIFO and writes characters and attributes through executed instructions. Printable ASCII only. This is not VGA or an emulated PC keyboard controller. See [profile](TEXT_PROFILE.md). |
| `diagnostic-disk-v1` | Adds lab disk ports, a synthetic 16-byte-sector image, staged overlay and explicit IndexedDB save/export | On a fresh test image the guest reads `A`, stages `Z`, rereads it and emits `AZ`; after committing, later runs read `Z` first. Node failure tests use a transactional test double; Chromium also passed an actual save, reload and export check. See [profile](DISK_PROFILE.md). |

The UI offers run, pause, single-step, reset, registers, instruction trace, local
import, explicit save and committed-image export. A save is reported committed only
after transaction completion. Base identity uses SHA-256 and byte length, not the
filename. A reset discards uncommitted changes and retains committed revisions.
Browser storage can be denied or evicted. Imported images must be 16–4096 bytes,
a multiple of 16; they are interpreted as lab data, never uploaded or executed as
host code. These are intentionally not general PC disk images.

The reference suite checks its own mathematical contracts; it is not a CPU
conformance suite. Additional Node tests exercise the implemented CPU, device and
lifecycle paths, including batch replay and simulated failed saves. A headless Chromium 153.0.8010.0 run exercised controls, focused input, reload,
committed export, malformed imports and `/486/` hosting with no console or page
errors. This is evidence for that browser and workload, not broad browser or x86
conformance. Firefox and actual browser quota/abort injection remain unverified;
the corresponding failure and race tests use a store double.

The compute profile is a new opt-in slice and does not expand the historical profiles.
Its tested boundaries, unsupported forms and optional independent host-x86 oracle are
described in [COMPUTE_PROFILE.md](COMPUTE_PROFILE.md) and
[the oracle recipe](../tools/native-oracle/README.md).

The segment profile uses independent fixed address vectors in executor tests;
these vectors do not import CPU decoding helpers. Its existing inherited
sequential-IP wrap is a lab convention and differs from the documented 486
segment-limit fault. Full exception delivery and complete 486 behavior remain
unimplemented; see [SEGMENT_PROFILE.md](SEGMENT_PROFILE.md).
