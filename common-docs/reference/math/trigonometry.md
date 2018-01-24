# Trigonometry

Functions for finding numbers of angles, sides of triangles, and positions on a circle. These
functions are also used to make information for wave signals.

## What's your angle? Degrees or radians

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

## Sine

Get the length of the vertical (up or down) side of a right triangle at some angle. But, the
_sine_ value is the length of the vertical side divided by the length of the longest side,
its _hypotenuse_.

What's the sine of 60 degrees? **Math.sin(60 \* Math.PI / 180)** equals 0.5. The vertical side of a right triangle
is one half the length of the longest side when the opposite angle is 60 degrees.

```typescript-ignore
let ySide = Math.sin(60 * Math.PI / 180)
```

## Cosine

Get the length of the horizontal (left or right) side of a right triangle at some angle. But, the
_cosine_ value is the length of the horizontal side divided by the length of the longest side,
its _hypotenuse_.

What's the cosine of 45 degrees? **Math.cos(45 \* Math.PI / 180)** equals 0.707. The length of the horizontal side
of a right triangle is about 70 percent of the length of the longest side when the angle between them
is 45 degrees.

```typescript-ignore
let xSide = Math.cos(45 * Math.PI / 180)
```