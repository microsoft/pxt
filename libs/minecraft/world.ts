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
     * Gets a known block id
     */
    //% blockId=minecraftBlock block="%block" weight=10
    export function block(block: Blocks): number {
        return block;
    }        
}