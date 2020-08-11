/// <reference path="./monacoFieldEditor.ts" />
/// <reference path="./field_react.ts" />

namespace pxt.editor {
    const fieldEditorId = "tilemap-editor";

    export class MonacoTilemapEditor extends MonacoReactFieldEditor<pxt.sprite.TilemapData> {
        protected tilemapName: string;
        protected isTilemapLiteral: boolean;

        protected textToValue(text: string): pxt.sprite.TilemapData {
            const tm = this.readTilemap(text);

            const allTiles = pxt.react.getTilemapProject().getProjectTiles(tm.tileset.tileWidth);

            for (const tile of allTiles.tiles) {
                if (!tm.tileset.tiles.some(t => t.id === tile.id)) {
                    tm.tileset.tiles.push(tile);
                }
            }

            for (const tile of tm.tileset.tiles) {
                tile.weight = allTiles.tiles.findIndex(t => t.id === tile.id);
            }

            return tm;
        }

        protected readTilemap(text: string): pxt.sprite.TilemapData {
            const project = pxt.react.getTilemapProject();

            if (/^\s*tiles\s*\./.test(text)) {
                this.isTilemapLiteral = false;

                if (text) {
                    try {
                        const data = pxt.sprite.decodeTilemap(text, "typescript", project);
                        return data;
                    }
                    catch (e) {
                        // If the user is still typing, they might try to open the editor on an incomplete tilemap
                    }
                    return null;
                 }
            }

            this.isTilemapLiteral = true;

            // This matches the regex for the field editor, so it should always match
            const match = /^\s*tilemap\s*(?:`([^`]*)`)|(?:\(\s*"""([^"]*)"""\s*\))\s*$/.exec(text);
            const name = (match[1] || match[2] || "").trim();

            if (name) {
                let id = ts.pxtc.escapeIdentifier(name)
                let proj = project.getTilemap(id);

                if (!proj) {
                    const [ name, map ] = project.createNewTilemap(id, 16, 16, 16);
                    proj = map;
                    id = name;
                }

                this.tilemapName = id;

                return proj
            }

            return project.blankTilemap(16, 16, 16);
        }

        protected resultToText(result: pxt.sprite.TilemapData): string {
            const project = pxt.react.getTilemapProject();
            project.pushUndo();

            if (result.deletedTiles) {
                for (const deleted of result.deletedTiles) {
                    project.deleteTile(deleted);
                }
            }

            if (result.editedTiles) {
                for (const edit of result.editedTiles) {
                    const editedIndex = result.tileset.tiles.findIndex(t => t.id === edit);
                    const edited = result.tileset.tiles[editedIndex];

                    // New tiles start with *. We haven't created them yet so ignore
                    if (!edited || edited.id.startsWith("*")) continue;

                    result.tileset.tiles[editedIndex] = project.updateTile(edited.id, edited.bitmap);
                }
            }

            for (let i = 0; i < result.tileset.tiles.length; i++) {
                const tile = result.tileset.tiles[i];

                if (tile.id.startsWith("*")) {
                    const newTile = project.createNewTile(tile.bitmap);
                    result.tileset.tiles[i] = newTile;
                }
                else if (!tile.data) {
                    result.tileset.tiles[i] = project.resolveTile(tile.id);
                }
            }

            pxt.sprite.trimTilemapTileset(result);

            if (this.isTilemapLiteral) {
                if (this.tilemapName) {
                    project.updateTilemap(this.tilemapName, result);
                }
                else {
                    const [ name, map ] = project.createNewTilemap(lf("level"), result.tileset.tileWidth, result.tilemap.width, result.tilemap.height);
                    map.tilemap.apply(result.tilemap);
                    map.tileset = result.tileset;
                    map.layers = result.layers;
                    this.tilemapName = name;
                }

                return this.fileType === "typescript" ? `tilemap\`${this.tilemapName}\`` : `tilemap("""${this.tilemapName}""")`;
            }
            else {
                return pxt.sprite.encodeTilemap(result, this.fileType === "typescript" ? "typescript" : "python");
            }
        }

        protected getFieldEditorId() {
            return "tilemap-editor";
        }
        protected getOptions(): any {
            return {
                initWidth: 16,
                initHeight: 16,
                blocksInfo: this.host.blocksInfo()
            };
        }

        protected getCreateTilemapRange() {
            const start = this.editrange.getStartPosition();
            let current = this.editrange.getEndPosition();
            let range: monaco.Range;

            let openParen = 1;

            while (true) {
                range = new monaco.Range(current.lineNumber, current.column, current.lineNumber + 1, 0);
                const line = this.host.getText(range);

                for (let i = 0; i < line.length; i++) {
                    if (line.charAt(i) === "(") {
                        openParen++;
                    }
                    else if (line.charAt(i) === ")") {
                        openParen --;

                        if (openParen === 0) {
                            const end = new monaco.Position(current.lineNumber, current.column + i + 2);

                            return monaco.Range.fromPositions(start, end);
                        }
                    }
                }

                current = range.getEndPosition();

                if (current.lineNumber > start.lineNumber + 20) {
                    return null;
                }
            }
        }
    }

    export const tilemapEditorDefinition: MonacoFieldEditorDefinition = {
        id: fieldEditorId,
        foldMatches: true,
        alwaysBuildOnClose: true,
        glyphCssClass: "sprite-focus-hover ms-Icon ms-Icon--Nav2DMapView",
        heightInPixels: 510,
        weight: 5,
        matcher: {
            // match both JS and python
            searchString: "(?:tilemap\\s*(?:`|\\(\"\"\")(?:[ a-zA-Z0-9_]|\\n)*\\s*(?:`|\"\"\"\\)))|(?:tiles\\s*\\.\\s*createTilemap\\s*\\([^\\)]+\\))",
            isRegex: true,
            matchCase: true,
            matchWholeWord: false
        },
        proto: MonacoTilemapEditor
    };

    registerMonacoFieldEditor(fieldEditorId, tilemapEditorDefinition);
}