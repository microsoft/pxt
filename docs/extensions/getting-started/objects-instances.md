# Objects and instances

To create objects that associate certain operations more logically, you can have classes in your namespace. In the `tropic` extension, the **pick** function simply returns a **boolean** to indicate that the action was successful or not. The **pick** function would make more sense if it actually returned a `fruit` object like a `banana` if successful.

## Step 1: Make a fruit object

Let's add a class to represent a `fruit` object. Also, let's change **pick** to now return a new `fruit` object. To do this, we'll make individual classes for each fruit in our tropical paradise.

Now, it would be nice if the **pick** function was general enough to pick a fruit of any type and return it to you. Something like:

```typescript-ignore
/**
 * Types of tropical fruit
 */
enum TropicalFruit {
    Banana = 0,
    Pinapple = 1,
    Coconut = 2
}

/**
 * Pick fruit, let it ripen or eat.
 */
namespace tropic {
    abstract class fruit {
        _type: TropicalFruit;

        constructor(TropicalFruit: type) {
            this._type = type;
        }
        whatAmI(): TropicalFruit {
            return this._type;
        }
    }

    export class banana extends fruit {
        constructor() {
            super(TropicalFruit.Banana);
        }
    }
    export class pineapple extends fruit {
        constructor() {
            super(TropicalFruit.Pineapple);
        }
    }
    export class Coconut extends fruit {
        constructor() {
            super(TropicalFruit.Coconut);
        }
    }

    /**
     * Pick a fruit to ripen or eat.
     */
    export function pick(TropicalFruit: type): fruit {
            switch (type) {
                case TropicalFruit.Pineapple:
                    return new pineapple();
                case TropicalFruit.Coconut:
                    return new coconut();
                case TropicalFruit.Banana:
                default:
                    return new banana();
            }
        }
    }
}
```

The **pick** function returns a general `fruit` object and not the specific fruit subclass. Not every fruit opens up the same way so, for `banana`, we would want to call the **peel** method. If we picked a `coconut`, we'd call its **crack** method.

```typescript-ignore
namespace tropic {
    ...
    export class banana extends fruit {
        constructor() {
            super(TropicalFruit.Banana);
        }
        peel(): boolean {
            return true;
        }
    }
    export class coconut extends fruit {
        constructor() {
            super(TropicalFruit.Coconut);
        }
        crack(): boolean {
            return true;
        }
    }
}
```

MakeCode is limited to using [Static TypeScript](/language) so we can't cast a `fruit` to a `banana` or a `coconut` in order to get at the **peel** or **crack** methods.

## Step 2: Make a banana object

Well, for now, we can live with just bananas. If we want other fruit, we can code classes for them explicitly. So, we'll make the fruit picker give just bananas.

```typescript-ignore
namespace tropic {
    ...
    /**
     * Pick a fruit to ripen or eat. Just bananas right now.
     */
    export function pickBanana(): banana {
        return new banana();
    }
}
```

With bananas, they can ripen, get peeled, be eaten, or be left to rot. Let's add methods for these actions in the `banana` class.

```typescript-ignore
/**
 * Appearance and condition of the banana.
 */
enum Peel {
    Green = 0,
    Yellow = 1,
    Spotted = 2,
    Blackened = 3,
    Peeled = 4
}

/**
 * Pick fruit, let it ripen.
 */
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
        public peel(): void {
            this._condition = Peel.Peeled;
        }
        /**
         * See if the banana is ripe yet.
         */
        public ripe(): boolean {
            return (this._condition > Peel.Green);
        }
        /**
         * See how ripe the banana is now.
         */
        public howRipe(): Peel {
            return this._condition;
        }
        /**
         * Let the banana go rotten.
         */
        public rot(): void {
            this._condition = Peel.Blackened;
        }
    }
}
```

## Step 3: Defining blocks for banana methods

In the blocks model, class methods aren't available, or don't show up, in the Toolbox until there's an actual object instance related to it. The [block definitions](/defining-blocks#objects-and-instance-methods) for the methods must "tag" them to an instance. Let's take the **peel** method as an example. We've inserted the ``%fruit`` parameter at the beginning of the `block` attribute. This is not a parameter for the method, but an association of the block to an instance variable initially called `fruit`. This will cause the **peel** block to be valid in the workspace as a method of `fruit` even if the value of `fruit` is stil `null` or `undefined`. You can think of it as a placeholder or a default instance name, but without it, the **peel** method has no context.

