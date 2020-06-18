/// <reference path="./monacoFieldEditor.ts" />
/// <reference path="./field_react.ts" />

namespace pxt.editor {
    const fieldEditorId = "tilemap-editor";

    export class MonacoTilemapEditor extends MonacoReactFieldEditor<pxt.sprite.TilemapData> {
        protected initAsync(): Promise<void> {
            const projectTiles = this.host.readFile("tilemap.jres");
            if (!projectTiles) {
                return this.host.writeFileAsync("tilemap.jres", defaultTileset);
            }

            return Promise.resolve();
        }

        protected textToValue(text: string): pxt.sprite.TilemapData {
            const tileset = new pxt.TilemapProject(this.host.package());

            // This matches the regex for the field editor, so it should always match
            const match = /^\s*tilemap\s*`([^`]*)`\s*$/.exec(text);
            const name = match[1];

            if (name) {

            }

            return null;
        }

        protected resultToText(result: pxt.sprite.TilemapData): string {
            return pxt.sprite.bitmapToImageLiteral(null, "typescript");
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