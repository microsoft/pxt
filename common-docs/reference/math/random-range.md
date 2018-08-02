# random Range

Return a pseudo-random value within a range of numbers.

```sig
Math.randomRange(0, 10)
```

Returns a pseudo-random number in the range ``[min, max];`` that is, from ``0`` (inclusive) up to including ``1`` (inclusive), which you can then scale to your desired range.

## Parameters

* **min**: the smallest possible pseudo-random number to return.
* **max**: the largest possible pseudo-random number to return.

## Returns

* a pseudo-random [number](types/number) between ``min`` (inclusive) and ``max`` (inclusive).

## Example

Generate a random number between `0` and `100`.

```blocks
let centoRandom = Math.randomRange(0, 100);
```

## See Also

[random](/reference/math/random)