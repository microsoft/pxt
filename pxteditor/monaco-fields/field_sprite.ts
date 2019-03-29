/// <reference path="./monacoFieldEditor.ts" />

namespace pxt.editor {
    const fieldEditorId = "image-editor";

    export class MonacoSpriteEditor implements MonacoFieldEditor {
        private resolver: (edit: TextEdit) => void;
        private rejecter: (err?: any) => void;

        protected editor: pxtsprite.SpriteEditor;
        protected fileType: pxt.editor.FileType;
        protected editrange: monaco.Range;

        getId() {
            return fieldEditorId;
        }

        showEditorAsync(fileType: FileType, editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit> {
            this.fileType = fileType;
            this.editrange = editrange;
            const contentDiv = host.contentDiv();
            const state = pxtsprite.imageLiteralToBitmap(host.getText(editrange), `
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
        `);

            this.editor = new pxtsprite.SpriteEditor(state, host.blocksInfo(), false);
            this.editor.render(contentDiv);
            this.editor.rePaint();
            this.editor.setActiveColor(1, true);
            this.editor.setSizePresets([
                [8, 8],
                [16, 16],
                [32, 32],
                [10, 8]
            ]);

            contentDiv.style.height = (this.editor.outerHeight() + 3) + "px";
            contentDiv.style.width = (this.editor.outerWidth() + 3) + "px";
            contentDiv.style.overflow = "hidden";
            addClass(contentDiv, "sprite-editor-dropdown-bg");
            addClass(contentDiv.parentElement, "sprite-editor-dropdown");

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
                    replacement: pxtsprite.bitmapToImageLiteral(this.editor.bitmap(), this.fileType)
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

    function addClass(el: Element, className: string) {
        if (el.hasAttribute("class")) el.setAttribute("class", el.getAttribute("class") + " " + className);
        else el.setAttribute("class", className);
    }

    registerMonacoFieldEditor(fieldEditorId, spriteEditorDefinition);
}