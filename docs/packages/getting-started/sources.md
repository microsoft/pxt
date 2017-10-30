# Package sources

All of the sources for the package tutorial are listed here in complete form.

## pxt.json

```
{
    "name": "tropic",
    "description": "A tropical fruit paradise.",
    "icon": "./static/libs/tropic.png",
    "files": [
        "tropic.ts"
    ],
    "dependencies": {
        "core": "file:../core"
    }
}
```

## tropic.ts

```typescript-ignore
/**
 * Types of tropical fruit
 */
enum TropicalFruit {
    //% block=banana
    Banana = 0,
    //% block=pineapple
    Pinapple = 1,
    //% block=coconut
    Coconut = 2
}

/**
 * Pick some fruit and peel it.
 */
//% weight=70 icon="\uf185" color=#EC7505
namespace tropic {
    /**
     * Pick a fruit
     */
    //% blockId=tropic_pick block="pick a %type"
    //% help=tropic/pick
    export function pick(type: TropicalFruit): boolean {
        return true;
    }
    /**
     * Peel the fruit if possible
     */
    //% blockId=tropic_peel block="peel a %fruit"
    //% help=tropic/peel
    export function peel(fruit: TropicalFruit): boolean {
        return (fruit == TropicalFruit.Banana);
    }
}
```

## tropic.md

````markdown
# Tropic

The methods to pick, peel, and eat tropical fruit.

## Reference

```cards
tropic.pick(TropicalFruit.Coconut);
tropic.peel(TropicalFruit.Cocount);
```

```package
tropic
```
````

## pick.md

````markdown
# pick

Select an available tropical fruit to eat.

```sig
tropic.peel(TropicalFruit.Banana)
```

## Parameters

* **type**: a `TropicalFruit` to eat, which is either: `banana`, `pineapple`, or `coconut`.

## Returns

* a [boolean](/types/boolean) value which is `true` if the fruit was picked, `false` if not.

## Example

Try and pick a coconut from a tropical tree. Can you peel it?

```blocks
let peeled = false
if (tropic.pick(TropicalFruit.Coconut)) {
    peeled = tropic.peel(TropicalFruit.Coconut)
}
```

## See also

[peel](/reference/tropic/peel)

```package
tropic
```
````

## peel.md

````markdown
# peel

Try to peel a tropical fruit to eat.

```sig
tropic.peel(TropicalFruit.Banana);
```

## Parameters

* **fruit**: a `TropicalFruit` to peel and eat, which is either: `banana`, `pineapple`, or `coconut`.

## Returns

* a [boolean](/types/boolean) value which is `true` if the fruit was peeled, `false` if not.

## Example

Try and pick a coconut from a tropical tree. Can you peel it?

```blocks
let peeled = false
if (tropic.pick(TropicalFruit.Coconut)) {
    peeled = tropic.peel(TropicalFruit.Coconut)
}
```

## See also

[pick](/reference/tropic/pick)

```package
tropic
```
````