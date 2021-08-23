# return

Return a result value from a function back to the program.

```sig
function doSomething(){
    return 0
}
doSomething()
```

If you've made a function in your program, it can work as a block in other parts of your program. If the purpose of your function is to make some result for your
program to use, you can _return_ a value from the function. This is done using a **return** statement in the function.

You can set a variable to  the return value from a function or use it in an
expression like:

```blocks
let result = 0
function oneToTen() {
    return Math.randomRange(0, 10)
}

if (oneToTen() > 5) {
    result = oneToTen()
}
```

The return statement is usually placed at the end of the function. You can put a
return statement anywhere in the function though. The execution of the code in the
function ends when it arrives at a return statement. It's considered good
programming style if you can arrange to have your return statement placed at the
end of the function.

## Example #example

A function calculates the volume of a cube. The result value is returned to the
program.

```blocks
let side = 0;
let volume = 0;
function cubeit() {
    return side * side * side;
}

side = 15;
volume = cubeit();
side = 21;
volume = cubeit();
```

In the example, the **cubeit** function is called twice to calculate the volume of some cubes with different sizes. The code in the function stays in one place. It doesn't have to get copied to the program at everyplace you want to calculate a cube volume. This is really convenient! Your code is reusable.

## See also #seealso
 
[call](/types/function/call),
[define](/types/function/define)
