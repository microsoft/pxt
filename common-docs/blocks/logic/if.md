# If

Conditionally run code depending on whether a [Boolean](/blocks/logic/boolean) condition is true or false.

```block
if(true) {
}
```
The code inside the `if` block only runs when the condition block is **true**. You can compare
variables with values or variables to other variables for a **true** condition.

## Opposite condition `else`

If you want some code to run only when the opposite condition is **true**, you put it in
an additional block area called else.

```block
let colorMix = 255;
let favColor = "orange";

if (favColor == "blue")
{
    colorMix = 7;
} else {
    colorMix = 472;
}
```

Click on the dark blue gear icon (see above) to add an *else* or *if* to the current block.

## #examples
