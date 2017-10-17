

```typescript
/**
 * Appearance and codition of the banana.
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

/**
 * Pick fruit, let it ripen.
 */
//% weight=70 icon="\uf1db" color=#EC7505
namespace tropic {
    /**
     * The tropical fruit called banana.
     */
    //% autoCreate=tropic.pick
    export class banana {
        _condition: Peel;

        constructor() {
            this._condition = Peel.Green;
        }
        /**
         * Make the banana get riper.
         * @param tooMuch make the banana ripen too much, eg: true
         */
        //% weight=66 
        //% help=tropic/ripen
        //% blockId=tropic_banana_ripen block="tropic banana ripen %tooMuch"
        //% defaultInstance=tropic.fruit
        public ripen(tooMuch: boolean): void {
            if (this._condition <= Peel.Spotted) {
                this._condition = this._condition + 1;
            } else if (tooMuch) {
            this._condition = Peel.Blackened;
            }
        }

        /**
         * Peel the skin off of the banana
         */
        //% weight=65
        //% help=tropic/peel
        //% blockId=tropic_banana_peel block="tropic banana peel"
        //% defaultInstance=tropic.fruit
        public peel(): void {
            this._condition = Peel.Peeled;
        }
        /**
         * See if the banana is ripe yet.
         */
        //% weight=64
        //% help=tropic/ripe
        //% blockId=tropic_banana_ripe block="tropic banana ripe"
        //% defaultInstance=tropic.fruit
        public ripe(): boolean {
            return (this._condition > Peel.Green);
        }
        /**
         * See how ripe the banana is now.
         */
        //% weight=63
        //% help=tropic/how-ripe
        //% blockId=tropic_banana_how_ripe block="tropic banana how ripe"
        //% defaultInstance=tropic.fruit
        public howRipe(): Peel {
            return this._condition;
        }
        /**
         * Let the banana go rotten.
         */
        //% weight=62
        //% help=tropic/rot
        //% blockId=tropic_banana_rot block="tropic banana let rot"  
        //% defaultInstance=tropic.fruit
        public rot(): void {
            this._condition = Peel.Blackened;
        }
    }

    /**
     * Pick a fruit to ripen. Just bananas right now.
     */
    //% weight=81
    //% help=tropic/pick
    //% blockId=tropic_pick block="tropic pick"
    export function pick(): banana {
            return new banana();
    }

    /**
     * Compost a fruit by letting it rot.
     * @param matter plant matter to compost
     */
    //% weight=80
    //% help=tropic/compost
    //% blockId=tropic_compost block="tropic compost %matter=tropic_top_banana"
    export function compost(matter: banana): void {
        matter.rot();
    }

    /**
     * Compost a fruit by letting it rot.
     */
    //% weight=79
    //% help=tropic/top-banana
    //% blockId=tropic_top_banana block="tropic top banana"
    export function topBanana(): banana {
        return tropic.fruit;
    }
    
    //%
    export const fruit = tropic.pick();
}
```