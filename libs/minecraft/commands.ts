//% color=176 weight=10
namespace commands {
    /**
     * Fills a cuboid of space between two points.
     */
    //% weight=80 blockId=minecract_fill block="fill|p1: %p1=minecraftCreatePoint|p2: %p2=minecraftCreatePoint|block %blockId"
    export function fill(p1: basic.Point, p2: basic.Point, blockId: Blocks, dataId?: number) {
        sendCommand("fill", `${p1.x} ${p1.y} ${p1.z} ${p2.x} ${p2.y} ${p2.z} ${blockId} ${blockId == Blocks.Tnt ? 1 : 0}`);
    }
    
    /**
     * Sends a command and returns the response from Minecraft
     */
    //% shim=minecraft::sendCommand async
    export function sendCommand(cmd: string, args: string) : string[] {        
        return null;
    }
}
