# compare

See how two text strings compare based on which characters are first.

```sig
"".compare("");
```
Two strings are compared based on the order of their characters. If string `A` has `"111"` it will
be less than a string with `"512"`. A string with `"Everything"` is less than `"Nothing"` because
`'N'` comes after `'E'` in the alphabet.

The string `"abcdefg"` is greater than `"abcdefa"`. They are almost the same but the last letter of the second string is less than the last letter of the first one. This makes the whole second string compare as less. In blocks, the comparison of these strings looks like:

```block
let iamGreater = false;
if ("abcdefg".compare("abcdefa") > 0) {
    iamGreater = true;
}
```

## Parameters

* **that**: the [string](/types/string) that compares to this string.

## Returns

* a [number](/types/number) that is -1, 0, or 1. These numbers mean that this string is:

>**-1**: this string is less than the compared string.<br/>
**0**: this string is equal to the compared string.<br/>
**1**: this string is greater than the compared string.

## Examples #exsection

### Which bird is the same as a duck #ex1

See which bird is the same as a `"duck"`.

```blocks
let match = false;
let bird = "duck";
if (bird.compare("crow") == 0) {
    match = true;
} else if (bird.compare("goose") == 0) {
    match = true;
} else if (bird.compare("duck") == 0) {
    match = true;
}
```

### Compare the birds #ex2

See how other birds compare to a `"duck"`.

```blocks
let birds = ["crow", "DUCK", "goose", "Duck", "eagle", "osprey"];
let lesserBirds = 0;
let greaterBirds = 0;
let ducks = 0;

for (let bird of birds) {
    let result = bird.compare("duck");
    if (result < 0) {
        lesserBirds++;
    } else if (result > 0) {
        greaterBirds++;
    } else {
        ducks++;
    }
}
```


