/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";

import svg = pxt.svgUtil;
import { FieldAssetEditor } from "./field_asset";
import { songToDataURI } from "./field_utils";

export interface FieldMusicEditorOptions {
}

interface ParsedFieldMusicEditorOptions {
}

const PREVIEW_HEIGHT = 32;
const X_PADDING = 5;
const Y_PADDING = 1;
const BG_PADDING = 4;
const BG_HEIGHT = BG_PADDING * 2 + PREVIEW_HEIGHT;
const TOTAL_HEIGHT = Y_PADDING * 2 + BG_PADDING * 2 + PREVIEW_HEIGHT;

export class FieldMusicEditor extends FieldAssetEditor<FieldMusicEditorOptions, ParsedFieldMusicEditorOptions> {
    protected getAssetType(): pxt.AssetType {
        return pxt.AssetType.Song;
    }

    protected createNewAsset(text?: string): pxt.Asset {
        const project = pxt.react.getTilemapProject();
        if (text) {
            const asset = pxt.lookupProjectAssetByTSReference(text, project);

            if (asset) return asset;
        }

        if (this.getBlockData()) {
            return project.lookupAsset(pxt.AssetType.Song, this.getBlockData());
        }

        let song: pxt.assets.music.Song;

        if (text) {
            const match = /^\s*hex\s*`([a-fA-F0-9]+)`\s*(?:;?)\s*$/.exec(text);

            if (match) {
                song = pxt.assets.music.decodeSongFromHex(match[1]);
            }
        }
        else {
            song = pxt.assets.music.getEmptySong(2);
        }

        if (!song) {
            this.isGreyBlock = true;
            this.valueText = text;
            return undefined;
        }
        else {
            // Restore all of the unused tracks
            pxt.assets.music.inflateSong(song);
        }

        const newAsset: pxt.Song = {
            internalID: -1,
            id: this.temporaryAssetId(),
            type: pxt.AssetType.Song,
            meta: {
            },
            song
        };

        return newAsset;
    }

    render_() {
        super.render_();

        if (!this.isGreyBlock) {
            this.size_.height = TOTAL_HEIGHT;
            this.size_.width = X_PADDING * 2 + BG_PADDING * 2 + this.previewWidth();
        }
    }

    protected getValueText(): string {
        if (this.asset && !this.isTemporaryAsset()) {
            return pxt.getTSReferenceForAsset(this.asset);
        }
        return this.asset ? `hex\`${pxt.assets.music.encodeSongToHex((this.asset as pxt.Song).song)}\`` : (this.valueText || "");
    }

    protected parseFieldOptions(opts: FieldMusicEditorOptions): ParsedFieldMusicEditorOptions {
        return {};
    }

    protected redrawPreview() {
        if (!this.fieldGroup_) return;
        pxsim.U.clear(this.fieldGroup_);

        if (this.isGreyBlock) {
            super.redrawPreview();
            return;
        }

        const totalWidth = X_PADDING * 2 + BG_PADDING * 2 + this.previewWidth();

        const bg = new svg.Rect()
            .at(X_PADDING, Y_PADDING)
            .size(BG_PADDING * 2 + this.previewWidth(), BG_HEIGHT)
            .setClass("blocklySpriteField")
            .stroke("#898989", 1)
            .corner(4);

        this.fieldGroup_.appendChild(bg.el);

        if (this.asset) {
            const dataURI = songToDataURI((this.asset as pxt.Song).song, this.previewWidth(), PREVIEW_HEIGHT, this.lightMode);

            if (dataURI) {
                const img = new svg.Image()
                    .src(dataURI)
                    .at(X_PADDING + BG_PADDING, Y_PADDING + BG_PADDING)
                    .size(this.previewWidth(), PREVIEW_HEIGHT);
                this.fieldGroup_.appendChild(img.el);
            }
        }

        if (this.size_?.width != totalWidth) {
            this.forceRerender();
        }
    }

    protected previewWidth() {
        const measures = this.asset ? (this.asset as pxt.Song).song.measures : 2;
        return measures * PREVIEW_HEIGHT;
    }
}