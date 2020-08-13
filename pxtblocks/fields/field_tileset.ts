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
        // private member of FieldDropdown
        protected selectedOption_: TilesetDropdownOption;

        protected static referencedTiles: TilesetDropdownOption[];
        protected static cachedRevision: number;
        protected static cachedWorkspaceId: string;

        protected static getReferencedTiles(workspace: Blockly.Workspace) {
            const project = pxt.react.getTilemapProject();

            if (project.revision() !== FieldTileset.cachedRevision || workspace.id != FieldTileset.cachedWorkspaceId) {
                FieldTileset.cachedRevision = project.revision();
                FieldTileset.cachedWorkspaceId = workspace.id;
                const references = getAllReferencedTiles(workspace);

                const supportedTileWidths = [16, 8, 32];

                for (const width of supportedTileWidths) {
                    const projectTiles = project.getProjectTiles(width, width === 16);
                    if (!projectTiles) continue;

                    for (const tile of projectTiles.tiles) {
                        if (!references.find(t => t.id === tile.id)) {
                            references.push(tile);
                        }
                    }
                }


                let weights: pxt.Map<number> = {};
                references.sort((a, b) => {
                    if (a.id === b.id) return 0;

                    if (a.bitmap.width !== b.bitmap.width) {
                        return a.bitmap.width - b.bitmap.width
                    }

                    if (a.isProjectTile !== b.isProjectTile) {
                        if (a.isProjectTile) return -1
                        else return 1;
                    }

                    return (weights[a.id] || (weights[a.id] = tileWeight(a.id))) -
                        (weights[b.id] || (weights[b.id] = tileWeight(b.id)))
                });

                const getTileImage = (t: pxt.Tile) => tileWeight(t.id) <= 2 ?
                    mkTransparentTileImage(t.bitmap.width) :
                    bitmapToImageURI(pxt.sprite.Bitmap.fromData(t.bitmap), PREVIEW_SIDE_LENGTH, false);

                FieldTileset.referencedTiles = references.map(tile => [{
                    src: getTileImage(tile),
                    width: PREVIEW_SIDE_LENGTH,
                    height: PREVIEW_SIDE_LENGTH,
                    alt: tile.id
                }, tile.id])
            }
            return FieldTileset.referencedTiles;
        }

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

        render_() {
            if (this.value_ && this.selectedOption_) {
                if (this.selectedOption_[1] !== this.value_) {
                    const tile = pxt.react.getTilemapProject().resolveTile(this.value_);
                    FieldTileset.cachedRevision = -1;

                    if (tile) {
                        this.selectedOption_ = [{
                            src: bitmapToImageURI(pxt.sprite.Bitmap.fromData(tile.bitmap), PREVIEW_SIDE_LENGTH, false),
                            width: PREVIEW_SIDE_LENGTH,
                            height: PREVIEW_SIDE_LENGTH,
                            alt: tile.id
                        }, this.value_]
                    }
                }

            }
            super.render_();
        }

        getOptions(): any[] {
            if (typeof this.menuGenerator_ !== 'function') {
                this.transparent = constructTransparentTile();
                return [this.transparent];
            }

            return this.menuGenerator_.call(this);
        }

        menuGenerator_ = () => {
            if (this.sourceBlock_?.workspace && needsTilemapUpgrade(this.sourceBlock_?.workspace)) {
                return [[{
                    src: mkTransparentTileImage(16),
                    width: PREVIEW_SIDE_LENGTH,
                    height: PREVIEW_SIDE_LENGTH,
                    alt: this.getValue()
                }, this.getValue()]]
            }
            return FieldTileset.getReferencedTiles(this.sourceBlock_.workspace);
        }
    }

    function constructTransparentTile(): TilesetDropdownOption {
        const tile = pxt.react.getTilemapProject().getTransparency(16);
        return [{
            src: mkTransparentTileImage(16),
            width: PREVIEW_SIDE_LENGTH,
            height: PREVIEW_SIDE_LENGTH,
            alt: pxt.U.lf("transparency")
        }, tile.id];
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

    function tileWeight(id: string) {
        switch (id) {
            case "myTiles.transparency16":
                return 1;
            case "myTiles.transparency8":
            case "myTiles.transparency32":
                return 2;
            default:
                if (id.startsWith("myTiles.tile")) {
                    const num = parseInt(id.slice(12));

                    if (!Number.isNaN(num)) return num + 2;
                }
                return 9999999999;
        }
    }
}
