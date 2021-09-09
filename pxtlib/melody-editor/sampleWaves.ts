namespace pxtmelody {
    export class WaveInfo {
        //will be the wave shape name 
        name: string;
        type: string;
        image: string;

        constructor(name: string, type: string, image: string) {
            this.name = name;
            this.type = type;
            this.image = image;
        }
    }

    export const SampleWaves = [
        new WaveInfo(lf("sine"), "wave", "/static/online-learning/img/waves/transparent_sinewave.png"),
        new WaveInfo(lf("square"), "wave", "/static/online-learning/img/waves/squarewave.png"),
        new WaveInfo(lf("triangle"), "wave", "/static/online-learning/img/waves/trianglewave.png"),
        new WaveInfo(lf("sawtooth"), "wave", "/static/online-learning/img/waves/sawtoothwave.png")
    ]
}
