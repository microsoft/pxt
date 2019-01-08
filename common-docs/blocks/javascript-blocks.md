# JavaScript Block

JavaScript is a very powerful language; so powerful that some concepts in
JavaScript can't be shown using blocks. When PXT encounters a piece of code
that can't be converted into blocks, it instead creates a grey JavaScript block
to preserve it. These blocks get converted right back into the original
JavaScript when you switch back to the text editor.

```block
for (let index = 0; index <= 5; index++) {
    let x = fibonacci(index);
}

function fibonacci(n: number): number {
    if (n === 0 || n === 1) {
        return 1;
    }

    return fibonacci(n - 1) + fibonacci(n - 2);
}
```

The code in JavaScript blocks cannot be edited, but the blocks
themselves can be moved, copied, pasted, and deleted just like any
other block.


## How do I get my JavaScript code to convert without any grey blocks?

The easiest way to write code that will convert cleanly back to blocks
is to write the code using blocks and convert it to JavaScript. Many blocks
have a very specific structure to their JavaScript that must be
followed in order to have them convert properly. If you have a
piece of your code that does not convert, try looking at the block
you were expecting and the JavaScript it produces.

For example, a for-loop must have this structure to convert to a block:

```typescript
for (let x = 0; x <= 5; x++) {
}
```

The following examples can't be represented by the blocks:

```typescript-ignore
// Condition must be either < or <= with a variable on the left side
for (let x = 0; x > -1; x++) {
}

// The both the variable in the condition and the variable with increment
// operator must be the same as the declared variable
for (let x = 0; x <= 5; y++) {
}

// The declared variable must be initialized to 0
for (let x = 2; x <= 5; x++) {
}

// All three parts of the for-loop must be present
for (;;) {
}
```

Try to match the JavaScript of the desired block as closely as
possible.
