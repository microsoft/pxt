# Codegen test corpus: conditions and interface dispatch

Tests for how the compiler lowers boolean conditions and dynamic member access
(interface-typed, structural, `any`). Three layers; each catches what the one
before structurally cannot:

| layer | run | catches |
| --- | --- | --- |
| JS-executed semantics | `gulp testlang` | wrong answers. The corpus files in this directory are compiled and *run* on the simulator backend -- and condition lowering changes the JS backend too, so this is real coverage, not a stand-in for native |
| native assembly shape | `gulp testthumb` | which sequences codegen chose, unencodable instructions, large size swings. Nothing executes, so no wrong answer is visible here |
| on-device A/B + soak | `npm run hwab` (see `tests/hw-ab/README.md`) | the real allocator, real GC, real panics, leaks over time |

The coverage matrix below is the index: failure mode -> covering test -> layer
-> what the failure looks like when it fires.

The corpus is sized for two optimization families:

- **Boolean condition lowering.** Conditions lower to short-circuit jumps that
  yield a raw 0/1 rather than a tagged value materialized and then narrowed,
  with Thumb fast-path helpers taking over the common truthiness tests from a
  runtime call.
- **Interface dispatch specialization.** Count-gated checked-field-load
  helpers, shared interface-call thunks, object-literal store specialization,
  vtable wrapper-skip for calls whose arity already matches, and a typed
  index-signature store fast path.

## Coverage matrix

