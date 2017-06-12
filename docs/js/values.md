# Value representation

## Ref-counting

There are currently two types of ref-counted objects. There's a `RefCounted` type coming
from Codal and `RefObject` one coming from PXT. They use exact same layout though, and will
likely be unified more in the future.

```
struct RefObject {
    uint16_t refcnt;
    uint16_t vtable;
}
```

The `refcnt` field is always odd, so the actual number of references is stored in its upper
15 bits. When `refcnt == 1` (i.e., the actual ref count is zero), the object is deleted.
Upon allocation, `refcnt == 3`.

The `vtable` field holds either a small integer (tag), or a pointer to vtable shifted by 2 bits
(look or `vtableShift` here and in `pxt-common-packages`). Thus, we allow for 256k of flash.
In case more flash is needed, the shift can be increased (and vtables aligned appropriately).

The tags are defined in Codal and two additional tags are defined in pxt:
```
// Codal:
#define REF_TAG_STRING 1
#define REF_TAG_BUFFER 2
#define REF_TAG_IMAGE 3
// ... possibly more ...

// PXT:
#define REF_TAG_NUMBER 32
#define REF_TAG_ACTION 33
```

PXT defines corresponding vtables for the tags above, which have the same layout
and the usual bit-shifted vtables. The `getVTable(RefObject*)` function can be used to
fetch a vtable pointer (it either shifts or looks up based on tag).

Note that the first word (both 16 and 32 bit) in `RefObject` is always odd (due to `refcnt` field). 
In C++ a class with virtual methods would always have a full pointer to a C++ vtable, which
is always even. Similarly, if the first field of an object is a pointer to something
aligned, it will be also even. Thus, `RefObjects` can be distinguished at runtime
from most C++ classes, provided appropriate care is taken to either have some virtual fields,
or a pointer in front. In particular, Codal components all have virtual methods.


## Floating point numbers

In hardware, numbers are represented either by 31 bit tagged integers (with the lowest bit always set) 
or by reference-counted, boxed 64 bit double precision floating point numbers.

Values with lowest bit clear and next lowest set are used to encode special values
and `0` denotes `undefined`.

```
null      =  (1 << 2) | 2   //  6 = 0x06
false     =  (2 << 2) | 2   // 10 = 0x0A
true      = (16 << 2) | 2   // 66 = 0x42 (an accident! really!)
undefined = 0               //  0 = 0x00
```

Encodings `(1 << 2) | 2` ... `(15 << 2) | 2` are reserved for falsy values,
whereas `(16 << 2) | 2` and onwards for truthy ones.

The reason for choosing `0` for `undefined` (as opposed to `null`)
is that it's the default value of JavaScript fields and variables, and memory
tends to be cleared to `0` by default.

### Arithmetic operations in assembly

The following operations have the integer fast-path implemented in assembly for speed.

* `adds`, `subs`
* `orrs`, `ands`, `eors`
* `toInt` and `fromInt`

It's particularly important for `adds` and `subs` since they otherwise always
use doubles (for easier overflow checking in C++). In the other cases it just saves a few
cycles.
