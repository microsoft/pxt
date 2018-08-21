# More JavaScript! Yay!

I've been thinking about aligning our compiler more with JavaScript semantics.

This is partially motivated by possible upcoming targets that are used
in slightly more professional settings.

In particular, handling web requests in a nice way requires support for JSON
objects, which in turn requires supporting `any` type and dynamic `typeof`
checks.

Another major feature of JS we are missing is exceptions. While our current
strategy of returning dummy values for error conditions works well enough for
the current targets, I think we should consider more strict error checking for
the slightly more advanced ones, possibly including Arcade. Also, exceptions is
something Eric wanted to cover in his course.

These two are related, since exceptions needs a very regular shape of the stack
(so that when exception is raised we know what to deallocate (or rather decrement
reference count)), and `any` type requires dynamic type checks when calling
functions, which will be now integrated with reference count and stack management.

To these ends my plan is to drop support for non-tagged native compilation.
This will require a bump of major version from v3 to v4, and it implies:

* Chibitronics uses it; it will just stay on pxt v3 forever; I don't think they have
  flash space to handle the tagged strategy and pxt-common-packages
* the two AVR ports (native and VM) for Arduino UNO stay on pxt v3 forever (I'm not even sure it's available somewhere; it did make a nice contribution to a paper though)
* everyone else moves to pxt v4 - the breaking change is dropping stuff they don't use;
  this includes micro:bit v1; micro:bit v0 stays on pxt v0 of course
* we generally assume all types require reference counting (we almost do that already in tagged
  strategy, except for `null` type and similar oddities)
* we still have some expressions that don't need (but can handle) reference counting (number and string literals mostly)
* currently, generics are compiled several times depending on the type arguments being reference types or not;
  this can be simplified away now, since everything is a reference type
* drop C# backend (it doesn't look this will be used for the intended purpose); we can revive it later

Additionally, we can, but don't have to, drop support for reference counting when generating JS code.
It slows down execution, but potentially allows us to measure memory pressure in
the simulator (which we don't do, but easily could). It would also let us
implement destructors, for example for things like file objects. I don't have a clear
use case yet though, so maybe it also goes away at least for now.

## any

Allowing `any` type will let the user cast anything to anything. I suspect
we already have loopholes that allow that, given the complexity of the TS
type system. Once the user can cast around, we need to check the casts.
There are two options:

* check on casts, C#-style; this could be potentially faster and catch errors earlier;
  OTOH, in `function f(v:any) { g(v) }` you could get an invalid cast exception on call
  to `g()`, which doesn't have any explicit cast. This is also a bit more risky, since
  we need to positively track down all the places where TS can inject a down-cast
* check on usage, JavaScript-style. This might be a bit slower, but we already convert
  numbers to ints in most calls, so probably not that much of a perf hit.
  Now we would additionally need to check strings, buffers,
  etc. We might also want to check methods calls, especially virtual methods.
  We need to check field accesses and array
  indexers (these are all done via runtime functions, so easy to inject checks there).

We could also for more JS-like semantics of field/method accesses - index v-table with
method names and drop current C#-like classes.

Field lookup should stay cheap though, no list iteration etc.

### Calling C++

* determine non-trivial arguments (non-literals I guess)
* compute each and push on the stack
* call helper routine, which converts/type-checks them and loads them into appropriate registers;
  routine would be auto-generated
* load the trivial arguments into registers directly
* do the C++ call
* call cleanup helper to: check for exception and pop stuff off the stack (and decrement)

For example (the functions starting with `_` are generated in assembly and
generally don't follow typical calling conventions; in particular they might save r0-r3)

```
// C++
void foo(int x, int y, TValue z, String w) { ... }

// Call
foo(local, 12, something(), somethingelse())

// Assembly
  load local
  call _incr
  push r0
  ... something() ...
  push r0
  ... somethingelse() ...
  push r0
  call _conv_int_r0_any_r2_string_r3
  mov r1, #12
  call foo
  call _clean_3
  push r0

// can inline _check_exn and _decr here, as there will be just a few of these
_clean_3:
  mov r4, lr
  call _check_exn
  mov r5, r0
  pop {r0}
  call _decr
  pop {r0}
  call _decr
  pop {r0}
  call _decr
  mov r0, r5
  bx r4

_conv_int_r0_any_r2_string_r3:
  push {lr}
  load r0, stack@r0
  call _toInt
  push r0
  load r0, stack@r3
  call _toString
  push r0
  pop r3
  load r2, stack@r2
  pop r0
  pop {pc}
```

It's quite likely this stack-like translation will save some flash space compared to the current one.

### Intermediate Representation changes

Drop `SharedRef` and `SharedDef`, and instead have an explicit stack:
* `SK.Push(Expr)`
* `EK.StackRef(Expr)`
* `SK.PopAndDecr(howMany)`

Or else: have `SharedRef` implicitly include `incr()`. Everything else should work out.

## Exceptions

This requires adding thread-local data to codal. It seems quite easy - just
add a user-data pointer in `CodalFiber` structure. We will need to handle it in fork-on-block
scenario, but again not too difficult (previous user data just to be saved
in a variable on the stack when FOB method is invoked).

With thread-local data, have a thread-local exception context structure.
The context has a stack of exception handlers and a pointer to currently
thrown exception if any.

We may use a special tagged value, similar to `null` or `undefined`, that
indicates exception return. Let's call it `exn`.

### Try block

Save handler in context - current `sp` and instruction pointer to the `catch` block.

### Calling TS from C++

The init sequence (lambda wrapper) that executes when C++ calls TS does something similar to `try` block.
If TS throws, the `pxt::runAction()` will return `exn`.

Still need to figure out calls from TS to first class TS functions (optimization), as
it currently also goes through `pxt::runAction()`.

Need to make sure what lambda wrapped pushes on the stack, and that it is ref-safe.
Return addresses on Thumb are, since they are always odd.

### Throw

On `throw`:
* get top of handler stack
* ref-count decrement everything on the stack between the current `sp` and the `sp` saved in the handler
* set `sp` to the saved one
* execute handler code
* handler code can re-throw (especially if it's `finally`)

Throw can be executed only from a **safe point**. Not sure if all points are safe - has
to do with stack shape.

### Calling C++ from TS

After a C++ function returns, check if there is a pending exception in the context.
If so, throw.

### Performance

It's possible to store pointer to that exception context in a register, we still have
two or so left. We can benchmark.

We can have `//% throws` annotation on C++ function to avoid checking for pending
exception too often.

### Stack traces

Four options:
* no stack trace in string form, that can be inspected by the code running on the board
* have flash addresses in `e.stack`
* just have function names `e.stack`
* have full-blown `e.stack`

In the second case, we could construct full stack trace in the editor, and there
is little overhead. I'm leaning towards that option.