| Failure mode | Covered by | Layers | How it presents |
| --- | --- | --- | --- |
| Truthiness divergence between a fast path and the runtime's own `toBool` (`-0`, `NaN`, boxed zero, `""` vs `"0"`, `[]`, `{}`, functions) | `54conditiontruthiness.ts`, whole `check()` matrix plus the `--- falsy ---` / `--- truthy ---` case list | testlang, hw-ab | `assertion failed: if:<case>` / `ternary:<case>` / `while:<case>` / `bangbang:<case>`, where `<case>` names the value (`negzero`, `nan`, `boxedzero`, `str0`, `emptyarr`, ...) |
| Statically typed operand and boxed `any` operand disagreeing at the same construct | `54conditiontruthiness.ts`, the `typed:` block; every matrix value additionally arrives through `opaque()` as an `any` | testlang, hw-ab | `typed:emptystr`, `typed:zero`, `typed:nullarr`, `typed:emptyarr` |
| Raw 0/1 form leaking out of a condition instead of round-tripping to a tagged boolean | `54conditiontruthiness.ts` `roundtrip:` block; `55conditionlowering.ts` `testValuePosition` `vp:rt1`, `vp:rt2`, `vp:rtany` | testlang, hw-ab | `roundtrip:true`, `roundtrip:cond`, `vp:rtany`; also `bangbangtype:<case>` and `vp:bangtype` when `typeof` stops saying `boolean` |
| Short-circuit order or operand count changing (`&&`, `\|\|`, `!`, nesting, 3- and 4-operand chains, mixed precedence) | `55conditionlowering.ts` `testShortCircuit`, which records a left-to-right trace in `lg` | testlang, hw-ab | `sc:and:short`, `sc:group1`, `sc:notand1`, `sc:and3short`, `sc:or3short`, `sc:and4`, `sc:mixed1` |
| Value position confused with condition position -- `\|\|`/`&&` yielding a truth value where the operand itself is required | `55conditionlowering.ts` `testValuePosition`; the condition-position complement is in `54conditiontruthiness.ts` (`and1:`, `and0:`, `or0:`, `or1:`) | testlang, hw-ab | `vp:orstr`, `vp:andnum`, `vp:andnocall`, `vp:ornum` |
| Conditions inside constructs other than plain `if` (else-if chains, `while`, `do..while`, `for` header, nested ternaries, switch on a computed scrutinee) | `55conditionlowering.ts` `testConstructs` and `testSwitch` | testlang, hw-ab | `cc:if*`, `cc:while`, `cc:dowhile2`, `cc:for`, `cc:tern*`, `sw:s*`, `sw:n*`, `sw:c*`, `sw:b*` |
| Comparisons feeding logical operators, including string relational comparisons and `length` used directly as a condition | `55conditionlowering.ts` `testComparisons` | testlang, hw-ab | `cmp:1`..`cmp:6`, `cmp:str1`..`cmp:str4`, `cmp:len0`, `cmp:lenchain` |
| Reference imbalance on an operand consumed by a condition (allocation in a loop header, re-evaluated every iteration) | `55conditionlowering.ts` `testFreshOperands` -- string concatenation, array literal, `slice`, object literal and ternary operands all built inside the header | testlang (wrong final state), hw-ab (allocator/GC failure) | `fresh:concat`, `fresh:arrlit`, `fresh:slicelen`, `fresh:obj`, `fresh:strcmp`, `fresh:tern`; on device, a memory panic instead of an assert |
| A condition abandoned part way through by an exception, and conditions used again after the stack unwinds | `55conditionlowering.ts` `testExceptionsInConditions` | testlang, hw-ab | `exn:right`, `exn:left`, `exn:and`, `exn:andshort`, `exn:after`, `exn:loop`; the message carries the actual trace, e.g. `exn:right t!c` |
| Threshold miscounting in a count-gated specialization -- members just below and just above the gate behaving differently | `56ifacedispatch.ts` `testThresholds` (`qzLo` 2 sites vs `qzHi` 5+, `qzFew` 4 reads vs `qzMany` 6+) and `testStores` (`qzRare` 2 stores vs `qzHot` 4) | testlang, hw-ab | `th:lo1`, `th:hi1`..`th:hi5`, `th:few*`, `th:many*`, `th:agree`, `st:rare`, `st:hot` |
| The same miscounting for the checked-field-load gate, which counts per class field rather than per interface member and so is not reachable from the semantic layer | `tests/thumb-test/cases/fieldbaseline.ts`, one class whose `qzTally` is read above the gate and `qzSpare` below it, with `asmchecks.ts` counting the inline checked-load sequences by field offset | testthumb | `expected at least 6 inline checked loads of qzTally, found N`, or `listing unexpectedly contains N checked-field-load thunks (ldfldchk_)` |
| Arity holes in wrapper-skip -- one member name declared at two arities by two unrelated interfaces | `56ifacedispatch.ts` `testArityCollision`, with the two dispatches interleaved in a loop so neither can be hoisted | testlang, hw-ab | `ar:one1`, `ar:two1`, `ar:mixed` |
| A missing trailing argument on a dynamic call (the documented default-parameter constraint) | `56ifacedispatch.ts` `testDefaults` | testlang, hw-ab | `opt:concrete`, `opt:dynagree`, `opt:safe1`..`opt:safe4`, `opt:iface2`, `opt:any2` |
| Get and call sharing a dispatch bucket -- one member name that is a field on one type and a method on another | `56ifacedispatch.ts` `testGetCallCollision`, through both interface-typed and `any`-typed references | testlang, hw-ab | `gc:get1`, `gc:call1`, `gc:agree`, `gc:get2`, `gc:call2`, `gc:type` |
| `toString` fixed-slot violation -- an override not reached through concatenation, templates, direct call, interface or `any` | `56ifacedispatch.ts` `testToString`; also present in `tests/thumb-test/cases/ifacebaseline.ts` | testlang, testthumb (shape), hw-ab | `ts:concat`, `ts:template`, `ts:iface`, `ts:any`, `ts:anyconcat` |
| Polymorphic call site confused between class instances and object literals (maps) | `56ifacedispatch.ts` `testPolymorphic` -- one call site `useQzVal` fed both, plus a mixed array iterated twice | testlang, hw-ab | `poly:class`, `poly:literal`, `poly:elem0`..`poly:elem3`, `poly:total` |
| Index-signature store fast path misrouting -- a declared field reached through `{ [k: string]: number }`, versus a real map | `56ifacedispatch.ts` `testStores` (`st:idx:*` against a class instance, `st:grow*` against a run-time-keyed map); also in `ifacebaseline.ts` | testlang, testthumb (shape), hw-ab | `st:idx:literal`, `st:idx:class:set`, `st:idx:class:rmw`, `st:grow0`, `st:growsum` |
| Stores and accessor calls through interface-typed references, including inherited fields and `super` | `56ifacedispatch.ts` `testStores` | testlang, hw-ab | `st:prop:class`, `st:acc:set`, `st:acc:rmw`, `st:inh:ifaceset`, `st:super:iface`, `st:base:call` |
| Dynamic member get on an `any`, by dot, by string literal and by computed key | `56ifacedispatch.ts` `testDynamicGet` | testlang, hw-ab | `dg:dot`, `dg:literal`, `dg:computed`, `dg:missing`, `dg:inst1`..`dg:inst3`, `dg:instcall` |
| Silent optimization loss -- an expected helper, thunk or dispatch sequence quietly stops being emitted, or an unexpected one appears | `tests/thumb-test/cases/boolbaseline.ts`, `ifacebaseline.ts` and `fieldbaseline.ts`, whose entries in `asmchecks.ts` name the exact helpers that must and must not appear | testthumb | chai failure from `assertAtLeast` / `assertAbsent` / `assertNoMatch`, e.g. `expected at least 12 calls to numops::toBoolDecr, found 0` or `listing unexpectedly mentions _pxt_map_set_by_string` |
| Large silent swing in generated code size | `tests/thumb-test/cases/sizebaseline.ts` via `codeSize` and `assertWithin` | testthumb | `generated code size is N, outside the band lo..hi` |
| Invalid Thumb emission -- an unencodable instruction or a stack imbalance | Every thumb-test case, plus every semantic file registered in `externalCases` in `asmchecks.ts`, compiled natively with the lang-test0 prelude | testthumb | `native compile of <file> failed:` followed by the code-9200 diagnostics from the in-process assembler |

