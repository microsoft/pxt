# Macros

MakeCode has several custom macros that extend regular markdown. These provide extra style features and code / blocks rendering in the document pages.

The following macros are the MakeCode custom extensions to markdown.

## Checkboxes in bullet points

Use ``* [ ]`` to create a bullet point with a square and ``* [x]`` for a checked bullet point

### Checked bullets

* [ ] unchecked bullet point
* [x] checked bullet point

```
* [ ] unchecked bullet point
* [x] checked bullet point
```

### Regular bullets

* a regular bullet point

```
* a regular bullet point
```

## avatar

MakeCode targets have avatar icons that help express a more personalized message to a user. The avatar icon is specified by its ``class`` name.

### ~avatar avatar

Hi! Writing docs for MakeCode is great!

### ~

```
### ~avatar [class]

[content]

### ~
```

**Example:** the [blink lesson](https://makecode.microbit.org/lessons/blink/activity)
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/lessons/blink/activity.md) source.

## Message Boxes

Message boxes bring special attention to an idea or to something that the user must take note of. There are several types of message boxes.

### hint

### ~hint

#### Hint Title
[content]

### ~

```
### ~hint

#### Hint Title
[content]

### ~
```

### tutorialhint

Tutorial hints accept but do not require a closing ``#### ~`` tag. They terminate automatically on the next heading with an equal or lesser level.

#### ~tutorialhint

##### Hint Title
[content]

#### ~

```
#### ~hint

##### Hint Title
[content]
```


### reminder

### ~reminder

#### Reminder Title
[content]

### ~

```
### ~reminder

#### Reminder Title
[content]

### ~
```
### alert

### ~alert

#### Alert Title
[content]

### ~
```
### ~alert

#### Alert Title
[content]

### ~
```

### tip

### ~tip

#### Tip Title
[content]

### ~
```
### ~tip

#### Tip Title
[content]

### ~
```

## Buttons

As a navigation aid, the button macro is used to move to another page within the target's document tree.

### ~button /writing-docs/tutorials

NEXT: Tutorials

### ~

```
## ~button /writing-docs/tutorials

NEXT: Tutorials

## ~
```

### autoOpen

To disable auto-opening the README file in MakeCode, add

```
### @autoOpen false
```
