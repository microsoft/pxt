/**
 * Provides access to basic minecraft functionality.
 */
enum Blocks {
    //% enumval=46
    Tnt,
    //% enumval=0
    Air,
    //% enumval=2
    Stone,
    //% enumval=10
    Lava,
    //% enumval=8
    Water
}

//% color=190 weight=100
namespace basic {
    /**
     * A 3D coordinate
     */
    export class Position {
        public x: number;
        public y: number;
        public z: number;
    }
    
    /**
     * A 3D coordinate
     */
    //% blockId=minecraftCreatePosition block="x: %x|y: %y|z: %z"
    export function createPos(x:number, y:number, z:number) : Position {
        let p = new Position();
        p.x = x;
        p.y = y;
        p.z = z;
        return p;
    }
    
    /**
     * Gets a known block id
     */
    //% blockId=minecraftBlock block="%block"
    export function block(block : Blocks) : number {
        return block;
    }
    
    /**
     * Places a block in the world
     */
    //% blockId=minecraftPlace block="place %block=minecraftBlock|at %position=minecraftPlayerPosition"
    export function place(block: number, position: Position) {
        fill(block, position, position);   
    }
    
    /**
     * Fills a volume with a given block
     */
    //% blockId=minecraftFill block="fill %block=minecraftBlock|from %from=minecraftPlayerPosition|to %to=minecraftCreatePosition" blockExternalInputs=1
    export function fill(block: number, from: Position, to: Position) {
        commands.postCommand('fill', `${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${block} ${block == 46 ? 1 : 0}`)
    }
    
    /**
     * Gets the current player position
     */
    //% blockId=minecraftPlayerPosition block="player position"
    export function playerPosition() : Position {
        let v = commands.postCommand("getposition")
        let p = new Position();
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
