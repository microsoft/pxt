# Floating point numbers

In hardware, numbers are represented either by 31 bit tagged integers (with the lowest bit always set) 
or by reference-counted, boxed 64 bit double precision floating point numbers.

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
