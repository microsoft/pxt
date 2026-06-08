/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldAssetEditor } from "./field_asset";

export interface FieldTilemapOptions {
    initWidth: string;
    initHeight: string;
    disableResize: string;
    tileWidth: string | number;

    filter?: string;
    // Filter above is used for tiles in the tilemap editor; this is used to filter tilemaps themselves in the gallery
    tilemapFilter?: string;
    lightMode: boolean;
}

interface ParsedFieldTilemapOptions {
    initWidth: number;
    initHeight: number;
    disableResize: boolean;
    tileWidth: 4 | 8 | 16 | 32;
    filter?: string;
    tilemapFilter?: string;
    lightMode: boolean;
}

export class FieldTilemap extends FieldAssetEditor<FieldTilemapOptions, ParsedFieldTilemapOptions> {
    protected initText: string;
    protected asset: pxt.ProjectTilemap;

    getInitText() {
        return this.initText;
    }

    getTileset() {
        return (this.asset as pxt.ProjectTilemap)?.data.tileset;
    }

    protected getAssetType(): pxt.AssetType {
        return pxt.AssetType.Tilemap;
    }

    protected createNewAsset(newText = ""): pxt.Asset {
        if (newText) {
            // backticks are escaped inside markdown content
            newText = newText.replace(/&#96;/g, "`");
        }

        const project = pxt.react.getTilemapProject();

        const existing = pxt.lookupProjectAssetByTSReference(newText, project);
        if (existing) return existing;

        if (this.sourceBlock_?.isInFlyout) return undefined;

        const tilemap = pxt.sprite.decodeTilemap(newText, "typescript", project) || project.blankTilemap(this.params.tileWidth, this.params.initWidth, this.params.initHeight);
        let newAsset: pxt.ProjectTilemap;

        // Ignore invalid bitmaps
        if (checkTilemap(tilemap)) {
            this.initText = newText;
            this.isGreyBlock = false;
            const [ name ] = project.createNewTilemapFromData(tilemap);
            newAsset = project.getTilemap(name);
        }
        else if (newText.trim()) {
            this.isGreyBlock = true;
            this.valueText = newText;
        }

        return newAsset;
    }

    protected onEditorClose(newValue: pxt.ProjectTilemap) {
        pxt.sprite.updateTilemapReferencesFromResult(pxt.react.getTilemapProject(), newValue);
    }

    protected getValueText(): string {
        if (this.isGreyBlock) return pxt.Util.htmlUnescape(this.valueText);

        if (this.asset) {
            return pxt.getTSReferenceForAsset(this.asset);
        }

        if (this.initText) {
            return this.getInitText();
        }

        return this.valueText || "";
    }

    protected parseFieldOptions(opts: FieldTilemapOptions): ParsedFieldTilemapOptions {
        return parseFieldOptions(opts);
    }
}

function parseFieldOptions(opts: FieldTilemapOptions) {
    const parsed: ParsedFieldTilemapOptions = {
        initWidth: 16,
        initHeight: 16,
        disableResize: false,
        tileWidth: 16,
        lightMode: false
    };

    if (!opts) {
        return parsed;
    }

    parsed.lightMode = opts.lightMode;

    if (opts.filter) {
        parsed.filter = opts.filter;
    }

    if (opts.tilemapFilter) {
        parsed.tilemapFilter = opts.tilemapFilter;
    }

    if (opts.tileWidth) {
        if (typeof opts.tileWidth === "number") {
            switch (opts.tileWidth) {
                case 4:
                    parsed.tileWidth = 4;
                    break;
                case 8:
                    parsed.tileWidth = 8;
                    break;
                case 16:
                    parsed.tileWidth = 16;
                    break;
                case 32:
                    parsed.tileWidth = 32;
                    break;
            }
        }
        else {
            const tw = opts.tileWidth.trim().toLowerCase();
            switch (tw) {
                case "4":
                case "four":
                    parsed.tileWidth = 4;
                    break;
                case "8":
                case "eight":
                    parsed.tileWidth = 8;
                    break;
                case "16":
                case "sixteen":
                    parsed.tileWidth = 16;
                    break;
                case "32":
                case "thirtytwo":
                    parsed.tileWidth = 32;
                    break;
            }
        }
    }

    parsed.initWidth = withDefault(opts.initWidth, parsed.initWidth);
    parsed.initHeight = withDefault(opts.initHeight, parsed.initHeight);

    return parsed;

    function withDefault(raw: string, def: number) {
        const res = parseInt(raw);
        if (isNaN(res)) {
            return def;
        }
        return res;
    }
}
function checkTilemap(tilemap: pxt.sprite.TilemapData) {
    if (!tilemap || !tilemap.tilemap || !tilemap.tilemap.width || !tilemap.tilemap.height) return false;

    if (!tilemap.layers || tilemap.layers.width !== tilemap.tilemap.width || tilemap.layers.height !== tilemap.tilemap.height) return false;

    if (!tilemap.tileset) return false;

    return true;
}