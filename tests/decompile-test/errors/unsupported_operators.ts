// @case: left shift
{ let x = 0 << 1; }

// @case: right shift
{ let x = 0 >> 1; }

// @case: right shift zero fill
{ let x = 0 >>> 1; }

// @case: bitwise or
{ let x = 0 | 1; }

// @case: bitwise and
{ let x = 0 & 1; }

// @case: bitwise xor
{ let x = 0 ^ 1; }

// @case: bitwise not
{ let x = ~0; }

// @case: exponentiation
{ let x = 1 ** 1; }

// @case: void
{ let x = void 1; }

// @case: delete
{ let x = delete "hello".length; }

// @case: typeof
{ let x = typeof 0; }

// @case: times equals
{
    let x = 1;
    x *= 1;
}

// @case: slash equals
{
    let x = 1;
    x /= 1;
}

// @case: modulo equals
{
    let x = 1;
    x %= 1;
}

// @case: bitwise or equals
{
    let x = 1;
    x |= 1;
}

// @case: bitwise and equals
{
    let x = 1;
    x &= 1;
}

// @case: bitwise xor equals
{
    let x = 1;
    x ^= 1;
}

// @case: left shift equals
{
    let x = 1;
    x <<= 1;
}

// @case: right shift equals
{
    let x = 1;
    x >>= 1;
}

// @case: right shift zero fill equals
{
    let x = 1;
    x >>>= 1;
}
