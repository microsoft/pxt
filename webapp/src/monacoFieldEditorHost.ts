/// <reference path="../../localtypings/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />

import * as compiler from "./compiler";
import * as blocklyFieldView from "./blocklyFieldView";

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
    protected id: string;
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

export class ModalEditorHost implements pxt.editor.MonacoFieldEditorHost {
    protected blocks: pxtc.BlocksInfo;

    constructor(protected fe: pxt.editor.MonacoFieldEditor, protected range: monaco.Range, protected model: monaco.editor.IModel) {
    }

    contentDiv(): HTMLDivElement {
        return null;
    }

    getText(range: monaco.Range): string {
        return this.model.getValueInRange(range);
    }

    blocksInfo(): pxtc.BlocksInfo {
        return this.blocks;
    }

    showAsync(fileType: pxt.editor.FileType, editor: monaco.editor.IStandaloneCodeEditor): Promise<pxt.editor.TextEdit> {
        return compiler.getBlocksAsync()
            .then(bi => {
                this.blocks = bi;
                return this.fe.showEditorAsync(fileType, this.range, this);
            });
    }

    close(): void {
        this.fe.onClosed();
        this.fe.dispose();
    }
}

export class FieldEditorManager implements monaco.languages.FoldingRangeProvider {
    protected fieldEditors: pxt.editor.MonacoFieldEditorDefinition[] = [];
    protected decorations: pxt.Map<string[]> = {};
    protected liveRanges: OwnedRange[] = [];
    protected fieldEditorsEnabled = true;

    private rangeID = 0;

    constructor(protected editor: monaco.editor.IStandaloneCodeEditor) {}

    setFieldEditorsEnabled(enabled: boolean) {
        this.fieldEditorsEnabled = enabled;
        if (!enabled) this.clearRanges(this.editor);
    }

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

    provideFoldingRanges(model: monaco.editor.ITextModel, context: monaco.languages.FoldingContext, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.FoldingRange[]> {
        this.updateFieldEditorRanges(model);

        // We use FoldingRangeKind.Comment for field editors and FoldingRangeKind.Region for everything else
        const editorRanges: monaco.languages.FoldingRange[] = this.liveRanges.map(range => ({
            start: range.range.startLineNumber,
            end: range.range.endLineNumber,
            kind: monaco.languages.FoldingRangeKind.Comment
        }));

        // Remove duplicate ranges
        let indentRanges = computeRanges(model, false);
        editorRanges.forEach(eRange => {
            indentRanges = indentRanges.filter(range => range.start != eRange.start);
        });

        return editorRanges.concat(indentRanges);
    }

    protected updateFieldEditorRanges(model: monaco.editor.ITextModel) {
        this.clearRanges(this.editor);

        if (!this.fieldEditorsEnabled) return;

        this.allFieldEditors().forEach(fe => {
            const matcher = fe.matcher;
            const matches = model.findMatches(matcher.searchString,
                true,
                matcher.isRegex,
                matcher.matchCase,
                matcher.matchWholeWord ? this.editor.getOptions().get(monaco.editor.EditorOption.wordSeparators) : null,
                false);


            const decorations: monaco.editor.IModelDeltaDecoration[] = [];
            matches.forEach(match => {
                const line = match.range.startLineNumber;

                decorations.push({
                    range: new monaco.Range(line, model.getLineMinColumn(line), line, model.getLineMaxColumn(line)),
                    options: {
                        glyphMarginClassName: fe.glyphCssClass
                    }
                });

                this.trackRange(fe.id, line, match.range);

            });
            this.setDecorations(fe.id, this.editor.deltaDecorations([], decorations));
        });
    }
}

// The implementation below is lightly adapted from the default folding provider in vscode.
// It creates regions based on indent level
const MAX_FOLDING_REGIONS_FOR_INDENT_LIMIT = 5000;

export class RangesCollector {
    private readonly _startIndexes: number[];
    private readonly _endIndexes: number[];
    private readonly _indentOccurrences: number[];
    private _length: number;
    private readonly _foldingRangesLimit: number;

    constructor(foldingRangesLimit: number) {
        this._startIndexes = [];
        this._endIndexes = [];
        this._indentOccurrences = [];
        this._length = 0;
        this._foldingRangesLimit = foldingRangesLimit;
    }

    public insertFirst(startLineNumber: number, endLineNumber: number, indent: number) {
        let index = this._length;
        this._startIndexes[index] = startLineNumber;
        this._endIndexes[index] = endLineNumber;
        this._length++;
        if (indent < 1000) {
            this._indentOccurrences[indent] = (this._indentOccurrences[indent] || 0) + 1;
        }
    }

