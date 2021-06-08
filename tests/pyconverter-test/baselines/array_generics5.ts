function f1() {
    let a: string[];
    let b: number[];
    let c: string[];
    let d: number[];
    let e: string;
    let f: number;
    let g: string;
    let h: number;
    let x = ["a", "b", "c"]
    let z = [0, 1, 2]
    while (true) {
        a = x.slice()
        b = z.concat(z)
        c = x.fill("u", 1, 1)
        d = z.filter(function filt(a: any): boolean {
            return true
        })
        e = x.removeAt(1)
        f = z.shift()
        g = x.get(0)
        h = z._pickRandom()
    }
}

