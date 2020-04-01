# Classes

Classes in Python follow a definition format similar to other object-oriented languages. The classes can have members that are either _public_ or _private_. The inheritance model allows the programmer to subclass and override methods of the parent class.

Let's take a look at a simple class-based example:

```python-ignore
class Greeter:
    greeting = ""
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
    name = ""
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

You may still mark a member `public` explicitly.
We could have written the `Animal` class from the previous section in the following way:

```python-ignore
class Animal:
    name = ""
    def __init__(self, theName):
        self.name = theName
    def move(self, distanceInMeters):
        print(str.format("{0} moved {1}m.", self.name, distanceInMeters))
```

### Understanding `private`

When a member is prefixes with a double underscore `__` it is **private** and cannot be accessed from outside of its containing class. For example:

```python-ignore
class Animal:
    __name = ""
    def __init__(self, theName):
        self.name = theName
    def move(self, distanceInMeters):
        print(str.format("{0} moved {1}m.", self.name, distanceInMeters))

Animal("Cat").name # Error: 'name' is private
```

Python is a structural type system.
When we compare two different types, regardless of where they came from, if the types of all members are compatible, then we say the types themselves are compatible.

However, when comparing types that have **private** and **protected** members, we treat these types differently.
For two types to be considered compatible, if one of them has a **private** member, 
then the other must have a **private** member that originated in the same declaration.
The same applies to **protected** members.

Let's look at an example to better see how this plays out in practice:

```python-ignore
class Animal:
    __name = ""
    def __init__(self, theName):
        self.__name = theName
class Rhino(Animal):
    def __init__(self):
        Animal.__init__(self, "Rhino")
class Employee:
    __name = ""
    def __init__(self, theName):
        self.__name = theName

animal = Animal("Goat")
rhino = Rhino()
employee = Employee("Bob")

animal = rhino
animal = employee # Error: 'Animal' and 'Employee' are not compatible
```

In this example, we have an `Animal` and a `Rhino`, with `Rhino` being a subclass of `Animal`.
We also have a new class `Employee` that looks identical to `Animal` in terms of shape.
We create some instances of these classes and then try to assign them to each other to see what will happen.
Because `Animal` and `Rhino` share the private side of their shape from the same declaration of 
`__ name = ""` in `Animal`, they are compatible. However, this is not the case for `Employee`.
When we try to assign from an `Employee` to `Animal` we get an error that these types are not compatible.
Even though `Employee` also has a private member called `name`, it's not the one we declared in `Animal`.

### Understanding `protected`

The **protected** modifier `_` acts much like the **private** modifier with the exception that members 
declared protected can also be accessed by instances of deriving classes. For example,

```python-ignore
class Person:
    _name = ""
    def __init__(self, name):
        self.name = name

class Employee(Person):
    __department = ""

    def __init__(self, name, department):
        Person.__init__(self, name)
        self.department = department

    def getElevatorPitch(self):
        return "Hello, my name is " + self.name + " and I work in " + self.department + "."

howard = Employee("Howard", "Sales")
print(howard.getElevatorPitch())
print(howard.name) # error
```

Notice that while we can't use `name` from outside of `Person`, 
we can still use it from within an instance method of `Employee` because `Employee` derives from `Person`.