# Math

Using [numbers](/types/number), number operators, and math functions.

## Numeric values: 0, 1, 2, 6.7, 10.083...

Just numbers by themselves. Sometimes these are called _numeric literals_.

### Integers: whole numbers

```block
let num = 0;
num = 0;
num = 1;
num = 2;
```
### Floating point: numbers with a fractional part #floatingpoints

Numbers can have their fractional part too. The decimal point is between the digits of the number.
But, _floating point_ numbers have the decimal point at any spot between digits, like: 3.14159 or 651.75.

```block
let num = 0
num = 6.7
num = 10.083
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
## Square root

The square root of a number is another number that when multiplied by itself it becomes the original number. You know that `2 * 2` equals `4` so the square root of `4` is `2`. It's called a _square root_ because the area of a _square_ is the length of two equal sides multiplied together. The _root_ is the length of a side.

```block
let side = 5
let square = side * side
let root = Math.sqrt(side)
```

## Absolute value

When you want to know how much a number is without its _sign_ (+/-). The absolute value of -5 is 5 and the absolute value of 5 is also 5. The absolute value is sometimes called the _magnitude_.

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

## Round

If a number has a fractional part, you can make the number change to be the closest, next integer value. This is called _rounding_. Rounding the number `6.78` will make it be `7` and rounding `9.3` will give you `9`. If a number has a fractional part greater than or equal to `0.5`, the number will round up to the next whole integer value with the higher value. Otherwise, it will round down to the next lowest integer value.

For negative numbers, they round toward the absolute value (the absolute value of `-8` is `8`) of the number. So, `-5.23` rounds to `-5` and `-2.68` rounds to `-3`.

```block
let rounded = Math.round(5.5)
```

## Ceiling

To make a number change to the next higher whole number (integer), get the number's _ceiling_ value. The ceiling value for `1.234` is `2` since that is the next higher whole number. For the negative number of `-3.63`, its ceiling is `-3` since that's the next higher whole number.

```block
let nextup = Math.ceil(8.435)
```

## Floor

To make a number change to the next lower whole number (integer), get the number's _floor_ value. The floor value for `8.76` is `8` since that is the next lower whole number. For the negative number of `6.17`, its floor is `-7` since that's the next lower whole number.

```block
let nextdown = Math.floor(4.97)
```

## Truncate

The fractional part of a number is removed by _truncating_ it. If a number has the value `54.234` its truncated value is `54`. Truncation works the same way for a negative number. The truncated value of `-34.913` is `-34`.

```block
let nonfraction = Math.trunc(87.23455)
```

## Random value

Make up any number from a minimum value to a some maximum value. If you want a random number up to
100, say: **Math.randomRange(0, 100)**.

```block
let myRandom = Math.randomRange(0, 5);
```

## Trigonometry

Functions for finding numbers of angles, sides of triangles, and positions on a circle. These functions are also used to make information for wave signals.

### What's your angle? Degrees or radians

A compass shows where North is and the direction to it is 0 degrees (which is also 360 degrees). If you walk directly to the East, then your direction will be 90 degrees on the compass. This is
also the measurement of the angle between the path of your direction and the path to North. If point
yourself to North and spin around to the right (clockwise) in one spot, you will see the compass change from 0 degrees, go up to 359 degrees, and back to 0 degrees. So, a full rotation is 360 degrees, or full
circle.

Another way to measure angles is to use numbers that are special to the size of circles. A circle has two important numbers related to it. They are called the _radius_ and _pi_. The radius is the distance from the center of the circle to its outside edge. A long time ago, people learned that no matter how big
a circle is, if you divide the length of its outside edge by the length of its radius, you always get the same number back. They decided to call this number **_pi_**. It's **2** times **_pi_** actually, because they used the whole length across the circle which is two lengths of the radius.

Now, we don't have to worry about the radius anymore, we can just use some part of **2_pi_** to tell where any spot on the edge of a circle is. Any part or all of **2_pi_** is called _radians_. We can use radians to measure an angle of direction too, just like with the compass. Except now, we spin **2_pi_** radians around the circle instead of 360 degrees.

### ~hint
**What number is _pi_?**

As it turns out, **_pi_** is an _irrational_ number. That means it has a fractional part that uses more digits than we can display. So, it's best to use a constant in code for the value of **_pi_**. In case you're curious, the first 32 digits of **_pi_** are: **3.1415926535897932384626433832795**.

 Luckily, you can use the built-in constant **Math.PI**.
### ~

In code, you use _radians_ for angle measures. All of the math functions for trigonometry use radians.

### ~hint
**Changing degrees to radians**

What's 60 degrees in radians? Well, one radian is _(2 \* Math.PI / 360)_ radians. Or, to make it
simple, _(Math.PI / 180)_ radians. So, 60 degrees is _(60 \* Math.PI / 180)_ radians.
### ~

### Sine

Get the length of the vertical (up or down) side of a right triangle at some angle. But, the
_sine_ value is the length of the vertical side divided by the length of the longest side,
its _hypotenuse_.

What's the sine of 60 degrees? **Math.sin(60 \* Math.PI / 180)** equals 0.5. The vertical side of a right triangle
is one half the length of the longest side when the opposite angle is 60 degrees.

```typescript-ignore
let ySide = Math.sin(60 * Math.PI / 180)
```

### Cosine

Get the length of the horizontal (left or right) side of a right triangle at some angle. But, the
_cosine_ value is the length of the horizontal side divided by the length of the longest side,
its _hypotenuse_.

What's the cosine of 45 degrees? **Math.cos(45 \* Math.PI / 180)** equals 0.707. The length of the horizontal side
of a right triangle is about 70 percent of the length of the longest side when the angle between them
is 45 degrees.

```typescript-ignore
let xSide = Math.cos(45 * Math.PI / 180)
```

## See also

[randomRange](/reference/math/random-range)
