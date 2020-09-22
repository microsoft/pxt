# Function definition

The name, arguments, and code for a function.

```block
function doSomething(){}
```

A function lets you create a portion of code that you can reuse in your program. This is handy because
you can put code that you want to use over again in a function. Instead of copying the same code to many
places in your program, you can just use a function you made and all the code inside is used as a single
block.

## The _function_ word

All functions definitions begin with the word **function**. This means that the definition will start.

```typescript
function myFunction() {
}
```

## Name

A function has a _name_ that is unique. You also give a name to a function which gives an idea about what
the code in the function does. If you want to make a function to set all LEDs to green, then you might call
the function, **setAllGreen**. This gives you and anyone else looking at your code an idea of what
the function will do.

```blocks
function setAllGreen() {
    let lightsOn = true
}
```

If you had some functions with the names **function1**, **function2**, and **function3**, they would be unique but
you probably wouldn't remember what each one does the next time you looked at your code. That's why it's
best to give your functions names that tell you what the code inside is going to accomplish.

## Return value

A function can [return](/types/function/return) a value back to your program. A return value is usually a result of an evaluation or status from an operation that happened in your function.

```blocks
function weAreHappy() {
    return true
}
```

## Parameters

If you want to give data to your function, you can include one or more _parameters_ which are values you send to the function. Parameters work like variables inside the function.

```blocks
function square(side: number) {
	return side * side
}
```

A function can have multiple parameters too.

```blocks
function volume(side1: number, side2: number, side3: number) {
    return side1 * side2 * side3
}
```

The parameters can have different [types](/types). For example, if you want to make a function to add two strings together, you could have two string parameters and one boolean parameter to tell which string is first.

```blocks
function addStrings(stringA: string, stringB: string, first: boolean) {
    if (first) {
        return stringA + stringB
    } else {
        return stringB + stringA
    }
}
```
### ~ hint

#### Pull down the parameter

In blocks, you can pull a parmeter from the function block and drag it down and place it as a variable in the code inside the function.

Pull the ``||variables:message||`` parameter from the **repeat** function.

```block
function repeat(message: string) {
    let repeated = ""
    for (let index = 0; index < 3; index++) {
        repeated += "hello" + ", "
    }
}
```

Then, use it as a variable to replace the **"hello"** string.

```block
function repeat(message: string) {
    let repeated = ""
    for (let index = 0; index < 3; index++) {
        repeated += message + ", "
    }
}
```

### ~

## Body

The _body_ of the function is the code inside of the function block. The work of the function happens here.

```blocks
let side = 25;
let square = 0;

function squared( ) {
    square = side * side;
}
```

## Example

Make a function to calculate the average of score of quiz scores in a list.

```blocks
let scores = [9, 5, 3, 1, 6, 3, 5, 7];
let average = 0;

function averageScore( ) {
    let count = 0;
    for (let score of scores) {
        count += score;
    }
    average = count / scores.length;
}
```

## See also #seealso
 
[call](/types/function/call),
[return](/types/function/return)
