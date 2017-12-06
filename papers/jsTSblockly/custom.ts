namespace Examples {

export enum Poke { A, B }

//% block
export function noParam(): void { }

//% block
export function returnVal(): number { return 1; }

//% block
export function oneParam(b: Poke): void { }

//% block
export function oneParamWithReturn(b: Poke): number { return b; }

//% block
export function onEvent(b: Poke, handler: () => void): void { }

}