```typescript-ignore
/*
 * Peel the skin off of the banana.
 */
//% blockId=banana_peel block="%fruit|peel"
public peel(): void {
    this._condition = Peel.Peeled;
}
```

Now, lets's add the new `banana` class to the `tropic` namespace created in the simple extension tutorial. Take the code from [banana.ts](./sources#banana-ts) in the supplied sources and save it in the tropic extension under _/libs/tropic_. Go to the `pxt.json` file and add "banana.ts" to the `files` list.

```typescript-ignore
"files": [
    "tropic.ts",
    "banana.ts"
],
```

Restart your target to build the extension with the `banana` class added. In the Toolbox you will now see the `banana` methods in the **Tropic** category tagged with the `fruit` instance. Go to the JavaScript editor and paste in this code to test your class:

```typescript-ignore
let fruit = tropic.pickBanana()
if (!(fruit.ripe())) {
    fruit.ripen()
}
fruit.peel()
tropic.compost(fruit)
```

## Step 4: Auto-create instance

Delete the test code from the editor workspace. Switch back to the **Blocks** view and drag the **ripen** method block from **Tropic** into an **on start** block. Now, go to the **JavaScript** view and you will see:

```typescript-ignore
let fruit: tropic.banana = null
fruit.ripen()
```

Since you have the `%fruit` parameter in the `block` attribute, the `fruit` instance variable is declared to make the block code valid. There is no valid instance of `banana` though and you can't run this code until you set `fruit` to `tropic.pickBanana()`.

To have MakeCode automatically create an instance of `fruit` when you first pull out a method from `banana`, use the `//% autoCreate` attribute. It is set in the heading of the class.

```typescript-ignore
/**
 * The tropical fruit called banana.
 */
//% autoCreate=tropic.pickBanana
export class banana {
    ...
}
```

So now, when a **ripen** block is placed onto the workspace, an instance is created by calling the `tropic.pickBanana()` function as an object factory for `fruit`.

Add the `autoCreate` attribute as shown and restart the target. Delete any blocks in the workspace and pull out **ripen** as you did before. After swithing to JavaScript, you'll see that `fruit` is now set to an instance of `banana` rather than being just a variable declaration with a `null` value.

```typescript-ignore
let fruit = tropic.pickBanana()
fruit.ripen()
```

## Step 5: Default instances

Maybe you want to have an instance of your class already created when your extension is installed. To do this you make a constant and assign it to a new object instance. Here we've added the `fruit` constant as an instance of `banana`.

```typescript-ignore
namespace tropic {
    /**
     * The tropical fruit called banana.
     */
    export class banana {
        ...
    }

    /**
     * Pick a fruit to ripen. Just bananas right now.
     */
    //% blockId=tropic_pick block="pick a banana"
    export function pickBanana(): banana {
        return new banana();
    }

    export const fruit: banana = tropic.pickBanana();
}
```
Now, for each method in `banana` you add the `//% defaultInstance` attribute. For the **peel** method (and the others) the default instance attribute is set to `tropic.fruit`. Remove the `%fruit` parameter from the `block` attribute.

```typescript-ignore
/**
 * Peel the skin off of the banana
 */
//% blockId=banana_peel block="peel"
//% defaultInstance=tropic.fruit
public peel(): void {
    this._condition = Peel.Peeled;
}
```

Repeat this for the other methods too. Restart your target to build these changes into the `tropic` extension. Go to the Toolbox and drag the **peel** block from **Tropic**. You'll see that it has no instance parameter with it and it's usable directly. Delete that block, go into the JavaScript editor and paste in this code:

```typescript-ignore
if (!(tropic.fruit.ripe())) {
    tropic.fruit.ripen();
}
tropic.fruit.peel();
tropic.compost(fruit);
``` 

Since there's already a default instance, the use of **pickBanana** isn't needed unless you want to create another `banana`. Add these two lines to at the bottom of the test code:

```typescript-ignore
let otherFruit = tropic.pickBanana();
otherFruit.peel();
```

Switch back to blocks. Notice that the last **peel** method has the `otherFruit` instance parameter added to its block.

## See also

[Objects and instance methods](/defining-blocks#objects-and-instance-methods) section in [Defining blocks](/defining-blocks)

[Sources](./sources) for the extension tutorial