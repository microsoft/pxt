# random int

Return a pseudo-random value within a range of numbers.

```sig
randint(0, 10)
```

Returns a pseudo-random number in the range ``[min, max];`` that is, from ``min`` (inclusive) up to and including ``max`` (inclusive).

## Parameters

* **min**: the smallest possible pseudo-random number to return.
* **max**: the largest possible pseudo-random number to return.

## Returns

* a pseudo-random [number](types/number) between ``min`` (inclusive) and ``max`` (inclusive).

## Example

Generate a random number between `0` and `100`.

```blocks
let centoRandom = randint(0, 100);
```

## See Also

[random](/reference/math/random)