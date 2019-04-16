/// <reference path="../../localtypings/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />

export class MonacoBreakpoint implements monaco.IDisposable {
    protected active: boolean;
    protected decoration: string;
    protected range: monaco.Range;

    constructor(public readonly source: pxtc.Breakpoint, protected readonly editor: monaco.editor.IStandaloneCodeEditor) {
        this.active = false;

        const model = this.editor.getModel();
        const start = model.getPositionAt(this.source.start);
        const end = model.getPositionAt(this.source.start + this.source.length);

        if (end.lineNumber === start.lineNumber) {
            this.range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
        }
        else {
            this.range = new monaco.Range(start.lineNumber, start.column, start.lineNumber, model.getLineMaxColumn(start.lineNumber));
        }


        this.updateDecoration();
    }

    public simulatorID() {
        return this.source.id;
    }

    public isActive() {
        return this.active;
    }

    public setActive(active: boolean) {
        if (this.active === active) return;

        this.active = active;
        this.updateDecoration();
    }

    public toggle() {
        this.setActive(!this.active);
    }

    public distanceFromLine(line: number) {
        return Math.abs(this.range.startLineNumber - line);
    }

    public dispose() {
        if (this.decoration) {
            this.editor.deltaDecorations([this.decoration], []);
            this.decoration = undefined;
        }
    }

    updateDecoration() {
        const glyphClass = this.active ? "monaco-breakpoint active" : "monaco-breakpoint";
        const glyphHover = this.active ? pxt.U.lf("Remove breakpoint") : pxt.U.lf("Add breakpoint");

        const dec = this.editor.deltaDecorations(this.decoration ? [this.decoration] : [], [
            {
                range: this.range,
                options: {
                    glyphMarginClassName: glyphClass,
                    glyphMarginHoverMessage: glyphHover
                }
            }
        ]);
        this.decoration = dec[0];
    }
}