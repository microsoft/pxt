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