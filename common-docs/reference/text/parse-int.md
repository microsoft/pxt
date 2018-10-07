# parse Int

Turn text that has just number characters into an integer number value.

```sig
parseInt("0");
```

You can change a text string having number characters into an actual integer value. The text needs to have only number characters. This can also include the `'-'` and the `'.'`
symbols though. But, only the _integer_ part (left of the decimal point) is converted to a number.

If the text has other characters, like `"-2g5u7"`, only `-2` is returned since it is the best
attempt at converting to a number. So, try not to mix number characters with letters or other symbols.

## ~ hint

**Powers of 10**

If the text string has the letter **'e'** after the number characters and then some more number characters like **"2e4"**, then the number characters after the **'e'** are an _exponent_ of **10**. This means that a string with `"8e3"` becomes the value of `8000` when converted to an integer. This is because the `2` after the `e` is 2 powers of ten which is ``10 * 10 * 10`` or `1000`. The resulting value then is ``8 * 1000`` which equals `8000`.

## ~

## Returns

* an integer [number](/types/string) value for the text number in the string.

## Example #exsection

Take the temperature text from the sentence and turn it into a number.

```blocks
let frozenWater = "The freezing temperature of water is 32 degrees Fahrenheit.";
let freezing = parseInt(frozenWater.substr(37, 2));
```

## See also #seealso

[parse float](/reference/text/parse-float)
