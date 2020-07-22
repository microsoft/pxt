//  This test case exists to make sure
//  we make it through the converter, but
//  the output is not ideal. In the future
//  we may want to improve the type inference
function whatever(y: any) {
    let x = [1, 2, 3]
    x.push(y)
}

let z = []
z.push("")
let q = ["a", "b"]
q.push(0)