// shadowing
let i = 0;
if (true) {
    let i = 0;
    i += 1
}
console.log(i)