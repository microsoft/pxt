# Variable Declarations

Declaring a variable is simply a matter of just assigning a value to a variable identifier:

```python-ignore
a = 10
```

## Block-scoping

When a variable is declared with an assignment, it uses what some call *lexical-scoping* or *block-scoping*.
Block-scoped variables are not visible outside of their nearest containing block or `for`-loop.

```python-ignore
def f(inp):
    a = 100

    if inp:
        # Still okay to reference 'a'
        b = a + 1
        return b

    # Error: 'b' doesn't exist here
    return b
```

Here, we have two local variables `a` and `b`.
`a`'s scope is limited to the body of `f` while `b`'s scope is limited to the containing `if` statement's block.

Another property of block-scoped variables is that they can't be read or written to before they're actually declared.
While these variables are "present" throughout their scope, all points up until their declaration are part of their *temporal dead zone*.
This is just a sophisticated way of saying you can't access them before the first time they are assigned.

```python-ignore
a++ # illegal to use 'a' before it's declared
a = 0
```
