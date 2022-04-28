# Custom blocks

This page provides a short introduction to defining your own blocks in MakeCode. 

## Custom blocks? I can't find it in the editor!

That's right. It's possible to define your own functions in JavaScript and turn them into blocks 
with the addition of some special comment macros.

Any exported JavaScript function can be turned into a block by simply adding a ``//% block`` comment:

```typescript
namespace fun {
    /**
    * Computes the famous Fibonacci number sequence!
    */
    //% block
    export function fib(value: number): number {
        return value <= 1 ? value : fib(value - 1) + fib(value - 2);
    }
}
```

There are several options to control the appearance of your blocks. 
We generate a few of those in the template to get you started. 
For the complete guide, read https://makecode.com/defining-blocks.

## Storing blocks within a project

Do not add block definitions directly into ``main.ts`` as they will show up as grey blocks.
Instead, follow the steps below to add a new file, ``custom.ts``, and add all your blocks in that file.

In order to add ``custom.ts`` to your project, you do this:

* go to JavaScript
* click on the **Explorer** view and expand it
* click on the ``+`` button that just appeared
* accept the dialog to add a ``custom.ts`` file in your project

If you already have added this file to your project, simply navigate to it using the **Explorer** view.

## Using a shared project in **Extensions**

You can add a shared project as a dependent extension and re-use all the blocks from that project. Just click on the **Extensions**
button, paste the shared project url, and search.

## Development cycle

Once ``custom.ts`` is added to your project, you can alternate between this file and the blocks view.
The blocks will automatically reload on each iteration.

If nothing shows up in your category, you might have a syntax error in your function definition.
Make sure that your code compiles and that the comments look correct.

## Sharing your blocks

The easiest way to share your blocks is to share the entire project using the [share button](/share).

## Taking it to GitHub

If you plan to reuse those blocks further, you might consider turning them into an [extension](/extensions).

## Default custom.ts

When ``custom.ts`` is created, it contains some default code for blocks as a placeholders for you to start with.
Depending on your language the default ``custom.ts`` looks something like this:

```typescript

/**
* Use this file to define custom functions and blocks.
* Read more at https://makecode.microbit.org/blocks/custom
*/

enum MyEnum {
        //% block="one"
        One,
        //% block="two"
        Two
}

/**
* Custom blocks
*/
//% weight=100 color=#0fbc11 icon=""
namespace custom {
    /**
    * TODO: describe your function here
    * @param n describe parameter here, eg: 5
    * @param s describe parameter here, eg: "Hello"
    * @param e describe parameter here
    */
    //% block
    export function foo(n: number, s: string, e: MyEnum): void {
        // Add code here
    }

    /**
    * TODO: describe your function here
    * @param value describe value here, eg: 5
    */
    //% block
    export function fib(value: number): number {
	return value <= 1 ? value : fib(value - 1) + fib(value - 2);
    }
}
```
