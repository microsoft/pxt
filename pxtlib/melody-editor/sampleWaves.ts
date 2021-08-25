namespace pxtmelody {
    export class WaveInfo {
        //will be the wave shape name 
        name: string;
        type: string;

        constructor(name: string, type: string) {
            this.name = name;
            this.type = type;
        }
    }

    export const SampleWaves = [
        new WaveInfo(lf("sine"), "wave"),
        new WaveInfo(lf("square"), "wave"),
        new WaveInfo(lf("triangle"), "wave"),
        new WaveInfo(lf("sawtooth"), "wave")
    ]
}
