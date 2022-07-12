function f1() {
    let b: any[];
    let x = ["a", "b", "c"]
    while (true) {
        b = x.map(function mapf(a: any): boolean {
            return true
        })
    }
}

