# parse Float

Turn text that has just number characters into a floating point number value.

```sig
parseFloat("0.5");
```
You can change a text string having number characters into an actual floating point value. The text needs to have only number characters. This can also include the `'-'` and the `'.'`
symbols though.

If the text has other characters, like `"-5.8g5u7"`, only `-5.8` is returned since it is the best
attempt at converting to a number. So, try not to mix number characters with letters or other symbols.

## ~ hint

**Powers of 10**

If the text string has the letter **'e'** after the number characters and then some more number characters like **"2e4"**, then the number characters after the **'e'** are an _exponent_ of **10**. This means that a string with `"7.5e2"` becomes the value of `750` when converted to a floating point number. This is because the `2` after the `e` is 2 powers of ten which is ``10 * 10`` or `100`. The resulting value then is ``7.5 * 100`` which equals `750`.

## ~

## Returns

* a floating point [number](/types/string) value for the text number in the string.

## Example #exsection

Take the first few digits of PI from the sentence and turn it into a number.

```blocks
let text = "pi is 3.14...";
let pi = parseFloat(text.substr(6, 3));
```

## See also #seealso

[parse int](/reference/text/parse-int)
