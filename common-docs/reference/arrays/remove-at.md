# remove At

Remove and return an element from an array at some position.

```sig
[""].removeAt(0)
```

Remove an element from an array at some position but don't return it.

```sig
[""]._removeAtStatement(0)
```

The size of the array shrinks by one. The element is removed from the array at the position you want. All the other elements after it are moved (shifted) to down to the next lower position. So, an array that has the numbers
`4, 5, 9, 3, 2` will be `4, 5, 3, 2` if `9` is removed from the array at index `2`. It looks like this in blocks:

```block
let myNumbers = [4, 5, 9, 3, 2]
let item = myNumbers.removeAt(2)
```

## Parameters

* **index**: the position in the array to get the element from.

## Returns

* the element in the array from the position you chose.

### ~reminder

#### **remove At** statement

The ``||arrays:remove at||`` **statement** only removes an element from the array. It doesn't return it.

```block
["a", "b", "c"]._removeAtStatement(0)
```

### ~

## Example

Remove the most dangerous level of radiation from the list.

```block
let radLevels = ["alpha", "beta", "gamma"]
let level = radLevels.indexOf("gamma")
let unzapped = radLevels.removeAt(level)
```

## See also

[insert at](/reference/arrays/insert-at)
