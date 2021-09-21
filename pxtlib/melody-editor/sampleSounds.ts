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
        repeat: number;
        image: string;

        constructor(name: string, volume: number, startFrequency: number, endFrequency: number, duration: number, waveType: string, interpolation: string, repeat: number, image: string) {
            this.name = name;
            this.volume = volume;
            this.startFrequency = startFrequency;
            this.endFrequency = endFrequency;
            this.duration = duration;
            this.waveType = waveType;
            this.interpolation = interpolation;
            this.repeat = repeat;
            this.image = image;
        }
    }

    export const SampleSounds = [
        new SoundInfo(lf("Squeak"), 2, 6000, 7000, 250,  "sawtooth", "linear",1, "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Croak"), 3, 80, 170, 250,  "sawtooth", "exponential",2, "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Warble"), 3, 900, 850, 80,  "square", "linear",16, "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Chirp"), 2, 4000, 6000, 290,  "triangle", "linear",4, "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Meow"), 1, 1100, 600, 1000,  "sine", "exponential",1, "/static/online-learning/img/flashing-heart.png"),
        new SoundInfo(lf("Yawn"), 1 , 1500, 700, 2000,  "triangle", "quadratic",1, "/static/online-learning/img/flashing-heart.png")
    ]

}
