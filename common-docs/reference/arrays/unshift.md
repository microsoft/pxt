# unshift

Add an element to the front of an array.

```sig
[""].unshift("hello")
```

You might have an array with 3 numbers, like 1, 2, and 3. If you want to add another number to the front,
then you _unshift_ it into the array. You do it like this:

```block
let thoseNumbers = [1, 2, 3];
let head = 0;
head = thoseNumbers.unshift(0);
```

## Parameters

* **item**: the element to add to the front of the array.

## Example

Make an array that simulates a train. Place the parts of the train in the right order.

```blocks
let count = 0
let part = ""
let train: string[] = []
let parts = ["flatcar", "boxcar", "tanker", "engine", "flatcar", "caboose", "boxcar"]
while (parts.length > 0) {
    part = parts.shift()
    if (parts.length > 1) {
        if (part == "engine") {
            parts.push(part)
        } else if (part == "caboose") {
            train.push(part)
        } else {
            count = train.unshift(part)
        }
    } else {
        count = train.unshift(part)
    }
}
```

## Sea also

[shift](/reference/arrays/shift), [push](/reference/arrays/push)