## Per-file summaries

### `54conditiontruthiness.ts`

A value-by-value truthiness matrix. `check()` pushes a single value through
every construct that lowers to a condition -- `if`, `if (!v)`, if/else, the
conditional expression, `while`, `do..while`, a `for` header, condition-position
`&&` and `||`, and single and double negation -- and asserts the outcome of
each. The falsy set is pinned to exactly what the runtime treats as false:
`false`, zero in any representation (including `-0` and a boxed double zero),
`null`, `undefined`, `NaN` and `""`; everything else is truthy, including
`"0"`, `" "`, `"false"`, `[]`, `{}` and function values. Every value reaches its
test site through an `any`-typed identity call, so the operand is opaque and no
condition can be folded at compile time. Floating-point-only values (boxed
zero, fractions) are gated on `hasFloat`, and a `casecount` assert pins the
matrix size per target so a case cannot silently disappear. A closing block
re-runs the same values through statically typed locals and round-trips a
boolean through a call, which is where a raw 0/1 form that failed to become a
tagged boolean shows up.

### `55conditionlowering.ts`

Structural semantics rather than truth values. Operand functions `A`..`D`
append to a module-level trace string, so each assertion pins the exact
left-to-right evaluation order and operand count of a condition -- including
nested groups, negation wrapped around a chain, three- and four-operand chains,
and `&&` binding tighter than `||`. A separate section contrasts condition
position with value position, where `&&` and `||` must yield an operand rather
than a truth value. `testFreshOperands` allocates the operand inside the loop
header on every iteration (string concatenation, array literals, `slice`,
object literals) and runs the loops for hundreds of iterations, so a
reference-count imbalance on the condition path surfaces as a wrong final state
or an allocator failure rather than as a wrong first iteration.
`testExceptionsInConditions` throws from either operand of `&&` and `||` and
from inside a loop header, asserting both the partial trace and that conditions
still behave once the stack has unwound. `testSwitch` uses computed scrutinees
and a condition result as the scrutinee so nothing resolves statically.

