# Function call

Use a function by its name somewhere in a program.

```sig
function doSomething(){}
doSomething();
```

If you've made a function in your program, it can work as a block in other parts of your program. To use
your function you make a _function call_. This is like calling a friend for help. The function has
code inside of it that will do something to help your other code. So, you _call_ your function for help to
get something done now. Like this:

```blocks
let side = 0;
let volume = 0;
function cubeit() {
    volume = side * side * side;
}

side = 15;
cubeit();
side = 21;
cubeit();
```

In the example, the **cubeit** function is called twice to calculate the volume of some cubes with different sizes. The code in the function stays in one place. It doesn't have to get copied to the program at everyplace you want to calculate a cube volume. This is really convenient! Your code is reusable.

## See also #seealso
 
[define](/types/function/define),
[return](/types/function/return)
