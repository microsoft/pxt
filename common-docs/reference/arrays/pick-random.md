# pick Random

Randomly choose an item from an array.

```sig
[""]._pickRandom()
```

Rather that generating your own random index for an array to select an item, you can have an item from an array returned to you randomly in single operation. An item is chosen at a random index within the length of the array.

```block
let list: number[] = []
let item = list._pickRandom()
```

This is a more convenient way to get a random item. Otherwise, you need to generate a random index first before accessing the array item.


```block
let list: number[] = []
let item = list[Math.randomRange(0, list.length - 1)]
```

## Returns

* An item from the array that is ramdomly selected.

## Example #example

Randomly select a name for your new pet from an array of names.

```blocks
let petNames = ["sparky", "fido", "spots", "fluffy", "muffin"]
let newName = petNames._pickRandom()
```

## See also

[remove at](/reference/arrays/remove-at), [get](/reference/arrays/get),
[pop](/reference/arrays/pop), [shift](/reference/arrays/shift)