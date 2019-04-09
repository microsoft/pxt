/// <reference path="../../localtypings/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />

import * as compiler from "./compiler";

interface OwnedRange {
    line: number;
    owner: string;
    range: monaco.Range;
    id: number;
}

export class ViewZoneEditorHost implements pxt.editor.MonacoFieldEditorHost, monaco.editor.IViewZone {
    domNode: HTMLDivElement;
    afterLineNumber: number;
    heightInPx = 520;

    protected content: HTMLDivElement;
    protected wrapper: HTMLDivElement;
    private fileType: pxt.editor.FileType;
    protected editor: monaco.editor.IStandaloneCodeEditor;
    protected blocks: pxtc.BlocksInfo;
    protected id: number;
    protected _deferredShow: () => void;

    suppressMouseDown = false;

    constructor(protected fe: pxt.editor.MonacoFieldEditor, protected range: monaco.Range, protected model: monaco.editor.IModel) {
        this.afterLineNumber = range.endLineNumber;

        const outer = document.createElement("div");
        outer.setAttribute("class", "pxt-view-zone");

        const content = document.createElement("div");
        content.setAttribute("class", "monaco-field-editor-frame");

        outer.appendChild(content);
        this.domNode = outer;
        this.wrapper = content;
    }

    getId() {
        return "pxt-monaco-field-editor";
    }

    contentDiv(): HTMLDivElement {
        if (!this.content) {
            this.content = document.createElement("div");
            this.wrapper.appendChild(this.content);
        }
        return this.content;
    }

    showAsync(fileType: pxt.editor.FileType, editor: monaco.editor.IStandaloneCodeEditor): Promise<pxt.editor.TextEdit> {
        this.fileType = fileType;
        this.editor = editor;
        return compiler.getBlocksAsync()
            .then(bi => {
                this.blocks = bi;
                return this.showViewZoneAsync();
            })
            .then(() => {
                this.editor.setScrollPosition({
                    scrollTop: this.editor.getTopForLineNumber(this.afterLineNumber)
                });
                return this.fe.showEditorAsync(this.fileType, this.range, this)
            })
            .finally(() => {
                this.close();
            })
    }

    onComputedHeight(height: number) {
        this.contentDiv().style.height = height + "px";
    }

    onDomNodeTop(top: number) {
        if (this._deferredShow) {
            this._deferredShow();
            this._deferredShow = undefined;
        }
    }

    protected showViewZoneAsync(): Promise<void> {
        if (this._deferredShow) return Promise.resolve();
        return new Promise(resolve => {
            this._deferredShow = resolve;
            this.editor.changeViewZones(accessor => {
                this.id = accessor.addZone(this);
            });
        });
    }

    protected resizeViewZoneAsync(): Promise<void> {
        if (!this.id) return Promise.resolve();
        return new Promise(resolve => {
            this.editor.changeViewZones(accessor => {
                accessor.layoutZone(this.id);
            });
        });
    }

    getText(range: monaco.Range): string {
        return this.model.getValueInRange(range);
    }

    blocksInfo(): pxtc.BlocksInfo {
        return this.blocks;
    }

    close(): void {
        this.fe.onClosed();
        this.fe.dispose();
        this.editor.changeViewZones(accessor => {
            accessor.removeZone(this.id);
        });
    }
}

export class FieldEditorManager {
    protected fieldEditors: pxt.editor.MonacoFieldEditorDefinition[] = [];
    protected decorations: pxt.Map<string[]> = {};
    protected liveRanges: OwnedRange[] = [];

    private rangeID = 0;

    addFieldEditor(definition: pxt.editor.MonacoFieldEditorDefinition) {
        for (const f of this.fieldEditors) {
            if (f.id === definition.id) return;
        }
        this.fieldEditors.push(definition);
    }

    getDecorations(owner: string) {
        return this.decorations[owner] || [];
    }

    allDecorations() {
        const res: string[] = [];
        Object.keys(this.decorations).forEach(owner => res.push(...this.getDecorations(owner)));
        return res;
    }

    setDecorations(owner: string, decorations: string[]) {
        this.decorations[owner] = decorations;
    }

    clearRanges(editor?: monaco.editor.IStandaloneCodeEditor) {
        if (editor) {
            Object.keys(this.decorations).forEach(owner => {
                editor.deltaDecorations(this.decorations[owner], []);
            });
        }

        this.decorations = {};
        this.liveRanges = [];
        this.rangeID = 0;
    }

    trackRange(owner: string, line: number, range: monaco.Range): boolean {
        if (this.getInfoForLine(line)) {
            return false;
        }

        this.liveRanges.push({ line, owner, range, id: this.rangeID++ });
        return true;
    }

    getFieldEditorById(id: string) {
        for (const fe of this.fieldEditors) {
            if (fe.id === id) {
                return fe;
            }
        }
        return undefined;
    }

    getInfoForLine(line: number) {
        for (const range of this.liveRanges) {
            if (range.line === line) return range;
        }
        return undefined;
    }

    allRanges() {
        return this.liveRanges;
    }

    allFieldEditors() {
        return this.fieldEditors;
    }
}