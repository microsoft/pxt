# create

Create a new array to store one or more values.

## Create an array

### Empty array

You can create arrays with no items. If you do that, you'll need tell what [type](/types) the array will be. This is an empty array:

```typescript
let empty: string[] = []
```

```blocks
let empty: string[] = []
```

### One item array

You can create and _initialize_ an array with an item. Arrays created with at least one item automatically have the [type](/types) of the item. This is called a _type inference_.


```block
let oneItem = ["item"]
```

### Multiple item array

Create arrays with more than one item if you want.

```block
let twoItems = [1, 2]
```

## Examples

Make an empty array of numbers. Then, add two numbers to the array.

```blocks
let scores: number[] = [];
scores.push(98);
scores.push(75);
let lastScore = scores.pop();
```

Make an array with two words, then swap them in the array.

```blocks
let words = ["Hello", "there"]
let swap = words[0];
words[0] = words[1];
words[1] = swap;
```