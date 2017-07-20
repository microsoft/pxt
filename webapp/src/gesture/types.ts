export class Point {
    public X: number;
    public Y: number;

    constructor(x: number, y: number) {
        this.X = x;
        this.Y = y;
    }
}


export class GestureData {
    public gesture: string;
    public label: number;
    public dimension: number;
    public video: string[];
    public data: number[][][];

    constructor() {
        this.gesture = "";
        this.label = 0;
        this.dimension = 3;
        this.video = [];
        this.data = [];
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
}


export class Match {
    public MinimumDistance: number;
    public Ts: number;
    public Te: number;
    public classNumber: number;

    constructor(dmin: number, ts: number, te: number, classNum: number) {
        this.MinimumDistance = dmin;
        this.Te = te;
        this.Ts = ts;
        this.classNumber = classNum;
    }

    public Length(): number {
        return this.Te - this.Ts;
    }
}


export enum DataType {
    Integer = 0,
    Float = 1
}