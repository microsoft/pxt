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

//% weight=70 color=270
namespace world {
    /**
     * Fills a volume with a given block
     */
    //% weight=80
    //% blockId=minecraftFill block="fill %block=minecraftBlock|around %center=minecraftPlayerPosition|from %from=minecraftCreatePosition|to %to=minecraftCreatePosition" blockExternalInputs=1
    export function fill(block: number, center: Position, from: Position, to: Position) {
        commands.postCommand('fill',
            '0 ' + (center.x + from.x) + " " + (center.y + from.y) + " " + (center.z + from.z) + " " + (center.x + to.x)
            + " " + (center.y + to.y) + " " + (center.z + to.z) + " " + block + " 1")
    }        

    /**
     * Builds a floor between two positions
     * @param length of the floor, eg: 5
     */
    //% weight=80
    //% blockId=minecraftFloor block="build floor of %block=minecraftBlock|around %center=minecraftPlayerPosition|of length %length" blockExternalInputs=1
    export function floor(block: number, center: Position, length: number) {
        let l2 = length / 2;
        commands.postCommand('fill',
            '0 ' + (center.x - l2) + " " + (center.y) + " " + (center.z - l2) + " " + (center.x + l2)
            + " " + (center.y + l2) + " " + (center.z + l2) + " " + block + " 1")
    }        
    
    /**
     * Gets the ground position
     */
    //% blockId=minecraftGround block="ground at %pos=minecraftPlayerPosition"
    export function ground(pos: Position): Position {
        let args = commands.postCommand('getheight', '0 ' + pos.x + ' ' + pos.z);
        let y = parseInt(args[0]);
        return basic.createPos(pos.x, y, pos.z);
    }    
        
    /**
     * Gets the block id at a given location
     */
    //% weight=75 blockId=minecraftGetBlock block="block at %pos=minecraftPlayerPosition"
    export function blockAt(pos: Position) : number {
        let r = commands.postCommand('getblock', '0 ' + pos.x + ' ' + pos.y + ' ' + pos.z);
        return parseInt(r[0]);
    }
    
    /**
     * Gets a known block id
     */
    //% blockId=minecraftBlock block="%block" weight=10
    export function block(block: Blocks): number {
        return block;
    }        
}