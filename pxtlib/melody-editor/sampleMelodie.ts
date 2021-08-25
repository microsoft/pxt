namespace pxtmelody {
    export class MelodyInf {
        name: string;
        notes: string;
        tempo: number;

        constructor(name: string, notes: string, tempo: number) {
            this.name = name;
            this.notes = notes;
            this.tempo = tempo;
        }
    }
//
    export const SampleMelodie = [
        new MelodyInf(lf("Scale"), "C5 B A G F E D C", 120),
        new MelodyInf(lf("Reverse"), "C D E F G A B C5", 120),
        new MelodyInf(lf("Mystery"), "E B C5 A B G A F", 120),
        new MelodyInf(lf("Gilroy"), "A F E F D G E F", 120),
        new MelodyInf(lf("Falling"), "C5 A B G A F G E", 120),
        new MelodyInf(lf("Hopeful"), "G B A G C5 B A B", 120),
        new MelodyInf(lf("Tokyo"), "B A G A G F A C5", 120),
        new MelodyInf(lf("Paris"), "G F G A - F E D", 120),
        new MelodyInf(lf("Rising"), "E D G F B A C5 B", 120),
        new MelodyInf(lf("Sitka"), "C5 G B A F A C5 B", 120)
    ]

}
