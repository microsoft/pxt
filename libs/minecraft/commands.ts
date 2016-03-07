//% color=176 weight=10
namespace commands {    
    /**
     * Sends a command and returns the response from Minecraft
     */
    //% shim=minecraft::postCommand async
    export function postCommand(cmd: string, args?: string) : string[] {        
        return null;
    }
}
