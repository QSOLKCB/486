# Get started

Use Node.js **24.22.1** (also pinned in `.node-version`). No npm install, bundler,
assembler, browser, or network is required to run the checks:

```sh
node --test
```

The harness is in `contracts/`; tests are in `tests/`. It is a reference/specification
layer, not the eventual emulator. `fixtures/diagnostics/hello.json` contains an
original, source-described seven-byte guest program. Tests verify its exact bytes
and digest; they do **not** execute it. No browser app or bootable disk exists yet.

Read `AGENTS.md`, then `docs/HANDOFF.md` before implementing. The first useful app
will run this guest through a real decoder and expose run, pause, step and reset.
Serve that future app over local HTTP; Node is development tooling only, never a
production runtime dependency. Do not add a server or package manager merely to
serve this foundation.
