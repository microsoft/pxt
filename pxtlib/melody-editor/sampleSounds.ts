namespace pxtmelody {
    export class SoundInfo {
        //will be the wave shape name 
        name: string;
        volume: number;
        startFrequency: number;
        endFrequency: number;
        duration: number;
        waveType: string;
        interpolation: string;
        image: string;

        constructor(name: string, volume: number, startFrequency: number, endFrequency: number, duration: number, waveType: string, interpolation: string, image: string) {
            this.name = name;
            this.volume = volume;
            this.startFrequency = startFrequency;
            this.endFrequency = endFrequency;
            this.duration = duration;
            this.waveType = waveType;
            this.interpolation = interpolation;
            this.image = image;
        }
    }

    export const SampleSounds = [
        new SoundInfo(lf("Squeak"), 2, 6000, 7000, 250,  "sawtooth", "linear", "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Croak"), 3, 80, 170, 250,  "sawtooth", "exponential", "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Warble"), 2, 6000, 7000, 250,  "sawtooth", "linear", "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Chirp"), 2, 6000, 7000, 250,  "sawtooth", "linear", "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Meow"), 2, 6000, 7000, 250,  "sawtooth", "linear", "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Yawn"), 2 , 6000, 7000, 250,  "sawtooth", "linear", "/static/online-learning/img/flashing-heart.png")
    ]

}
