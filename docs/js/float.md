# Floating point numbers

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

## Arithmetic operations in assembly

### Add

```armasm
add:
    ands r2, r0, r1
    lsls r2, r2, #31
    beq .boxed
    subs r2, r0, #1
    adds r0, r2, r1  ; the actual add
    bvs .overflow
    blx lr

.overflow:
    adds r0, r2, #1 ; restore
.boxed:
    push {lr}
    bl add_boxed
    pop {lr}
```

### Sub

Same as add.

### Or, and, xor

```armasm
or:
    ands r2, r0, r1
    lsls r2, r2, #31
    beq .boxed
    ors r0, r0, r1
    blx lr

.boxed:
    push {lr}
    bl or_boxed
    pop {lr}
```

And same. Xor, with `adds r0, r0, #1` before `blx lr`.

### Mul, div

In C++.

### To int

```armasm
toInt:
    asrs r0, r0, #1
    bcs .ok
    bl toInt_boxed
.ok:
```
