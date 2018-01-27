# abs

The absolute value of a number.

```sig
Math.abs(-5);
```

When you want to know how much a number is without its _sign_ (+/-). The absolute value of -5 is 5 and the
the absolute value 5 is also 5. The absolute value is sometimes called the _magnitude_.

## Parameters

* **x**: The [number](/types/number) to return the absolute value for. This can be a negative number (`-1`), positive number (`6`), or `0`.

## Returns

* a [number](/types/number) that is the absolute value of number in ``x``.

## Example #example

Find the absolute value of `-34`. Do some checks to make sure the absolute value is really `34`. Set the value to `0` if the checks fail.

```blocks
let pos = Math.abs(-34);
if (pos > 0) {
    if (pos != 34) {
        pos = 0;
    }
} else {
    pos = 0;
}
```
