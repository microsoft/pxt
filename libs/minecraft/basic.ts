/**
 * Provides access to basic minecraft functionality.
 */
enum Blocks {
    //@ enumval=46
    Tnt,
    //@ enumval=0
    Air,
    //@ enumval=2
    Stone,
    //@ enumval=10
    Lava,
    //@ enumval=8
    Water
}

enum MoveDirection {
    Up,
    Down,
    West,
    East,
    North,
    South
}

//% color=190 weight=100
namespace basic {
    /**
     * A 3D coordinate
     */
    export class Point {
        public x: number;
        public y: number;
        public z: number;

        /**
         * Fill the current position with a block
         */
        //% blockId=minecraftPointFill block="fill %this=minecraftCreatePoint|with %block"
        public fill(block : Blocks) {
            commands.fill(this, this, block);
        }
        
        /**
         * Returns a new coordinate one block higher
         */
        //% blockId=minecraftPointMove block="move %this=minecraftCreatePoint|%direction|by %blocks"
        public move(dir: MoveDirection, blocks: number) : Point {
            let p = new Point();
            p.x = this.x;
            p.y = this.y;
            p.z = this.z;
            switch(dir) {
                case MoveDirection.Up: p.y+=blocks; break;
                case MoveDirection.Down: p.y-=blocks; break;
                case MoveDirection.West: p.x+=blocks; break;
                case MoveDirection.East: p.x-=blocks; break;
                case MoveDirection.North: p.z+=blocks; break;
                case MoveDirection.South: p.z-=blocks; break;
            }
            return p;
        }
    }
    
    /**
     * A 3D coordinate
     */
    //% blockId=minecraftCreatePoint block="x: %x|y: %y|z: %z"
    export function createPoint(x:number, y:number, z:number) : Point {
        let p = new Point();
        p.x = x;
        p.y = y;
        p.z = z;
        return p;
    }
    
    /**
     * Gets the current player position
     */
    //% blockId=minecractPlayerGetPos block="player position"
    export function playerGetPos() : Point {
        let v = commands.sendCommand("getposition", "")
        let p = new Point();
        p.x = parseInt(v[0]);
        p.y = parseInt(v[1]);
        p.z = parseInt(v[2]);
        return p;
    }

    /**
     * Repeats the code forever in the background. On each iteration, allows other codes to run.
     * @param body TODO
     */
    //% help=functions/forever weight=55 blockGap=8
    //% blockId=device_forever block="forever" icon="\uf01e" shim=minecraft::forever
    export function forever(body: () => void): void { }

    /**
     * Pause for the specified time in milliseconds
     * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
     */
    //% help=functions/pause weight=54
    //% shim=minecraft::pause async block="pause (ms) %pause"
    //% blockId=device_pause icon="\uf110"
    export function pause(ms: number): void { }
}
