# char Code At

Get the code for a character (letter, number, or symbol) from a place in a text string.

```sig
"".charCodeAt(0)
```

Like the position of a character in the an alphabet, or the traditional order of characters in a language, characters are assigned a code in a character set when used with computers. If a character set used only the 5 characters of "ABCDE", then 'A', as the first character, would have a character code of `0` and 'D' would have a charcter code of `3`.

You can find the code of a character in a text string by selecting it from it's position in a string.

## Parameters

* **index**: the [number](/types/number) for the position in the text string to return a character code for.

## Returns

* a [number](/types/string) that is the code in the character set for the selected position in the text string.

## Example

Find the character code for the character at position `6` in a string.

```blocks
let sentence = "Super space ship"
let myCharCode = sentence.charCodeAt(6)
```

## See also

[char at](/reference/text/char-at),
[substr](/reference/text/substr)