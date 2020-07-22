/// <reference path="../../localtypings/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />

import * as pkg from "./package";

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
                    glyphMarginHoverMessage: { value: glyphHover }
                }
            }
        ]);
        this.decoration = dec[0];
    }
}

export class BreakpointCollection implements monaco.IDisposable {
    // This maps TS files to breakpoints. See loadBreakpointsForFile for how Python is handled
    protected fileToBreakpoint: pxt.Map<pxtc.Breakpoint[]>;
    protected loadedBreakpoints: MonacoBreakpoint[];
    protected activeBreakpoints: number[];
    protected sourcemap: pxtc.SourceMapHelpers;

    constructor(allBreakpoints: pxtc.Breakpoint[], sourcemap?: pxtc.SourceMapHelpers) {
        this.fileToBreakpoint = {};
        this.activeBreakpoints = [];
        this.sourcemap = sourcemap;

        for (const bp of allBreakpoints) {
            if (!this.fileToBreakpoint[bp.fileName]) this.fileToBreakpoint[bp.fileName] = [];
            this.fileToBreakpoint[bp.fileName].push(bp);
        }
    }

    loadBreakpointsForFile(file: pkg.File, editor: monaco.editor.IStandaloneCodeEditor) {
        if (this.loadedBreakpoints) this.loadedBreakpoints.forEach(bp => bp.dispose());

        if (!file) return;

        const isPython = file.getExtension() === "py";
        let srcName = file.getTextFileName();

        if (isPython) srcName = file.getFileNameWithExtension("ts");

        let fileBreakpoints = this.fileToBreakpoint[srcName];

        if (isPython) {
            if (!this.sourcemap) return;

            fileBreakpoints = fileBreakpoints?.map(bp => {
                const pyLoc = this.sourcemap.ts.locToLoc(bp);
                return {
                    ...bp,
                    ...pyLoc
                }
            });
        }

        if (fileBreakpoints) {
            this.loadedBreakpoints = fileBreakpoints.map(bp => {
                const mbp = new MonacoBreakpoint(bp, editor);
                if (this.activeBreakpoints.indexOf(bp.id) != -1) mbp.setActive(true);

                return mbp
            });
        }
    }

    toggleBreakpointAt(lineNo: number) {
        const bp = this.getBreakpointForLine(lineNo);
        if (bp) {
            bp.toggle();

            if (bp.isActive()) {
                this.activeBreakpoints.push(bp.source.id);
            }
            else {
                this.activeBreakpoints = this.activeBreakpoints.filter(id => id != bp.source.id);
            }
        }
    }

    refreshDecorations() {
        if (this.loadedBreakpoints) this.loadedBreakpoints.forEach(bp => bp.updateDecoration());
    }

    clearDecorations() {
        if (this.loadedBreakpoints) this.loadedBreakpoints.forEach(bp => bp.dispose());
    }

    getActiveBreakpoints() {
        return this.activeBreakpoints;
    }

    dispose() {
        if (this.loadedBreakpoints) {
            this.loadedBreakpoints.forEach(bp => bp.dispose());
            this.loadedBreakpoints = undefined;
        }
        this.activeBreakpoints = undefined;
        this.fileToBreakpoint = undefined;
    }

    getLocationOfBreakpoint(id: number): pxtc.LocationInfo {
        // Check loaded breakpoints first in case this is a Python file
        const loaded = this.getLoadedBreakpoint(id);
        if (loaded) return loaded;

        for (const file of Object.keys(this.fileToBreakpoint)) {
            const bps = this.fileToBreakpoint[file];

            for (const bp of bps) {
                if (bp.id === id) return bp;
            }
        }

        return undefined;
    }

    getLoadedBreakpoint(id: number) {
        if (this.loadedBreakpoints) {
            for (const bp of this.loadedBreakpoints) {
                if (bp.source.id === id) return bp.source;
            }
        }
        return null;
    }

    protected getBreakpointForLine(lineNo: number) {
        if (!this.loadedBreakpoints || !this.loadedBreakpoints.length) return undefined;

        let closestBreakpoint: MonacoBreakpoint;
        let closestDistance: number;

        for (const bp of this.loadedBreakpoints) {
            const distance = bp.distanceFromLine(lineNo);
            if (closestDistance === undefined || distance < closestDistance) {
                closestBreakpoint = bp;
                closestDistance = distance;
            }
        }

        if (closestDistance < 5) return closestBreakpoint;
        return undefined;
    }
}