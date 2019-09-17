# Continue

Skip the rest of the code in a loop and start the loop again.

```block
while(true) {
    if (Math.randomRange(0, 10) > 5) {
        // skip the rest of the loop
        continue;
    }
    // do something
}
```

When a program sees a **continue** inside of a loop, it skips running the rest of the code in the loop from the place of the **continue** to the end of the loop. The loop doesn't stop but continues to run again. If the loop uses iteration (a count or index value), like a [for](/blocks/loops/for) loop, it will start again with its next iteration.

## #examples

## See also #seealso

[break](/blocks/loops/break)