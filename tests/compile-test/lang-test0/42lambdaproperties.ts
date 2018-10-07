namespace LambdaProperty {

    interface IFoo {
        y: number;
        z: number;
        bar: () => number;
        baz: (i: number) => number;
    }

    let x: IFoo = {
        y: 3, z: 4, bar: () => {
            return 0
        }, baz: (i: number) => i + 1
    }

    x.bar = () => {
        return x.y
    }

    export function test() {
        assert(x.bar() == 3);
        assert(x.baz(42) == 43);
        x = null // release memory
    }
}
LambdaProperty.test()
