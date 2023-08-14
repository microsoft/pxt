import * as pkg from "./package";
import * as core from "./core";
import * as React from "react";

export type ViewState = any;
export type ProjectView = pxt.editor.IProjectView;

export interface ParentProps {
    parent: ProjectView;
}

export class Editor implements pxt.editor.IEditor {
    protected currSource: string;
    isVisible = false;
    constructor(public parent: ProjectView) {
    }
    changeCallback = () => { };
    setVisible(v: boolean) {
        this.isVisible = v;
    }
    simStateChanged() { }

    onPageVisibilityChanged(isVisible: boolean) {}

    /*******************************
     Methods called before loadFile
      this.editor may be undefined
      Always check that this.editor exists
    *******************************/

    acceptsFile(file: pkg.File) {
        return false
    }

    getViewState(): ViewState {
        return {}
    }

    getCurrentSource(): string {
        return this.currSource
    }

    getStyle(style?: any) {
        let display = { display: this.isVisible ? "block" : "none" };
        return Object.assign(display, style);
    }

    getId() {
        return "editor"
    }

    displayOuter(style?: any) {
        return (
            <div className='full-abs' key={this.getId() } id={this.getId() } style={this.getStyle(style)}>
                {this.display() }
            </div>
        )
    }
    display(): JSX.Element {
        return null
    }

    beforeCompile() { }

    isReady = false;
    prepare() {
        this.isReady = true;
    }

    resize(e?: Event) { }

    snapshotState(): any {
        return null
    }
    unloadFileAsync(): Promise<void> { return Promise.resolve() }

    isIncomplete() {
        return false
    }

    hasHistory() { return true; }
    hasUndo() { return true; }
    hasRedo() { return true; }
    undo() { }
    redo() { }

    zoomIn() { }
    zoomOut() { }
    setScale(scale: number) { }

    closeFlyout() { }
    clearCaches() { }
    /*******************************
     loadFile
    *******************************/

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        this.currSource = file.content
        this.setDiagnostics(file, this.snapshotState())
        return Promise.resolve();
    }

    /*******************************
     Methods called after loadFile
      this.editor != undefined
    *******************************/

    domUpdate() { }

    setDiagnostics(file: pkg.File, snapshot: any): void { }
    setViewState(view: ViewState): void { }

    /**
     * Serializes code to typescript.
     * @returns undefined if there is nothing to save
     */
    saveToTypeScriptAsync(willOpenTypeScript = false): Promise<string> {
        return Promise.resolve(undefined);
    }

    highlightStatement(stmt: pxtc.LocationInfo, brk?: pxsim.DebuggerBreakpointMessage): boolean { return false; }

    clearHighlightedStatements() { }

    setHighContrast(hc: boolean) {}

    hasEditorToolbar() {
        return true
    }

    filterToolbox(showCategories?: boolean) {
    }

    insertBreakpoint() {
    }

    updateBreakpoints() {
    }

    getBreakpoints(): number[] {
        return [];
    }

    updateToolbox() {
    }

    // allows all editors to send exceptions to error list
    onExceptionDetected(exception: pxsim.DebuggerBreakpointMessage) {
        core.warningNotification(lf("Program Error: {0}", exception?.exceptionMessage));
    }
}