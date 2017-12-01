# Variables

A program is always working with information. The information, or data, that a program needs is kept somewhere in a computer's memory. Memory in a computer is arranged so that the data stored there can be found using an address. An address is a number that tells where the data that program wants to use is located in memory.

For a program, using an address number to get and store data is very inconvenient. So, programs use _variables_ instead. A variable represents the place in memory for the data that's kept there. It's called a variable because the data it represents may change (vary) when the program stores something new there. When you create a new variable in your program, you're reserving a place in memory for some data that your program might want to create, copy, or check on later.

Variables have a name, a [type](/types), and a value:

* *name* - how you'll refer to the variable
* *type* - the kind of data a variable will store
* *value* - what's stored (the data) in the variable

### ~ hint

You can use the default variable names given in the blocks if you'd like. However, it's best to use descriptive variable names. To change a variable name in the editor, select the down arrow next to the variable and then click "Rename variable...".

### ~

## ``let`` statement

Use the Block Editor variable statement to create a variable 
and the [assignment operator](/blocks/variables/assign) 
to store something in the variable. This is called _declaring_ the variable.

For example, this code stores the number `2` in the `x` variable:

```block
let x = 2;
```
Here's how to make a variable in the Block Editor:

1. Click `variables`.

2. Change the default variable name if you like.

3. Drag a block type on the right-side of the [assignment operator](/blocks/variables/assign) and click the down arrow to change the variable name.

When you make, or declare, a variable in code, you'll use the ```let``` statement. It looks like this:

```typescript
let percent = 50;
```

### #letexample

### Reading variable values

Once you've declared a variable, just use the variable's name whenever you need what's stored in the variable. 

#### #readvariableexample

```block
let count = 10
let half = count / 2
```

### Updating variable values

To change the contents of a variable use the assignment operator. 

#### #updatevariableexample
```block
let count = 10
if (count < 20) {
    count = 20
}
```
### Why use variables?

If you want to remember and modify data somewhere in your program later, you'll need a variable. 

#### #whyusevariablesexample

### Local variables

Local variables exist only within the function or block of code where they're declared.

Here, the variable `index` only exists inside the **for** block. The `looping` variable exists both
outside and inside the **for** block.

#### #localvariableexample

```block
let looping = true;
for (let index = 0; index <= 10; index++) {
    if (index == 10) {
        looping = false;
    }
}
```

## See also

[Assignment operator](/blocks/variables/assign), [Change operator](/blocks/variables/change)
