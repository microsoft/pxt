namespace advanced {
    export class A {
    }
    export const a = new A();
    export class B {
    }
    export const b = new B();

    export function union1(ab: A | B) {
    }
    export function union2(c: number | string) {
    }
}