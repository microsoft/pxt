namespace pxtmelody {
    export class MelodyInfo {
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
        new MelodyInfo("Scale", "C5 B A G F E D C", 120),
        new MelodyInfo("Reverse Scale", "C D E F G A B C5", 120),
        new MelodyInfo("Mystery", "E B C5 A B G A F", 120),
        new MelodyInfo("Melody 4", "A F E F D G E F", 120),
        new MelodyInfo("Melody 5", "C5 A B G A F G E", 120),
        new MelodyInfo("Melody 6", "G B A G C5 B A B", 120),
        new MelodyInfo("Melody 7", "B A G A G F A C5", 120),
        new MelodyInfo("Melody 8", "G F G A - F E D", 120),
        new MelodyInfo("Melody 9", "E D G F B A C5 B", 120),
        new MelodyInfo("Melody 10", "C5 G B A F A C5 B", 120)
    ]
       
}
