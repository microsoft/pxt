export namespace dummy {
    export function someFunction(someParam: string) {

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

        doSomething(n: number) {
        }
    }

    export function createSomething(): SomeClass {
        return new SomeClass()
    }
}
