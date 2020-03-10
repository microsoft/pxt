# Python in MakeCode

Our Python support is called **MakeCode Python**. As with TypeScript, the Python implementation is a subset of the full Python languange.

The TypeScript implementation in MakeCode is called Static TypeScript (STS) and similarly, MakeCode Python is often referred to as Static Python (SPY).

### ~ hint

#### MakeCode languages

See the [MakeCode Languages](/language) page for general description of programming
language support in MakeCode.

### ~

## Python - Very brief overview

Python is a simple but expressive language that is used widely from programming simple scripting operations to complex website applications. Learning Python with MakeCode let's you start with simple programs while switching between Blocks and even JavaScript if you want. Later, you can advance to more complex concepts such as arrays and classes. As, you develop a proficiency in the Python editor, you can write code that is too complex for Blocks to represent. Then, you're on your way to become a real power coder!

This section is a very brief overview of what Python code looks like.

### Variables and expressions

Python variables are initialized when declared and the type is inferred from the value assigned. 

```python
a = 10
b = a * 50
```

Some of the common value types for variables are numeric, boolean, and string.

```python
cards = 52
finished = False
month = "Febraury"
```

Expressions are formed using values of these types along with associated operators:

```python
hours = 24
seconds = hours * 60 * 60
pin1 = False
pin2 = True
command = pin1 and pin2
```

### Control structures

Conditional statements and loops rely on indentation to determine block scope for the control structure. Control blocks don't use any text delimiters other that an indent to specify the block scope. The ``if`` and ``if-else`` statement has the code for the condition indented: 

```python
a = True
b = False
if a:
    b = False
else:
    b = True
```

For a multi-level conditional:

```python
a = True
b = False
if a:
    b = False
    if a and b:
        a = False
    else if a or b:
        b = True
else:
    b = True
```

Loops use indentation to determine what code is repeated:

```python
limit = 0
while limit < 10:
    limit = limit + 1

for i in range(10):
    limit = limit + i
``` 

### Functions and function calls

Functions are defined using the `def` directive. The code for a function is indented below the definition statement to show that it is contained in the function. The function is called using the function name with parenthesis to contain any parameters. Functions can return a value or just perform other actions and not return a value.

```python
def square(side):
    return side * side

area = square(9)

def showArea(side):
    print("The area of the square is: " + square(side))

showArea(32)
```

## MakeCode Python implementation

### Code translation

Python support in MakeCode works by converting SPY source code into Static Typscript (STS) and vice versa.
The translation is mostly 1:1 (that is for every statement of STS you usually get
one statement of SPY and vice versa).
The code generated in both directions is meant to be human readable.
The API surface stays largely the same between STS and SPY, except that camel case
like `onChat` are converted into snake case (e.g., `on_chat`) where
appropriate (that is excluding class and enum names; enum members are converted
to upper snake case).

#### Python

```python
def on_chat():
    for i in range(100):
        mobs.spawn(CHICKEN, pos(0, 10, 0))
player.on_chat("chicken", on_chat)
```

#### TypeScript

```typescript
player.onChat("chicken", function () {
    for (let i = 0; i < 100; i++) {
        mobs.spawn(CHICKEN, pos(0, 10, 0))
    }
})
```

This approach has the following advantages:

* the blocks to code and code to blocks is supported for both STS and SPY
  (in case of SPY there is an intermediate conversion to STS)
* the same high-performance runtime is used across STS and SPY
  (it's typically 10-100x faster than embedded interpreters)
* documentation can be converted automatically
* as the SPY - >STS converter infers types, the SPY editor supports
  smart autocompletion, contextual doc-comment display, etc.
* features like debugger are easily shared between SPY and STS

The type annotations are technically optional in both STS and SPY -
TypeScript `any` type is supported in the runtime with dynamic member lookup
(though it still uses compact C++-like memory layout for classes).
Some of this have not been fully implemented or exposed to the user yet though.

### Language support

The disadvantage with this technique is that it imposes some limits in compatibility with the full Python language.

The main missing feature (from both STS and SPY) is `eval`,
and this one is very unlikely to ever change.

Currently, SPY auto-imports all STS namespaces (that is, one can say
`pins.D7.digitalWrite(True)` without saying `import pins` first).
This is mostly due to MakeCode libraries using a large number of namespaces
even in simple programs (as they map directly to block categories).

### Not supported

The following Python language features are currently not supported.

*  `-*- coding: encoding -*-` (only UTF8 is supported)
* class private names `__*` are not mangled
* complex and imaginary numbers
* big integers
* Formatted string literals (for now)
