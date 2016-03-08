/**
 * A 3D coordinate
 */
class Position {
    public x: number;
    public y: number;
    public z: number;
}

enum VerticalDelta {
    //% block=lower
    Lower,
    //% block=higher
    Higher
}

//% color=52 weight=75
namespace position {
    /**
     * A 3D coordinate
     */
    //% blockId=minecraftCreatePosition block="x: %x|y: %y|z: %z"
    export function createPos(x: number, y: number, z: number): Position {
        let p = new Position();
        p.x = x;
        p.y = y;
        p.z = z;
        return p;
    }
    
    /**
     * Returns the sum of the two vectors
     */
    //% blockId=minecraftAddPosition block="%p1=minecraftPlayerPosition|+ %p2=minecraftCreatePosition" blockExternalInputs=1
    export function add(p1 : Position, p2 : Position) : Position {
        let p = new Position();
        p.x = p1.x + p2.x;
        p.y = p1.y + p2.y;
        p.z = p1.z + p2.z;
        return p;
    }
    
    /**
     * Returns the difference of the two vectors
     */
    //% blockId=minecraftSubPosition block="%p1=minecraftPlayerPosition|- %p2=minecraftCreatePosition" blockExternalInputs=1
    export function sub(p1 : Position, p2 : Position) : Position {
        let p = new Position();
        p.x = p1.x - p2.x;
        p.y = p1.y - p2.y;
        p.z = p1.z - p2.z;
        return p;
    }
    
    /**
     * Gets the ground position
     */
    //% blockId=minecraftGround block="ground at %pos=minecraftPlayerPosition"
    export function ground(pos: Position): Position {
        let args = commands.postCommand('getheight', '0' + pos.x + ' ' + pos.z);
        let y = parseInt(args[0]) || 0;
        return position.createPos(pos.x, y, pos.z);
    }
}