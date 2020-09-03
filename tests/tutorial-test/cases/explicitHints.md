# Explicit Hints

### @diffs false
### @explicitHints true

## Introduction

Some tutorials can have explicit hints.

## This step has a hint

Initial step instruction goes here.

#### ~ tutorialhint 

Everything below the tag is included in the hint, which terminates automatically

```blocks
basic.showString("Micro!")
```

## This step has code but no hint

The text and code are all displayed in the card.

```blocks
let x = 1;
let y = x + 2;
```

```ghost
basic.showIcon(IconNames.Square)
```