### `56ifacedispatch.ts`

Dynamic member get, set and call through interface-typed, structurally typed
and `any`-typed references. Interface member ids are global by name across a
whole program and some specializations are gated on how many static sites a
member has, so every member here carries a `qz` prefix that is unique to this
file, and the threshold-straddling members are counted deliberately: `qzLo`,
`qzFew` and `qzRare` sit below their gates while `qzHi`, `qzMany` and `qzHot`
sit above, and both sides must behave identically. The remaining sections
isolate one dispatch hazard each: the same method through concrete, interface
and `any` references; one member name at two arities in two unrelated
interfaces; one member name that is a field on one type and a method on
another; a method reached through a lambda and through a higher-order call; a
single call site fed both class instances and object literals; a `toString`
override reached five different ways; stores through property signatures,
accessors, inherited fields, `super`, a run-time-keyed map and a typed index
signature over both a literal and a class instance; and dynamic gets by dot, by
string literal and by computed key. One constraint is documented in the file
rather than asserted away: the emitter fills a defaulted argument in at the
call site from the statically known signature, so through an interface- or
`any`-typed reference there is no signature and the callee's own default does
not apply. `testDefaults` therefore asserts that the interface and `any` paths
agree with each other, and that a callee written to test for `undefined` works
on every path.

`57defaultparamdispatch.ts` is the minimal standalone repro of that defect: a
two-line block marked REPRO is commented out so the suite stays green, and
uncommenting it makes `gulp testlang` fail with `qzdp:iface` -- a ready-made
red test for whoever picks the fix up. The file's active assertions pin the
parts that must hold either way.

### `tests/thumb-test/cases/boolbaseline.ts`

A small program that drives conditions in `if` and `while` headers, `&&`, `||`
and `!` over numbers, booleans, strings and arrays, at enough distinct sites to
make a count assertion meaningful. Every value feeds a module-level accumulator
so no condition site can be dropped as unused. Its entry in `asmchecks.ts`
asserts on the shape of the resulting listing: how many test sites narrow their
operand through a `numops::toBoolDecr` call, and which condition-lowering
helpers appear in the listing. Nothing executes -- this is purely about which
sequence codegen chose.

### `tests/thumb-test/cases/ifacebaseline.ts`

The dispatch counterpart. Two classes implement one interface; the program does
repeated interface-typed reads of a single field, repeated interface-dispatched
calls of a single method, repeated object-literal stores of a single key, an
overridden `toString`, and a typed index signature -- each repeated enough times
to cross a plausible count gate. Everything feeds a module-level accumulator.
Its `asmchecks.ts` entry asserts both on the generic map runtime entries the
program reaches and on the presence or absence of the specialized forms:
checked-field-load thunks, interface-call thunks, specialized map-store thunks,
`_iface` proc labels and the by-string map-set helper.

### `tests/thumb-test/cases/fieldbaseline.ts`

The field-access counterpart, and the only case that reaches the checked field
load path at all: `ifacebaseline.ts`'s field reads have interface-typed
receivers, so they lower to interface dispatch instead. A field read is checked
whenever its receiver is not `this`, so this program keeps every receiver in a
class-typed variable or parameter and reads `qzTally` at six static sites and
`qzSpare` at four, straddling the count gate that decides whether the checked
sequence is hoisted into a per-field thunk. Both fields live on one class that
implements no interface and has no subclass -- an overridden field is treated as
slow and routed through interface dispatch, which would take the reads out of
the path this case exists to pin. Its `asmchecks.ts` entry counts the inline
validate-then-load sequences separately per field, by the load offset, and
asserts the thunk form is absent.

### `tests/thumb-test/cases/sizebaseline.ts`

A fixed dispatch-heavy program -- an interface with three implementations
driven through a loop, string building, a string-keyed counter map and an array
sort -- whose emitted code size is tracked with a wide percentage band via
`codeSize` and `assertWithin`. The band is deliberately wide: it is there to
catch large silent swings in either direction, not to turn every codegen tweak
into a test edit. This program must stay stable, since changing it invalidates
the recorded baseline.

