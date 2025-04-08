const fieldEditorId = "image-editor";

export class MonacoReactFieldEditor<U> implements pxt.editor.MonacoFieldEditor {
    private resolver: (edit: pxt.editor.TextEdit) => void;
    private rejecter: (err?: any) => void;

    protected fileType: pxt.editor.FileType;
    protected editrange: monaco.Range;
    protected host: pxt.editor.MonacoFieldEditorHost;
    protected fv: pxt.react.FieldEditorView<U>;

    getId() {
        return fieldEditorId;
    }

    showEditorAsync(fileType: pxt.editor.FileType, editrange: monaco.Range, host: pxt.editor.MonacoFieldEditorHost): Promise<pxt.editor.TextEdit> {
        this.fileType = fileType;
        this.editrange = editrange;
        this.host = host;

        return this.initAsync().then(() => {
            const value = this.textToValue(host.getText(editrange));

            if (!value) {
                return Promise.resolve(null);
            }

            this.fv = pxt.react.getFieldEditorView(this.getFieldEditorId(), value, this.getOptions());

            this.fv.onHide(() => {
                this.onClosed();
            });

            this.fv.show();

            return new Promise((resolve, reject) => {
                this.resolver = resolve;
                this.rejecter = reject;
            });
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

    protected initAsync(): Promise<void> {
        return Promise.resolve();
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