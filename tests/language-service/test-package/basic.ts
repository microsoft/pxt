namespace testNamespace {
    export function someFunction(someParam: string, someNum: number, someBool: boolean) {
        return someParam
    }

    export let someString: string;

    export interface SomeInterface {
        someField: number;
    }

    export enum SomeEnum {
        One,
        Two
    }

    export class SomeClass {
        e: SomeEnum;
    }

    export function registerSomeEvent(param1: number, handler: () => void, param2: boolean) {
        handler()
    }

}
