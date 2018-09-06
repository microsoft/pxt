# last index Of

Get the index (position) of the last occurrence of a specified value in a string.

```sig
"hello".lastIndexOf("hel")
```

## Parameters

* **searchValue**: the item to find somewhere in the array.
* **start**: a [number](/types/number) which is the position where to start the search (searching backwards). If omitted, the default value is the length of the string

## Returns

* a [number](/types/number) which is the position in the string where the element is found. This number
is `-1` if a matching element isn't found anywhere in the array.

## Example

Get the last index of "popcorn" in a list of movie treats.

```blocks
let movieSnacks = "popcorn mints popcorn peanuts";
let popcorn = movieSnacks.lastIndexOf("popcorn");
```

