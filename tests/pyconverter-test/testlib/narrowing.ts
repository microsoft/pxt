namespace narrowing {
    export interface Interface1 {
        doSomething(): void;
    }

    export class Class1 implements Interface1 {
        doSomething(): void {
        }
    }

    export const instance = new Class1();

    export function fun1(a: boolean): void {
    }
    export function fun2(a: Interface1): void {
    }
    export function fun3(a: Class1): void {
    }
    export function fun4(a: number[]): void {
    }
    export function fun5(a: Interface1[]): void {
    }
    export function fun6(a: Class1[]): void {
    }
}