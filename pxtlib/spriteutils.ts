namespace pxt.sprite {
    // These are the characters used to output literals (but we support aliases for some of these)
    const hexChars = [".", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

    export const BLOCKLY_TILESET_TYPE = "BLOCKLY_TILESET_TYPE";
    export const TILE_PREFIX = "tile";
    export const TILE_NAMESPACE = "myTiles";

    const tileReferenceRegex = new RegExp(`^\\s*${TILE_NAMESPACE}\\s*\\.\\s*${TILE_PREFIX}(\\d+)\\s*$`);

    export interface Coord {
        x: number,
        y: number
    }

    export interface BitmapData {
        width: number;
        height: number;
        x0: number;
        y0: number;
        data: Uint8ClampedArray;
    }

    export interface AnimationData {
        interval: number;
        frames: BitmapData[];
    }

    export interface ImageState {
        bitmap: BitmapData;
        overlayLayers?: BitmapData[];
        floating?: {
            bitmap: BitmapData;
            overlayLayers: BitmapData[]
        };
        layerOffsetX?: number;
        layerOffsetY?: number;
    }

    /**
     * 16-color sprite
     */
    export class Bitmap {
        protected buf: Uint8ClampedArray;

        public static fromData(data: BitmapData): Bitmap {
            return new Bitmap(data.width, data.height, data.x0, data.y0, data.data);
        }

        constructor(public width: number, public height: number, public x0 = 0, public y0 = 0, buf?: Uint8ClampedArray) {
            this.buf = buf || new Uint8ClampedArray(this.dataLength());
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

        apply(change: Bitmap, transparent = false) {
            let current: number;
            for (let c = 0; c < change.width; c++) {
                for (let r = 0; r < change.height; r++) {
                    current = change.get(c, r);

                    if (!current && transparent) continue;
                    this.set(change.x0 + c, change.y0 + r, current);
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

        data(): BitmapData {
            return {
                width: this.width,
                height: this.height,
                x0: this.x0,
                y0: this.y0,
                data: this.buf
            };
        }

        resize(width: number, height: number): Bitmap {
            return resizeBitmap(this, width, height);
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

        protected dataLength() {
            return Math.ceil(this.width * this.height / 2);
        }
    }

    export class Tilemap extends Bitmap {
        public static fromData(data: BitmapData): Tilemap {
            return new Tilemap(data.width, data.height, data.x0, data.y0, data.data);
        }

        copy(col = 0, row = 0, width = this.width, height = this.height): Tilemap {
            const sub = new Tilemap(width, height);
            sub.x0 = col;
            sub.y0 = row;
            for (let c = 0; c < width; c++) {
                for (let r = 0; r < height; r++) {
                    sub.set(c, r, this.get(col + c, row + r));
                }
            }
            return sub;
        }

        resize(width: number, height: number): Tilemap {
            return resizeTilemap(this, width, height);
        }

        protected getCore(index: number) {
            return this.buf[index];
        }

        protected setCore(index: number, value: number) {
            this.buf[index] = value;
        }

        protected dataLength() {
            return this.width * this.height;
        }
    }

    export interface TileSet {
        tileWidth: number;
        tiles: TileInfo[];
    }

    export interface TileInfo {
        data: BitmapData;
        qualifiedName?: string;
        projectId?: number;
    }

    export class TilemapData {
        nextId = 0;

        // Used to make sure the user doesn't delete a tile used elsewhere in their project
        projectReferences: number[];

        constructor(public tilemap: Tilemap, public tileset: TileSet, public layers: BitmapData) {}
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

    export function encodeTilemap(t: TilemapData, fileType: "typescript" | "python"): string {
        if (!t) return `null`;

        return `tiles.createTilemap(
            ${tilemapToTilemapLiteral(t.tilemap)},
            ${bitmapToImageLiteral(Bitmap.fromData(t.layers), fileType)},
            [${t.tileset.tiles.map(tile => encodeTile(tile, fileType))}],
            ${tileWidthToTileScale(t.tileset.tileWidth)}
        )`
    }

    export function decodeTilemap(literal: string, fileType: "typescript" | "python"): TilemapData {
        literal = Util.htmlUnescape(literal).trim();

        if (!literal.trim()) {
            return new TilemapData(new Tilemap(16, 16), {tileWidth: 16, tiles: []}, new Bitmap(16, 16).data());
        }

        literal = literal.substr(literal.indexOf("(") + 1);
        literal = literal.substr(0, literal.lastIndexOf(")") - 1);

        const tm = literal.substr(0, literal.indexOf(","));
        literal = literal.substr(tm.length + 1);

        const layer = literal.substr(0, literal.indexOf(","));
        literal = literal.substr(layer.length + 1);

        const tileset = literal.substr(0, literal.lastIndexOf("]") + 1);
        literal = literal.substr(tileset.length + 1);

        const tilescale = literal;

        const result = new TilemapData(tilemapLiteralToTilemap(tm), {
            tiles: decodeTileset(tileset),
            tileWidth: tileScaleToTileWidth(tilescale)
        }, imageLiteralToBitmap(layer).data());

        return result;
    }

    export function computeAverageColor(bitmap: Bitmap, colors: string[]) {
        const parsedColors = colors.map(colorStringToRGB);
        let color: number[];
        const averageColor = [0, 0, 0];

        for (let x = 0; x < bitmap.width; x++) {
            for (let y = 0; y < bitmap.height; y++) {
                color = parsedColors[bitmap.get(x, y)];
                averageColor[0] += color[0];
                averageColor[1] += color[1];
                averageColor[2] += color[2];
            }
        }

        const numPixels = bitmap.width * bitmap.height;
        return "#" + toHex(averageColor.map(c => Math.floor(c / numPixels)));
    }

    export interface GalleryItem {
        qName: string;
        src: string;
        alt: string;
        tags: string[];
    }

    export function getBitmap(blocksInfo: pxtc.BlocksInfo, qName: string) {
        const sym = blocksInfo.apis.byQName[qName];
        const jresURL = sym.attributes.jresURL;
        let data = atob(jresURL.slice(jresURL.indexOf(",") + 1))
        let magic = data.charCodeAt(0);
        let w = data.charCodeAt(1);
        let h = data.charCodeAt(2);

        if (magic === 0x87) {
            magic = 0xe0 | data.charCodeAt(1);
            w = data.charCodeAt(2) | (data.charCodeAt(3) << 8);
            h = data.charCodeAt(4) | (data.charCodeAt(5) << 8);
            data = data.slice(4);
        }

        const out = new pxt.sprite.Bitmap(w, h);

        let index = 4
        if (magic === 0xe1) {
            // Monochrome
            let mask = 0x01
            let v = data.charCodeAt(index++)
            for (let x = 0; x < w; ++x) {
                for (let y = 0; y < h; ++y) {
                    out.set(x, y, (v & mask) ? 1 : 0);
                    mask <<= 1
                    if (mask == 0x100) {
                        mask = 0x01
                        v = data.charCodeAt(index++)
                    }
                }
            }
        }
        else {
            // Color
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y += 2) {
                    let v = data.charCodeAt(index++)
                    out.set(x, y, v & 0xf);
                    if (y != h - 1) {
                        out.set(x, y + 1, (v >> 4) & 0xf);
                    }
                }
                while (index & 3) index++
            }
        }

        return out;
    }

    export function filterItems(target: GalleryItem[], tags: string[]) {
        tags = tags
            .filter(el => !!el)
            .map(el => el.toLowerCase());
        const includeTags = tags
            .filter(tag => tag.indexOf("!") !== 0);
        const excludeTags = tags
            .filter(tag => tag.indexOf("!") === 0 && tag.length > 1)
            .map(tag => tag.substring(1));

        return target.filter(el => checkInclude(el) && checkExclude(el));

        function checkInclude(item: GalleryItem) {
            return includeTags.every(filterTag => {
                const optFilterTag = `?${filterTag}`;
                return item.tags.some(tag =>
                    tag === filterTag || tag === optFilterTag
                )
            });
        }

        function checkExclude(item: GalleryItem) {
            return excludeTags.every(filterTag =>
                !item.tags.some(tag => tag === filterTag)
            );
        }
    }

    export function getGalleryItems(blocksInfo: pxtc.BlocksInfo, qName: string): GalleryItem[] {
        const syms = getFixedInstanceDropdownValues(blocksInfo.apis, qName);
        generateIcons(syms);

        return syms.map(sym => {
            const splitTags = (sym.attributes.tags || "")
                .split(" ")
                .filter(el => !!el)
                .map(tag => pxt.Util.startsWith(tag, "category-") ? tag : tag.toLowerCase());

            return {
                qName: sym.qName,
                src: sym.attributes.iconURL,
                alt: sym.qName,
                tags: splitTags
            };
        });
    }

    function getFixedInstanceDropdownValues(apis: pxtc.ApisInfo, qName: string) {
        return pxt.Util.values(apis.byQName).filter(sym => sym.kind === pxtc.SymbolKind.Variable
            && sym.attributes.fixedInstance
            && isSubtype(apis, sym.retType, qName));
    }

    function isSubtype(apis: pxtc.ApisInfo, specific: string, general: string) {
        if (specific == general) return true
        let inf = apis.byQName[specific]
        if (inf && inf.extendsTypes)
            return inf.extendsTypes.indexOf(general) >= 0
        return false
    }

    function generateIcons(instanceSymbols: pxtc.SymbolInfo[]) {
        const imgConv = new pxt.ImageConverter();
        instanceSymbols.forEach(v => {
            if (v.attributes.jresURL && !v.attributes.iconURL && v.attributes.jresURL.indexOf("data:image/x-mkcd-f") == 0) {
                v.attributes.iconURL = imgConv.convert(v.attributes.jresURL)
            }
        });
    }

    function tilemapLiteralToTilemap(text: string, defaultPattern?: string): Tilemap {
        // Strip the tagged template string business and the whitespace. We don't have to exhaustively
        // replace encoded characters because the compiler will catch any disallowed characters and throw
        // an error before the decompilation happens. 96 is backtick and 9 is tab
        text = text.replace(/[ `]|(?:&#96;)|(?:&#9;)|(?:hex)/g, "").trim();
        text = text.replace(/^["`\(\)]*/, '').replace(/["`\(\)]*$/, '');
        text = text.replace(/&#10;/g, "\n");

        if (!text && defaultPattern)
            text = defaultPattern;

        const width = parseInt(text.substr(0, 2), 16) | (parseInt(text.substr(2, 2), 16) << 8);
        const height = parseInt(text.substr(4, 2), 16) | (parseInt(text.substr(6, 2), 16) << 8);
        const data = hexToUint8Array(text.substring(8));

        return Tilemap.fromData({
            width,
            height,
            x0: 0,
            y0: 0,
            data
        })
    }

    function tilemapToTilemapLiteral(t: Tilemap): string {
        if (!t) return `hex\`\``;
        return `hex\`${formatByte(t.width, 2)}${formatByte(t.height, 2)}${uint8ArrayToHex(t.data().data)}\``;
    }

    function decodeTileset(tileset: string) {
        tileset = tileset.replace(/[\[\]]/g, "");
        return tileset ? tileset.split(",").filter(t => !!t.trim()).map(t => decodeTile(t)) : [];
    }

    function encodeTile(tile: TileInfo, fileType: "typescript" | "python") {
        if (tile.qualifiedName) {
            return `${tile.qualifiedName}`;
        }
        else if (tile.projectId != undefined) {
            return `${TILE_NAMESPACE}.${TILE_PREFIX}${tile.projectId}`;
        }
        else {
            return bitmapToImageLiteral(Bitmap.fromData(tile.data), fileType);
        }
    }

    function decodeTile(literal: string): TileInfo {
        literal = literal.trim();
        if (literal.indexOf("img") === 0) {
            const bitmap = imageLiteralToBitmap(literal);
            return {
                data: bitmap.data()
            }
        }

        const match = tileReferenceRegex.exec(literal);

        if (match) {
            return {
                data: null,
                projectId: Number(match[1])
            };
        }

        return {
            data: null,
            qualifiedName: literal
        }
    }

    function formatByte(value: number, bytes: number) {
        let result = value.toString(16);

        const digits = bytes << 1;

        if (result.length & 1) {
            result = "0" + result;
        }

        while (result.length < digits) {
            result += "0"
        }

        return result;
    }

    export function resizeBitmap(img: Bitmap, width: number, height: number) {
        const result = new Bitmap(width, height);
        result.apply(img);
        return result;
    }

    export function resizeTilemap(img: Tilemap, width: number, height: number) {
        const result = new Tilemap(width, height);
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

        const result = new Bitmap(spriteWidth, spriteHeight)

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

    export function bitmapToImageLiteral(bitmap: Bitmap, fileType: "typescript" | "python"): string {
        let res = '';
        switch (fileType) {
            case "python":
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
            case "python":
                res += "\"\"\")";
                break;
            default:
                res += "`";
                break;
        }

        return res;
    }

    function tileWidthToTileScale(tileWidth: number) {
        switch (tileWidth) {
            case 8: return `TileScale.Eight`;
            case 16: return `TileScale.Sixteen`;
            case 32: return `TileScale.ThirtyTwo`;
            default: return Math.floor(Math.log2(tileWidth)).toString();
        }
    }

    function tileScaleToTileWidth(tileScale: string) {
        tileScale = tileScale.replace(/\s/g, "");
        switch (tileScale) {
            case `TileScale.Eight`: return 8;
            case `TileScale.Sixteen`: return 16;
            case `TileScale.ThirtyTwo`: return 32;
            default: return Math.pow(2, parseInt(tileScale));
        }
    }

    function hexToUint8Array(hex: string) {
        let r = new Uint8ClampedArray(hex.length >> 1);
        for (let i = 0; i < hex.length; i += 2)
            r[i >> 1] = parseInt(hex.slice(i, i + 2), 16)
        return r
    }

    function uint8ArrayToHex(data: Uint8ClampedArray) {
        const hex = "0123456789abcdef";
        let res = "";
        for (let i = 0; i < data.length; ++i) {
            res += hex[data[i] >> 4];
            res += hex[data[i] & 0xf];
        }
        return res;
    }

    function colorStringToRGB(color: string) {
        const parsed = parseColorString(color);
        return [_r(parsed), _g(parsed), _b(parsed)]
    }

    function parseColorString(color: string) {
        if (color) {
            if (color.length === 6) {
                return parseInt("0x" + color);
            }
            else if (color.length === 7) {
                return parseInt("0x" + color.substr(1));
            }
        }
        return 0;
    }

    function _r(color: number) { return (color >> 16) & 0xff }
    function _g(color: number) { return (color >> 8) & 0xff }
    function _b(color: number) { return color & 0xff }

    function toHex(bytes: ArrayLike<number>) {
        let r = ""
        for (let i = 0; i < bytes.length; ++i)
            r += ("0" + bytes[i].toString(16)).slice(-2)
        return r
    }


    export function tileToBlocklyVariable(info: pxt.sprite.TileInfo): string {
        return `${info.projectId};${info.data.width};${info.data.height};${pxtc.Util.toHex(info.data.data)}`
    }

    export function blocklyVariableToTile(name: string): pxt.sprite.TileInfo {
        const parts = name.split(";");

        if (parts.length !== 4) {
            return null;
        }

        return {
            projectId: parseInt(parts[0]),
            data: {
                width: parseInt(parts[1]),
                height: parseInt(parts[2]),
                data: new Uint8ClampedArray(pxtc.Util.fromHex(parts[3])),
                x0: 0,
                y0: 0
            }
        }
    }
}