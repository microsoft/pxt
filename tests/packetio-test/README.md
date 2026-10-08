# Packet-I/O regression tests

Run `gulp testpacketio` from the PXT repository. The task rebuilds the shared
library before compiling/running tests, so it does not test stale runtime output.
It is also included in `gulp test`.

On Windows with Git Bash, the equivalent invocation is
`node node_modules/gulp/bin/gulp.js testpacketio` if an auto-detected VS Code Gulp
task misquotes the Windows executable path.

## Coverage

- [webusb.spec.ts](webusb.spec.ts): device selection, mode identity, native setup
  cancellation, failed claims, configuration/alternate selection, stale reads,
  complete disposal, and the bulk/control DAP contract.
- [hf2.spec.ts](hf2.spec.ts): request/reply serialization, frame resets, retry
  ownership, real WebUSB/HF2 composition, app/bootloader transitions, UF2
  validation, partial-flash selection, cancellation and fast-path command counts.
- [lifecycle.spec.ts](lifecycle.spec.ts): asynchronous wrapper creation/disposal
  races and cleanup after errors.
- [deploy.spec.ts](deploy.spec.ts): retries, timeout teardown, loading state,
  pairing cycles, foreground reconnect deferral and service-worker ownership.
- [microbit.spec.ts](microbit.spec.ts): optional sibling-target integration using
  the actual micro:bit DAP wrapper. The sibling checkout is discovered by default;
  `PXT_MICROBIT_PATH` can point to another checkout. These six tests are explicitly
  skipped when that repository is absent; core transport tests still run.

[testUtils.ts](testUtils.ts) supplies isolated runtime contexts, native USB fakes,
an HF2 firmware model and a manually advanced clock. No physical USB permissions,
browser user prompts, network service or wall-clock retry sleeps are required.

The 512 KiB mock-image regression asserts one final readiness command, no full
image read-back, bounded progress updates and no artificial per-page delays. It
measures algorithmic command overhead, **not physical throughput**.

See the [reliability review](../../docs/webusb-reliability.md) for individual fixes,
compatibility limits and the physical-device validation checklist.