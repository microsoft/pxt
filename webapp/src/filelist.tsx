/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

interface FileListState {
    expands: pxt.Map<boolean>;
}

const customFile = "custom.ts";
export class FileList extends data.Component<ISettingsProps, FileListState> {

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            expands: {}
        }
    }

    private removePkg(e: React.MouseEvent, p: pkg.EditorPackage) {
        e.stopPropagation();
        core.confirmAsync({
            header: lf("Remove {0} package", p.getPkgId()),
            body: lf("You are about to remove a package from your project. Are you sure?"),
            agreeClass: "red",
            agreeIcon: "trash",
            agreeLbl: lf("Remove it"),
        }).done(res => {
            if (res) {
                pkg.mainEditorPkg().removeDepAsync(p.getPkgId())
                    .then(() => this.props.parent.reloadHeaderAsync())
                    .done()
            }
        })
    }

    private removeFile(e: React.MouseEvent, f: pkg.File) {
        e.stopPropagation();
        this.props.parent.removeFile(f);
    }

    private updatePkg(e: React.MouseEvent, p: pkg.EditorPackage) {
        e.stopPropagation();
        pkg.mainEditorPkg().updateDepAsync(p.getPkgId())
            .then(() => this.props.parent.reloadHeaderAsync())
            .done()
    }

    private filesOf(pkg: pkg.EditorPackage): JSX.Element[] {
        const deleteFiles = pkg.getPkgId() == "this";
        const parent = this.props.parent;
        return pkg.sortedFiles().map(file => {
            let meta: pkg.FileMeta = this.getData("open-meta:" + file.getName())
            return (
                <a key={file.getName() }
                    onClick={() => parent.setSideFile(file) }
                    tabIndex={0}
                    role="treeitem"
                    aria-label={parent.state.currFile == file ? lf("{0}, it is the current opened file in the JavaScript editor", file.name) : file.name}
                    onKeyDown={sui.fireClickOnEnter}
                    className={(parent.state.currFile == file ? "active " : "") + (pkg.isTopLevel() ? "" : "nested ") + "item"}
                    >
                    {file.name} {meta.isSaved ? "" : "*"}
                    {/\.ts$/.test(file.name) ? <i className="align left icon"></i> : /\.blocks$/.test(file.name) ? <i className="puzzle icon"></i> : undefined }
                    {meta.isReadonly ? <i className="lock icon"></i> : null}
                    {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
                    {deleteFiles && /\.blocks$/i.test(file.getName()) ? <sui.Button class="primary label" icon="trash" title={lf("Delete file {0}", file.name)} onClick={(e) => this.removeFile(e, file) } onKeyDown={(e) => e.stopPropagation()} /> : ''}
                </a>);
        })
    }

    private packageOf(p: pkg.EditorPackage) {
        const expands = this.state.expands;
        let del = p.getPkgId() != pxt.appTarget.id
            && p.getPkgId() != "built"
            && p.getPkgId() != pxt.appTarget.corepkg;
        let upd = p.getKsPkg() && p.getKsPkg().verProtocol() == "github";
        return [<div key={"hd-" + p.getPkgId() } className="header link item" role="treeitem" aria-expanded={expands[p.getPkgId()]} aria-label={lf("{0}, {1}", p.getPkgId(), expands[p.getPkgId()] ? lf("expanded") : lf("collapsed"))} onClick={() => this.togglePkg(p) } tabIndex={0} onKeyDown={sui.fireClickOnEnter}>
            <i className={`chevron ${expands[p.getPkgId()] ? "down" : "right"} icon`}></i>
            {upd ? <sui.Button class="primary label" icon="refresh" title={lf("Refresh package {0}", p.getPkgId())} onClick={(e) => this.updatePkg(e, p) } onKeyDown={(e) => e.stopPropagation()} /> : ''}
            {del ? <sui.Button class="primary label" icon="trash" title={lf("Delete package {0}", p.getPkgId())} onClick={(e) => this.removePkg(e, p) } onKeyDown={(e) => e.stopPropagation()} /> : ''}
            {p.getPkgId() }
        </div>
        ].concat(expands[p.getPkgId()] ? this.filesOf(p) : [])
    }

    private togglePkg(p: pkg.EditorPackage) {
        const expands = this.state.expands;
        expands[p.getPkgId()] = !expands[p.getPkgId()];
        this.forceUpdate();
    }

    private filesWithHeader(p: pkg.EditorPackage) {
        return p.isTopLevel() ? this.filesOf(p) : this.packageOf(p);
    }

    private toggleVisibility() {
        this.props.parent.setState({ showFiles: !this.props.parent.state.showFiles });
    }

    private addCustomBlocksFile() {
        core.confirmAsync({
            header: lf("Add custom blocks?"),
            body: lf("A new JavaScript file, custom.ts, will be added to your project. You can define custom functions and blocks in that file.")
        }).then(v => {
            if (!v) return;
            const p = pkg.mainEditorPkg();
            p.setFile(customFile, `
/**
 * ${lf("Use this file to define custom functions and blocks.")}
 * ${lf("Read more at {0}", pxt.appTarget.appTheme.homeUrl + 'blocks/custom' )}
 */

enum MyEnum {
    //% block="one"
    One,
    //% block="two"
    Two
}

/**
 * ${lf("Custom blocks")}
 */
//% weight=100 color=#0fbc11 icon="\uf0c3"
namespace custom {
    /**
     * TODO: ${lf("describe your function here")}
     * @param n ${lf("describe parameter here")}, eg: 5
     * @param s ${lf("describe parameter here")}, eg: "Hello"
     * @param e ${lf("describe parameter here")}
     */    
    //% block
    export function foo(n: number, s: string, e: MyEnum): void {
        // Add code here
    }

    /**
     * TODO: ${lf("describe your function here")}
     * @param value ${lf("describe value here")}, eg: 5
     */    
    //% block
    export function fib(value: number): number {
        return value <= 1 ? value : fib(value -1) + fib(value - 2);
    }
}
`);
            return p.updateConfigAsync(cfg => cfg.files.push(customFile))
                .then(() => this.props.parent.setFile(p.lookupFile("this/" + customFile)))
                .then(() => p.savePkgAsync())
                .then(() => this.props.parent.reloadHeaderAsync())
        });
    }

    renderCore() {
        const show = !!this.props.parent.state.showFiles;
        const targetTheme = pxt.appTarget.appTheme;
        const plus = show && !pkg.mainEditorPkg().files[customFile]
        return <div role="tree" className={`ui tiny vertical ${targetTheme.invertedMenu ? `inverted` : ''} menu filemenu landscape only`}>
            <div role="treeitem" aria-expanded={show} aria-label={lf("File explorer toolbar")} key="projectheader" className="link item" onClick={() => this.toggleVisibility() } tabIndex={0} onKeyDown={sui.fireClickOnEnter}>
                {lf("Explorer") }
                <i className={`chevron ${show ? "down" : "right"} icon`}></i>
                {plus ? <sui.Button class="primary label" icon="plus" title={lf("Add custom blocks?")} onClick={(e) => {this.addCustomBlocksFile(); e.stopPropagation();} } onKeyDown={(e) => e.stopPropagation()} /> : undefined }
            </div>
            {show ? Util.concat(pkg.allEditorPkgs().map(p => this.filesWithHeader(p))) : undefined }
        </div>;
    }
}