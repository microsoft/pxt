import * as pkg from "./package";
import * as core from "./core";


export interface Theme {
    inverted?: boolean;
    fontSize?: string;
}

export type ViewState = any;

export class Editor {
    protected currTheme: Theme = {};
    protected currSource: string;
    onChange = () => { };
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
        this.setDiagnostics(file)
    }
    setDiagnostics(file: pkg.File): void { }
    setViewState(view: ViewState): void { }
    acceptsFile(file: pkg.File) {
        return false
    }
}
