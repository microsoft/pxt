/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

interface FileListState {
    currentFile?: pxt.editor.IFile;
    expandedPkg?: string;
}

const customFile = "custom.ts";
export class FileList extends data.Component<ISettingsProps, FileListState> {

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        }

        this.toggleVisibility = this.toggleVisibility.bind(this);
        this.handleCustomBlocksClick = this.handleCustomBlocksClick.bind(this);
        this.handleButtonKeydown = this.handleButtonKeydown.bind(this);
        this.handleSyncClick = this.handleSyncClick.bind(this);
        this.setFile = this.setFile.bind(this);
        this.removeFile = this.removeFile.bind(this);
        this.removePkg = this.removePkg.bind(this);
        this.updatePkg = this.updatePkg.bind(this);
        this.togglePkg = this.togglePkg.bind(this);
    }

    componentWillReceiveProps(nextProps: ISettingsProps) {
        const currentFile = nextProps.parent.state.currFile;
        // Set the current package as expanded
        if (this.state.currentFile != currentFile) {
            let expandedPkg = undefined;
            pkg.allEditorPkgs().forEach(p => {
                if (this.packageContainsFile(p, currentFile)) {
                    expandedPkg = p.getPkgId();
                }
            })
            this.setState({ expandedPkg: expandedPkg, currentFile: currentFile });
        }
    }

    private removePkg(p: pkg.EditorPackage) {
        core.confirmAsync({
            header: lf("Remove {0} extension", p.getPkgId()),
            body: lf("You are about to remove an extension from your project. Are you sure?"),
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

    private setFile(f: pkg.File) {
        this.props.parent.setSideFile(f);
    }

    private removeFile(f: pkg.File) {
        this.props.parent.removeFile(f);
    }

    private updatePkg(p: pkg.EditorPackage) {
        pkg.mainEditorPkg().updateDepAsync(p.getPkgId())
            .then(() => this.props.parent.reloadHeaderAsync())
            .done()
    }

    private filesOf(pkg: pkg.EditorPackage): JSX.Element[] {
        const { currentFile } = this.state;
        const deleteFiles = pkg.getPkgId() == "this";
        return pkg.sortedFiles().map(file => {
            let meta: pkg.FileMeta = this.getData("open-meta:" + file.getName())
            return (
                <FileTreeItem key={file.getName()} file={file}
                    onItemClick={this.setFile}
                    onItemRemove={this.removeFile}
                    isActive={currentFile == file}
                    hasDelete={deleteFiles && /\.blocks$/i.test(file.getName())}
                    className={(currentFile == file ? "active " : "") + (pkg.isTopLevel() ? "" : "nested ") + "item"}
                >
                    {file.name} {meta.isSaved ? "" : "*"}
                    {/\.ts$/.test(file.name) ? <sui.Icon icon="align left" /> : /\.blocks$/.test(file.name) ? <sui.Icon icon="puzzle" /> : undefined}
                    {meta.isReadonly ? <sui.Icon icon="lock" /> : null}
                    {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
                </FileTreeItem>);
        })
    }

    private packageOf(p: pkg.EditorPackage) {
        const expandedPkg = this.state.expandedPkg;
        const del = p.getPkgId() != pxt.appTarget.id
            && p.getPkgId() != "built"
            && p.getPkgId() != "assets"
            && p.getPkgId() != pxt.appTarget.corepkg
            && p.getKsPkg().config && !p.getKsPkg().config.core
            && p.getKsPkg().level <= 1;
        const upd = p.getKsPkg() && p.getKsPkg().verProtocol() == "github";
        const meta: pkg.PackageMeta = this.getData("open-pkg-meta:" + p.getPkgId());
        let version = upd ? p.getKsPkg().verArgument().split('#')[1] : undefined; // extract github tag
        if (version && version.length > 20) version = version.substring(0, 7);
        return [<PackgeTreeItem key={"hd-" + p.getPkgId()}
            pkg={p} isActive={expandedPkg == p.getPkgId()} onItemClick={this.togglePkg}
            hasDelete={del} onItemRemove={this.removePkg}
            version={version} hasRefresh={upd} onItemRefresh={this.updatePkg} >
            {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
            {p.getPkgId()}
            {expandedPkg == p.getPkgId() ?
                <div role="group" className="menu">
                    {this.filesOf(p)}
                </div> : undefined}
        </PackgeTreeItem>]
    }

    private packageContainsFile(pkg: pkg.EditorPackage, f: pxt.editor.IFile) {
        return pkg.sortedFiles().filter(file => file == f).length > 0;
    }

    private togglePkg(p: pkg.EditorPackage) {
        this.setState({ expandedPkg: this.state.expandedPkg == p.getPkgId() ? undefined : p.getPkgId() });
    }

    private filesWithHeader(p: pkg.EditorPackage) {
        return p.isTopLevel() ? this.filesOf(p) : this.packageOf(p);
    }

    private toggleVisibility() {
        this.props.parent.setState({ showFiles: !this.props.parent.state.showFiles });
    }

    private handleSyncClick(e: React.MouseEvent<any>) {
        this.props.parent.pushPullAsync();
        e.stopPropagation();
    }

    private handleCustomBlocksClick(e: React.MouseEvent<any>) {
        this.addCustomBlocksFile();
        e.stopPropagation();
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    private addTypeScriptFile() {
        core.promptAsync({
            header: lf("Add new file?"),
            body: lf("Please provide a name for your new file. Don't use spaces or special characters.")
        }).then(str => {
            str = str || ""
            str = str.trim()
            str = str.replace(/\.[tj]s$/, "")
            str = str.trim()
            let ext = "ts"
            let comment = "//"
            if (pxt.U.endsWith(str, ".py")) {
                str = str.slice(0, str.length - 3)
                ext = "py"
                comment = "#"
            }
            if (pxt.U.endsWith(str, ".md")) {
                str = str.slice(0, str.length - 3)
                ext = "md"
                comment = ">"
            }
            if (!str)
                return Promise.resolve()
            if (!/^[\w\-]+$/.test(str)) {
                core.warningNotification(lf("Invalid file name"))
                return Promise.resolve()
            }
            str += "." + ext
            if (pkg.mainEditorPkg().sortedFiles().some(f => f.name == str)) {
                core.warningNotification(lf("File already exists"))
                return Promise.resolve()
            }
            return this.props.parent.updateFileAsync(str, comment + " " + pxt.U.lf("Add your code here") + "\n", true)
        }).done()
    }

    private addCustomBlocksFile() {
        if (this.props.parent.state.header.githubId || pxt.appTarget.appTheme.addNewTypeScriptFile) {
            this.addTypeScriptFile()
            return
        }
        core.confirmAsync({
            header: lf("Add custom blocks?"),
            body: lf("A new JavaScript file, custom.ts, will be added to your project. You can define custom functions and blocks in that file.")
        }).then(v => {
            if (!v) return undefined;
            return this.props.parent.updateFileAsync(customFile, `
/**
 * ${lf("Use this file to define custom functions and blocks.")}
 * ${lf("Read more at {0}", pxt.appTarget.appTheme.homeUrl + 'blocks/custom')}
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
`, true);
        });
    }

    renderCore() {
        const show = !!this.props.parent.state.showFiles;
        const targetTheme = pxt.appTarget.appTheme;
        const mainPkg = pkg.mainEditorPkg()
        const plus = show && !mainPkg.files[customFile]
        const sync = show && pxt.github.token && !!mainPkg.header.githubId
        const meta: pkg.PackageMeta = this.getData("open-pkg-meta:" + mainPkg.getPkgId());
        return <div role="tree" className={`ui tiny vertical ${targetTheme.invertedMenu ? `inverted` : ''} menu filemenu landscape only hidefullscreen`}>
            <div role="treeitem" aria-selected={show} aria-expanded={show} aria-label={lf("File explorer toolbar")} key="projectheader" className="link item" onClick={this.toggleVisibility} tabIndex={0} onKeyDown={sui.fireClickOnEnter}>
                {lf("Explorer")}
                <sui.Icon icon={`chevron ${show ? "down" : "right"} icon`} />
                {sync ? <sui.Button className="primary label" icon="github" title={lf("Sync with github")} onClick={this.handleSyncClick} onKeyDown={this.handleButtonKeydown} /> : undefined}
                {plus ? <sui.Button className="primary label" icon="plus" title={lf("Add custom blocks?")} onClick={this.handleCustomBlocksClick} onKeyDown={this.handleButtonKeydown} /> : undefined}
                {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
            </div>
            {show ? pxt.Util.concat(pkg.allEditorPkgs().map(p => this.filesWithHeader(p))) : undefined}
        </div>;
    }
}

interface FileTreeItemProps extends React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> {
    file: pkg.File;
    onItemClick: (fn: pkg.File) => void;
    onItemRemove: (fn: pkg.File) => void;
    isActive: boolean;
    hasDelete?: boolean;
}

class FileTreeItem extends sui.StatelessUIElement<FileTreeItemProps> {
    constructor(props: FileTreeItemProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleRemove = this.handleRemove.bind(this);
        this.handleButtonKeydown = this.handleButtonKeydown.bind(this);
    }

    handleClick(e: React.MouseEvent<HTMLElement>) {
        this.props.onItemClick(this.props.file);
        e.stopPropagation();
    }

    handleRemove(e: React.MouseEvent<HTMLElement>) {
        this.props.onItemRemove(this.props.file);
        e.stopPropagation();
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    renderCore() {
        const { onClick, onItemClick, onItemRemove, isActive, hasDelete, file, ...rest } = this.props;

        return <a
            onClick={this.handleClick}
            tabIndex={0}
            role="treeitem"
            aria-selected={isActive}
            aria-label={isActive ? lf("{0}, it is the current opened file in the JavaScript editor", file.name) : file.name}
            onKeyDown={sui.fireClickOnEnter}
            {...rest}>
            {this.props.children}

            {hasDelete ? <sui.Button className="primary label" icon="trash"
                title={lf("Delete file {0}", file.name)}
                onClick={this.handleRemove}
                onKeyDown={this.handleButtonKeydown} /> : ''}
        </a>
    }
}

interface PackageTreeItemProps {
    pkg: pkg.EditorPackage;
    onItemClick: (p: pkg.EditorPackage) => void;
    onItemRemove: (p: pkg.EditorPackage) => void;
    onItemRefresh: (p: pkg.EditorPackage) => void;
    isActive?: boolean;
    hasRefresh?: boolean;
    version?: string;
    hasDelete?: boolean;
}

class PackgeTreeItem extends sui.StatelessUIElement<PackageTreeItemProps> {
    constructor(props: PackageTreeItemProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleRemove = this.handleRemove.bind(this);
        this.handleRefresh = this.handleRefresh.bind(this);
        this.handleButtonKeydown = this.handleButtonKeydown.bind(this);
    }

    handleClick() {
        this.props.onItemClick(this.props.pkg);
    }

    handleRefresh(e: React.MouseEvent<HTMLElement>) {
        this.props.onItemRefresh(this.props.pkg);
        e.stopPropagation();
    }

    handleRemove(e: React.MouseEvent<HTMLElement>) {
        this.props.onItemRemove(this.props.pkg);
        e.stopPropagation();
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    renderCore() {
        const { onItemClick, onItemRemove, onItemRefresh, version,
            isActive, hasRefresh, hasDelete, pkg: p, ...rest } = this.props;

        return <div className="header link item" role="treeitem"
            aria-selected={isActive} aria-expanded={isActive}
            aria-label={lf("{0}, {1}", p.getPkgId(), isActive ? lf("expanded") : lf("collapsed"))}
            onClick={this.handleClick} tabIndex={0} onKeyDown={sui.fireClickOnEnter} {...rest}>
            <sui.Icon icon={`chevron ${isActive ? "down" : "right"} icon`} />
            {hasRefresh ? <sui.Button className="primary label" icon="refresh" title={lf("Refresh extension {0}", p.getPkgId())}
                onClick={this.handleRefresh} onKeyDown={this.handleButtonKeydown} text={version || ''}></sui.Button> : undefined}
            {hasDelete ? <sui.Button className="primary label" icon="trash" title={lf("Delete extension {0}", p.getPkgId())}
                onClick={this.handleRemove} onKeyDown={this.handleButtonKeydown} /> : undefined}

            {this.props.children}
        </div>
    }
}