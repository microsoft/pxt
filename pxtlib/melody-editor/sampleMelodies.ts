namespace pxtmelody {
    export class MelodyInfo {
        //will be the wave shape name 
        name: string;
        notes: string;
        tempo: number;

        constructor(name: string, notes: string, tempo: number) {
            this.name = name;
            this.notes = notes;
            this.tempo = tempo;
        }
    }

    export const SampleMelodies = [
        new MelodyInfo(lf("Squeak"), "C5 B A G F E D C", 120),
        new MelodyInfo(lf("Croak"), "C D E F G A B C5", 120),
        new MelodyInfo(lf("Warble"), "E B C5 A B G A F", 120),
        new MelodyInfo(lf("Chirp"), "A F E F D G E F", 120),
        new MelodyInfo(lf("Meow"), "C5 A B G A F G E", 120),
        new MelodyInfo(lf("Yawn"), "C5 A B G A F G E", 120)
    ]

}
