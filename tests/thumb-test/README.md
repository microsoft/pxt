# thumb-test

Compiles PXT TypeScript programs to native ARM Thumb in-process and asserts on
the generated assembly listing.

    gulp testthumb      # also part of gulp test

Runs offline, no C++ toolchain needed: the whole native path -- emitter,
register allocation, peephole, Thumb assembler -- runs in-process.

Catches: which helpers, thunks and dispatch sequences codegen chose; invalid
instruction streams (the assembler fails the compile); silent code-size
swings. Cannot catch: runtime behavior -- nothing executes here, that is
`tests/hw-ab/` -- and multi-variant packaging (the universal-hex combiner is
not loaded; output is single-variant).

## How it works

Native compilation needs `opts.extinfo.hexinfo`; here it comes from a fixture:
`fixtures/microbit-mbcodal.json.gz` is a gzipped `CompileOptions` environment
captured from a real native micro:bit build (the mbcodal / V2 variant), holding
`target`, `extinfo` (with `hexinfo`), `fileSystem` (all dependency TS sources),
`sourceFiles` and `jres`.

For each case program the runner parses a fresh copy of the fixture,
substitutes the case text as `main.ts` in `fileSystem`, forces
`target.isNative`, `target.nativeType = "thumb"` and `target.switches.size`,
then calls `pxtc.compile`. The result must succeed, and the listing in
`res.outfiles["binary.asm"]` is handed to the case's expectation function.

Compile success is itself a meaningful assertion: the in-process assembler
turns invalid instructions and stack imbalances into code-9200 diagnostics.

## Adding a case

1. Drop a `.ts` program in `cases/`. Use core language constructs only --
   classes, interfaces, strings, arrays, maps, arithmetic. Avoid event loops and
   device APIs; the program must terminate. Feed every value into a module-level
   accumulator so the optimizer cannot drop the code under test.
2. Add an entry keyed by the file name to `asmChecks` in `asmchecks.ts`. A case
   with no entry fails, so an expectation is never accidentally omitted.

Helpers available to expectations: `hasLabel`, `mentions`, `countMatches`,
`codeSize`, `hexSize`, `assertAbsent`, `assertNoMatch`, `assertAtLeast`,
`assertWithin`.

Size assertions use `codeSize`, which reads the generated-code byte count from
the size stats header. That number tracks codegen; `hexSize` is dominated by the
fixed runtime image and moves very little, so it is only useful as a
sanity check.

## Regenerating the fixture

The fixture is a self-consistent snapshot; it does not track pxt-microbit
releases, and a target version bump alone does not require regeneration.
Regenerate only when:

- the compiler emits calls to a runtime function the snapshot does not carry
  (fails loudly at hex setup with the missing function name)
- the shape of `CompileOptions`/`extinfo` consumed by `pxtc.compile` changes
  (fails loudly when the replayed options are rejected)
- a test case needs core APIs or runtime behavior newer than the snapshot

Codegen changes in this repo never require it: the current compiler always
runs against the fixture, so compiler changes are exercised regardless of the
fixture's age. The `meta` block inside the fixture records the capture date,
target version and extinfo sha for diagnosis.

Requires a sibling `pxt-microbit` checkout that is npm-linked to this one
(`node_modules/pxt-core -> ../../pxt`) and has a populated `built/hexcache/`.

    npm run build
    node tests/thumb-test/scripts/capture-fixture.js

Set `PXT_TARGET_DIR` to capture from a checkout that is not the sibling
`../pxt-microbit`.

If the capture build fails with `Package not installed: <name>`, the target's
`upgrades` rules injected a dependency into the scratch project. The script
guards against this by stamping the current target version into the scratch
`pxt.json` (`targetVersions.target`), which gates off rules aimed at older
projects; a rule not gated on version would need a matching dependency added to
`makeScratchProject`.

The script creates a scratch project under
`<target>/projects/thumb-fixture`, loads the compiled CLI bundle
(`built/pxt.js`), patches `ts.pxtc.compile` to intercept the options the CLI
assembles, and drives the CLI's own `build` command with
`PXT_COMPILE_SWITCHES=csv---mbcodal` (a variant selector, not a real switch)
to pin the single mbcodal variant. The hex runtime is resolved from
`built/hexcache/`, so nothing is downloaded or compiled in C++. The script
prints the fixture path and size, and drops `extinfo.compileData`,
`generatedFiles`, `extensionFiles` and `otherMultiVariants`, none of which
`pxtc.compile` reads.

## Coverage

This layer is the middle of three that cover condition compilation and
interface dispatch. The coverage map for all of them -- which failure mode is
caught where, what each case program and each semantic test file exercises, and
where a new test belongs -- is
`tests/compile-test/lang-test0/README-codegen.md`. Read it before adding a case
here: some things belong in the JS-executed layer (`gulp testlang`) or on
hardware (`tests/hw-ab/`) instead, and it also lists what none of the layers
cover.
