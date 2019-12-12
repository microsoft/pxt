/// <reference path="./monacoFieldEditor.ts" />

namespace pxt.editor {
    const fieldEditorId = "image-editor";

    export class MonacoReactFieldEditor<U> implements MonacoFieldEditor {
        private resolver: (edit: TextEdit) => void;
        private rejecter: (err?: any) => void;

        protected fileType: pxt.editor.FileType;
        protected editrange: monaco.Range;
        protected host: MonacoFieldEditorHost;
        protected fv: pxt.react.FieldEditorView<U>;

        getId() {
            return fieldEditorId;
        }

        showEditorAsync(fileType: FileType, editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit> {
            this.fileType = fileType;
            this.editrange = editrange;
            this.host = host;

            this.fv = pxt.react.getFieldEditorView(this.getFieldEditorId(), this.textToValue(host.getText(editrange)), this.getOptions());

            this.fv.onHide(() => {
                this.onClosed();
            });

            this.fv.show();

            return new Promise((resolve, reject) => {
                this.resolver = resolve;
                this.rejecter = reject;
            });
        }

        onClosed() {
            if (this.resolver) {
                this.resolver({
                    range: this.editrange,
                    replacement: this.resultToText(this.fv.getResult())
                });

                this.editrange = undefined;
                this.resolver = undefined;
                this.rejecter = undefined;
            }
        }

        dispose() {
            this.onClosed();
        }

        protected textToValue(text: string): U {
            return null
        }

        protected resultToText(result: U): string {
            return result + "";
        }

        protected getFieldEditorId() {
            return "";
        }
        protected getOptions(): any {
            return null;
        }
    }
}