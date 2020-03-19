# Functions

Functions are the fundamental building block of programs. Here is the simplest
way to make a function that adds two numbers:

```python-ignore
# Named function
def add(x, y):
    return x + y

sum = add(1, 2)
```

Functions can refer to variables outside of the function body.
When they do so, they're said to `capture` these variables.

```python-ignore
z = 100

def addToZ(x, y):
    return x + y + z

sum = addToZ(1, 2)
```

Python can figure the return type out by looking at the return statements, so you can optionally leave this off in many cases.

## Optional and Default Parameters

The number of arguments given to a function has to match the number of parameters the function expects.

```python-ignore
def buildName(firstName, lastName):
    return firstName + " " + lastName;

result1 = buildName("Bob")                  # error, too few parameters
result2 = buildName("Bob", "Adams", "Sr.")  # error, too many parameters
result3 = buildName("Bob", "Adams")         # ah, just right
```

In Python, if a parameter is optional, and users may leave them off as they see fit.
When they do, their value is `None`.
We can get this functionality in Python by assigning `None` to the parameters we want to be optional.
For example, let's say we want the last name parameter from above to be optional:

```python-ignore
def buildName(firstName, lastName = None):
    if lastName:
        return firstName + " " + lastName
    else:
        return firstName

result1 = buildName("Bob")                  # works correctly now
result2 = buildName("Bob", None)            # this works too
result3 = buildName("Bob", "Adams", "Sr.")  # error, too many parameters
result4 = buildName("Bob", "Adams")         # ah, just right
```

Any optional parameters must follow required parameters.
Had we wanted to make the first name optional rather than the last name, we would need to change the order of parameters in the function, putting the first name last in the list.

In Python, we can also set a value that a parameter will be assigned if the user does not provide one, or if the user passes `None` in its place.
These are called default-initialized parameters.
Let's take the previous example and default the last name to `"Smith"`.

```python-ignore
def buildName(firstName, lastName = "Smith"):
    return firstName + " " + lastName

result1 = buildName("Bob")                  # works correctly now, returns "Bob Smith"
result2 = buildName("Bob", None)            # Nope, that's a type error this time
result3 = buildName("Bob", "Adams", "Sr.")  # error, too many parameters
result4 = buildName("Bob", "Adams")         # ah, just right
```

Default-initialized parameters that come after all required parameters are treated as optional, and just like optional parameters, can be omitted when calling their respective function.
This means optional parameters and trailing default parameters will share commonality in their types, so both

```python-ignore
def buildName(firstName, lastName = None):
    # ...
```

and

```python-ignore
def buildName(firstName, lastName = "Smith"):
    # ...
```

share the same type `(firstName: str, lastName: str = None) => string`.
The default value of `lastName` disappears in the type, only leaving behind the fact that the parameter is optional.

## Handler Functions

Handler functions are functions that take some action when an event or change of state occurs. Usually, some other code saves, or registers, the handler function in a variable in order to call
it at a later time. When an event happens, like a new input value or an elapsed timer, the handler is called to run a response action.

As an example, the `Thermal` class will check for changes in temperature and run a registered handler when the temperature drops to a set thershold:

```python-ignore
# the handler function when it's cold...
def whenCold():
    print("It's cold!")

# 'Thermal' class to monitor temperature
class Thermal:
    action = None
    cold = 10
    temp = 5
    def __init__(self, cold = 10):
        self.cold = cold
    def whenCold(self, handler):
        self.action = handler
    def checkCold(self):
        if self.temp <= self.cold:
            self.action()

thermal = Thermal()
# register the 'whenCold()' function as a parameter
thermal.whenCold(whenCold)
thermal.checkCold()
```

## Lamda Functions

Lamda functions serve as a kind of shortcut to return a result of an expression. A lamda is often saved to a variable and then used like a function to return the expression result:

```python-ignore
def square(x):
    return x * x

area = lambda x, y: x * y

def cube(area, height):
    return area * height

volume1 = cube(square(5), 5)
volume2 = cube(area(4, 3), 10)
```

A lambda can also be used anonymously to directly return a result.

```python-ignore
print("area = " + str((lambda x, y: x * y)(3, 4)))
```
