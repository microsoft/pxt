export let multiGesture_v0 = `
enum GestureName {
    //% block="Gesture1"
    Gesture1 = 1,
    //% block="Gesture2"
    Gesture2 = 2,
}


/**
 * Gesture blocks
 */
//% weight=100 color=#0fbc11 icon=""
namespace Gesture {
    let MY_EVENT_SRC = 12345;
    let initializedG1 = false;
    let initializedG2 = false;

    //% blockId=input_on_gesture_recognized block="on gesture %condition"
    export function onGesture(condition: GestureName, handler: () => void): void {
        if (condition == GestureName.Gesture1 && initializedG1 == false) {
            // initialize fiber for gesture1 that will control.raiseEvent(MY_EVENT_SRC, 1);

            control.runInBackground(() => {
                while (true) {
                    if (input.lightLevel() > 70 && input.lightLevel() < 100)
                        control.raiseEvent(MY_EVENT_SRC, condition);

                    loops.pause(40);
                }
            });

            initializedG1 = true;
        }
        else if (condition == GestureName.Gesture2 && initializedG2 == false) {
            // initialize fiber for gesture2 that will control.raiseEvent(MY_EVENT_SRC, 2);

            control.runInBackground(() => {
                while (true) {
                    if (input.lightLevel() > 155 && input.lightLevel() < 185)
                        control.raiseEvent(MY_EVENT_SRC, condition);

                    loops.pause(40);
                }
            });

            initializedG2 = true;
        }


        control.onEvent(MY_EVENT_SRC, condition, handler);
    }
}
`



//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////



export let singleGestureBlock_v1 = `
/**
 * Gesture blocks
 */
//% weight=100 color=#d3a226 icon=""
namespace custom {
    let MY_EVENT_SRC: number = 873;
    let is_initialized: boolean = false;

    //% blockId=something_descriptive block="on gesture"
    export function onGesture(a: () => void) {
        if (!is_initialized)
            initialize_predictor();

        control.onEvent(MY_EVENT_SRC, 1, a);
    }

    function initialize_predictor() {
        is_initialized = true;

        control.runInBackground(() => {
            let threshold = 235757;

            let infinityPrototype = [
                new Vector(200, 128, -612),
                new Vector(240, 184, -652),
                new Vector(634, 406, -627),
                new Vector(1379, 698, -669),
                new Vector(2028, 972, -76),
                new Vector(2036, 916, 236),
                new Vector(2036, 840, 492),
                new Vector(1955, 717, 627),
                new Vector(1292, 532, 500),
                new Vector(1144, 444, 476),
                new Vector(980, 380, 604),
                new Vector(659, 272, 448),
                new Vector(284, 228, 424),
                new Vector(36, 200, 380),
                new Vector(-262, 150, 285),
                new Vector(-232, 180, 148),
                new Vector(-172, 272, 68),
                new Vector(384, 364, -56),
                new Vector(1244, 460, -348),
                new Vector(1904, 464, -595),
                new Vector(2042, 736, -1328),
                new Vector(2036, 644, -1580),
                new Vector(1644, 620, -1664),
                new Vector(1192, 448, -1608),
                new Vector(744, 320, -1488),
                new Vector(524, 244, -1256),
                new Vector(211, 102, -922),
                new Vector(-36, -28, -536),
                new Vector(-240, -76, -392),
                new Vector(-312, -160, -144),
                new Vector(-376, -156, -48),
                new Vector(-316, -32, 88),
                new Vector(136, 72, -36),
                new Vector(1260, 68, 424),
                new Vector(2013, 93, 742),
                new Vector(1875, 333, 266)
            ];

            let spring = new SpringAlgorithm(infinityPrototype, threshold, ManhattanDistance);

            while (true) {
                let x = input.acceleration(Dimension.X);
                let y = input.acceleration(Dimension.Y);
                let z = input.acceleration(Dimension.Z);

                if (spring.Feed(new Vector(x, y, z)) == 1)
                    control.raiseEvent(MY_EVENT_SRC, 1);

                loops.pause(40);    //almost 25fps
            }
        });
    }
}

function ManhattanDistance(a: Vector, b: Vector): number {
    return Math.abs(a.X - b.X) + Math.abs(a.Y - b.Y) + Math.abs(a.Z - b.Z);
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

class SpringAlgorithm {
    private distFunction: (a: Vector, b: Vector) => number;

    private Y: Vector[];
    private eps: number;
    private M: number;

    private minLen: number;
    private maxLen: number;

    private s: number[];
    private d: number[];
    private s2: number[];
    private d2: number[];
    
    private dmin: number;

    private t: number;
    private te: number;
    private ts: number;

    private report: (dmin: number, ts: number, te: number) => void;


    constructor(_input: Vector[], _epsilon: number, _distFun: (a: Vector, b: Vector) => number) {
        this.Y = _input;
        this.eps = _epsilon;
        this.distFunction = _distFun;

        this.M = _input.length;

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

        for (let i = 1; i <= this.M; i++) {
            this.d[i] = 1e8;
            this.s[i] = 0;
        }

        this.dmin = 1e8;
        this.t = 0;
        this.ts = 0;
        this.te = 0;
    }


    public Feed(xt: Vector) {
        let predicted = 0;

        let t = this.t + 1;
        let d: number[] = this.d2;
        let s: number[] = this.s2;

        d[0] = 0;
        s[0] = t;

        // update M distances (d[] based on dp[]) and M starting points (s[] based on sp[]):
        for (let i = 1; i <= this.M; i++) {
            let dist = this.distFunction(this.Y[i - 1], xt);
            let di_minus1 = d[i - 1];
            let dip = this.d[i];
            let dip_minus1 = this.d[i - 1];

            // compute dbest and use that to compute s[i]
            if (di_minus1 <= dip && di_minus1 <= dip_minus1) {
                d[i] = dist + di_minus1;
                s[i] = s[i - 1];
            } else if (dip <= di_minus1 && dip <= dip_minus1) {
                d[i] = dist + dip;
                s[i] = this.s[i];
            } else {
                d[i] = dist + dip_minus1;
                s[i] = this.s[i - 1];
            }
        }

        if (this.dmin <= this.eps) {
            let matchLength = this.te - this.ts;

            if (matchLength > this.minLen && matchLength < this.maxLen) {
                let condition = true;

                for (let i = 0; i <= this.M; i++)
                    if (!(d[i] >= this.dmin || s[i] > this.te))
                        condition = false;

                if (condition) {
                    predicted = 1;
                    this.dmin = 1e8;

                    for (let i = 1; i <= this.M; i++) {
                        if (s[i] <= this.te) {
                            d[i] = 1e8;
                        }
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

        return predicted;
    }
}
`;


