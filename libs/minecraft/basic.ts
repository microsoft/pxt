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
     * Gets the current player name
     */
    //% shim=minecraft::playerName
    export function playerName() : string {
        return null;
    }

    /**
     * Places a block in the world
     */
    //% blockId=minecraftPlace block="place %block=minecraftBlock|at %pos=minecraftPlayerPosition" weight=80
    export function place(block: number, pos: Position) {
        world.fill(block, pos, position.createPos(0, 0, 0), position.createPos(0, 0, 0));
    }

    /**
     * Gets the current player position
     */
    //% blockId=minecraftPlayerPosition block="player position"
    export function playerPosition(): Position {
        let name = basic.playerName();
        let v = commands.postCommand("getposition", name)
        let p = new Position();
        p.x = parseInt(v[1]);
        p.y = parseInt(v[2]);
        p.z = parseInt(v[3]);
        return p;
    }
    
    /**
     * Posts a message on the chat
     * @param message the message to post on the chat, eg: "Hi!"
     */
    //% blockId=minecraftChat block="say %message" weight=10
    export function chat(message : string) {
        commands.postCommand('postchat', playerName() + ' "' + message + '"');
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
