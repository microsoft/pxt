let n: number;
let numbers = [2, 10, 1]
numbers.sort()
for (n of numbers) {
    console.log(n)
}
numbers.sort(function sorter(a: number, b: number): number {
    return b - a
})
for (n of numbers) {
    console.log(n)
}
