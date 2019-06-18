# reverse

Reverse all the elements in an array.

```sig
["hello", "goodbye"].reverse();
```

All the elements in the array change their position. The elements going from the lowest to the highest
position will end up having new order. The element with the highest position is now in the lowest position
and so on. The array `9, 8, 3, 5, 9, 8, 7, 2` looks like `2, 7, 8, 9, 5, 3, 8, 9` after it is reversed.

You might notice that if your array has an odd number of elements, the element in the very middle gets to
keep is old position when the array is reversed.

# Returns

* the same array but now it's reversed.

# Example

Reverse the colors of the rainbow. You could call a reversed rainbow a "wobniar".

```blocks
let rainbow = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];
rainbow.reverse();
```