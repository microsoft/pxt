# Math

Using [numbers](/types/number), number operators, and math functions.

## Numeric values: 0, 1, 2...

Just numbers by themselves. Sometimes these are called _numeric literals_.

### Integers: whole numbers

```block
let num = 0;
num = 0;
num = 1;
num = 2;
```

## Arithmetic binary operation (+, -, \*, /)

The operations for basic arithmetic: add, subtract, multiply, and divide.

```block
let more = 0+1;
let less = 0-1;
let twice = 1*2;
let divide = 8/4;
```

### Remainder (%)
This is a extra operator for division. You can find out how much is left over if one number doesn't
divide into the other number evenly.

We know that 4 / 2 = 2, so 2 divides into 4 evenly. But, 5 / 2 = 2 with a remainder of 1. So, the 
remainder operation, 5 % 2 = 1, gives the number that's left over from a division operation.

```block
let remainder = 7%4;
```

### Exponent (\*\*)

The exponent operator will multiply the number on the left by itself for the amount of times of the number on its right. That is, 4 \*\* 2 = 4 \* 4 and 2 \*\* 3 = 2 \* 2 \* 2. The area of a square that has sides with a length of `5` is equal to one side multiplied by another. For a square, all sides are equal, so:

```block
let side = 5;
let area = side * side;
```

But using the exponent operator, this is the same as:

```block
let side = 5;
let area = side ** 2;
```

The volume of a cube is three sides multiplied together. The two volumes are the same:

```block
let side = 5;
let volume1 = side * side * side;
let volume2 = side ** 3;
```

## Absolute value

When you want to know how much a number is without it's _sign_ (+/-). The absolute value of -5 is 5 and the 
the absolute value 5 is also 5. The absolute value is sometimes called the _magnitude_.

```block
let item = Math.abs(-5);
```

## Minimum and maximum of two values

You can get the smaller or the bigger of two numbers with the min() and max() functions.

* The minimum of 2 and 9: **Math.min(2, 9)** equals 2.
* The maximum of 3 and 9: **Math.max(3, 9)** equals 9.

```block
let minval = Math.min(0, 1);
let maxval = Math.max(8, 2);
```

## Random value

Make up any number from a minimum value to a some maximum value. If you want a random number up to
100, say: **Math.random(100)**.

```block
let myRandom = Math.random(5);
```

## See also

[random](/reference/math/random)