    public toIndentRanges(model: monaco.editor.ITextModel) {
        if (this._length <= this._foldingRangesLimit) {
            // reverse and create arrays of the exact length
            let startIndexes = new Uint32Array(this._length);
            let endIndexes = new Uint32Array(this._length);
            for (let i = this._length - 1, k = 0; i >= 0; i--, k++) {
                startIndexes[k] = this._startIndexes[i];
                endIndexes[k] = this._endIndexes[i];
            }
            return toFoldRanges(startIndexes, endIndexes);
        } else {
            let entries = 0;
            let maxIndent = this._indentOccurrences.length;
            for (let i = 0; i < this._indentOccurrences.length; i++) {
                let n = this._indentOccurrences[i];
                if (n) {
                    if (n + entries > this._foldingRangesLimit) {
                        maxIndent = i;
                        break;
                    }
                    entries += n;
                }
            }
            const tabSize = model.getOptions().tabSize;
            // reverse and create arrays of the exact length
            let startIndexes = new Uint32Array(this._foldingRangesLimit);
            let endIndexes = new Uint32Array(this._foldingRangesLimit);
            for (let i = this._length - 1, k = 0; i >= 0; i--) {
                let startIndex = this._startIndexes[i];
                let lineContent = model.getLineContent(startIndex);
                let indent = computeIndentLevel(lineContent, tabSize);
                if (indent < maxIndent || (indent === maxIndent && entries++ < this._foldingRangesLimit)) {
                    startIndexes[k] = startIndex;
                    endIndexes[k] = this._endIndexes[i];
                    k++;
                }
            }
            return toFoldRanges(startIndexes, endIndexes);
        }
    }
}

function toFoldRanges(startLines: Uint32Array, endLines: Uint32Array): monaco.languages.FoldingRange[] {
    const res: monaco.languages.FoldingRange[] = [];

    for (let i = 0; i < startLines.length; i++) {
        res.push({
            start: startLines[i],
            end: endLines[i],
            kind: monaco.languages.FoldingRangeKind.Region
        });
    }
    return res;
}


interface PreviousRegion {
    indent: number; // indent or -2 if a marker
    endAbove: number; // end line number for the region above
    line: number; // start line of the region. Only used for marker regions.
}

export function computeRanges(model: monaco.editor.ITextModel, offSide: boolean, markers?: monaco.languages.FoldingMarkers, foldingRangesLimit = MAX_FOLDING_REGIONS_FOR_INDENT_LIMIT) {
    const tabSize = model.getOptions().tabSize;
    let result = new RangesCollector(foldingRangesLimit);

    let pattern: RegExp | undefined = undefined;
    if (markers) {
        pattern = new RegExp(`(${markers.start.source})|(?:${markers.end.source})`);
    }

    let previousRegions: PreviousRegion[] = [];
    let line = model.getLineCount() + 1;
    previousRegions.push({ indent: -1, endAbove: line, line }); // sentinel, to make sure there's at least one entry

    for (let line = model.getLineCount(); line > 0; line--) {
        let lineContent = model.getLineContent(line);
        let indent = computeIndentLevel(lineContent, tabSize);
        let previous = previousRegions[previousRegions.length - 1];
        if (indent === -1) {
            if (offSide) {
                // for offSide languages, empty lines are associated to the previous block
                // note: the next block is already written to the results, so this only
                // impacts the end position of the block before
                previous.endAbove = line;
            }
            continue; // only whitespace
        }
        let m;
        if (pattern) {
            m = lineContent.match(pattern)
            if (m) {
                // folding pattern match
                if (m[1]) { // start pattern match
                    // discard all regions until the folding pattern
                    let i = previousRegions.length - 1;
                    while (i > 0 && previousRegions[i].indent !== -2) {
                        i--;
                    }
                    if (i > 0) {
                        previousRegions.length = i + 1;
                        previous = previousRegions[i];

                        // new folding range from pattern, includes the end line
                        result.insertFirst(line, previous.line, indent);
                        previous.line = line;
                        previous.indent = indent;
                        previous.endAbove = line;
                        continue;
                    } else {
                        // no end marker found, treat line as a regular line
                    }
                } else { // end pattern match
                    previousRegions.push({ indent: -2, endAbove: line, line });
                    continue;
                }
            }
        }
        if (previous.indent > indent) {
            // discard all regions with larger indent
            do {
                previousRegions.pop();
                previous = previousRegions[previousRegions.length - 1];
            } while (previous.indent > indent);

            // new folding range
            let endLineNumber = previous.endAbove - 1;
            if (endLineNumber - line >= 1) { // needs at east size 1
                result.insertFirst(line, endLineNumber, indent);
            }
        }
        if (previous.indent === indent) {
            previous.endAbove = line;
        } else { // previous.indent < indent
            // new region with a bigger indent
            previousRegions.push({ indent, endAbove: line, line });
        }
    }
    return result.toIndentRanges(model);
}

function computeIndentLevel(line: string, tabSize: number): number {
    let indent = 0;
    let i = 0;
    let len = line.length;

    while (i < len) {
        let chCode = line.charCodeAt(i);
        if (chCode === 32 /* space */) {
            indent++;
        } else if (chCode === 9 /* tab */) {
            indent = indent - indent % tabSize + tabSize;
        } else {
            break;
        }
        i++;
    }

    if (i === len) {
        return -1; // line only consists of whitespace
    }

    return indent;
}