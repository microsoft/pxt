namespace testNamespace {
    //% forceStatement
    //% blockId=forceStatement
    //% block="force statement"
    export function forceStatement(): boolean {
        return true;
    }

    //% handlerStatement
    //% blockId=handlerStatement
    //% block="handler statement"
    //% handlerStatement=true
    export function handlerStatement(handler: () => void): boolean {
        return true;
    }
}