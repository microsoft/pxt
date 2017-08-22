export let streamerCode = `
let sampleRate = 0
let prevTime = 0
let time = 0
let z = 0
let y = 0
let x = 0
let threshold = 0
// The main loop:
loops.forever(function () {
    while (true) {
        // If enough time has elapsed or the timer rolls over,
        // do something
        x = input.acceleration(Dimension.X)
        y = input.acceleration(Dimension.Y)
        z = input.acceleration(Dimension.Z)
        spring.Feed(new Vector(x, y, z));
serial.writeLine("A " + x + " " + y + " " + z)
        loops.pause(40)
    }
})
threshold = 235757
let infinityPrototype: Vector[];
infinityPrototype = []
infinityPrototype = [
    new Vector(200, 128, -612)
                            , 
    new Vector(240, 184, -652)
                            , 
    new Vector(634, 406, -627)
                            , 
    new Vector(1379, 698, -669)
                            , 
    new Vector(2028, 972, -76)
                            , 
    new Vector(2036, 916, 236)
                            , 
    new Vector(2036, 840, 492)
                            , 
    new Vector(1955, 717, 627)
                            , 
    new Vector(1292, 532, 500)
                            , 
    new Vector(1144, 444, 476)
                            , 
    new Vector(980, 380, 604)
                            , 
    new Vector(659, 272, 448)
                            , 
    new Vector(284, 228, 424)
                            , 
    new Vector(36, 200, 380)
                            , 
    new Vector(-262, 150, 285)
                            , 
    new Vector(-232, 180, 148)
                            , 
    new Vector(-172, 272, 68)
                            , 
    new Vector(384, 364, -56)
                            , 
    new Vector(1244, 460, -348)
                            , 
    new Vector(1904, 464, -595)
                            , 
    new Vector(2042, 736, -1328)
                            , 
    new Vector(2036, 644, -1580)
                            , 
    new Vector(1644, 620, -1664)
                            , 
    new Vector(1192, 448, -1608)
                            , 
    new Vector(744, 320, -1488)
                            , 
    new Vector(524, 244, -1256)
                            , 
    new Vector(211, 102, -922)
                            , 
    new Vector(-36, -28, -536)
                            , 
    new Vector(-240, -76, -392)
                            , 
    new Vector(-312, -160, -144)
                            , 
    new Vector(-376, -156, -48)
                            , 
    new Vector(-316, -32, 88)
                            , 
    new Vector(136, 72, -36)
                            , 
    new Vector(1260, 68, 424)
                            , 
    new Vector(2013, 93, 742)
                            , 
    new Vector(1875, 333, 266)
                            ]
time = 0
prevTime = 0
// the trained reference prototype for making an
// infinity gesture with the circuit playground
function report(dmin: number, ts: number, te: number): void {

}
let spring = new SpringAlgorithm(infinityPrototype, threshold, ManhattanDistance, report);
sampleRate = 40
function ManhattanDistance(a: Vector, b: Vector): number {
    return Math.abs(a.X - b.X) + Math.abs(a.Y - b.Y) + Math.abs(a.Z - b.Z);
}
class SpringAlgorithm {
    private distFunction: (a: Vector, b: Vector) => number;

    private Y: Vector[];
    private M: number;
    private eps: number;
    private s: number[];
    private d: number[];
    private s2: number[];
    private d2: number[];
    private dmin: number;
    private t: number;
    private te: number;
    private ts: number;
    private minLen: number;
    private maxLen: number;
    private margin: number;
    private matchList: Match[];
    private report: (dmin: number, ts: number, te: number) => void;

    public DMin(): number {
        return this.dmin;
    }

    public GetMatchList(): Match[] {
        return this.matchList;
    }

    constructor(_input: Vector[], _epsilon: number, _distFun: (a: Vector, b: Vector) => number,
        _report: (dmin: number, ts: number, te: number) => void) {
        this.eps = _epsilon;
        this.Y = _input;
        this.M = _input.length;
        this.margin = 0; //_margin;
        this.distFunction = _distFun;
        this.report = _report;
        this.minLen = Math.idiv(Math.imul(this.M, 7), 10);
        this.maxLen = Math.idiv(Math.imul(this.M, 13), 10);

        this.d = [];
        this.s = [];
        this.d2 = [];
        this.s2 = [];

        for (let i = 0; i < this.M + 1; i++) {
            this.d.push(0);
            this.s.push(0);
            this.d2.push(0);
            this.s2.push(0);
        }

        for (let j = 1; j <= this.M; j++) {
            this.d[j] = 1e8;
            this.s[j] = 0;
        }

        this.dmin = 1e8;
        this.t = 0;
        this.ts = 0;
        this.te = 0;

        this.matchList = [];
    }

    public Feed(xt: Vector) {
        let t = this.t + 1;
        let d: number[] = this.d2;
        let s: number[] = this.s2;

        d[0] = 0;
        s[0] = t;

        // update M distances (d[] based on dp[]) and M starting points (s[] based on sp[]):
        for (let k = 1; k <= this.M; k++) {
            let dist = this.distFunction(this.Y[k - 1], xt);
            let di_minus1 = d[k - 1];
            let dip = this.d[k];
            let dip_minus1 = this.d[k - 1];

            // compute dbest and use that to compute s[i]
            if (di_minus1 <= dip && di_minus1 <= dip_minus1) {
                d[k] = dist + di_minus1;
                s[k] = s[k - 1];
            } else if (dip <= di_minus1 && dip <= dip_minus1) {
                d[k] = dist + dip;
                s[k] = this.s[k];
            } else {
                d[k] = dist + dip_minus1;
                s[k] = this.s[k - 1];
            }
        }

        if (this.dmin <= this.eps) {
            let condition = true;

            for (let l = 0; l <= this.M; l++)
                if (!(d[l] >= this.dmin || s[l] > this.te - this.margin))
                    condition = false;

            if (condition) {
                let matchLength = this.te - this.ts;

                if (matchLength > this.minLen && matchLength < this.maxLen)
                    this.report(this.dmin, this.ts - 1, this.te - 1);
                this.dmin = 1e8;

                for (let m = 1; m <= this.M; m++) {
                    if (s[m] <= this.te - this.margin) {
                        d[m] = 1e8;
                    }
                }
            }
        }

        if (d[this.M] <= this.eps && d[this.M] < this.dmin) {
            this.dmin = d[this.M];
            this.ts = s[this.M];
            this.te = t;
        }

        this.d2 = this.d; this.d = d;
        this.s2 = this.s; this.s = s;
        this.t = t;
    }
}
class Vector {
    public X: number;
    public Y: number;
    public Z: number;

    constructor(x: number, y: number, z: number) {
        this.X = x;
        this.Y = y;
        this.Z = z;
    }
}
class Match {
    public MinimumDistance: number;
    public Ts: number;
    public Te: number;

    constructor(dmin: number, ts: number, te: number) {
        this.MinimumDistance = dmin;
        this.Te = te;
        this.Ts = ts;
    }
}
enum DataType {
    Integer = 0,
    Float = 1
}
`