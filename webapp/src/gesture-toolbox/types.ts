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
    public labelNumber: number;
    public name: string;
    public description: string;
    public displayGesture: GestureSample;
    public displayVideoLink: any;
    public displayVideoData: any;
    private static id: number = 0;
    public gestureID: number;

    constructor() {
        this.gestures = [];
        this.displayGesture = new GestureSample();
        this.gestureID = Gesture.id++;
        this.name = "gesture " + this.gestureID.toString();
        this.description = "description of this gesture will be here. it's a great and wonderful gesture. you won't be dissapointed " + this.gestureID.toString();
    }

    public getCroppedData(): Vector[][] {
        let all_data: Vector[][] = [];

        for (let i = 0; i < this.gestures.length; i++) {
            let sample: Vector[] = [];

            for (let j = this.gestures[i].cropStartIndex; j <= this.gestures[i].cropEndIndex; j++) {
                sample.push(this.gestures[i].rawData[j].Clone());
            }

            all_data.push(sample);
        }

        return all_data;
    }
}


export class GestureSample {
    public rawData: Vector[];
    public videoLink: any;
    public videoData: any;
    public startTime: number;
    public endTime: number;
    private static id: number = 0;
    public sampleID: number;
    public cropStartIndex: number;
    public cropEndIndex: number;

    constructor() {
        this.rawData = [];
        this.sampleID = GestureSample.id++;
    }

    public Clone(): GestureSample {
        let cloneSample = new GestureSample();

        for (let i = 0; i < this.rawData.length; i++) {
            cloneSample.rawData.push(this.rawData[i]);
        }

        cloneSample.videoLink = this.videoLink;
        cloneSample.videoData = this.videoData;
        cloneSample.startTime = this.startTime;
        cloneSample.endTime = this.endTime;
        cloneSample.cropStartIndex = this.cropStartIndex;
        cloneSample.cropEndIndex = this.cropEndIndex;

        return cloneSample;
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

    public Clone() {
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