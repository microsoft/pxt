namespace testNamespace {
    export function testEvent(handler: () => void): void {

    }

    //% blockId=test_event_alias
    //% block="test"
    //% blockAliasFor="testNamespace.testEvent"
    //% draggableParameters=reporter
    export function _testEvent(handler: () => void): void {
        testEvent(handler);
    }

    export function testEvent2(handler: (num: number, bool: boolean) => void): void {

    }

    //% blockId=test_event_alias2
    //% block="test $num and $bool"
    //% blockAliasFor="testNamespace.testEvent2"
    //% draggableParameters=reporter
    export function _testEvent2(handler: (num: number, bool: boolean) => void): void {
        testEvent2(handler);
    }
}