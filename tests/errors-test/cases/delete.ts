class A {
    public x: number
}

let a = new A()
delete a.x //TS9277

const arr = [0, 1, 2, 3, 4];
delete arr[2]; //TS9277
