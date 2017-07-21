export class Point {
    public X: number;
    public Y: number;

    constructor(x: number, y: number) {
        this.X = x;
        this.Y = y;
    }
}


export class Gesture {
    public gestures: GestureSample[];
    public label: number;
    public name: string;
    public displayGesture: GestureSample;
    public htmlContainer: any;

    constructor() {
        this.gestures = [];
    }
}


export class GestureSample {
    public rawData: Vector[];
    public video: any;
    public startTime: number;
    public endTime: number;

    constructor() {
        this.rawData = [];
    }
}


export class Vector {
    public X: number;
    public Y: number;
    public Z: number;

    constructor(x: number, y: number, z: number) {
        this.X = x;
        this.Y = y;
        this.Z = z;
    }

    public clone() {
        return new Vector(this.X, this.Y, this.Z);
    }
}


export class Match {
    public minDist: number;
    public Ts: number;
    public Te: number;
    public classNum: number;

    constructor(_dmin: number, _ts: number, _te: number, _classNum: number) {
        this.minDist = _dmin;
        this.Te = _te;
        this.Ts = _ts;
        this.classNum = _classNum;
    }

    public Length(): number {
        return this.Te - this.Ts;
    }
}


export enum DataType {
    Integer = 0,
    Float = 1
}