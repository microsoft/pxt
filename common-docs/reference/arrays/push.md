# push

Add an element to the end of an array.

```sig
[""].push("hello")
```

You might have an array with 3 numbers, like 1, 2, and 3. If you want to add another number to the end,
then you _push_ it on to the array. You do it like this:

```block
let thoseNumbers = [1, 2, 3];
thoseNumbers.push(4);
```

## Parameters

* **item**: the element to add to the end of the array.

## Example

Add another animal to the end of your list of favorite pets.

```blocks
let pets = ["cat", "dog", "parrot", "goldfish"];
pets.push("guinea pig");
```

## See also

[pop](/reference/arrays/pop), [unshift](/reference/arrays/unshift)