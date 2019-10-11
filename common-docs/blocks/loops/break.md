# Break
 
Break out of the current loop and continue the program.

```block
while(true) {
    if (Math.randomRange(0, 10) > 5) {
        break;
    }
}
```

When a program encounters a **break**, the loop that contains it will stop running at the place of the **break**. The program then continues by running the code right after the end of the loop.

If a loop with a **break** is inside of another loop (nested loop), only the loop with the **break** will end. The outer loop will continue to run the code inside of it.

## #examples

## See also #seealso

[continue](/blocks/loops/continue)
