# Boolean

A Boolean has one of two possible values: `true` or `false`. Boolean (logical) operators (*and*, *or*, *not*) take Boolean inputs and make another Boolean value. Comparison operators on other types ([numbers](/types/number), [strings](/types/string)) create Boolean values.

These blocks represent the `true` and `false` Boolean values, which can plug into anyplace a Boolean value is expected:

```block
true;
false;
```

The next three blocks represent the three Boolean (logic) operators:

```block
true && false;
true || false;
!true;
```

The next six blocks represent comparison operators that yield a Boolean value. Most comparisons you will do involve [numbers](/types/number):

```block
42 == 0;
42 != 0;
42 < 0;
42 > 0;
42 <= 0;
42 >= 0;
```

Boolean values and operators are often used with an [if](/blocks/logic/if) or [while](/blocks/loops/while) statement to determine which code will execute next. For example:

### Functions that return a Boolean

Some functions return a Boolean value, which you can store in a Boolean variable. For example, the following code gets the on/off state of `point (1, 2)` and stores this in the Boolean variable named `on`. Then the code clears the screen if `on` is `true`:

### Boolean operators

Boolean operators take Boolean inputs and evaluate to a Boolean output:

### Conjunction: `A and B`

`A and B` evaluates to `true` if-and-only-if both A and B are true:

```block
false && false == false;
false && true == false;
true && false == false;
true && true == true;
```

### Disjunction: `A or B`

`A or B` evaluates to `true` if-and-only-if either A is true or B is true:

```block
false || false == false;
false || true == true;
true || false == true;
true || true == true;
```

### Negation: `not A`

`not A` evaluates to the opposite (negation) of A:

```block
!false == true;
!true == false;
```

## #examples
