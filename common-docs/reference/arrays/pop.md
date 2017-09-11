# pop

Remove and return the last element from an array.

```sig
["hello"].pop()
```

The last element in the array is removed, so the array becomes smaller by one element.

If you have an array with 4 numbers, like 1, 2, 3, and 4, you remove the last number from the array
by _popping_ it off of the end. To pop the number from the array in blocks, do this:

```block
let thoseNumbers = [1, 2, 3, 4];
let lastNumber = thoseNumbers.pop();
```

## Returns

* The last element in the array.

## Example

Clean out your junk drawer but check if the scissors are in there. Do this by removing them from your list items in the drawer.

```blocks
let found = false;
let junk = ["paper clip", "pencil", "notepad", "glue", "scissors", "screw driver"];
while (junk.length > 0) {
    if (junk.pop() == "scissors") {
        found = true;
    }
}
```

## See also

[push](/reference/arrays/push), [shift](/reference/arrays/shift)