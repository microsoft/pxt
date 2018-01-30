# Array

An *Array* is a list of other items that have a basic (primitive) type.

## #intro

An array is a list of items that are numbers, booleans, or strings. Arrays have a length which is the number of items they contain. You get and change the values of items at different places in an array. You find items in an array by knowing their positions.

Arrays are flexible, they can grow and shrink in size. You can add and remove items at any place in the array.

## Create an array

An array is created by making a list of items.

```block
let scores = [9, 8, 3, 5, 6, 8];
```
Here the array automatically becomes an array of [numbers](/types/number) because it was created with items that are numbers.

You can use different types, like [string](/types/string).

```block
let directions = ["East", "North", "South", "West"];
```

If you want to create an array with no items in it yet (empty array), you have to tell what type the array should be. This is because there are no items in it that automatically decide the type.

```typescript
let scores: number[] = [];
```

## Items in an array

When an item is added to an array it becomes an _element_ of the array. Array elements are found using an _index_. This is the position in the array of the element, or the element's _order_ in the array. The positions in an array begin with the index of `0`. The first place in the array is `0`, the second place is `1`, and so on.

```block
let scores = [9, 8, 3, 5, 6, 8];
let firstScore= scores[0];
let secondScore = scores[1];
```
## Length of arrays

Arrays always have a length. The last element of an array has an index that is _length of array - 1_. Indexes begin with `0` so the last element's index is one less than the array length.

```block
let directions = ["East", "North", "South", "West"];
let count = directions.length;
```

## Advanced

Arrays are a very useful way to collect and organize information. There are more advanced operations and functions you can use on arrays.

Here's an example using [**insertAt**](/reference/arrays/insert-at) to insert a number into the middle of an array.

```block
let scores = [8, 5, 9, 3, 2, 4];
scores.insertAt(3, 1);
```

## #examples

### See also #seealso