//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////


export let multiGesture_v1 = `
enum GestureName {
    //% block="Gesture1"
    Gesture1 = 1,
    //% block="Gesture2"
    Gesture2 = 2,
}

/**
 * Gesture blocks
 */
//% weight=100 color=#0fbc11 icon=""
namespace Gesture {
    let MY_EVENT_SRC = 12345;
    let is_initialized = false;

    //% blockId=input_on_gesture_recognized block="on gesture %condition"
    export function onGesture(condition: GestureName, handler: () => void): void {
        if (is_initialized == false) {
            // initialize fiber for gesture1 that will control.raiseEvent(MY_EVENT_SRC, 1);

            control.runInBackground(() => {
                let circleThreshold = 174508;
                let circleAvgLength = 25;

                let circlePrototype = [
                    new Vector(922, 224, -464),
                    new Vector(880, 246, -547),
                    new Vector(954, 301, -710),
                    new Vector(1072, 368, -560),
                    new Vector(1120, 416, -586),
                    new Vector(1331, 499, -400),
                    new Vector(1248, 490, -58),
                    new Vector(1430, 470, 416),
                    new Vector(1379, 378, 602),
                    new Vector(1235, 250, 723),
                    new Vector(989, 134, 662),
                    new Vector(944, 128, 624),
                    new Vector(773, 66, 569),
                    new Vector(550, -74, 144),
                    new Vector(498, -171, 128),
                    new Vector(400, -205, -80),
                    new Vector(346, -250, -173),
                    new Vector(320, -221, -339),
                    new Vector(403, -195, -362),
                    new Vector(589, -67, -614),
                    new Vector(739, -19, -736),
                    new Vector(1142, 166, -867),
                    new Vector(1421, 285, -797),
                    new Vector(1477, 448, -499),
                    new Vector(1421, 451, -128),
                    new Vector(1267, 490, 58),
                    new Vector(1144, 365, 421),
                    new Vector(1114, 262, 541),
                    new Vector(973, 243, 221),
                    new Vector(941, 240, 176),
                    new Vector(986, 250, 163)
                ];

                // initialize first core
                let circleCore = new SpringAlgorithm(circlePrototype, circleThreshold, circleAvgLength, EuclideanDistanceFast);

                // initialize second core
                let crossThreshold = 20447;
                let crossAvgLength = 18;

                let crossPrototype = [
                    new Vector(794, -109, -698),
                    new Vector(736, -125, -755),
                    new Vector(774, 70, -1142),
                    new Vector(1331, 630, -1126),
                    new Vector(1853, 998, 1238),
                    new Vector(1904, 586, 1510),
                    new Vector(1770, 390, 1779),
                    new Vector(1808, 870, 128),
                    new Vector(1254, 848, -1091),
                    new Vector(272, 413, -774),
                    new Vector(-570, -182, -432),
                    new Vector(-1018, -582, -67),
                    new Vector(-1181, -522, 19),
                    new Vector(-1514, 38, -32),
                    new Vector(-1501, 1725, -448),
                    new Vector(1853, 2032, -8),
                    new Vector(2048, 1941, -389),
                    new Vector(1216, 973, 189),
                    new Vector(1488, 755, -182),
                    new Vector(733, 586, 22),
                    new Vector(1050, 570, -138)
                ];

                let crossCore = new SpringAlgorithm(crossPrototype, crossThreshold, crossAvgLength, EuclideanDistanceFast);

                while (true) {
                    let x = input.acceleration(Dimension.X);
                    let y = input.acceleration(Dimension.Y);
                    let z = input.acceleration(Dimension.Z);

                    let xt = new Vector(x, y, z);

                    if (circleCore.Feed(xt) == 1)
                        control.raiseEvent(MY_EVENT_SRC, 1);
                    else if (crossCore.Feed(xt) == 1)
                        control.raiseEvent(MY_EVENT_SRC, 2);

                    loops.pause(40);
                }
            });

            is_initialized = true;
        }

        control.onEvent(MY_EVENT_SRC, condition, handler);
    }
}

function EuclideanDistanceFast(a: Vector, b: Vector): number {
    // L2 Norm:
    return IntegerSqrt((a.X - b.X) * (a.X - b.X) + (a.Y - b.Y) * (a.Y - b.Y) + (a.Z - b.Z) * (a.Z - b.Z));
}

function IntegerSqrt(n: number) {
    if (n < 0) return -1;

    let shift = 2;
    let nShifted = n >> shift;

    while (nShifted != 0 && nShifted != n) {
        shift += 2;
        nShifted = n >> shift;
    }

    shift -= 2;

    let result = 0;

    while (shift >= 0) {
        result = result << 1;
        let candidateResult = result + 1;

        if (candidateResult * candidateResult <= n >> shift)
            result = candidateResult;

        shift -= 2;
    }

    return result;
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

class SpringAlgorithm {
    private distFunction: (a: Vector, b: Vector) => number;

    private Y: Vector[];
    private eps: number;
    private M: number;

    private minLen: number;
    private maxLen: number;

    private s: number[];
    private d: number[];
    private s2: number[];
    private d2: number[];

    private dmin: number;

    private t: number;
    private te: number;
    private ts: number;

    private report: (dmin: number, ts: number, te: number) => void;


    constructor(_input: Vector[], _epsilon: number, avgLen: number, _distFun: (a: Vector, b: Vector) => number) {
        this.Y = _input;
        this.eps = _epsilon;
        this.distFunction = _distFun;

        this.M = _input.length;

        this.minLen = Math.idiv(Math.imul(avgLen, 7), 10);
        this.maxLen = Math.idiv(Math.imul(avgLen, 13), 10);

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

        for (let i = 1; i <= this.M; i++) {
            this.d[i] = 1e8;
            this.s[i] = 0;
        }

        this.dmin = 1e8;
        this.t = 0;
        this.ts = 0;
        this.te = 0;
    }


    public Feed(xt: Vector) {
        let predicted = 0;

        let t = this.t + 1;
        let d: number[] = this.d2;
        let s: number[] = this.s2;

        d[0] = 0;
        s[0] = t;

        // update M distances (d[] based on dp[]) and M starting points (s[] based on sp[]):
        for (let i = 1; i <= this.M; i++) {
            let dist = this.distFunction(this.Y[i - 1], xt);
            let di_minus1 = d[i - 1];
            let dip = this.d[i];
            let dip_minus1 = this.d[i - 1];

            // compute dbest and use that to compute s[i]
            if (di_minus1 <= dip && di_minus1 <= dip_minus1) {
                d[i] = dist + di_minus1;
                s[i] = s[i - 1];
            } else if (dip <= di_minus1 && dip <= dip_minus1) {
                d[i] = dist + dip;
                s[i] = this.s[i];
            } else {
                d[i] = dist + dip_minus1;
                s[i] = this.s[i - 1];
            }
        }

        if (this.dmin <= this.eps) {
            let matchLength = this.te - this.ts;

            if (matchLength > this.minLen && matchLength < this.maxLen) {
                let condition = true;

                for (let i = 0; i <= this.M; i++)
                    if (!(d[i] >= this.dmin || s[i] > this.te))
                        condition = false;

                if (condition) {
                    predicted = 1;
                    this.dmin = 1e8;

                    for (let i = 1; i <= this.M; i++) {
                        if (s[i] <= this.te) {
                            d[i] = 1e8;
                        }
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

        return predicted;
    }
}
`