# Marked build-only parser

`marked.mjs` is the unmodified `lib/marked.esm.js` from Marked **17.0.5**,
[markedjs/marked](https://github.com/markedjs/marked/tree/v17.0.5), published
by MarkedJS and Christopher Jeffrey under the MIT license. The license is in
`LICENSE.md`; it permits redistribution with its copyright and permission notice.
This copy is for the Pages build only and is not included in the published site.

- File size: 41,661 bytes.
- SHA-256: `0b4487359ce6b85108708e7a532e1242a27f4718241e7b2de109ac6cd307d2dc`.
- Obtained from the Marked 17.0.5 npm package's `lib/marked.esm.js`; copied
  byte-for-byte to `marked.mjs` for Node's ESM loader. No build is required.
- Reproduce the vendor file from the package with Node 24.22.1: install the exact
  `marked@17.0.5` package in a temporary directory and copy `lib/marked.esm.js`.
  Verify its size and SHA-256 before use. Marked's own upstream build is outside
  this project's build recipe.
