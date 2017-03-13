# Sequencing

By calling one function after another, in sequence, you can create an animation:

```typescript
basic.showLeds(`
    . # . # .
    . . . . .
    . . # . .
    # . . . #
    . # # # .
    `);
basic.showLeds(`
    . # . # .
    . . . . .
    . . . . .
    . # # # .
    # . . . #
    `);
```

### The semicolon 

In JavaScript, the semicolon (;) is used to terminate (or end) a statement. However, in most
cases, the semicolon is optional and can be omitted. So both code sequences below are 
legal:

```typescript
basic.showNumber(1)
basic.showNumber(2)
```

```typescript
basic.showNumber(1); 
basic.showNumber(2);
```

### The empty statement

In JavaScript, there is the concept of an *empty statement*, which is whitespace followed by
a semicolon in the context where a statement is expected.
So, the following code is an infinite loop
followed by a call to `showNumber` that will never execute:
```typescript-ignore
while(true) ;
basic.showNumber(1);
```


### ~hint

For the @boardname@, we don't allow a program to contain an empty statement, such as shown above. 
If you really want an empty statement, you need to use curly braces to delimit an empty statement block:
```typescript
while(true) { } 
basic.showNumber(1);
```

### ~

[Read more](http://inimino.org/~inimino/blog/javascript_semicolons) about semicolons in JavaScript.
