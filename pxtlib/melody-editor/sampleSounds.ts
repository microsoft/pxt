namespace pxtmelody {
    export class SoundInfo {
        //will be the wave shape name 
        name: string;
        volume: number;
        startFrequency: number;
        endFrequency: number;
        duration: number;
        waveType: string;
        interpolation: string

        constructor(name: string, volume: number, startFrequency: number, endFrequency: number, duration: number, waveType: string, interpolation: string) {
            this.name = name;
            this.volume = volume;
            this.startFrequency = startFrequency;
            this.endFrequency = endFrequency;
            this.duration = duration;
            this.waveType = waveType;
            this.interpolation = interpolation;
        }
    }

    export const SampleSounds = [
        new SoundInfo(lf("Squeak"), 0.2, 6000, 7000, 250,  "sawtooth", "linear"),
        new SoundInfo(lf("Croak"), 0.3, 80, 170, 250,  "square", "exponential"),
        new SoundInfo(lf("Warble"), 0.2, 6000, 7000, 250,  "sawtooth", "linear"),
        new SoundInfo(lf("Chirp"), 0.2, 6000, 7000, 250,  "sawtooth", "linear"),
        new SoundInfo(lf("Meow"), 0.2, 6000, 7000, 250,  "sawtooth", "linear"),
        new SoundInfo(lf("Yawn"), 0.2 , 6000, 7000, 250,  "sawtooth", "linear")
    ]

}
