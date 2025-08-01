# Multiple languages

In addtion to Block-based tutorials, MakeCode supports tutorials for JavaScript and Python.

## Using JavaScript

A JavaScript only tutorial is authored in the same way as a Blocks tutorial except that the snippets are enclosed by the ```` ```typescript```` tag instead of with ```` ```blocks````.

````
```typescript
sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, function (sprite, otherSprite) {
    otherSprite.destroy()
})
```
````

## Using Python

If the target supports Python, snippets can be written in JavaScript or Python directly.

### Python snippets

Using ``python`` after the triple tick like this:

````
```python
for i in range(100):
    mobs.spawn(CHICKEN, pos(0, 10, 0))
```
````

### Spy snippets (JavaScript to Python)

Snippets can also be written in JavaScript and automatically converted to Python
at display time. Use a ``spy`` section:

````
```spy
basic.showString("Hello!")
```
````

### Other languages

Note that if the target supports python, then snippets are written in the usual way like:

````
```typescript
basic.showString("Hello!")
```

    - or -

```blocks
basic.showString("Hello!")
```
````

Users will have the option of clicking the Python icon to see the snippet in Python just like they can with Blocks and Javascript/Typescript.

### Python templates
To provide starter code in Python, these should be written using **python-template** like this:
````
```python-template
for i in range(100):
    mobs.spawn(CHICKEN, pos(0, 10, 0))
```
````

## JavaScript and Python with a single tutorial ("Spy tutorials")

If you are able to author your tutorial in a language agnostic way,
you will be able to have a single source document for both JavaScript and Python. You can specify a single tutorial for multiple languages using the [otherActions](/targets/home-screen#otheractions) field in the tutorial code card.
