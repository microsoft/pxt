let sq1 = (x: number) => {
    return x * x 
}

let sq2 = (x: number): number => {
    return x * x
}

let a = sq1(2) // TS9218
let b = sq2(2) // TS9218
