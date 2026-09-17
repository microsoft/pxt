# Arcade WebUSB reliability review

## Scope and speed

Arcade's application and bootloader use the same MCU. A download can either hand
USB directly to the bootloader or lose the application connection and enumerate
a bootloader device, sometimes requiring a second browser permission. The browser
must not mistake that transition for an unrelated disconnect/reconnect request.

The normal path **does not read back the flashed image**. It retains partial-flash
selection, adds one final `BININFO` readiness barrier after the page writes, and
performs one caller-owned reconnect after resetting into the application. The
barrier checks that the bootloader still responds after the final early write
acknowledgement; it is **not byte-for-byte flash verification**. There is no new
per-page sleep. Progress updates are limited to percentage changes.

Healthy USB operations return immediately. Longer deadlines apply only when a
transfer or mode transition is slow: five seconds for page replies, the final
barrier, OUT packets and individual native setup/close operations; a ten-second
HF2 reconnect retry window, with 500 ms between failed attempts. The reconnect
window is checked between attempts, so an already-started bounded native
operation can extend elapsed time past that window. The editor retains its
120-second overall deploy deadline and explicitly tears down the attempt when it
expires.

## Individual fixes

### USB selection and transport — [pxtlib/webusb.ts](../pxtlib/webusb.ts)

| # | Fix | Previous failure / improvement |
| --- | --- | --- |
| 1 | Preserve the browser picker's selected device. | Pairing previously discarded the selected object, allowing the next enumeration to open a different previously authorized board. |
| 2 | Retain device identity across reconnects. | A missing remembered serial previously caused a fixed delay followed by fallback to any enumerated device. The stack now waits/re-enumerates for the selected board instead of flashing another one. A different/absent serial after a mode change requires explicit selection. |
| 3 | Cancel an in-progress selection when the picker chooses a board. | If that board was already being opened, a failed claim could otherwise continue an old candidate list and open another board. |
| 4 | Apply vendor, product, serial and interface filters together. | Matching only interface class/subclass/protocol could choose an incompatible authorized device or react to an unrelated connect event. |
| 5 | Select actual configurations and alternate settings; validate endpoint directions. | Assuming configuration 1 and alternate 0, or retaining bulk endpoints for a control-only bootloader, could route transfers to the wrong pipe. |
| 6 | Serialize open/close and coalesce reentrant reconnect requests. | Concurrent lifecycle operations could close a newly opened connection. Ownership is published before callbacks can request another reconnect. |
| 7 | Clear readiness, interfaces, endpoints and pending reads when retiring a connection. | Disconnect previously left stale readiness/interface state behind. Both the UI and subsequent transfers now see the retired connection as disconnected. |
| 8 | Scope each HF2 read loop and transfer completion to its connection generation. | Old responses or errors could be delivered to a new wrapper/session. Retired reads now stop, including when native close never resolves a pending transfer. |
| 9 | Close failed initialization handles and dispose listeners/resources on every exit. | Failed claims and disposal could leak an open device, block a subsequent attempt/tab, or leave a reader running indefinitely. |
| 10 | Bound native setup and close operations; quarantine unfinished handles. | Waiting forever for open/claim/close could also block timeout cleanup. Late native completions are closed and cannot affect a replacement connection. |
| 11 | Respect `DataView` offsets/lengths and validate OUT byte counts. | Reading the entire backing buffer could include unrelated bytes. A short successful-status write could previously be treated as a complete command. |
| 12 | Retain one native IN request across a DAP recovery timeout; serialize reads. | A timed-out read must not consume a later reply while a second transfer waits forever. The timed-out operation remains collectible, without disconnecting micro:bit. Zero/omitted timeouts retain their existing unbounded semantics. |

### HF2 and flashing — [pxtlib/hf2.ts](../pxtlib/hf2.ts)

| # | Fix | Previous failure / improvement |
| --- | --- | --- |
| 13 | Serialize complete HF2 request/response exchanges, not only writes. | Overlapping commands could consume each other's replies and cause sequence errors. The protocol permits only one outstanding command. |
| 14 | Clear partial message frames and invalidate queued work on disconnect. | Fragment buffers survived reconnects and could be prepended to a new response. Old queued commands can no longer execute on a replacement session. |
| 15 | Validate frame, response, memory-read and `BININFO` lengths/geometry. | Truncated data could be interpreted as valid zero-filled protocol fields or flash metadata. Invalid packets now fail before further writes. |
| 16 | Bound stale-response skipping by the command's overall response deadline. | A fixed three-reply limit could reject otherwise recoverable late replies; independent waits could also repeatedly extend the operation. |
| 17 | Bound OUT packets and retire the session before releasing a timed-out sender. | A hung OUT request could outlive a reported timeout while queued serial/command data started against the same half-sent command. |
| 18 | Make reconnect single-flight, retry from fresh enumeration, and cancel retry continuations. | Duplicate retries could compete with each other; a manual disconnect could be undone by an older retry finishing later. |
| 19 | Give the active flash ownership of USB mode-transition events. | Device callbacks and automatic recovery could disconnect/reinitialize a bootloader underneath a running download. Unexpected read failures still invalidate protocol state and reject waiting work. |
| 20 | Handle acknowledged handover followed by re-enumeration. | `START_FLASH` success does not imply that the original USB connection remains usable. The stack now confirms bootloader mode and reconnects when required, with reset fallback for unsupported handover. |
| 21 | Reject missing/truncated UF2 output, skip metadata blocks, and check family/message capacity. | A partially parsed file, non-flash metadata, a different device family or an oversized message could previously reach the page-write loop. |
| 22 | Fall back from unsupported partial-checksum reads to full flashing only. | Optional `READ_WORDS` rejection should not prevent a compatible full download. Genuine disconnects and other errors still abort rather than being mistaken for unsupported optimization. |
| 23 | Add one final bootloader readiness barrier before application reset. | Bootloaders can acknowledge before physically writing. Waiting for a subsequent command avoids assuming that the last early ACK alone completes the operation, without image read-back overhead. |
| 24 | Preserve explicit reset failures and require application mode on reconnect. | A rejected reset could be swallowed, or reconnect could succeed to a board still in bootloader mode and be reported as a completed download. |
| 25 | Remove redundant reconnects and retain cleanup ownership until flashing ends. | `reflashAsync` previously reconnected internally even though its interface/callers already reconnect, and also unconditionally reopened the initial transport. Those extra connection cycles added latency and reset races. |
| 26 | Skip Jacdac probing in bootloader mode; preserve optional support in applications and HID bridge errors. | Bootloaders need no Jacdac configuration. Legacy firmware without it remains connectable; failed probes must not hide a retired connection. |
| 27 | Report normalized, throttled progress. | Arcade did not report HF2 progress. Updates now use the shared 0–1 contract and do not force a UI render for every page. |

