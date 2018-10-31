namespace pxtblockly {
    const fieldEditorId = "image-editor";

    export class MonacoSpriteEditor implements MonacoFieldEditor {
        private resolver: (edit: TextEdit) => void;
        private rejecter: (err?: any) => void;

        protected editor: SpriteEditor;
        protected editrange: monaco.Range;

        getId() {
            return fieldEditorId;
        }

        showEditorAsync(editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit> {
            this.editrange = editrange;
            const contentDiv = host.contentDiv();
            const state = imageLiteralToBitmap(host.getText(editrange));

            this.editor = new SpriteEditor(state, host.blocksInfo(), false);
            this.editor.render(contentDiv);
            this.editor.rePaint();
            this.editor.setActiveColor(1, true);

            goog.style.setHeight(contentDiv, this.editor.outerHeight() + 1);
            goog.style.setWidth(contentDiv, this.editor.outerWidth() + 1);
            goog.style.setStyle(contentDiv, "overflow", "hidden");
            goog.style.setStyle(contentDiv, "max-height", "500px");
            goog.dom.classlist.add(contentDiv.parentElement, "sprite-editor-dropdown")

            this.editor.addKeyListeners();
            this.editor.onClose(() => this.onClosed());
            this.editor.layout();
            return new Promise((resolve, reject) => {
                this.resolver = resolve;
                this.rejecter = reject;
            });
        }

        onClosed() {
            if (this.resolver) {
                this.resolver({
                    range: this.editrange,
                    replacement: bitmapToImageLiteral(this.editor.bitmap())
                });

                this.editor.removeKeyListeners();

                this.editor = undefined;
                this.editrange = undefined;
                this.resolver = undefined;
                this.rejecter = undefined;
            }
        }

        dispose() {
            this.onClosed();
        }
    }

    export const spriteEditorDefinition: MonacoFieldEditorDefinition = {
        id: fieldEditorId,
        foldMatches: true,
        glyphCssClass: "sprite-editor-glyph",
        matcher: {
            sourcefile: "main.ts",
            qname: "Image",
            nodeKind: 183
        },
        proto: MonacoSpriteEditor
    };
}