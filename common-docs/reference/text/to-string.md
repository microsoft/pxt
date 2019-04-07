# to String

Change a [number](/types/number) or a [boolean](/types/boolean) value into a text [string](/types/string).

```sig
toString(123)
```

## Parameters

* **value**: a [number](/types/number) or [boolean](/types/boolean) value to convert to a [string](/types/string).

## Returns

* a [string](/types/string) that is a text representation of **value**.

## Example #example

Convert a boolean and a number value to strings and join them in a sentence.

```blocks
let myBoolean = false
let myNumber = 0

myBoolean = true
myNumber = 123

let myString = "It is " + toString(myBoolean) + " that " + toString(myNumber) + " is now a string!"
```

## Sea also #seealso

[parse int](/reference/text/parse-int), 
[parse float](/reference/text/parse-float)