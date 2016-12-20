declare module 'windows-mutex' {
    export class Mutex {
        constructor(mutexName: string);
        isActive(): boolean;
        release(): void;
    }
}