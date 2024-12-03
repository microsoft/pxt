# String

A *String* is a sequence of characters. 

## #intro

A string type is more complex than a [number](/types/number) or a [boolean](/types/boolean). Along with its characters a string type contains information about its length an it lets you change any of its charaters using an index. Strings can be broken into smaller strings or added on to make larger strings.

Strings can contain letters, numbers, punctuation marks, and other special characters. Strings can have characters from different languages too.

``"abcdefg1234*?!"``

A string [variable](/blocks/variables/var) is declared by [assigning](/blocks/variables/assign) a variable to a string value:

```block
let myString = "My nice new string is here!"
```

Strings have operations associated with them so that you can change them or work with parts of them.

```blocks
let myString = "My nice new string is here!"
// make a smaller string
let mySmallString = myString.substr(0, myString.indexOf("g") + 1)
```

## Create a string variable #create

```block
let greeting = "hello"
```

To create a variable that holds a string:

1. Click `Variables` (in the Toolbox drawer).
2. Click on **Make a Variable...**.
3. Choose a name for your variable, like "greeting", type it in and click **Ok**.
4. Drag the new variables block into your code.
5. Click on the ``Text``  (in the Toolbox drawer) and find the `" "` block.
6. Click the `" "` and then type a string like `hello`.

Your code should look something like this:

```block
let greeting = "hello"
```

## #examples

## #custom

## See also #seealso
 
[Number](/types/number)