/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    export interface ImageJSON {
        src: string;
        alt: string;
        width: number;
        height: number;
    }

    export type TilesetDropdownOption = [ImageJSON, string];

    const PREVIEW_SIDE_LENGTH = 32;

    export class FieldTileset extends FieldImages implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        protected selected: pxt.Tile;
        protected blocksInfo: pxtc.BlocksInfo;
        protected transparent: TilesetDropdownOption;

        constructor(text: string, options: FieldImageDropdownOptions, validator?: Function) {
            super(text, options, validator);
            this.blocksInfo = options.blocksInfo;

        }

        init() {
            super.init();

            if (this.sourceBlock_ && this.sourceBlock_.isInFlyout) {
                this.setValue(this.getOptions()[0][1]);
            }
        }

        getValue() {
            const v = super.getValue();

            // If the user decompiled from JavaScript, then they might have passed an image literal
            // instead of the qualified name of a tile. The decompiler strips out the "img" part
            // so we need to add it back
            if (typeof v === "string" && v.indexOf(".") === -1 && v.indexOf(`\``) === -1) {
                return `img\`${v}\``
            }
            return v;
        }

        getText() {
            const v = this.getValue();

            if (typeof v === "string" && v.indexOf("`") !== -1) {
                return v;
            }
            return super.getText();
        }

        getOptions(): any[] {
            if (typeof this.menuGenerator_ !== 'function') {
                this.transparent = constructTransparentTile();
                return [this.transparent];
            }

            return this.menuGenerator_.call(this);
        }

        menuGenerator_ = () => {
            if (!this.transparent) {
                this.transparent = constructTransparentTile();
            }

            let options: TilesetDropdownOption[] = [this.transparent];

            if (this.sourceBlock_) {
                // projectId 0 is reserved for transparency, which is always included

                const tiles = pxt.react.getTilemapProject().getProjectTiles(16);

                options = options.concat(tiles.tiles.map(t => [{
                    src: bitmapToImageURI(pxt.sprite.Bitmap.fromData(t.bitmap), PREVIEW_SIDE_LENGTH, false),
                    width: PREVIEW_SIDE_LENGTH,
                    height: PREVIEW_SIDE_LENGTH,
                    alt: t.id
                }, t.id]))
            }

            return options;
        }
    }

    function constructTransparentTile(): TilesetDropdownOption {
        return [{
            src: mkTransparentTileImage(16),
            width: PREVIEW_SIDE_LENGTH,
            height: PREVIEW_SIDE_LENGTH,
            alt: pxt.U.lf("transparency")
        }, "myTiles.tile0"];
    }

    function mkTransparentTileImage(sideLength: number) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = sideLength;
        canvas.height = sideLength;

        context.fillStyle = "#aeaeae";
        context.fillRect(0, 0, sideLength, sideLength);

        context.fillStyle = "#dedede";

        for (let x = 0; x < sideLength; x += 4) {
            for (let y = 0; y < sideLength; y += 4) {
                if (((x + y) >> 2) & 1) context.fillRect(x, y, 4, 4);
            }
        }

        return canvas.toDataURL();
    }
}
