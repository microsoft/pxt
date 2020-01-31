# Types

For programs to be useful, we need to be able to work with some of the simplest units of data:
numbers, strings, structures, boolean values, and the like.

## Type Inference

In Python, there are several places where type inference is used to provide type information when there is
no explicit type annotation. For example, in this code:

```python
x = 3
y = x + 3
```

The type of the `x` variable is inferred to be `number`. Similarly, the type of `y` variable also is inferred to be `number`.
This kind of inference takes place when initializing variables and members,
setting parameter default values, and determining function return types.

All the examples below give an example type annotation, but will work just the same without the annotation.

## Boolean

The most basic datatype is the simple `True` or `False` value, which is called a `bool` value.

```python
blueSky = False
windy = True

def isStormy(sky: bool, wind: bool):
    return not sky and wind

stormy = isStormy(blueSky, windy)
```

## Number

Both whole numbers and numbers with a fractional part are supported. Sometimes numbers are called _numeric literals_.

### Integers: whole numbers

Integer values can be specified using decimal, hexadecimal, binary, and octal notation. When the number isn't expressed in its decimal form, special characters are used for notation to tell which form it is:

* Decimal: no notation is used
* Hexadecimal: prefix the value with `0x`
* Binary: prefix the value with `0b`
* Octal: prefix the value with `0o`

```python
decimal = 42
hexadecimal = 0xf00d
binary = 0b1010
octal = 0o744
```

### Floating point: numbers with a fractional part

Numbers can have their fractional part too. The decimal point is between the digits of the number.
But, _floating point_ numbers have the decimal point at any spot between digits, like: 3.14159 or 651.75.

```python
num = 0
num = 6.7
num = 10.083
```

## String #string

As in other languages, we use the type `str` to refer to textual data.
Use double quotes (`"`) or single quotes (`'`) to surround string data.

```python
myColor1 = "blue"
myColor2 = 'red'

def colorValue(colorName: str):
    value = 0
    if colorName == 'blue':
        value = 0x0000ff
    elif colorName == "green":
        value = 0x00ff00
    elif colorName == "red":
        value = 0xff0000

    return value

colorNum = colorValue(myColor1)
```

## Array #array

Arrays allow you to work with an expandable sequence of values, addressed by an integer-valued index. An array is formally called a **List** in Python. Arrays are declared by assigning a variable to a list of zero or more items.

```python
myArray = [1, 2, 3]
```

Functions can specify the array type for their parameters.

```python
myArray = [1, 2, 3]

def average(samples: []):
    if len(samples) > 0:
        total = 0
        for item in samples:
            total += item
        return total / len(samples)
    else:
        return 0
    
midVal = average(myArray)
```

### ~hint

#### Array Element Types

For the @boardname@, all elements of an array must have the same type.

### ~

## Enum

As in languages like C#, an enum is a way of giving more friendly names to sets of numeric values. Unlike these languages though, there is no standare `enum` type in Python. Enumerations are created as classes from the base class `Enum`:

```python
ordered = False

class myEnum(Enum):
    ZERO = 0
    ONE = 1
    TWO = 2
    THREE = 3 
    FOUR = 4
    FIVE = 5

if myEnum.FOUR > my.Enum.TWO:
    ordered = True
```

Normally, enum members are numbered starting at `0` but you don't have to use this order.
You can change this by setting your own order for the members.
For example, we can start an enumeration at `1` instead of `0`:

```python
class Colors(Enum):
    Red = 1
    Green = 2
    Blue = 3

c = Colors.Green
```

## NoneType

The `NoneType` is the absence of any type at all. It's expressed as `None` as a type specifier.
You may commonly see this as the return type of functions that do not return a value:

```python
def warnUser() -> None:
    pass

warnUser()
```

## None or No Value

A variable isn't always set to a value. If you want a variable to exist but not have it set to  a value of a type, it can be set to nothing, or `None`. This is often useful to indicate that a variable isn't meaningful for evaluation at the moment.

```python
class Encoder():
    __active = False
    __position = 0
    def isActive(self):
        return self.__active
    def activate(self):
        self.__active = True
    def readPosition(self):
        return self.__position
        
encoder = Encoder()

if encoder.isActive():
    position = encoder.readPosition()
else:
    position = None
```
