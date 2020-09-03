# random int

Return a pseudo-random value within a range of numbers.

```sig
randint(0, 10)
```

Returns a pseudo-random number in the range ``[min, max];`` that is, from ``min`` (inclusive) up to and including ``max`` (inclusive).

### ~ hint

#### What is pseudo-random?

Random numbers generated on a computer are often called _pseudo-random_. This because the method to create the number is based on some 
starting value obtained from the computer itself. The formula for the random number could use some amount of mathematical operations on a value derived from a timer or some other input. The resulting "random" number isn't considered entirely random because it started with some initial value and a repeatable set of operations on it. Therefore, it's called a pseudo-random number.

### ~

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
