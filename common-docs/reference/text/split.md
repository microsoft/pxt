# split

Split a string into smaller strings using a separator string to divide the larger string.

```sig
"".split(",")
```

A string is split into one or more shorter strings by finding a special string in the bigger string and dividing it right at that string. That special string is called a _separator_. The separator string is often just single character but it can also be longer if you want. The smaller strings that result after the split are returned in a string [array](/types/array).

If a string contains a list of animals and those animal names each end with a comma, that comma can be the separator.

```block
let animals = "giraffe,lion,wolf,hippo,cat,racoon"
```

When the `animals` string is split using the comma, an array of animal names is created.

```block
let animals = "giraffe,lion,wolf,hippo,cat,racoon"
let animalNames = animals.split(",")
```

If you wanted to get the `"hippo"` string, just select the string from `animalNames` at the index of `3`.

```block
let animals = "giraffe,lion,wolf,hippo,cat,racoon"
let animalNames = animals.split(",")
let hippo = animalNames[3]
```

Besides using a separator string, the split operation can use a **limit** parameter. This limits the number of smaller strings that are split from the bigger string. There are `6` animal names in the `animal` string in the examples. If you only wanted just the first `2` animals from that string, you can set the limit to `2`.

```typescript
let animals = "giraffe,lion,wolf,hippo,cat,racoon"
let animalNames = animals.split(",",2)
```

Now, the resulting array of `animalNames` will only have `"giraffe"` and `"lion"` as its members.

## Parameters

* **separator**: a [string](/types/string) which tells the split operation where to divide the larger string into smaller strings.
* **limit**: a [number](/types/number) which is maximum number of smaller strings to split from the larger string. The limit value can be more than the number of possible strings to split, but only the possible number of split strings is returned.

## Returns

* a string [array](/types/array) which contains the smaller strings spilt at the separator.

## Examples #examples

### Get the rainbow colors #ex1

Split a string with the rainbow color names into a color list.

```blocks
let rainbow = "red, orange, yellow, green, blue, indigo, violet"
let colors = rainbow.split(",")
```

### Secret message #ex2

Decode a secret message from a sentence that is "confused" by extra characters. The extra characters are called the `messageKey`. The string is split using the key.

```blocks
let message = ""
let messageKey = "j8it62we"
let secret = "j8it62weHelj8it62welo,j8it62we mj8it62wey namj8it62wee ij8it62wes Sanj8it62wedy"
let decoded = secret.split(messageKey)
for (let word of decoded) {
    message = "" + message + word
}
```

## See also #seealso

[substr](/reference/text/substr)