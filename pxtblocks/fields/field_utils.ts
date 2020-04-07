namespace pxtblockly {
    export namespace svg {
        export function hasClass(el: SVGElement, cls: string): boolean {
            return pxt.BrowserUtils.containsClass(el, cls);
        }

        export function addClass(el: SVGElement, cls: string) {
            pxt.BrowserUtils.addClass(el, cls);
        }

        export function removeClass(el: SVGElement, cls: string) {
            pxt.BrowserUtils.removeClass(el, cls);
        }
    }
    export function parseColour(colour: string | number): string {
        const hue = Number(colour);
        if (!isNaN(hue)) {
            return Blockly.hueToRgb(hue);
        } else if (goog.isString(colour) && (colour as string).match(/^#[0-9a-fA-F]{6}$/)) {
            return colour as string;
        } else {
            return '#000';
        }
    }

    /**
     * Converts a bitmap into a square image suitable for display. In light mode the preview
     * is drawn with no transparency (alpha is filled with background color)
     */
    export function bitmapToImageURI(frame: pxt.sprite.Bitmap, sideLength: number, lightMode: boolean) {
        const colors = pxt.appTarget.runtime.palette.slice(1);
        const canvas = document.createElement("canvas");
        canvas.width = sideLength;
        canvas.height = sideLength;

        // Works well for all of our default sizes, does not work well if the size is not
        // a multiple of 2 or is greater than 32 (i.e. from the decompiler)
        const cellSize = Math.min(sideLength / frame.width, sideLength / frame.height);

        // Center the image if it isn't square
        const xOffset = Math.max(Math.floor((sideLength * (1 - (frame.width / frame.height))) / 2), 0);
        const yOffset = Math.max(Math.floor((sideLength * (1 - (frame.height / frame.width))) / 2), 0);

        let context: CanvasRenderingContext2D;
        if (lightMode) {
            context = canvas.getContext("2d", { alpha: false });
            context.fillStyle = "#dedede";
            context.fillRect(0, 0, sideLength, sideLength);
        }
        else {
            context = canvas.getContext("2d");
        }

        for (let c = 0; c < frame.width; c++) {
            for (let r = 0; r < frame.height; r++) {
                const color = frame.get(c, r);

                if (color) {
                    context.fillStyle = colors[color - 1];
                    context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                }
                else if (lightMode) {
                    context.fillStyle = "#dedede";
                    context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                }
            }
        }

        return canvas.toDataURL();
    }

    export function tilemapToImageURI(data: pxt.sprite.TilemapData, sideLength: number, lightMode: boolean, blocksInfo: pxtc.BlocksInfo) {
        const colors = pxt.appTarget.runtime.palette.slice();
        const canvas = document.createElement("canvas");
        canvas.width = sideLength;
        canvas.height = sideLength;

        // Works well for all of our default sizes, does not work well if the size is not
        // a multiple of 2 or is greater than 32 (i.e. from the decompiler)
        const cellSize = Math.min(sideLength / data.tilemap.width, sideLength / data.tilemap.height);

        // Center the image if it isn't square
        const xOffset = Math.max(Math.floor((sideLength * (1 - (data.tilemap.width / data.tilemap.height))) / 2), 0);
        const yOffset = Math.max(Math.floor((sideLength * (1 - (data.tilemap.height / data.tilemap.width))) / 2), 0);

        let context: CanvasRenderingContext2D;
        if (lightMode) {
            context = canvas.getContext("2d", { alpha: false });
            context.fillStyle = "#dedede";
            context.fillRect(0, 0, sideLength, sideLength);
        }
        else {
            context = canvas.getContext("2d");
        }

        let tileColors: string[] = [];

        for (let c = 0; c < data.tilemap.width; c++) {
            for (let r = 0; r < data.tilemap.height; r++) {
                const tile = data.tilemap.get(c, r);

                if (tile) {
                    if (!tileColors[tile]) {
                        const tileInfo = data.tileset.tiles[tile];

                        if (tileInfo.data) {
                            tileColors[tile] = pxt.sprite.computeAverageColor(pxt.sprite.Bitmap.fromData(tileInfo.data), colors);
                        }
                        else {
                            const bitmap = pxt.sprite.getBitmap(blocksInfo, tileInfo.qualifiedName);

                            if (bitmap) {
                                tileColors[tile] = pxt.sprite.computeAverageColor(bitmap, colors);
                            }
                            else {
                                tileColors[tile] = "#ffffff";
                            }
                        }
                    }

                    context.fillStyle = tileColors[tile];
                    context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                }
                else if (lightMode) {
                    context.fillStyle = "#dedede";
                    context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                }
            }
        }

        return canvas.toDataURL();
    }

    export function saveTilesetTile(ws: Blockly.Workspace, tile: pxt.sprite.TileInfo) {
        deleteTilesetTileIfExists(ws, tile);

        ws.createVariable(pxt.sprite.tileToBlocklyVariable(tile), pxt.sprite.BLOCKLY_TILESET_TYPE);
    }

    export function deleteTilesetTileIfExists(ws: Blockly.Workspace, tile: pxt.sprite.TileInfo) {
        const existing = ws.getVariablesOfType(pxt.sprite.BLOCKLY_TILESET_TYPE);

        for (const model of existing) {
            if (parseInt(model.name.substr(0, model.name.indexOf(";"))) === tile.projectId) {
                ws.deleteVariableById(model.getId());
                break;
            }
        }
    }

    export function getAllTilesetTiles(ws: Blockly.Workspace): pxt.sprite.TileInfo[] {
        return ws.getVariablesOfType(pxt.sprite.BLOCKLY_TILESET_TYPE).map(model => pxt.sprite.blocklyVariableToTile(model.name));
    }

    export interface FieldEditorReference<U extends Blockly.Field> {
        block: Blockly.Block;
        field: string;
        ref: U;
        parsed?: pxt.sprite.TilemapData;
    }

    export function getAllBlocksWithTilemaps(ws: Blockly.Workspace): FieldEditorReference<FieldTilemap>[] {
        return getAllFieldsCore(ws, f => f instanceof FieldTilemap && !f.isGreyBlock);
    }

    export function getAllBlocksWithTilesets(ws: Blockly.Workspace): FieldEditorReference<FieldTileset>[] {
        return getAllFieldsCore(ws, f => f instanceof FieldTileset);
    }

    function getAllFieldsCore<U extends Blockly.Field>(ws: Blockly.Workspace, predicate: (field: Blockly.Field) => boolean): FieldEditorReference<U>[] {
        const result: FieldEditorReference<U>[] = [];

        const top = ws.getTopBlocks(false);
        top.forEach(block => getAllFieldsRecursive(block));

        return result;

        function getAllFieldsRecursive(block: Blockly.Block) {
            for (const input of block.inputList) {
                for (const field of input.fieldRow) {
                    if (predicate(field)) {
                        result.push({ block, field: field.name, ref: (field as U) });
                    }
                }

                if (input.connection && input.connection.targetBlock()) {
                    getAllFieldsRecursive(input.connection.targetBlock());
                }
            }

            if (block.nextConnection && block.nextConnection.targetBlock()) {
                getAllFieldsRecursive(block.nextConnection.targetBlock());
            }
        }
    }
}