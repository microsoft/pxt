# Blocks language

### @description Language constructs for the Block editor.

## #blocksbase
Blocks snap into each other to define the program that your @boardname@ will run.
Blocks can be event (buttons, shake, ...) or need to be snapped into an event to run.
The [on-start](/blocks/on-start) event runs first.

## Blocks

```namespaces
for (let i = 0;i<5;++i) {}
if (true){}
let x = 0;
```

## Built-in objects #builtins

```namespaces
Math.randomRange(0,5);
"".compare("");
[0].push(0);
```

## See Also

[logic](/blocks/logic), [loops](/blocks/loops), [variables](/blocks/variables),
[math](/reference/math), [text](/reference/text), [arrays](/reference/arrays)

[on-start](/blocks/on-start), [javascript blocks](/blocks/javascript-blocks), [custom blocks](/blocks/custom)
