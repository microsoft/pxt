# Variables

A variable is a place where you can store and retrieve data. Variables have a name, a [type](/reference/types), and value:

* *name* is how you'll refer to the variable
* *type* refers to the kind of data a variable can store
* *value* refers to what's stored in the variable

### ~ hint

You can use the default variable names if you'd like, however, it's best to use descriptive variable names. To change a variable name in the editor, select the down arrow next to the variable and then click "new variable".

### ~

### ``let`` statement

Use the Block Editor variable statement to create a variable 
and the [assignment operator](/blocks/variables/assign) 
to store something in the variable.

For example, this code stores the number `2` in the `x` variable:

```block
let x = 2;
```
Here's how to define a variable in the Block Editor:

1. Click `variables`.

2. Change the default variable name if you like.

3. Drag a block type on the right-side of the [assignment operator](/blocks/variables/assign) and click the down arrow to change the variable name.

A variable is created for the number returned by the [brightness](/reference/led/brightness) function.

```block
let b = led.brightness();
```

### Using variables

Once you've defined a variable, just use the variable's name whenever you need what's stored in the variable. For example, the following code shows the value stored in `counter` on the LED screen:

```blocks
let counter = 1;
basic.showNumber(counter);
```

To change the contents of a variable use the assignment operator. The following code sets `counter` to 1 and then increments `counter` by 10:

```block
let counter = 1;
counter = counter + 10;
basic.showNumber(counter);
```

### Why use variables?

If you want to remember and modify data, you'll need a variable. 
A counter is a great example:

```block
let counter = 0;
input.onButtonPressed(Button.A, () => { 
  counter = counter + 1;
  basic.showNumber(counter);
});
```

### Local variables

Local variables exist only within the function or block of code where they're defined. For example:

```block
// x does NOT exist here.
if (led.brightness() > 128) {
  // x exists here
  let x = 0;
}
```
