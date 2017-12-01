# char At

Get a character (letter, number, or symbol) from a place in the text string.

```sig
"".charAt(0);
```

You can find out which character is at any place in some text. You might have text thats says `"Hello there!"`. The character at position 6 is `'t'`. The word "Hello" plus the space have positions 0 - 5, so, 't' is at position 6. To get the character at this position, the letter `'t'`, you could use a blocks like this:

```block
let greeting = "Hello there!";
let tee = greeting.charAt(6);
```

## Parameters

* **index**: the [number](/types/number) for the position in the text string to return a character for.

## Returns

* a single character [string](/types/string) that is from the selected position in the text string.

## Example

Make a funny new sentence from an existing sentence by choosing every other letter.

```blocks
let sentence = "Cinnamon vanilla latte";
let funnySentence = "";
for (let i = 0; i < sentence.length; i++) {
    if (i % 2 > 0) {
        funnySentence = funnySentence + sentence.charAt(i);
    }
}
```

## See also

[substr](/reference/text/substr)