# constrain 

Make certain that the value of a number you give is no smaller and no bigger than two other numbers.

```sig
Math.constrain(0,0,0)
```

A value is _constrained_, or limited, within a range by testing it's value against two limit numbers. One of the limit numbers sets the lowest value that the number tested should have. The other limit number sets the highest value that the number tested should have.

If the value tested is within the range of these two limit numbers, the value itself is returned. If the value is outside of the range of these two limit numbers, the value returned is one of the limit numbers that is closest to the value being tested.

So, if `15` is constrained within a range of `3` to `10`, then ``Math.constrain(15, 6, 10)`` will return `10`. Also, if `3` is constrained to the same range, ``Math.constrain(3, 6, 10)`` will return `6`. Of course, a value of `4` that is constrained by `3` to `10` stays as `4`.

## Parameters

* **value**: A [number](/types/number) that is tested to be in a range.
* **low**: the lower number limit of the range to test **value** for.
* **high**: the upper number limit of the range to test **value** for.

## Returns

* a [number](/types/number) that is a value constrained by the number range of **low** to **high**.

## Example #example

Keep a desired value within a realistic range of `50` to `100`.

```block 
let desired = 155
let realistic = Math.constrain(desired, 50, 100)
```

## See also

[map](/reference/math/map) 