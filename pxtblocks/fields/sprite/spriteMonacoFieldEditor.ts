namespace pxtblockly {
    const fieldEditorId = "image-editor";

    export class MonacoSpriteEditor implements MonacoFieldEditor {
        getId() {
            return fieldEditorId;
        }

        showEditorAsync(editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit> {
            const contentDiv = host.contentDiv();
            const state = imageLiteralToBitmap(host.getText(editrange));

            const editor = new SpriteEditor(state, host.blocksInfo(), false);
            editor.render(contentDiv);
            editor.rePaint();
            editor.setActiveColor(1, true);

            goog.style.setHeight(contentDiv, editor.outerHeight() + 1);
            goog.style.setWidth(contentDiv, editor.outerWidth() + 1);
            goog.style.setStyle(contentDiv, "overflow", "hidden");
            goog.style.setStyle(contentDiv, "max-height", "500px");
            goog.dom.classlist.add(contentDiv.parentElement, "sprite-editor-dropdown")

            editor.addKeyListeners();
            editor.layout();
            return Promise.delay(5000).then(() => {
                return {
                    range: editrange,
                    replacement: bitmapToImageLiteral(state)
                }
            });
        }

        getRangeInfo(range: monaco.Range, host: MonacoFieldEditorHost): MonacoRangeInfo {
            return undefined;
        }

        dispose() {

        }
    }

    export const spriteEditorDefinition: MonacoFieldEditorDefinition = {
        id: fieldEditorId,
        matcher: {
            sourcefile: "main.ts",
            qname: "Image",
            nodeKind: 183
        },
        proto: MonacoSpriteEditor
    };
}