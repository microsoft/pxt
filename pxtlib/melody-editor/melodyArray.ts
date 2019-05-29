namespace pxtmelody {
    export class MelodyArray {
        // check that array is 9x8 
        private melody: boolean[][] = new Array(9).fill(false).map(() => new Array(8).fill(false));
        private tempo: number = 120;
        private width: number = 8;
        private height: number = 9;

        // constructor
        constructor(tempo?: number) {
            if (tempo) this.tempo = tempo;
        }
        
        // setValue

        // getValue
        public getArray() {
            return this.melody;
        }

        public setArray(array: boolean[][]): void {
            this.melody = array;
        }

        public getColor(row: number): number {
            // TODO
            return 0;
        }

        public getWidth(): number {
            return this.width;
        }

        public getHeight(): number {
            return this.height;
        }

        public copy(): boolean[][] {
            let copy = new MelodyArray();
            copy.setArray(this.getArray());
            return copy.getArray();
        }

        public updateMelody(row: number, col: number) {
            this.melody[row][col] = this.melody[row][col]? false:true;
        }


        // function to turn into string?
    }

    export function stringRepresentation(melodyArray: MelodyArray): string {
        let stringMelody: string = "";
        // TODO
        return stringMelody;
    }
}