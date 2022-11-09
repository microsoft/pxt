/**
 * Functions that create objects should store them in variables.
 */
//% color="#AA278D"
namespace language {
    //%
    export class Robot { }

    /**
     * Creates a robot and automtically set it to a variable
     */
    //% block="create robot"
    //% blockSetVariable=robot
    export function createRobot(): Robot {
        return undefined;
    }
}

/**
 * Declare a class outside and attach to a namespace.
 */
//% blockNamespace=Widgets color="#FF8000"
class Gizmo {
    _active: boolean;

    constructor(activate: boolean) {
        this._active = activate;
    }

    /**
     * Set the Gizmo widget to active
     * @param active set on (true) or off (false), eg: true
     */
    //% block="turn $this to $active"
    //% this.defl=gizmo
    //% this.shadow=variables_get
    //% active.shadow=toggleOnOff
    setActive(active: boolean) {
        this._active = active;
    }
}

/**
 * Widget namespace using en external class
 */
//% color="#FF8000"
namespace Widgets {

    /**
     * Create a Gizmo widget and automtically set it to a variable
     */
    //% block="create gizmo"
    //% blockSetVariable=gizmo
    export function createGizmo(): Gizmo {
        return new Gizmo(true);
    }
}
