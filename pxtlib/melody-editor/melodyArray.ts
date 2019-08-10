namespace pxtmelody {
    export class MelodyArray {
        // check that array is 8x8
        private tempo: number;
        private numCols: number = 8;
        private numRows: number = 8;
        private melody: boolean[][];

        // Whether or now the melody can contain more than one note at a single beat
        private polyphonic = false;

        // constructor
        constructor(tempo?: number) {
            if (tempo) this.tempo = tempo;
            // set all elements to false
            this.resetMelody();
        }

        public setTempo(tempo: number): void {
            this.tempo = tempo;
        }

        public getArray(): boolean[][] {
            return this.melody;
        }

        public setArray(array: boolean[][]): void {
            this.melody = array;
        }

        public getColor(row: number): number {
            // TODO
            return 0;
        }

        public getValue(row: number, col: number): boolean {
            return this.melody[row][col];
        }

        public getWidth(): number {
            return this.numCols;
        }

        public getHeight(): number {
            return this.numRows;
        }

        public updateMelody(row: number, col: number): void {
            const newValue = !this.melody[row][col];

            if (newValue && !this.polyphonic) {
                for (let r = 0; r < this.numRows; r++) {
                    this.melody[r][col] = false;
                }
            }

            this.melody[row][col] = newValue;
        }

        // function to turn into string
        public getStringRepresentation(): string {
            let stringMelody: string = "";
            let queues: string[][] = new Array(this.numCols);
            let numMelodies = 0;

            // create queues of notes
            for (let i = 0; i < this.numRows; i++) {
                let noteCount = 0;
                queues[i] = [];
                for (let j = 0; j < this.numCols; j++) {
                    if (this.melody[j][i]) {
                        queues[i].push(rowToNote(j));
                        noteCount++;
                    }
                }
                if (noteCount > numMelodies) {
                    numMelodies = noteCount;
                }
            }
            // create strings of melodies
            if (numMelodies == 0) return "- - - - - - - - ";
            for (let j = 0; j < numMelodies; j++) {
                for (let i = 0; i < this.numCols; i++) {
                    if (queues[i] && queues[i].length > 0) { // if there is an element
                        stringMelody += queues[i].shift() + " ";
                    } else {
                        stringMelody += "- "; // add rest if there is no selection for the note
                    }
                }
                //stringMelody += "."; // this will be used to split each melody
            }
            return stringMelody;
        }

        // turn string into boolean array
        public parseNotes(stringNotes: string): void {
            // A melody is represented as a string of notes separated by spaces, with dashes representing rests
            // ex: a scale is represented as "C5 B A G F E D C"
            stringNotes = stringNotes.trim();
            let notes = stringNotes.split(" ");
            for (let i = 0; i < notes.length; i++) {
                for (let j = 0; j < this.numRows; j++) {
                    // reset everything to false
                    this.melody[j][i] = false;
                }
                if (notes[i] != "-") {
                    this.melody[noteToRow(notes[i])][i] = true;
                }
            }
        }

        public setPolyphonic(isPolyphonic: boolean) {
            this.polyphonic = isPolyphonic;
        }

        public isPolyphonic() {
            return this.polyphonic;
        }

        public resetMelody() {
            this.melody = new Array(this.numCols);
            for (let i = 0; i < this.numCols; i++) {
                this.melody[i] = new Array(this.numRows).fill(false);
            }
        }
    }


    export function rowToNote(rowNum: number): string {
        let note: string = "";
        switch (rowNum) {
            case 0: note = "C5"; break;
            case 1: note = "B"; break;
            case 2: note = "A"; break;
            case 3: note = "G"; break;
            case 4: note = "F"; break;
            case 5: note = "E"; break;
            case 6: note = "D"; break;
            case 7: note = "C"; break;
        }
        return note;
    }

    export function noteToRow(note: string): number {
        let rowNum: number = -1;
        switch (note) {
            case "C5": rowNum = 0; break;
            case "B": rowNum = 1; break;
            case "A": rowNum = 2; break;
            case "G": rowNum = 3; break;
            case "F": rowNum = 4; break;
            case "E": rowNum = 5; break;
            case "D": rowNum = 6; break;
            case "C": rowNum = 7; break;
        }
        return rowNum;
    }

    export function getColorClass(row: number): string {
        let colorClass = "melody-default";
        switch (row) {
            case 0: colorClass = "melody-red"; break; // Middle C
            case 1: colorClass = "melody-orange"; break; // Middle D
            case 2: colorClass = "melody-yellow"; break; // Middle E
            case 3: colorClass = "melody-green"; break; // Middle F
            case 4: colorClass = "melody-teal"; break; // Middle G
            case 5: colorClass = "melody-blue"; break; // Middle A
            case 6: colorClass = "melody-purple"; break; // Middle B
            case 7: colorClass = "melody-violet"; break; // Tenor C
        }
        return colorClass;
    }
}