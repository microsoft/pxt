# get

Get a value from an array at a particular index.

```block
let item = [""][0]
```
## Parameters

* **index**: a [number](/types/number) that is the location in the array to get a value from.

## Returns

* a value in an array that is at the chosen index. The value has the [type](/types) that matches
the other items in the array.

### ~hint

**Out of bounds!**

If you try to get a value from any location (index) past the current length of the array, the value returned is the [number](/types/number) `0`.

### ~

## Example

```blocks
let directions = ["North", "South", "East", "West"];
let path = "Turn to the " + directions[3];
```

## See also

[index of](/reference/arrays/index-of)