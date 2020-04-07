# Boolean

A Boolean has one of two possible values: `true` or `false`. Boolean (logical) operators (*and*, *or*, *not*) take Boolean inputs and make another Boolean value. Comparison operators on other types ([numbers](/types/number), [strings](/types/string)) create Boolean values.

These blocks represent the `true` and `false` Boolean values, which can plug into anyplace a Boolean value is expected:

```block
let on = true;
```

The next three blocks represent the three Boolean (logic) operators:

```block
let and = true && false;
let or = true || false;
let not = !true;
```

The next six blocks represent comparison operators that yield a Boolean value. Most comparisons you will do involve [numbers](/types/number):

```block
let equality = 42 == 42;
let inequality = 42 != 42;
let lowerThan = 42 < 0;
let greaterThan = 42 > 0;
let lowerOrEqualThan =42 <= 0;
let greaterOrEqualThan = 42 >= 0;
```

Boolean values and operators are often used with an [if](/blocks/logic/if) or [while](/blocks/loops/while) statement to determine which code will execute next. For example:

```block
let a = 5
let b = 87

if (a < b) {
    a += 1
}

while (a < b) {
    a += 1
}
```

## Functions that return a Boolean

Some functions return a Boolean value, which you can store in a Boolean variable. For example, the following code gets the on/off state of `point (1, 2)` and stores this in the Boolean variable named `on`. Then the code clears the screen if `on` is `true`:

## Boolean operators

Boolean operators take Boolean inputs and evaluate to a Boolean output:

## Conjunction: `A and B`

`A and B` evaluates to `true` if-and-only-if both A and B are true:

```block
let off = false && false;
let off2 = false && true;
let off3 = true && false;
let on = true && true;
```

## Disjunction: `A or B`

`A or B` evaluates to `true` if either `A` is true or `B` is true, or if both `A` and `B` are true:

```block
let off = false || false;
let on = false || true;
let on2 = true || false;
let on3 = true || true;
```

## Negation: `not A`

`not A` evaluates to the opposite (negation) of A:

```block
let on = !false;
let off = !true;
```

## #examples
