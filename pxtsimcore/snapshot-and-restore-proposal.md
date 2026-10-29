# **PXT Simulator Runtime State: Snapshot and Restore Architecture**

# **1\. Executive Summary**

This document outlines the architectural blueprint for a deterministic runtime snapshot and restore mechanism within the PXT MakeCode simulator. Serving as the dedicated runtime save implementation required by Phase 10 of the headless harness design, this mechanism isolates the execution heap, fiber continuations, and global state from the virtual host. By formalizing cooperative safe points and avoiding the serialization of native JavaScript closures, this architecture guarantees a byte-identical continuation of simulator execution upon restoration.

# **2\. Architectural Boundaries and Safe Points**

A fundamental requirement of this architecture is the strict decoupling of runtime state from host state.

## **2.1 The Safe-Point Contract**

Because the PXT runtime relies heavily on JavaScript execution machinery, arbitrary preemption is unsupported. Checkpoints must exclusively occur at defined safe points.  
Specifically within the execution loop (e.g., `Runtime.ts` \~1400), a safe point is reached when the runtime yields because `yieldSteps == 0`, `maybeYield == true`, or if the runtime is explicitly killed. In the compiled state machine, returning a non-null `s.tmp_1` indicates execution should keep going; whenever the code actually returns from the execution step, it rests at a valid, stable safe point. Early or asynchronous checkpoint requests triggered outside these boundaries must fail immediately.

## **2.2 Boundary of Host State and BaseBoard**

Everything attached to the `BaseBoard` requires explicit serialization and deserialization routines. While the runtime snapshot mechanism remains agnostic to virtual hardware, the harness driver must ensure that all peripherals, pins, and custom states attached to the BaseBoard implement corresponding codecs.

## **2.3 Dynamically Added Members**

A key challenge during runtime serialization is identifying dynamically added members to the runtime environment. The serializer must defensively account for and capture ad-hoc properties attached to the runtime at execution time to avoid dropping state.

# **3\. Object Graph and Heap Serialization**

The current heap-walking diagnostic tool (`Runtime.traceObjects`) is insufficient for deterministic serialization. A rigorous data codec is required.

## **3.1 Deterministic Heap Codecs**

Dedicated serialize and deserialize codecs must be implemented for all core RefObject subtypes (RefRecord, RefCollection, RefBuffer, RefAction). To streamline implementation, the existing `To debug string` representation used by the debugger serves as a robust starting point and template for extracting object state for serialization.

## **3.2 Cycle Resolution and Identity Preservation**

To handle circular references and preserve pointer identity, the serializer must utilize a stable checkpoint-local ID mapping table. The allocation strategy dictates a two-pass restore:

1. **Allocation Pass:** Instantiate all declared heap objects with checkpoint-local IDs.  
2. **Population Pass:** Populate object fields and reconnect all internal references.

# **4\. Fiber and Interpreter State**

The MakeCode simulator utilizes explicit stack frames and program counters.

## **4.1 Frame Serialization and Context Switches**

A saved fiber continuation must include the `currFrame`, local registers, stack depth, exception handling states, and the program counter. The serialization strategy must deeply inspect how stack frames are constructed (e.g., `setupTopCore`) and how context switches take place between fibers to accurately rebuild the call stack upon restoration.

## **4.2 Stable Function Symbol IDs**

Function references within the stack frame must be encoded using stable, compiled function symbol IDs resolved against a `programHash`.

# **5\. Usage Analysis and Debugger Integration**

To ensure developer visibility, the checkpoint architecture must integrate directly with the MakeCode debugger. The ability to snapshot and restore state should include usage analysis to monitor performance overhead and memory footprints. By leveraging existing debugger hooks (such as `To debug string` outputs) for serialization boundaries, the architecture provides transparent, debuggable save states that developers can inspect directly within the IDE.

# **6\. Formal Checkpoint Data Transfer Object (DTO)**

The runtime payload will be expressed as a versioned, strictly typed plain-data object:

* **formatVersion**: Schema version of the checkpoint.  
* **programHash**: Cryptographic or deterministic hash of the compiled program.  
* **virtualTime**: Internal execution clock of the runtime.  
* **globals**: Mapping of global variable identifiers to encoded values.  
* **objects**: Array of encoded RefObject payloads.  
* **threads**: Array of serialized fibers, including call stacks and PCs.

# **7\. The Deterministic Restore Sequence**

1. **1\. Validation:** Verify checkpoint format and programHash.  
2. **2\. Resource Initialization:** Initialize program metadata.  
3. **3\. Heap Allocation:** Execute allocation pass to establish mapping table.  
4. **4\. Data Reconnection:** Execute population pass to inject object data.  
5. **5\. Interpreter Rebuild:** Reconstruct stack frames and fibers.  
6. **6\. Time Restoration:** Restore virtual time.  
7. **7\. Execution Resumption:** Yield control back to the driver.

# **8\. Round-Trip Equality and Verification**

1. 1\. Advance simulation to a specific frame boundary (safe point) and capture Checkpoint A.  
2. 2\. Terminate and restore Checkpoint A into a fresh environment.  
3. 3\. Capture Checkpoint B before resuming.  
4. 4\. Perform strict semantic comparison (Checkpoint A \== Checkpoint B).  
5. 5\. Assert identical downstream outputs for identical inputs.