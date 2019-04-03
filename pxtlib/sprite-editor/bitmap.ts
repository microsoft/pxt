namespace pxtsprite {
    // These are the characters used to output literals (but we support aliases for some of these)
    const hexChars = [".", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

    export type Coord = [number, number];

    /**
     * 16-color sprite
     */
    export class Bitmap {
        protected buf: Uint8Array;

        constructor(public width: number, public height: number, public x0 = 0, public y0 = 0) {
            this.buf = new Uint8Array(Math.ceil(width * height / 2));
        }

        set(col: number, row: number, value: number) {
            if (col < this.width && row < this.height && col >= 0 && row >= 0) {
                const index = this.coordToIndex(col, row);
                this.setCore(index, value);
            }
        }

        get(col: number, row: number) {
            if (col < this.width && row < this.height && col >= 0 && row >= 0) {
                const index = this.coordToIndex(col, row);
                return this.getCore(index);
            }
            return 0;
        }

        copy(col = 0, row = 0, width = this.width, height = this.height): Bitmap {
            const sub = new Bitmap(width, height);
            sub.x0 = col;
            sub.y0 = row;
            for (let c = 0; c < width; c++) {
                for (let r = 0; r < height; r++) {
                    sub.set(c, r, this.get(col + c, row + r));
                }
            }
            return sub;
        }

        apply(change: Bitmap) {
            for (let c = 0; c < change.width; c++) {
                for (let r = 0; r < change.height; r++) {
                    this.set(change.x0 + c, change.y0 + r, change.get(c, r));
                }
            }
        }

        equals(other: Bitmap) {
            if (this.width === other.width && this.height === other.height && this.x0 === other.x0 && this.y0 === other.y0 && this.buf.length === other.buf.length) {
                for (let i = 0; i < this.buf.length; i++) {
                    if (this.buf[i] !== other.buf[i]) return false;
                }
                return true;
            }

            return false;
        }

        protected coordToIndex(col: number, row: number) {
            return col + row * this.width;
        }

        protected getCore(index: number) {
            const cell = Math.floor(index / 2);
            if (index % 2 === 0) {
                return this.buf[cell] & 0xf;
            }
            else {
                return (this.buf[cell] & 0xf0) >> 4;
            }
        }

        protected setCore(index: number, value: number) {
            const cell = Math.floor(index / 2);
            if (index % 2 === 0) {
                this.buf[cell] = (this.buf[cell] & 0xf0) | (value & 0xf);
            }
            else {
                this.buf[cell] = (this.buf[cell] & 0x0f) | ((value & 0xf) << 4);
            }
        }
    }

    export class Bitmask {
        protected mask: Uint8Array;

        constructor(public width: number, public height: number) {
            this.mask = new Uint8Array(Math.ceil(width * height / 8));
        }

        set(col: number, row: number) {
            const cellIndex = col + this.width * row;
            const index = cellIndex >> 3;
            const offset = cellIndex & 7;
            this.mask[index] |= (1 << offset);
        }

        get(col: number, row: number) {
            const cellIndex = col + this.width * row;
            const index = cellIndex >> 3;
            const offset = cellIndex & 7;
            return (this.mask[index] >> offset) & 1;
        }
    }

    export function resizeBitmap(img: Bitmap, width: number, height: number) {
        const result = new Bitmap(width, height);
        result.apply(img);
        return result;
    }

    export function imageLiteralToBitmap(text: string, defaultPattern?: string): Bitmap {
        // Strip the tagged template string business and the whitespace. We don't have to exhaustively
        // replace encoded characters because the compiler will catch any disallowed characters and throw
        // an error before the decompilation happens. 96 is backtick and 9 is tab
        text = text.replace(/[ `]|(?:&#96;)|(?:&#9;)|(?:img)/g, "").trim();
        text = text.replace(/^["`\(\)]*/, '').replace(/["`\(\)]*$/, '');
        text = text.replace(/&#10;/g, "\n");

        if (!text && defaultPattern)
            text = defaultPattern;

        const rows = text.split("\n");

        // We support "ragged" sprites so not all rows will be the same length
        const sprite: number[][] = [];
        let spriteWidth = 0;

        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const rowValues: number[] = [];
            for (let c = 0; c < row.length; c++) {
                // This list comes from libs/screen/targetOverrides.ts in pxt-arcade
                // Technically, this could change per target.
                switch (row[c]) {
                    case "0": case ".": rowValues.push(0); break;
                    case "1": case "#": rowValues.push(1); break;
                    case "2": case "T": rowValues.push(2); break;
                    case "3": case "t": rowValues.push(3); break;
                    case "4": case "N": rowValues.push(4); break;
                    case "5": case "n": rowValues.push(5); break;
                    case "6": case "G": rowValues.push(6); break;
                    case "7": case "g": rowValues.push(7); break;
                    case "8": rowValues.push(8); break;
                    case "9": rowValues.push(9); break;
                    case "a": case "A": case "R": rowValues.push(10); break;
                    case "b": case "B": case "P": rowValues.push(11); break;
                    case "c": case "C": case "p": rowValues.push(12); break;
                    case "d": case "D": case "O": rowValues.push(13); break;
                    case "e": case "E": case "Y": rowValues.push(14); break;
                    case "f": case "F": case "W": rowValues.push(15); break;
                }
            }

            if (rowValues.length) {
                sprite.push(rowValues);
                spriteWidth = Math.max(spriteWidth, rowValues.length);
            }
        }

        const spriteHeight = sprite.length;

        const result = new pxtsprite.Bitmap(spriteWidth, spriteHeight)

        for (let r = 0; r < spriteHeight; r++) {
            const row = sprite[r];
            for (let c = 0; c < spriteWidth; c++) {
                if (c < row.length) {
                    result.set(c, r, row[c]);
                }
                else {
                    result.set(c, r, 0);
                }
            }
        }

        return result;
    }

    export function bitmapToImageLiteral(bitmap: Bitmap, fileType: pxt.editor.FileType): string {
        let res = '';
        switch (fileType) {
            case pxt.editor.FileType.Python:
                res = "img(\"\"\"";
                break;
            default:
                res = "img`";
                break;
        }

        if (bitmap) {
            for (let r = 0; r < bitmap.height; r++) {
                res += "\n"
                for (let c = 0; c < bitmap.width; c++) {
                    res += hexChars[bitmap.get(c, r)] + " ";
                }
            }
        }

        res += "\n";

        switch (fileType) {
            case pxt.editor.FileType.Python:
                res += "\"\"\")";
                break;
            default:
                res += "`";
                break;
        }

        return res;
    }
}