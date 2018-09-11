# includes

Determines whether a string contains the characters of a specified string.

```sig
"hello world".include("world")
```

## Parameters

* **searchValue**: the item to find somewhere in the array.
* **start**: a [number](/types/number) which is the position in the string to begin the search. You use this
if you want the search to start at someplace past `0`, the first position.

## Returns

* a [number](/types/number) which is the position in the string where the element is found. This number
is `-1` if a matching element isn't found anywhere in the array.

## Example

Determines if ``popcorn`` is in the snacks list.

```blocks
let movieSnacks = "mints cola pretzel popcorn peanuts";
let popcorn = movieSnacks.includes("popcorn");
```

