# remove At (no return value)

Remove an element from an array at some position.

```sig
[""]._removeAtStatement(0)
```

The size of the array shrinks by one. The element is removed from the array at the position you want. All the other elements after it are moved (shifted) to down to the next lower position. So, an array that has the numbers
`4, 5, 9, 3, 2` will be `4, 5, 3, 2` if `9` is removed from the array at index `2`. It looks like this in blocks:

```block
let myNumbers = [4, 5, 9, 3, 2]
myNumbers.removeAt(2)
```

## Parameters

* **index**: the position in the array to get the element from.

## Example

Remove the largest animal from the list of primates.

```block
let primates = ["chimpanzee", "baboon", "gorilla", "macaque"]
let largest = primates.indexOf("gorilla")
primates.removeAt(largest)
```

## See also

[remove at](/reference/arrays/remove-at), [insert at](/reference/arrays/insert-at)