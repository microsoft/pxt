# parse Int

Turn text that has just number characters into a real number value. The number is an integer.

```sig
parseInt("0");
```

The text needs to have only number characters. This can also include the `'-'` and the `'.'`
symbols though. But, only the _integer_ part (left of the decimal point) is converted to a number.

If the text has other characters, like `"-2g5u7"`, only `-2` is returned since it is the best
attempt at converting to a number. So, try not to mix number characters with letters or other symbols.

## Returns

* a [number](/types/string) value for the text number in the string.

## Example #exsection

Take the temperature text from the sentence and turn it into a number.

```blocks
let frozenWater = "The freezing temprature of water is 32 degrees Fahrenheit.";
let freezing = parseInt(frozenWater.substr(36, 2));
```
