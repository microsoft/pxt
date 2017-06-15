# Variables

A variable is a place where you can store and retrieve data. Variables have a name, a [type](/types), and value:

* *name* is how you'll refer to the variable
* *type* refers to the kind of data a variable can store
* *value* refers to what's stored in the variable

### ~ hint

You can use the default variable names given in the blocks if you'd like. However, it's best to use descriptive variable names. To change a variable name in the editor, select the down arrow next to the variable and then click "new variable".

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
