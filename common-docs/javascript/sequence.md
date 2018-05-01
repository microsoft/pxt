# Sequencing

By calling one function after another, in sequence, you can have the program do different things in sequence.

```typescript-ignore
doSomething();
doAnotherThing();
```

## The semicolon 

In JavaScript, the semicolon (;) is used to terminate (or end) a statement. However, in most
cases, the semicolon is optional and can be omitted. So both code sequences below are 
legal:

```typescript-ignore
doSomething()
doAnotherThing()
```

```typescript-ignore
doSomething();
doAnotherThing();
```

## The empty statement

In JavaScript, there is the concept of an *empty statement*, which is whitespace followed by
a semicolon in the context where a statement is expected.
So, the following code is an infinite loop
followed by a call to `doSomething` that will never execute:
```typescript-ignore
while(true) ;
doSomething(); // THIS LINE WILL NEVER EXECUTE!
```

### ~hint

To avoid this problem, we don't allow a program to contain an empty statement, such as shown above. 
If you really want an empty statement, you need to use curly braces to delimit an empty statement block:
```typescript-ignore
while(true) { } 
doSomething(); // THIS LINE WILL NEVER EXECUTE!
```

### ~

[Read more about semicolons in JavaScript](http://inimino.org/~inimino/blog/javascript_semicolons).