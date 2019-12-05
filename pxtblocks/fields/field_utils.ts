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

    const BLOCKLY_TILESET_TYPE = "BLOCKLY_TILESET_TYPE"

    export function saveTilesetTile(ws: Blockly.Workspace, tile: pxt.sprite.TileInfo) {
        deleteTilesetTileIfExists(ws, tile);

        ws.createVariable(tileToVariable(tile), BLOCKLY_TILESET_TYPE);
    }

    export function deleteTilesetTileIfExists(ws: Blockly.Workspace, tile: pxt.sprite.TileInfo) {
        const existing = ws.getVariablesOfType(BLOCKLY_TILESET_TYPE);

        for (const model of existing) {
            if (parseInt(model.name.substr(0, model.name.indexOf(";"))) === tile.projectId) {
                ws.deleteVariableById(model.getId());
                break;
            }
        }
    }

    export function getAllTilesetTiles(ws: Blockly.Workspace): pxt.sprite.TileInfo[] {
        return ws.getVariablesOfType(BLOCKLY_TILESET_TYPE).map(model => variableToTile(model.name));
    }

    function tileToVariable(info: pxt.sprite.TileInfo): string {
        return `${info.projectId};${info.data.width};${info.data.height};${pxtc.Util.toHex(info.data.data)}`
    }

    function variableToTile(name: string): pxt.sprite.TileInfo {
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