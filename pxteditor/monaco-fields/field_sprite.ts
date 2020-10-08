/// <reference path="./monacoFieldEditor.ts" />
/// <reference path="./field_react.ts" />

namespace pxt.editor {
    const fieldEditorId = "image-editor";

    export class MonacoSpriteEditor extends MonacoReactFieldEditor<pxt.ProjectImage> {
        protected isPython: boolean;

        protected textToValue(text: string): pxt.ProjectImage {
            this.isPython = text.indexOf("`") === -1
            return createFakeAsset(pxt.sprite.imageLiteralToBitmap(text));
        }

        protected resultToText(result: pxt.ProjectImage): string {
            return pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(result.bitmap), this.isPython ? "python" : "typescript");
        }

        protected getFieldEditorId() {
            return "image-editor";
        }
        protected getOptions(): any {
            return {
                initWidth: 16,
                initHeight: 16,
                blocksInfo: this.host.blocksInfo(),
                showTiles: true
            };
        }
    }

    function createFakeAsset(bitmap: pxt.sprite.Bitmap): pxt.ProjectImage {
        return {
            type: pxt.AssetType.Image,
            id: "",
            internalID: 0,
            bitmap: bitmap.data(),
            jresData: ""
        }
    }

    export const spriteEditorDefinition: MonacoFieldEditorDefinition = {
        id: fieldEditorId,
        foldMatches: true,
        glyphCssClass: "sprite-editor-glyph sprite-focus-hover",
        heightInPixels: 510,
        matcher: {
            // match both JS and python
            searchString: "img\\s*(?:`|\\(\\s*\"\"\")[ a-fA-F0-9\\.\\n]*\\s*(?:`|\"\"\"\\s*\\))",
            isRegex: true,
            matchCase: true,
            matchWholeWord: false
        },
        proto: MonacoSpriteEditor
    };

    registerMonacoFieldEditor(fieldEditorId, spriteEditorDefinition);
}