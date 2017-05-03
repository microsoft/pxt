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

The following operations have the integer fast-path implemented in assembly for speed.

* `adds`, `subs`
* `orrs`, `ands`, `eors`
* `toInt` and `fromInt`

It's particularly important for `adds` and `subs` since they otherwise always
use doubles (for easier overflow checking in C++). In the other cases it just saves a few
cycles.