# Functions

Functions are the fundamental building block of programs. Here is the simplest
way to make a function that adds two numbers:

```typescript
// Named function
function add(x : number, y : number): number {
    return x + y;
}

let sum = add(1, 2);
```

### ~ hint

For the @boardname@, you must specify a [type](/javascript/types) for each function parameter. 

### ~ 

Functions can refer to variables outside of the function body.
When they do so, they're said to `capture` these variables.

```typescript
let z = 100;

function addToZ(x: number, y: number) {
    return x + y + z;
}

let sum = addToZ(1, 2);
```

Let's add a return type to our add function:

```typescript
function add(x: number, y: number): number {
    return x + y;
}
```

TypeScript can figure the return type out by looking at the return statements, so you can optionally leave this off in many cases.

## Optional and Default Parameters

In TypeScript, the number of arguments given to a function has to match the number of parameters the function expects.

```typescript-ignore
function buildName(firstName: string, lastName: string) {
    return firstName + " " + lastName;
}

let result1 = buildName("Bob");                  // error, too few parameters
let result2 = buildName("Bob", "Adams", "Sr.");  // error, too many parameters
let result3 = buildName("Bob", "Adams");         // ah, just right
```

In JavaScript, every parameter is optional, and users may leave them off as they see fit.
When they do, their value is `undefined`.
We can get this functionality in TypeScript by adding a `?` to the end of parameters we want to be optional.
For example, let's say we want the last name parameter from above to be optional:

```typescript-ignore
function buildName(firstName: string, lastName?: string) {
    if (lastName)
        return firstName + " " + lastName;
    else
        return firstName;
}

let result1 = buildName("Bob");                  // works correctly now
let result2 = buildName("Bob", "Adams", "Sr.");  // error, too many parameters
let result3 = buildName("Bob", "Adams");         // ah, just right
```

Any optional parameters must follow required parameters.
Had we wanted to make the first name optional rather than the last name, we would need to change the order of parameters in the function, putting the first name last in the list.

In TypeScript, we can also set a value that a parameter will be assigned if the user does not provide one, or if the user passes `undefined` in its place.
These are called default-initialized parameters.
Let's take the previous example and default the last name to `"Smith"`.

```typescript-ignore
function buildName(firstName: string, lastName = "Smith") {
    return firstName + " " + lastName;
}

let result1 = buildName("Bob");                  // works correctly now, returns "Bob Smith"
let result2 = buildName("Bob", undefined);       // still works, also returns "Bob Smith"
let result3 = buildName("Bob", "Adams", "Sr.");  // error, too many parameters
let result4 = buildName("Bob", "Adams");         // ah, just right
```

Default-initialized parameters that come after all required parameters are treated as optional, and just like optional parameters, can be omitted when calling their respective function.
This means optional parameters and trailing default parameters will share commonality in their types, so both

```typescript
function buildName(firstName: string, lastName?: string) {
    // ...
}
```

and

```typescript
function buildName(firstName: string, lastName = "Smith") {
    // ...
}
```

share the same type `(firstName: string, lastName?: string) => string`.
The default value of `lastName` disappears in the type, only leaving behind the fact that the parameter is optional.

Unlike plain optional parameters, default-initialized parameters don't *need* to occur after required parameters.
If a default-initialized parameter comes before a required parameter, users need to explicitly pass `undefined` to get the default initialized value.
For example, we could write our last example with only a default initializer on `firstName`:

```typescript-ignore
function buildName(firstName = "Will", lastName: string) {
    return firstName + " " + lastName;
}

let result1 = buildName("Bob");                  // error, too few parameters
let result2 = buildName("Bob", "Adams", "Sr.");  // error, too many parameters
let result3 = buildName("Bob", "Adams");         // okay and returns "Bob Adams"
let result4 = buildName(undefined, "Adams");     // okay and returns "Will Adams"
```

## Arrow Functions

Arrow functions, also known as _lambda_ functions, provide a lightweight syntax for functions. Arrow functions are used extensively to provide event handlers for many APIs. For example:

```typescript
function foo(handler: Action) {
    // call handler ...
}

foo(() => { // arrow function!
   // do something
})
```

Often, a function like ``foo()`` will save the arrow function ``handler`` in a variable to run the code inside the function later when a certain condition occurs. Arrow functions serve as a kind of shortcut to provide extra code to run without having to write a separate formal function for that purpose. In this way arrow, or lambda, functions are thought of as "anonymous" functions.

[Read more about arrow functions...](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)


## Anonymous Functions

Anonymous functions are used just like arrow functions. They're called "anonymous" because the function doesn't have a name and isn't called using a name. The function is remembered by it's _reference_. This means that a variable is used to remember the function or the function is used directly ("inline").

Here's an example similar to the one shown for arrow functions but this time the ``foo()`` function uses an anonymous function directly:

```typescript
function foo(handler: Action) {
    // call handler ...
}

foo(function() { // use an inline function
   // do something
})
```

Also, you can set a variable to remember the function and use that variable as a reference to the anonymous function:

```typescript
function foo(handler: Action) {
    // call handler ...
}

let anon = function() { // anonymous function, set it to a variable
    // do something
}

foo(anon)
```