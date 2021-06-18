# Classes

Classes in Python follow a definition format similar to other object-oriented languages. The classes can have members that are either _public_ or _private_. The inheritance model allows the programmer to subclass and override methods of the parent class.

Let's take a look at a simple class-based example:

```python-ignore
class Greeter:
    def __init__(self, message):
        self.greeting = message
    def greet(self):
        return "Hello, " + self.greeting

greeter = Greeter("world")
```

We declare a new class `Greeter`. This class has three members: a property called `greeting`, a constructor, and a method `greet`.

You'll notice that in the class when we refer to one of the members of the class we prepend `self`.
This denotes that it's a member access.

In the last line we create an instance of the `Greeter` by assigning a variable with a class construction. This calls into the constructor we defined earlier, creating a new object with the `Greeter` shape, and running the constructor to initialize it.

## Inheritance

In python, we can use common object-oriented patterns.
Of course, one of the most fundamental patterns in class-based programming is being able to extend existing classes to create new ones using inheritance.

Let's take a look at an example:

```python-ignore
class Animal:
    def __init__(self, theName):
        self.name = theName
    def move(self, distanceInMeters = 0):
        print(self.name + " moved " + str(distanceInMeters) + "m.")

class Snake(Animal):
    def __init__(self, name):
        Animal.__init__(self, name)
    def move(self, distanceInMeters = 5):
        print("Slithering...")
        Animal.move(self, distanceInMeters)

class Horse(Animal):
    def __init__(self, name):
        Animal.__init__(self, name)
    def move(self, distanceInMeters = 45):
        print("Galloping...")
        Animal.move(self, distanceInMeters)

sam = Snake("Sammy the Python")
tom = Horse("Tommy the Palomino")

sam.move()
tom.move(34)
```

This example covers quite a few of the inheritance features in python that are common to other languages.
Here we see the class definition uses the `Animal` parameter to create a subclass. 
You can see this where `Horse` and `Snake` subclass the base class `Animal` and gain access to its features.

Derived classes that contain constructor functions must call `Animal.__init__()` which will execute the constructor function on the base class.

The example also shows how to override methods in the base class with methods that are specialized for the subclass.
Here both `Snake` and `Horse` create a `move` method that overrides the `move` from `Animal`, giving it functionality specific to each class.
Note that even though `tom` is declared as an `Animal`, since its value is a `Horse`, when `tom.move(34)` calls the overriding method in `Horse`:

```Text
Slithering...
Sammy the Python moved 5m.
Galloping...
Tommy the Palomino moved 34m.
```

## Public, private, and protected modifiers

### Public by default

In our examples, we've been able to freely access the members that we declared throughout our programs.
If you're familiar with classes in other languages, you may have noticed in the above examples 
we haven't had to use the word `public` to accomplish this; for instance, 
C# requires that each member be explicitly labeled `public` to be visible.
In python, each member is `public` by default.

### Understanding `private`

When a member is prefixes with a double underscore `__` it is **private** and cannot be accessed from outside of its containing class. For example:

```python-ignore
class Animal:
    def __init__(self, theName):
        self.__name = theName
    def move(self, distanceInMeters):
        print(str.format("{0} moved {1}m.", self.__name, distanceInMeters))

Animal("Cat").__name # AttributeError: 'Animal' object has no attribute '__name'
```

### Understanding `protected`

The **protected** modifier `_` acts much like the **private** modifier with the exception that members 
declared protected can also be accessed by instances of deriving classes. Note that Python will not
prevent these members being accessed in other situations - it's merely a convention.

For example,

```python-ignore
class Person:
    def __init__(self, name):
        self._name = name

class Employee(Person):
    def __init__(self, name, department):
        Person.__init__(self, name)
        self.__department = department

    def getElevatorPitch(self):
        return "Hello, my name is " + self._name + " and I work in " + self.__department + "."

howard = Employee("Howard", "Sales")
print(howard.getElevatorPitch())
print(howard._name) # Disallowed by convention
```

Notice that while we can't use `_name` from outside of `Person` (by convention), 
we can still use it from within an instance method of `Employee` because `Employee` derives from `Person`.
