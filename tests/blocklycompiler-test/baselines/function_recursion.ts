function fib (num: number): any {
    if (num <= 1) {
        return num
    }
    return fib(num - 1) + fib(num - 2)
}