### Wrapper and editor ownership

| # | Fix | Previous failure / improvement |
| --- | --- | --- |
| 28 | Serialize wrapper creation and disposal, including forced initialization — [pxtlib/packetio.ts](../pxtlib/packetio.ts). | Disconnect could miss an asynchronously created wrapper or a late finalizer could clear a newer wrapper. Disposal now runs even when disconnect fails. |
| 29 | Coalesce editor deploys and release finished ownership before fallback instructions — [cmds.ts](../webapp/src/cmds.ts). | Overlapping downloads could compete. Conversely, a fallback dialog's retry must not join the failed promise that is itself waiting for the dialog. |
| 30 | Cancel and settle the active attempt before fallback; normalize actual timeout errors — [cmds.ts](../webapp/src/cmds.ts). | Racing against a timeout alone does not stop writes. Late continuations could reconnect, update loading, or keep flashing after fallback began. Timeout strings and denied locks now take the correct error path. |
| 31 | Permit only one accepted bootloader permission repair — [cmds.ts](../webapp/src/cmds.ts). | Cancelling pairing previously recursed into another deploy, and repeated repair failures could keep reopening the dialog indefinitely. Pair-dialog errors now clean up and fall back as well. |
| 32 | Remove the reconnect/pairing promise cycle — [cmds.ts](../webapp/src/cmds.ts). | Pairing invoked from a failed reconnect could await that same reconnect while it awaited pairing. The failed promise is released before pairing starts. |
| 33 | Defer same-tab reconnect during a deployment, including DAP — [cmds.ts](../webapp/src/cmds.ts). | Foreground reconnect could replace micro:bit's DAP objects and reset its transport mid-download. HF2-specific guards alone do not protect the shared DAP path. |
| 34 | Acquire cross-tab ownership before deployment and retain it through bootloader permission repair — [cmds.ts](../webapp/src/cmds.ts). | Opening the device without the worker lock, or releasing it between application and bootloader permissions, let another tab interrupt the download. |
| 35 | Reject cancelled lock waiters, invalidate their late continuations and release late grants — [cmds.ts](../webapp/src/cmds.ts). | A cancelled request could leave every subsequent reconnect waiting forever, or acquire a lock after its caller had abandoned the operation. |
| 36 | Match lock releases/responses to their owner; withdraw cancelled waiters; reuse ownership scans — [serviceworker.ts](../webapp/src/serviceworker.ts). | Stale releases could free another tab's active device. Concurrent status scans could overwrite a newly granted owner. Repeat requests from the current owner now succeed without self-disconnection. |

## Automated validation

The [packet-I/O regression suite](../tests/packetio-test/README.md) uses fake native
USB devices, controllable failures and a deterministic clock. It tests the real
shared library, editor orchestration and service-worker code. Cross-layer tests
combine the real WebUSB transport and HF2 wrapper for both Arcade transitions.

When the sibling micro:bit checkout is available, integration tests also load its
actual DAP wrapper and exercise v1/DAL and v2/CODAL vendor flashing, control and
bulk transports, and stale-response recovery. Cortex register/memory hardware
operations are mocked; this is not physical-device testing or a complete DAPLink
firmware implementation.

The reviewed workspace passed 77 tests, the PXT build, changed-file lint,
Arcade/micro:bit editor type checks, and the micro:bit simulator type check.
Broader target-generation commands emitted diagnostics in untouched legacy
simulator parsing and tutorial/package metadata. A standalone sibling Arcade
simulator check also found duplicate dependency includes in its existing
configuration. Those diagnostics are outside this patch; a clean full-target
validation is not claimed. Generated target library changes were reverted.

## Hardware validation still required

- SAMD51 and STM32 Arcade boards: initial pairing from a game, bootloader-only
  pairing, direct handover and reset/re-enumeration; confirm the new game runs.
- Repeat full and partial downloads with serial output active; confirm recovery
  after application startup and compare healthy-path download times.
- Unplug during handover and mid-write, reconnect, and download again. A failed
  download must not reset incomplete firmware into the application or write to a
  different attached board.
- Two authorized boards and two tabs: retain the chosen board, protect an active
  download, cancel a waiting request, and test the fallback dialog's retry.
- micro:bit v1 and v2: full and partial flashing, serial recovery, control-pipe
  and CMSIS-DAP bulk firmware variants.
- Slow hubs and older supported bootloaders on supported WebUSB browsers,
  particularly Windows re-enumeration timing.

No host-side change guarantees successful physical programming after a cable,
power, firmware or flash-memory fault. Failed writes remain errors; the stack
does not blindly retry individual flash pages or claim byte verification.