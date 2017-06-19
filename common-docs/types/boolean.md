# Boolean

Something that is only true or false.

A boolean has one of two possible values: `true` or `false`.  The boolean (logical) operators (*and*, *or*, *not*) take boolean inputs and make another boolean value. Comparing on other types ([numbers](/types/number), [strings](/types/string)) with logical operators create boolean values.

These blocks represent the `true` and `false` boolean values, which can be plugged in anywhere a boolean value is expected:

```block
let on = true;
let off = false;
off = false;
```
You can set and compare other boolean values:

```block
let on = true;
let off = !on;
let switcher = on;
let lights = off;

if (switcher) {
    lights = on;
} else {
    lights = off;
}
```
Compare other types:

```block
let cool = 50;
let temp = 65;
let warming = temp > cool;

if (warming) {
    let message = "It's warming up."
}
```

### See Also

[boolean (blocks)](/blocks/logic/boolean)
