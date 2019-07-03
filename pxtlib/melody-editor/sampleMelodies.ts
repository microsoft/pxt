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
        new MelodyInfo("scale", "C5 B A G F E D C", 120),
        new MelodyInfo("scale", "C5 B A G F E D C", 120),
        new MelodyInfo("scale", "C5 B A G F E D C", 120),
        new MelodyInfo("scale", "C5 B A G F E D C", 120),
        new MelodyInfo("scale", "C5 B A G F E D C", 120),
        new MelodyInfo("scale", "C5 B A G F E D C", 120),
        new MelodyInfo("scale", "C5 B A G F E D C", 120)
    ]
       
}
