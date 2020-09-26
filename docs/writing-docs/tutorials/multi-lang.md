# Multiple languages

## Using Python

If the target supports Python, snippets can be written in JavaScript or Python directly.

## Python snippets

Using ``python`` after the triple tick like this:

````
```python
for i in range(100):
    mobs.spawn(CHICKEN, pos(0, 10, 0))
```
````

## Spy snippets (JavaScript to Python)

Snippets can also be written in JavaScript and automatically converted to Python
at display time. Use the ``spy`` section:

````
```spy
basic.showString("Hello!")
```
````

## Other languages

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

## JavaScript and Python tutorial ("Spy tutorials")

If you are able to author your tutorial in a language agnostic way,
you will be able to have a single source document for both JavaScript and Python. You can specify a single tutorial for multiple languages using the [otherActions](/targets/home-screen#otheractions) field in the tutorial code card.
