# 486

A browser-based retro PC diagnostic lab built with HTML, CSS and JavaScript. It
executes original guest instructions in a small, direct-loaded real-mode subset;
an opt-in core experiment also executes a tiny reset-vector ROM diagnostic. It is
not a bootable PC, BIOS, DOS or game emulator.

Serve the repository over HTTP or HTTPS and open `index.html`. Choose a diagnostic,
then use Run, Pause, Step and Reset. The optional reset ROM diagnostic jumps
from the 486-style reset vector and emits `R`; it does not boot a disk. The
computation guest sums an array through
a loop and subroutine; another guest loads its own data segments. The keyboard
guest echoes printable ASCII
when its display has focus. The disk guest exercises a tiny lab-only disk protocol;
use **Save overlay** to commit staged guest writes and **Export image** to download
the committed snapshot. Disk imports and storage remain local to the browser.

- [Get started](GETTING_STARTED.md) · [Support matrix](docs/SUPPORT.md)
- [Architecture](docs/ARCHITECTURE.md) · [Invariants](docs/INVARIANTS.md)
- [Reset experiment](docs/RESET_PROFILE.md) · [Compute profile](docs/COMPUTE_PROFILE.md) · [Segment profile](docs/SEGMENT_PROFILE.md) · [Text profile](docs/TEXT_PROFILE.md) · [Disk profile](docs/DISK_PROFILE.md)
- [Test plan](docs/TEST_PLAN.md) · [Assets and rights](docs/ASSETS_AND_RIGHTS.md)

Inspired by [e486-web](https://github.com/jandej/e486-web); no upstream source or
binary assets are imported. Project code is [Apache-2.0](LICENSE).
