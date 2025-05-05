# substr

Take some part of the this string to make a smaller string (substring).

```sig
"".substr(0, 0)
```

You can copy a part of another string by getting a _substring_ from it. A new 
substring is made by copying some amount of characters from the first string, starting at a beginning position.

You could make a new string that just has the word `"there"` from a bigger string that
says `"Hello there!!!"`. To do that, the substring is copied from the character position of `6` in the first string and `5` characters are copied. It's done like this:

```block
let there = "Hello there!!!".substr(6, 5)
```

If you want to have the substring copy to the end of the first string, you just use a starting
position and set `0` as the length. This will copy all of the first string beginning at position `6`. The substring will say `"there!!!"` in this case.

```block
let there = "Hello there!!!".substr(6, 0)
```

## Parameters

* **start**: a [number](/types/number) which is the position to start copying from the original this string. 
* **length**: a [number](/types/number) which is the amount of characters to copy from the original string. If _length_ is set to `0`, the rest of this string is copied beginning at _start_. If _length_ is `0` or less, a string with nothing in it is returned.

## Returns

* a new [string](/types/string) which is some part of the original string.

## Example

Copy the nouns from the sentence into two smaller strings.

```blocks
let sentence = "The mountains have snow."
let mountains = sentence.substr(4, 9)
let snow = sentence.substr(19, 4)
```

## See also

[char at](/reference/text/char-at)