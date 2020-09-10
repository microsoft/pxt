# is Empty

Determines whether a text string has any characters in it or not.

```sig
"".isEmpty()
```

## Returns

* a [boolean](/types/boolean) value which is `true` if string has no characters in it or `false` if there is one or more characters.

## Example

Check if a string called `myString` is empty.

```blocks
let myString = ""
let emptyStatus = false
if (myString.isEmpty()) {
    emptyStatus = true
}
```

## See also #seealso

[includes](/reference/text/includes)