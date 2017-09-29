# If

Run code depending on whether a [boolean](/blocks/logic/boolean) condition is true or false.

```block
if(true) {
}
```

The code inside the **`if`** block only runs when the condition block is **true**. You can compare
variables to values or variables to variables, for a **true** condition.

```block
let reward = false;
let perfect = 0;
let myScore = 0;
if (myScore < 10) {
    myScore += 1;
}

if (myScore == perfect) {
    reward = true;
}
```

## Opposite condition: `else` #oppositecondition

If you want some other code to run when the opposite condition is **true**, you put it in
an additional block area called **`else`**.

```block
let colorMix = 0;
let favColor = "orange";

if (favColor == "blue")
{
    colorMix = 7;
} else {
    colorMix = 472;
}
```
## Opposite condition, but check something again:  `else if`

Another conditional action is to add an **`if`** to an **`else`** for an **`else if`**. It works like this:

```block
let reward = false;
let nearPerfect = 0
let perfect = 0
let myScore = 0;
if (myScore < 10) {
    myScore += 1;
}

if (myScore == perfect) {
    reward = true;
} else if (myScore == nearPerfect) {
    reward = true;
}
```
You might guess that a longer way of saying the same thing is this:

```block
let reward = false;
let nearPerfect = 0;
let perfect = 0;
let myScore = 0;
if (myScore < 10) {
    myScore += 1;
}

if (myScore == perfect) {
    reward = true;
} else {
    if (myScore == nearPerfect) {
        reward = true;
    }
}
```

## ~hint
Click on the plus **(+)** symbol to add *else* or *else if* sections to the current *if* block.
## ~

## #examples
