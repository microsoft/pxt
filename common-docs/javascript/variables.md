# Variable Declarations

Declaring a variable should be done using the ``let`` keyword:

```typescript
let a = 10;
```

## ``var`` vs ``let``

Declaring a variable in JavaScript has always traditionally been done with the `var` keyword.

```typescript-ignore
var a = 10;
```

The `var` construct has some [problems](http://www.typescriptlang.org/docs/handbook/variable-declarations.html), 
which is why `let` statements were introduced. Apart from the keyword used, `let` statements are written 
the same way `var` statements are.

```typescript
let a = 10;
```

The key difference is not in the syntax, but in the semantics, which we'll now dive into.

### ~hint

Use `let` instead of `var` to introduce a new variable!!!

### ~

## Block-scoping

When a variable is declared using `let`, it uses what some call *lexical-scoping* or *block-scoping*.
Unlike variables declared with `var` whose scopes leak out to their containing function, 
block-scoped variables are not visible outside of their nearest containing block or `for`-loop.

```typescript-ignore
function f(input: boolean) {
    let a = 100;

    if (input) {
        // Still okay to reference 'a'
        let b = a + 1;
        return b;
    }

    // Error: 'b' doesn't exist here
    return b;
}
```

Here, we have two local variables `a` and `b`.
`a`'s scope is limited to the body of `f` while `b`'s scope is limited to the containing `if` statement's block.

Another property of block-scoped variables is that they can't be read or written to before they're actually declared.
While these variables are "present" throughout their scope, all points up until their declaration are part of their *temporal dead zone*.
This is just a sophisticated way of saying you can't access them before the `let` statement, and luckily TypeScript will let you know that.

```typescript-ignore
a++; // illegal to use 'a' before it's declared;
let a;
```

## Re-declarations

With `var` declarations, it doesn't matter how many times you declare your variables, you just get one:

```typescript-ignore
var x = 10;
var x = 20; 
```

In the above example, all declarations of `x` actually refer to the *same* `x`, and this is perfectly valid.
This often ends up being a source of bugs. Thankfully, `let` declarations are not as forgiving.

```typescript-ignore
let x = 10;
let x = 20; // error: can't re-declare 'x' in the same scope
```

## Shadowing

The act of introducing a new name in a more deeply nested scope is called *shadowing*.
It is a bit of a double-edged sword in that it can introduce certain bugs on its own in the 
event of accidental shadowing, while also preventing certain bugs.
For instance, imagine a `sumMatrix` function using `let` variables.

```typescript
function sumMatrix(matrix: number[][]) {
    let sum = 0;
    for (let i = 0; i < matrix.length; i++) {
        var currentRow = matrix[i];
        for (let i = 0; i < currentRow.length; i++) {
            sum += currentRow[i];
        }
    }

    return sum;
}
```

This version of the loop will actually perform the summation correctly because the inner loop's `i` shadows `i` from the outer loop.
Shadowing should *usually* be avoided in the interest of write clearer code, such as

```typescript-ignore
function sumMatrix(matrix: number[][]) {
    let sum = 0;
    for (let i = 0; i < matrix.length; i++) {
        var currentRow = matrix[i];
        for (let j = 0; j < currentRow.length; j++) {
            sum += currentRow[j];
        }
    }

    return sum;
}
```
While there are some scenarios where it may be fitting to take advantage of it, you should use your best judgement.

# `const` declarations

`const` declarations are another way of declaring variables.

```typescript
const numLivesForCat = 9;
```

They are like `let` declarations but, as their name implies, their value cannot be changed once they are bound.
In other words, they have the same scoping rules as `let`, but you can't re-assign to them.