## How to run

The layer table at the top: `gulp testlang` and `gulp testthumb` (both in
`gulp test`), and `tests/hw-ab/README.md` for hardware.

## Extending this corpus

Where a new test belongs:

- **A behavior that can be observed by running the program.** A new file in
  this directory, named `NNname.ts`. It is picked up automatically by
  `compilerunner.ts`, which compiles it as `main.ts` together with the
  `lang-test0.ts` prelude and runs it. Use `assert(cond, "prefix:id")` with a
  prefix unique to the section, since the assert id is the only thing a failure
  report carries.
- **A codegen shape that a running program cannot observe.** A new program in
  `tests/thumb-test/cases/` plus an entry keyed by its file name in
  `asmChecks`. A case with no entry fails, so an expectation is never
  accidentally omitted. Feed every value into a module-level accumulator or the
  optimizer will drop the code under test.
- **A semantic file that should also survive the native emitter.** Add its
  repo-relative path to `externalCases` in `asmchecks.ts`. Those entries are
  compiled with the lang-test0 prelude prepended but are not executed, so keep
  the expectation light -- the semantics are already covered by `gulp testlang`.
- **Anything that needs the real allocator, the real GC or a real panic.** The
  hardware layer; see `tests/hw-ab/README.md`.

Two rules that are easy to violate:

- **One program per case file.** Each file compiles as its own `main.ts`, and
  its top-level declarations share a scope with the prelude's globals (for
  lang-test0 files) or with the target's libraries (everywhere). Wrap the
  entire test in a namespace and call its `run()` at the end of the file, as
  `54`, `55` and `56` do. Do not merge two case programs into one file, and do
  not add bare top-level names.
- **Member-name call-site counts are program-wide.** Interface member ids are
  keyed by name across the whole program, target libraries included, so a
  member named `size` or `value` already has an unknown number of sites before
  your test adds any. A test that depends on sitting on a particular side of a
  count gate must use a name that occurs nowhere else -- hence the `qz` prefix
  in `56ifacedispatch.ts`. Adding one more use of such a name anywhere in the
  same file changes its count and can move it across the gate.

## Known gaps

Deliberately not covered by any layer in this corpus:

- **Asm shape for the semantic programs.** The semantic files are registered in
  `externalCases` only to prove they compile and assemble; the expectation is
  `codeSize(asm) > 0`. Their condition and dispatch shape is not pinned -- that
  is what the purpose-built baseline cases are for.
- **The VM / stack-machine backend.** `tests/thumb-test` pins
  `target.nativeType` to Thumb. Nothing asserts on the `backvm.ts` output for
  any of these programs.
- **Device-side GC stress.** `testFreshOperands` allocates in loop headers, but
  nothing forces a collection, applies memory pressure, or inspects heap growth.
  A reference imbalance is only visible indirectly, as a wrong final state or as
  an allocator failure that happens to occur.
- **Runtime speed.** These are performance optimizations, and no layer asserts a
  speedup. Generated code size (`sizebaseline.ts`) is the only quantitative
  signal in the offline layers.
- **Event handlers and concurrency.** The thumb-test cases must terminate and
  avoid event loops, and the lang-test0 files are straight-line programs.
  Conditions and dispatch inside event handlers or across fibers are not
  exercised offline.
- **Error paths on dynamic dispatch.** `dg:missing` reads an absent key and
  expects `undefined`, but nothing calls a member that does not exist, or
  stores through a reference of the wrong shape, to pin the failure behavior.
- **Accessors through an `any`-typed reference.** `56ifacedispatch.ts` reaches
  a getter/setter pair through an interface-typed reference (`st:acc:*`) but
  not through an `any`.
- **Multi-variant packaging.** The thumb layer produces single-variant output;
  the universal-hex combiner is not loaded. See `tests/thumb-test/README.md`.
