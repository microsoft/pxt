function f1() {
    let y: string;
    let z: number;
    let x = [1, 3, 4]
    while (true) {
        y = x.reduce(on_reduce, "hello")
        z = x.reduce(on_reduce, 1)
    }
}

function on_reduce(previousValue: any, currentValue: any, currentIndex: number) {
    return previousValue + currentIndex
}

