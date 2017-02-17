import * as pkg from "./package";
import * as core from "./core";
import * as data from "./data";
import * as app from "./app";
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

    getId() {
        return "editor"
    }

    displayOuter() {
        return (
            <div className='full-abs' key={this.getId() } id={this.getId() } style={{ display: this.isVisible ? "block" : "none" }}>
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

    hasUndo() { return true; }
    hasRedo() { return true; }
    undo() { }
    redo() { }

    zoomIn() { }
    zoomOut() { }

    /*******************************
     loadFile
    *******************************/

    loadFileAsync(file: pkg.File): Promise<void> {
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

    saveToTypeScript(): string {
        return null
    }

    highlightStatement(brk: pxtc.LocationInfo) { }

    filterToolbox(blockSubset?: { [index: string]: number }, showCategories: boolean = true, showToolboxButtons: boolean = true): Element {
        return null
    }
}
