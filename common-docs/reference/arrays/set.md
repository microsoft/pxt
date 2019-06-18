# set

Store a value in an array at some index.

```block
[""][0] = "item";
```

When an item exists in the array at the index you've chosen, it is replaced with a new value. If you use an index that is past the length of the array, the array is expanded to put the value at the location you want. All locations between the previous last item and the new last item have values of `0`.

## Parameters

* **index**: a [number](/types/number) that is the location in the array to set a value at.

## Example

Change your mind and make one of your favorite colors green instead of brown.

```blocks
let favColors = ["orange", "blue", "red", "brown", "yellow"];
favColors[3] = "green";
```

## See also

[insert-at](/reference/arrays/insert-at)