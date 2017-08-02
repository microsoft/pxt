# substr

Take some part of the this string to make a smaller string (substring).

```sig
"".substr(0,0);
```

If a string has a part of it copied as another string, it is called a _substring_. A new 
substring is made by copying from the first string at some starting place. Also, the substring
copies just the amount of characters you want from the first string.

You could make a new string that just has the word `"there"` from a bigger string that
says `"Hello there!!!"`. To do that, the substring is copied from the character position of `6` in the first string and `5` characters are copied. It's done like this:

```block
let there = "Hello there!!!".substr(6, 5);
```
If you want to have the substring copy to the end of the first string, you just use the starting
position without any length number. This will copy all of the first string beginning at position `6`. The substring will say `"there!!!"` in this case.

```block
let there = "Hello there!!!".substr(6);
```

## Parameters

* **start**: a [number](/types/number) which is the position to start copying from in this string. 
* **length**: a [number](/types/number) which is the amount of characters to copy from this string. If _length_ is left out, the rest of this string is copied beginning at _start_. If _length_ is `0` or less, a string with nothing in it is made.

## Returns

* a new [string](/types/string) which is some part of the this string.

## Example

Copy the nouns from the sentence into two smaller strings.

```block
let sentence = "The mountains have snow.";
let mountains = sentence.substr(4, 9);
let snow = sentence.substr(19, 4);
```

## See also

[char at](/reference/text/char-at)