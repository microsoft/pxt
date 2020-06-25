/// <reference path="./monacoFieldEditor.ts" />
/// <reference path="./field_react.ts" />

namespace pxt.editor {
    const fieldEditorId = "tilemap-editor";

    export class MonacoTilemapEditor extends MonacoReactFieldEditor<pxt.sprite.TilemapData> {
        protected tilemapName: string;

        protected initAsync(): Promise<void> {
            const projectTiles = this.host.readFile("tilemap.jres");
            if (!projectTiles) {
                return this.host.writeFileAsync("tilemap.jres", defaultTileset);
            }

            return Promise.resolve();
        }

        protected textToValue(text: string): pxt.sprite.TilemapData {
            const project = pxt.react.getTilemapProject();

            // This matches the regex for the field editor, so it should always match
            const match = /^\s*tilemap\s*`([^`]*)`\s*$/.exec(text);
            const name = match[1];

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
                    if (edited.id.startsWith("*")) continue;
                    if (edited) {
                        result.tileset.tiles[editedIndex] = project.updateTile(edited.id, edited.bitmap)
                    }
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

            return `tilemap\`${this.tilemapName}\``;
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
    }

    const defaultTileset = `{
        "*": {
            "namespace": "myTiles",
            "mimeType": "image/x-mkcd-f4",
            "dataEncoding": "base64"
          }
    }`

    export const tilemapEditorDefinition: MonacoFieldEditorDefinition = {
        id: fieldEditorId,
        foldMatches: true,
        glyphCssClass: "sprite-focus-hover ms-Icon ms-Icon--Nav2DMapView",
        heightInPixels: 510,
        matcher: {
            // match both JS and python
            searchString: "tilemap\\s*(?:`|\\(\"\"\")(?:[ a-zA-Z0-9\\.]|\\n)*\\s*(?:`|\"\"\"\\))",
            isRegex: true,
            matchCase: true,
            matchWholeWord: false
        },
        proto: MonacoTilemapEditor
    };

    registerMonacoFieldEditor(fieldEditorId, tilemapEditorDefinition);
}