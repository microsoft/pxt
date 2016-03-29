import * as pkg from "./package";
import * as core from "./core";
import * as data from "./data";
import * as app from "./app";
import * as React from "react";


export interface Theme {
    fontSize?: string;
}

export type ViewState = any;
export type ProjectView = app.ProjectView;

export interface ParentProps {
    parent: ProjectView;
}

export class Editor {
    protected currTheme: Theme = {};
    protected currSource: string;
    isVisible = false;
    constructor(public parent: ProjectView) {
    }
    changeCallback = () => { };
    setVisible(v: boolean) {
        this.isVisible = v;
    }
    setTheme(themeSetting: Theme): void {
        this.currTheme = themeSetting
    }
    getViewState(): ViewState {
        return {}
    }
    getCurrentSource(): string {
        return this.currSource
    }
    loadFile(file: pkg.File): void {
        this.currSource = file.content
        this.setDiagnostics(file, this.snapshotState())
    }
    setDiagnostics(file: pkg.File, snapshot: any): void { }
    setViewState(view: ViewState): void { }
    acceptsFile(file: pkg.File) {
        return false
    }
    menu(): JSX.Element {
        return null;
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
    isReady = false;
    prepare() {
        this.isReady = true;
    }
    domUpdate() { }
    saveToTypeScript(): string {
        return null
    }
    isIncomplete() {
        return false
    }
    snapshotState(): any {
        return null
    }
    undo() { }

    highlightStatement(brk: ts.ks.LocationInfo) {}

}
