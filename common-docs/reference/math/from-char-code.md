# from Char Code

Make a single character string from a character code number.

```sig
String.fromCharCode(0);
```

In order for computers to use text, each letter and symbol needs a number to identify it from all the others. Also, different languages have their own letters and symbols. The whole group of letters and symbols used by a computer for any one language is called a _character set_.

Let's say you made your own language that used just the letters: `A, B, C, D, E, F`. Your language has a character set of 6 letters. If the letter `A` is the first letter in your character set, then it has a character code of `0`. Likewise, the character code of `F` is `5`.

One of the first and most popular character sets used in computers is [ASCII](https://wikipedia.org/wiki/ASCII). There are many characters in ASCII so the letter `A` has a code of `65`.

Most newer character sets kept all the letters and symbols from ASCII and added many more. So, it's common that the codes for the older ASCII letters work in the new sets. Any time you are interacting with a computer, you are typing letters and symbols from a character set and it is displaying letters and symbols from a character set.

So, you can make the letter `B` from:

```block
let letItBe = String.fromCharCode(66);
```

## Parameters

* **code**: the code [number](/types/number) of the letter, number symbol, or other symbol (like punctuation marks) in the character set.

## Returns

* a single character [string](/types/string) that is a letter or symbol chosen from the character set.

## Example

Decode a secret message from an array of numbers!

```blocks
let secret = [67, 111, 111, 107, 105, 101, 115, 33];
let decoded = "";
for (let code of secret) {
    decoded = decoded + String.fromCharCode(code);
}
```

## See also

[parse float](/reference/text/parse-float)