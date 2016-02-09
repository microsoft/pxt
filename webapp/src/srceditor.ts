import * as pkg from "./package";
import * as core from "./core";


export interface Theme {
    inverted?: boolean;
    fontSize?: string;
}

export type ViewState = any;

export interface Editor {
    setTheme(themeSetting:Theme):void;
    getViewState():ViewState;
    getCurrentSource():string;
    loadFile(file: pkg.File):void;
    setDiagnostics(file: pkg.File):void;
    setViewState(view:ViewState):void;
}

