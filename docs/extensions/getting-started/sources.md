# Extension sources

All of the sources for the extension tutorial are listed here in complete form.

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
## banana.ts

```typescript-ignore
/**
 * Appearance and condition of the banana.
 */
enum Peel {
    //% block=green
    Green = 0,
    //% block=yellow
    Yellow = 1,
    //% block=spotted
    Spotted = 2,
    //% block=blackened
    Blackened = 3,
    //% block=peeled
    Peeled = 4
}

namespace tropic {
    /**
     * The tropical fruit called banana.
     */
    export class banana {
        _condition: Peel;

        constructor() {
            this._condition = Peel.Green;
        }
        /**
         * Make the banana get riper.
         * @param tooMuch make the banana ripen too much, eg: false
         */
        //% weight=66 
        //% blockId=banana_ripen block="%fruit|ripen"
        public ripen(tooMuch: boolean = false): void {
            if (tooMuch) {
                this._condition = Peel.Blackened;            
            } else if (this._condition <= Peel.Spotted) {
                this._condition = this._condition + 1;
            }
        }
        /**
         * Peel the skin off of the banana
         */
        //% weight=65
        //% blockId=banana_peel block="%fruit|peel"
        public peel(): void {
            this._condition = Peel.Peeled;
        }
        /**
         * See if the banana is ripe yet.
         */
        //% weight=64
        //% blockId=banana_ripe block="%fruit|ripe"
        public ripe(): boolean {
            return (this._condition > Peel.Green);
        }
        /**
         * See how ripe the banana is now.
         */
        //% weight=63
        //% blockId=banana_how_ripe block="%fruit|how ripe"
        public howRipe(): Peel {
            return this._condition;
        }
        /**
         * Let the banana go rotten.
         */
        //% weight=62
        //% blockId=banana_rot block="%fruit|let rot"
        public rot(): void {
            this._condition = Peel.Blackened;
        }
    }

    /**
     * Pick a fruit to ripen. Just bananas right now.
     */
    //% weight=81
    //% blockId=tropic_pick block="pick a banana"
    export function pickBanana(): banana {
        return new banana();
    }

    /**
     * Compost a fruit by letting it rot.
     * @param matter plant matter to compost
     */
    //% weight=80
    //% blockId=tropic_compost block="compost %matter"
    export function compost(matter: banana): void {
        matter.rot();
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