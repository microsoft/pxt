import { Vector, GestureData, Match, DataType } from './types';


export function EuclideanDistance(a: Vector, b: Vector): number {
    // L2 Norm:
    return Math.sqrt(Math.pow(a.X - b.X, 2) + Math.pow(a.Y - b.Y, 2) + Math.pow(a.Z - b.Z, 2));
}


export function ManhattanDistance(a: Vector, b: Vector): number {
    // L1 Distance:
    return Math.abs(a.X - b.X) + Math.abs(a.Y - b.Y) + Math.abs(a.Z - b.Z);
}


export function EuclideanDistanceFast(a: Vector, b: Vector): number {
    // L2 Norm:
    return IntegerSqrt((a.X - b.X) * (a.X - b.X) + (a.Y - b.Y) * (a.Y - b.Y) + (a.Z - b.Z) * (a.Z - b.Z));
}


export function IntegerSqrt(n: number) {
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


export class SpringAlgorithm<SampleType> {
    private distFunction: (a: SampleType, b: SampleType) => number;

    private Y: SampleType[];
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
    private matchList: Match[];
    private classNumber: number;
    private report: (match: Match) => void;

    public DMin(): number {
        return this.dmin;
    }


    public GetMatchList(): Match[] {
        return this.matchList;
    }


    constructor(_input: SampleType[], _epsilon: number, _distFun: (a: SampleType, b: SampleType) => number,
                                                        _report: (match: Match) => void,
                                                        _classNum: number) {
        this.eps = _epsilon;
        this.Y = _input;
        this.M = _input.length;
        this.distFunction = _distFun;
        this.report = _report;
        this.classNumber = _classNum;

        this.minLen = this.M * 7 / 10;
        this.maxLen = this.M * 13 / 10;

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
            this.d[i] = 1e10;
            this.s[i] = 0;
        }

        this.dmin = 1e10;
        this.t = 0;
        this.ts = 0;
        this.te = 0;

        this.matchList = [];
    }


    public Feed(xt: SampleType) {
        let t = this.t + 1;
        let d: number[] = this.d2;
        let s: number[] = this.s2;

        d[0] = 0;
        s[0] = t;

        // update M distances (d[] based on dp[]) and M starting points (s[] based on sp[]):
        for (let i = 1; i <= this.M; i++) {
            let dist = this.distFunction(this.Y[i-1], xt);
            let di_minus1 = d[i-1];
            let dip = this.d[i];
            let dip_minus1 = this.d[i-1];

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
            let condition = true;
            let matchLength = this.te - this.ts;

            if(matchLength > this.minLen && matchLength < this.maxLen) {
                for (let i = 0; i <= this.M; i++)
                    if (!(d[i] >= this.dmin || s[i] > this.te))
                        condition = false;

                if (condition) {
                    this.report(new Match(this.dmin, this.ts - 1, this.te - 1, this.classNumber));
                    this.dmin = 1e10;

                    for (let i = 1; i <= this.M; i++) {
                        if (s[i] <= this.te) {
                            d[i] = 1e10;
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
    }


    public FeedStoreMatch(xt: SampleType): void {
        let t = this.t + 1;
        let d: number[] = this.d2;
        let s: number[] = this.s2;

        d[0] = 0;
        s[0] = t;

        // update M distances (d[] based on dp[]) and M starting points (s[] based on sp[]):
        for (let i = 1; i <= this.M; i++) {
            let dist = this.distFunction(this.Y[i-1], xt);
            let di_minus1 = d[i-1];
            let dip = this.d[i];
            let dip_minus1 = this.d[i-1];

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
            let condition = true;
            let matchLength = this.te - this.ts;

            if(matchLength > this.minLen && matchLength < this.maxLen) {
                for (let i = 0; i <= this.M; i++)
                    if (!(d[i] >= this.dmin || s[i] > this.te))
                        condition = false;

                if (condition) {
                    // found match and report:
                    this.matchList.push(new Match(this.dmin, this.ts - 1, this.te - 1, this.classNumber));

                    // reset everything:
                    this.dmin = 1e10;

                    for (let i = 1; i <= this.M; i++) {
                        if (s[i] <= this.te) {
                            d[i] = 1e10;
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
    }
}


export function SimulateSpring<SampleType>(spring: SpringAlgorithm<SampleType>, testData: SampleType[][], nothing: SampleType[][]): Match[][] {    
    let inputTsTe: Match[] = [];
    let k = 0;

    for (let i = 0; i < testData.length; i++) {
        let noGesture = nothing[Math.floor(Math.random() * nothing.length)];

        for (let j = 0; j < 10; j++) {
            spring.FeedStoreMatch(noGesture[j]);
            k++;
        }

        let ts = k;
        for (let j = 0; j < testData[i].length; j++) {
            spring.FeedStoreMatch(testData[i][j]);
            k++;
        }
        let te = k;

        noGesture = nothing[Math.floor(Math.random() * nothing.length)];
        for (let j = 0; j < 10; j++) {
            spring.FeedStoreMatch(noGesture[j]);
            k++;
        }

        inputTsTe.push(new Match(null, ts, te, 1));
    }

    return [inputTsTe, spring.GetMatchList()];
}


export class RC4 {
    // Based on the RC4 random generator. See https://en.wikipedia.org/wiki/RC4
    // Ported from the Multiclass ModelTracker (now called Squares) project (originally in Javascript, now in Typescript).

    private S: number[];
    private i: number;
    private j: number;


    // Initialze the algorithm with a seed.
    constructor(seed: string | number[]) {
        this.S = [];
        this.i = 0;
        this.j = 0;
        for (let i = 0; i < 256; i++) {
            this.S[i] = i;
        }
        if (seed) {
            if (typeof (seed) === 'string') {
                const seed_as_string = seed as string;
                const aseed: number[] = [];
                for (let i = 0; i < seed.length; i++) { aseed[i] = seed_as_string.charCodeAt(i); }
                seed = aseed;
            }
            let j = 0;
            for (let i = 0; i < 256; i++) {
                j += this.S[i] + (seed as number[])[i % seed.length];
                j %= 256;
                const t = this.S[i]; this.S[i] = this.S[j]; this.S[j] = t;
            }
        }
    }


    // Compute the next byte and update internal states.
    public nextByte(): number {
        this.i = (this.i + 1) % 256;
        this.j = (this.j + this.S[this.i]) % 256;
        const t = this.S[this.i]; this.S[this.i] = this.S[this.j]; this.S[this.j] = t;
        return this.S[(this.S[this.i] + this.S[this.j]) % 256];
    }


    // Generate a random number from [ 0, 1 ] uniformally.
    public uniform(): number {
        // Generate 6 bytes.
        let value = 0;
        for (let i = 0; i < 6; i++) {
            value *= 256;
            value += this.nextByte();
        }
        return value / 281474976710656;
    }


    // Generate a random integer from min to max (both inclusive).
    public randint(min: number, max: number): number {
        let value = 0;
        for (let i = 0; i < 6; i++) {
            value *= 256;
            value += this.nextByte();
        }
        return value % (max - min + 1) + min;
    }


    // Choose K numbers from 0 to N - 1 randomly.
    // Using Algorithm R by Jeffrey Vitter.
    public choose(n: number, k: number): number[] {
        const chosen: number[] = [];
        for (let i = 0; i < k; i++) {
            chosen[i] = i;
        }
        for (let i = k; i < n; i++) {
            const j = this.randint(0, i);
            if (j < k) {
                chosen[j] = i;
            }
        }
        return chosen;
    }
}


export class DBA<SampleType> {
    /*
    Implements the DBA algorithm in:

    [1] Petitjean, F., Ketterlin, A., & Gançarski, P. (2011). 
    A global averaging method for dynamic time warping, with applications to clustering. 
    Pattern Recognition, 44(3), 678-693.

    [2] Petitjean, F., Forestier, G., Webb, G. I., Nicholson, A. E., Chen, Y., & Keogh, E. (2014, December). 
    Dynamic time warping averaging of time series allows faster and more accurate classification. 
    In 2014 IEEE International Conference on Data Mining (pp. 470-479). IEEE.
    */

    private _currentAverage: SampleType[];
    private _series: SampleType[][];
    private _distanceFunction: (a: SampleType, b: SampleType) => number;
    private _meanFunction: (x: SampleType[]) => SampleType;

    constructor(distanceFunction: (a: SampleType, b: SampleType) => number, meanFunction: (x: SampleType[]) => SampleType) {
        this._distanceFunction = distanceFunction;
        this._meanFunction = meanFunction;
        this._currentAverage = [];
        this._series = [];
    }


    // Compute DTW between two series, return [ cost, [ [ i, j ], ... ] ].
    public dynamicTimeWarp(a: SampleType[], b: SampleType[]): [number, [number, number][]] {
        const matrix: [number, number][][] = [];
        for (let i = 0; i <= a.length; i++) {
            matrix[i] = [];
            for (let j = 0; j <= b.length; j++) {
                matrix[i][j] = [1e20, 0];
            }
        }
        matrix[0][0] = [0, 0];
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = this._distanceFunction(a[i - 1], b[j - 1]);
                const c1 = matrix[i - 1][j][0];
                const c2 = matrix[i][j - 1][0];
                const c3 = matrix[i - 1][j - 1][0];
                if (c1 <= c2 && c1 <= c3) {
                    matrix[i][j] = [cost + c1, 1];
                } else if (c2 <= c1 && c2 <= c3) {
                    matrix[i][j] = [cost + c2, 2];
                } else {
                    matrix[i][j] = [cost + c3, 3];
                }
            }
        }
        const result: [number, number][] = [];
        let i = a.length; let j = b.length;
        while (i > 0 && j > 0) {
            const s = matrix[i][j][1];
            result.push([i - 1, j - 1]);
            if (s === 1) { i -= 1; }
            if (s === 2) { j -= 1; }
            if (s === 3) { i -= 1; j -= 1; }
        }
        result.reverse();
        return [matrix[a.length][b.length][0], result];
    }


    // Init the DBA algorithm with series.
    public init(series: SampleType[][]): void {
        this._series = series;

        // Initialize the average series naively to the first sereis.
        // TODO: Implement better initialization methods, see [1] for more detail.
        this._currentAverage = series[0];
    }


    // Do one DBA iteration, return the average amount of update (in the distanceFunction).
    // Usually 5-10 iterations is sufficient to get a good average series.
    // You can also test if the returned value (the average update distance of this iteration) 
    // is sufficiently small to determine convergence.
    public iterate(): number {
        const s = this._currentAverage;
        const alignments: SampleType[][] = [];
        for (let i = 0; i < s.length; i++) { alignments[i] = []; }
        for (const series of this._series) {
            const [, match] = this.dynamicTimeWarp(s, series);
            for (const [i, j] of match) {
                alignments[i].push(series[j]);
            }
        }
        this._currentAverage = alignments.map(this._meanFunction);
        return s.map((k, i) =>
            this._distanceFunction(k, this._currentAverage[i])).reduce((a, b) => a + b, 0) / s.length;
    }


    // Get the current average series.
    public average(): SampleType[] {
        return this._currentAverage;
    }


    public computeAverage(series: SampleType[][], iterations: number, TOL: number): SampleType[] {
        this.init(series);
        for (let i = 0; i < iterations; i++) {
            const change = this.iterate();
            if (change < TOL) { break; }
        }
        return this.average();
    }


    public computeVariance(series: SampleType[][], center: SampleType[]): number {
        if (series.length < 3) { return null; }
        const distances = series.map(s => this.dynamicTimeWarp(s, center)[0]);
        let sumsq = 0;
        for (const d of distances) { sumsq += d * d; }
        return Math.sqrt(sumsq / (distances.length - 1));
    }


    public computeKMeans(
        series: SampleType[][],
        k: number,
        kMeansIterations: number = 10,
        abcIterations: number = 10,
        dbaTolerance: number = 0.001): { variance: number, mean: SampleType[] }[] {
        if (k > series.length) {
            return series.map(s => ({ variance: 0, mean: s }));
        }
        if (k === 1) {
            const mean = this.computeAverage(series, abcIterations, dbaTolerance);
            return [{ variance: this.computeVariance(series, mean), mean }];
        }
        const random = new RC4('Labeling');
        const maxIterations = kMeansIterations;

        const assignSeriesToCenters = (centers: SampleType[][]) => {
            const classSeries: SampleType[][][] = [];
            for (let i = 0; i < k; i++) { classSeries[i] = []; }
            for (const s of series) {
                let minD: any = null; let minI: any = null;
                for (let i = 0; i < k; i++) {
                    const d = this.dynamicTimeWarp(centers[i], s)[0];
                    if (minI === null || d < minD) {
                        minI = i;
                        minD = d;
                    }
                }
                classSeries[minI].push(s);
            }
            return classSeries;
        };

        const currentCenters = random.choose(series.length, k).map(i => series[i]);
        let assigned = assignSeriesToCenters(currentCenters);

        // KMeans iterations.
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // Update means.
            for (let i = 0; i < k; i++) {
                currentCenters[i] = this.computeAverage(assigned[i], abcIterations, dbaTolerance);
            }
            assigned = assignSeriesToCenters(currentCenters);
        }
        return currentCenters.map((center, i) => ({
            variance: this.computeVariance(assigned[i], center),
            mean: center
        })
        );
    }
}
