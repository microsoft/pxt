# length

Get the number of characters in the text string.

```block
let text = "";
text.length;
```

## Returns

* a [number](/types/number) that is the length (number of characters) in the text string.

## Example

Add some text to a string until it is at least 100 characters long.

```blocks
let tooShort = "";
while (tooShort.length < 100)
{
    tooShort = tooShort + "add some more...";
}
```