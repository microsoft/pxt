# parse Float

Turn text that has just number characters into a floating point number value.

```sig
parseFloat("0.5");
```

## Returns

* a [number](/types/string) value for the text number in the string.

## Example #exsection

Take the first digits of PI from the sentence and turn it into a number.

```blocks
let text = "pi is 3.14...";
let pi = parseFloat(text.substr(6, 3));
```
