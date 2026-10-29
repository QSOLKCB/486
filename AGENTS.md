# Engineering instructions

- Read `docs/ARCHITECTURE.md`, `docs/INVARIANTS.md`, and `docs/HANDOFF.md` first.
- Build a static HTML/CSS/vanilla-JS app; CPU correctness before devices or polish.
  No dependency, framework, remote service or build pipeline without a concrete need.
- Implement one observable vertical slice at a time. Do not build a pretend CPU to
  satisfy reference checks. Add emulator-facing tests when an emulator exists.
- Every supported instruction needs width, operand/address-size, flags, fault and
  side-effect expectations. Undefined flags are not golden values.
- Unknown/unimplemented operations stop with context; never silently act as NOP.
- Preserve original disk bytes and existing historical fixtures. Validate identity
  and commit overlays transactionally. Never report durable saves before completion.
- No unreviewed ROM, BIOS, DOS, game, font or music imports. Record source, rights,
  version, hash and reproduction recipe before adding an asset.
- Keep claims honest: document unsupported features and distinguish reference tests,
  emulator conformance, browser integration and guest compatibility results.
- Run `node --test` and `git diff --check`; add applicable new checks. Report passed,
  failed and unrun separately, with exact commit and test environment.
- Keep README short; detailed evidence belongs in `docs/`. Change contracts with
  an explanation and a regression test, not by weakening expected results.
- Publish work as a draft PR unless explicitly instructed otherwise. No automatic
  merge, deployment, release, scheduled workflows or unrelated repository changes.
