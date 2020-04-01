/// <reference path="./monacoFieldEditor.ts" />
/// <reference path="./field_react.ts" />

namespace pxt.editor {
    const fieldEditorId = "image-editor";

    export class MonacoSpriteEditor extends MonacoReactFieldEditor<pxt.sprite.Bitmap> {
        protected textToValue(text: string): pxt.sprite.Bitmap {
            return pxt.sprite.imageLiteralToBitmap(text);
        }

        protected resultToText(result: pxt.sprite.Bitmap): string {
            return pxt.sprite.bitmapToImageLiteral(result, "typescript");
        }

        protected getFieldEditorId() {
            return "image-editor";
        }
        protected getOptions(): any {
            return {
                initWidth: 16,
                initHeight: 16,
                blocksInfo: this.host.blocksInfo()
            };
        }
    }

    export const spriteEditorDefinition: MonacoFieldEditorDefinition = {
        id: fieldEditorId,
        foldMatches: true,
        glyphCssClass: "sprite-editor-glyph sprite-focus-hover",
        heightInPixels: 510,
        matcher: {
            // match both JS and python
            searchString: "img\\s*(?:`|\\(\"\"\")(?:[ a-fA-F0-9\\.]|\\n)*\\s*(?:`|\"\"\"\\))",
            isRegex: true,
            matchCase: true,
            matchWholeWord: false
        },
        proto: MonacoSpriteEditor
    };

    registerMonacoFieldEditor(fieldEditorId, spriteEditorDefinition);
}