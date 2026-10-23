# If Then Else (Ternary)

Returns one value if a condition is true, or another value if it is false.

```block
let result = true ? 1 : 2;
```

The **if then else** block (also known as the **ternary operator**) evaluates a [boolean](/blocks/logic/boolean) condition. If the condition is **true**, it returns the first value (`then`). If the condition is **false**, it returns the second value (`else`).

Unlike the regular [if](/blocks/logic/if) block, which executes statements, the ternary block is an **expression** (a reporter block) that produces a value. You can plug it directly into variable assignments, math operations, and function arguments.

## Examples

### Pick a speed based on a condition #example1

Set motor speed to `100` if a variable `fastMode` is true, otherwise set it to `30`:

```block
let fastMode = true;
let speed = fastMode ? 100 : 30;
```

### Compare values #example2

Return different numbers based on comparing a variable to a threshold:

```block
let x = randint(0, 10);
let count = x < 5 ? 123 : 321;
```

### Choose text messages #example3

Display a status message depending on whether a score is high enough:

```block
let score = 75;
let status = score >= 50 ? "Pass" : "Try again";
```

### Nested ternary expressions #nested

You can nest ternary blocks inside one another to choose between more than two values:

```block
let temperature = 25;
let message = temperature > 30 ? "Hot" : (temperature > 15 ? "Warm" : "Cold");
```

## JavaScript and Python syntax #syntax

### JavaScript / TypeScript

```typescript
let result = condition ? valueIfTrue : valueIfFalse;
```

### Python

```python
result = valueIfTrue if condition else valueIfFalse
```

## See also #seealso

[if](/blocks/logic/if), [boolean](/blocks/logic/boolean)
