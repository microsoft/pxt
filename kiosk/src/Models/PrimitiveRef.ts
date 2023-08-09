// This class exists to make it easier to deal with React useState hooks.
// https://stackoverflow.com/questions/57847594/react-hooks-accessing-up-to-date-state-from-within-a-callback
export class PrimitiveRef<T> {
    constructor(public value: T) {
    }
}