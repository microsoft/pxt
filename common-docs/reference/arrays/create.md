# create

Create a new array that can be used to store values.

```block
let empty: string[] = []
```
```block
let oneItem = ["item"]
```
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