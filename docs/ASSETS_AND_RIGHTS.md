# Assets and rights

The root Apache-2.0 LICENSE is preserved. New project-authored contracts, docs and
`fixtures/diagnostics/hello.json` are offered under that project license. The fixture
was written for this repository; it contains no third-party ROM/OS/game bytes.
It is a flat diagnostic loaded at 0000:7c00, **not** a BIOS or bootable disk image.

[e486-web](https://github.com/jandej/e486-web) is inspiration only. Do not treat a
package metadata license string as clearance for its source, BIOS/VGA BIOS, DOS,
games or audio assets. None are imported here. Its audio/compatibility descriptions
are not evidence that this project emulates OPL3 or a full 486.

Before admitting any external artifact, record origin URL, author, version/commit,
license text and redistribution permission, exact SHA-256/length, build recipe/tool
versions and modifications in an asset manifest. Separate code and bundled-data
rights. Unknown rights means do not redistribute; user-local imports still need
safe parsing and must not be silently uploaded or committed. Disk contents are
untrusted data, never host JavaScript. Retain historical receipts; do not overwrite
old expected results to hide a changed implementation.

## Technical references (not imported assets)

- [Intel i486 Programmer's Reference Manual, 1990 (Intel-authored scan)](https://bitsavers.trailing-edge.com/components/intel/80486/i486_Processor_Programmers_Reference_Manual_1990.pdf): consult instruction-specific flags and real/protected-mode semantics. Pin applicable sections with each implementation PR.
- [Intel486 hardware reference collection, January 1995](https://bitsavers.org/components/intel/80486/241731-002_Intel486_Microprocessors_and_Related_Products_Jan95.pdf): CPU/bus details; board behavior still needs a selected chipset profile.
- [Intel SDM index](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html): useful supplemental instruction reference, not permission to implement post-486 behavior as a 486.
- [ECMAScript Number and BigInt](https://tc39.es/ecma262/#sec-numeric-types): host arithmetic semantics.
- [IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction): completion/abort and durability limitations.
- [AudioContext close](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/close): releasing host resources also requires dropping references.

These links are research starting points, not claims of full manual coverage or
formal verification. Browser/runtime documentation cannot establish x86 semantics.

## Original text diagnostic

`fixtures/diagnostics/echo.mjs` and `echo.json` are project-authored and licensed
under Apache-2.0. Their 26 bytes are hand-encoded directly in the source; no assembler,
third-party font, ROM, or other asset is used. The recipe and SHA-256 are in the
versioned JSON receipt. Browser monospace rendering uses the user's available font.
