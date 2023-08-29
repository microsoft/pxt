/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";
import { fireClickOnEnter } from "./util";

type ISettingsProps = pxt.editor.ISettingsProps;

interface FileListState {
    currentFile?: pxt.editor.IFile;
    expandedPkg?: string;
}

const customFile = "custom.ts";
const customFileText = `
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
`;
const customFileHeader = (homeUrl: string) => `
/**
* ${lf("Use this file to define custom functions and blocks.")}
* ${lf("Read more at {0}", homeUrl + 'blocks/custom')}
*/
`

export class FileList extends data.Component<ISettingsProps, FileListState> {

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        }

        this.toggleVisibility = this.toggleVisibility.bind(this);
        this.handleCustomBlocksClick = this.handleCustomBlocksClick.bind(this);
        this.handleButtonKeydown = this.handleButtonKeydown.bind(this);
        this.setFile = this.setFile.bind(this);
        this.removeFile = this.removeFile.bind(this);
        this.addLocalizedFile = this.addLocalizedFile.bind(this);
        this.removePkg = this.removePkg.bind(this);
        this.updatePkg = this.updatePkg.bind(this);
        this.togglePkg = this.togglePkg.bind(this);
        this.navigateToError = this.navigateToError.bind(this);
    }

    UNSAFE_componentWillReceiveProps(nextProps: ISettingsProps) {
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
        }).then(res => {
            if (res) {
                pkg.mainEditorPkg().removeDepAsync(p.getPkgId())
                    .then(() => this.props.parent.reloadHeaderAsync());
            }
        })
    }

    private setFile(f: pkg.File) {
        this.props.parent.setSideFile(f);
    }

    private removeFile(f: pkg.File) {
        this.props.parent.removeFile(f);
    }

    private addLocalizedFile(f: pkg.File, localizedF: string) {
        return this.props.parent.updateFileAsync(localizedF, f.content, true);
    }

    private updatePkg(p: pkg.EditorPackage) {
        core.showLoading("update", lf("Updating..."))
        pkg.mainEditorPkg().updateDepAsync(p.getPkgId())
            .then(() => this.props.parent.reloadHeaderAsync())
            .finally(() => core.hideLoading("update"));
    }

    private navigateToError(meta: pkg.FileMeta) {
        const diag = meta && meta.diagnostics && meta.diagnostics[0];
        if (diag)
            this.props.parent.navigateToError(diag);
    }

    private filesOf(pkg: pkg.EditorPackage): JSX.Element[] {
        const topPkg = pkg.isTopLevel();
        const langRestrictions = pkg.getLanguageRestrictions();
        let files = pkg.sortedFiles();

        if (topPkg) {
            files = files.filter(f => {
                switch (langRestrictions) {
                    case pxt.editor.LanguageRestriction.JavaScriptOnly:
                        return !/\.(blocks|py)$/.test(f.name);
                    case pxt.editor.LanguageRestriction.PythonOnly:
                        return !/\.(blocks|ts)$/.test(f.name);
                    default:
                        return true;
                }
            });
        }
        // group files in folders
        const folders: pxt.Map<pkg.File[]> = {};
        files.forEach(f => {
            const i = f.name.lastIndexOf("/");
            const folder = i < 0 ? "" : f.name.slice(0, i);
            const ffiles = folders[folder] || (folders[folder] = []);
            ffiles.push(f);
        })
        return Object.keys(folders)
            .map(folder => <FolderTreeItem key={"folder-" + folder} folder={folder}>
                {this.folderFilesOf(pkg, folder, folders[folder])}
            </FolderTreeItem>)
            .reduce((l, r) => l.concat(r), [])
    }

    private folderFilesOf(pkg: pkg.EditorPackage, folder: string, files: pkg.File[]): JSX.Element[] {
        const { currentFile } = this.state;
        const header = this.props.parent.state.header;
        const topPkg = pkg.isTopLevel();
        const shellReadonly = pxt.shell.isReadOnly();
        const deleteFiles = topPkg && !shellReadonly;

        return files.map(file => {
            const meta: pkg.FileMeta = this.getData("open-meta:" + file.getName())
            // we keep this disabled, until implemented for cloud syncing
            // makse no sense for local saves - the star just blinks for half second after every change
            const showStar = false
            const usesGitHub = !!header && !!header.githubId;
            const isTutorialMd = topPkg
                && usesGitHub
                && /\.md$/.test(file.name)
                && !/^_locales\//.test(file.name)
            const fn = file.name.replace(/\.[a-z]+$/, '');
            const previewUrl = !shellReadonly
                && isTutorialMd
                && `#tutorial:${header.id}:${fn}`;
            const ghid = usesGitHub && pxt.github.parseRepoId(header.githubId)
            const shareUrl = isTutorialMd && ghid
                && pxt.appTarget.appTheme.embedUrl
                && `${window.location.origin}${window.location.pathname || ""}#tutorial:github:${ghid.fullName}/${fn}`
            const lang = pxt.Util.userLanguage();
            const localized = `_locales/${lang}/${file.name}`;
            const addLocale = !shellReadonly
                && isTutorialMd
                && pxt.Util.userLanguage() !== (pxt.appTarget.appTheme.defaultLocale || "en")
                && !files.some(f => f.name == localized);
            const hasDelete = deleteFiles
                && (
                    file.name != pxt.CONFIG_NAME
                    && (usesGitHub || file.name != pxt.MAIN_TS)
                    && !file.isReadonly()
                    || file.name === pxt.HISTORY_FILE
                );
            const nameStart = folder.length ? folder.length + 1 : 0;
            return (
                <FileTreeItem
                    key={"file-" + file.getName()}
                    file={file}
                    meta={meta}
                    onItemClick={this.setFile}
                    onItemRemove={this.removeFile}
                    onErrorClick={this.navigateToError}
                    onItemLocalize={this.addLocalizedFile}
                    isActive={currentFile == file}
                    hasDelete={hasDelete}
                    previewUrl={previewUrl}
                    shareUrl={shareUrl}
                    addLocalizedFile={addLocale && localized}
                    className={(currentFile == file ? "active " : "") + (pkg.isTopLevel() ? "" : "nested ") + (folder ? "folderitem " : "") + "item"}
                >
                    {file.name.slice(nameStart)}
                    {showStar ? "*" : ""}
                    {meta.isGitModified ? " ↑" : ""}
                    {meta.isReadonly ? <sui.Icon icon="lock" /> : null}
                </FileTreeItem>);
        })
    }

    private packageOf(p: pkg.EditorPackage) {
        const expandedPkg = this.state.expandedPkg;
        const pkgid = p.getPkgId();
        const del = !pxt.shell.isReadOnly()
            && pkgid != pxt.appTarget.id
            && pkgid != "built"
            && pkgid != "assets"
            && pkgid != pxt.appTarget.corepkg
            && p.getKsPkg().config && !p.getKsPkg().config.core
            && p.getKsPkg().level <= 1;
        const gh = p.getKsPkg()?.verProtocol() == "github"
        const upd = del && gh;
        const meta: pkg.PackageMeta = this.getData("open-pkg-meta:" + p.getPkgId());
        let version = gh ? p.getKsPkg().verArgument().split('#')[1] : undefined; // extract github tag
        if (version && version.length > 20) version = version.substring(0, 7);
        return [<PackgeTreeItem key={"hd-" + pkgid}
            pkg={p} isActive={expandedPkg == pkgid} onItemClick={this.togglePkg}
            hasDelete={del} onItemRemove={this.removePkg}
            version={version} hasRefresh={upd} onItemRefresh={this.updatePkg} >
            {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
            {pkgid}
            {expandedPkg == pkgid ?
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

    private handleCustomBlocksClick(e: React.MouseEvent<any>) {
        this.addCustomBlocksFile();
        e.stopPropagation();
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    private addProjectFile() {
        const mainPkg = pkg.mainEditorPkg();
        const validRx = /^[\w][\/\w\-\.]*$/;
        core.promptAsync({
            header: lf("Add new file?"),
            hasCloseIcon: true,
            onInputValidation: (v) => {
                if (!v)
                    return lf("filename is empty.");
                v = v.trim();
                if (!validRx.test(v))
                    return lf("Don't use spaces or special characters.");
                return undefined;
            },
            body: lf("Please provide a name for your new file."),
            initialValue: !mainPkg.files[customFile] ? customFile : undefined
        }).then(str => {
            if (!str)
                return Promise.resolve()
            str = str.replace(/\s+/g, "");

            const indLastPeriod = str.lastIndexOf(".");
            let name = str;
            let givenExt: string;
            if (indLastPeriod != -1) {
                name = str.slice(0, indLastPeriod);
                givenExt = str.slice(indLastPeriod + 1).toLowerCase();
            }

            const pkgCfg = pkg.mainPkg && pkg.mainPkg.config
            const languageRestriction = pkgCfg && pkgCfg.languageRestriction;

            let ext = 'ts';
            let comment = "//";
            let commentText = pxt.U.lf("Add your code here");

            if (languageRestriction === pxt.editor.LanguageRestriction.PythonOnly) {
                ext = "py";
                comment = "#";
            }

            if (givenExt) {
                switch (givenExt) {
                    case "js": case "ts":
                        break;
                    case "py":
                        if (languageRestriction !== pxt.editor.LanguageRestriction.JavaScriptOnly) {
                            ext = "py";
                            comment = "#";
                        }
                        break;
                    case "md":
                        ext = "md";
                        comment = "#";
                        commentText = name;
                        break;
                    case "json":
                        ext = "json"
                        comment = undefined;
                        break;
                    case "jres":
                        ext = "jres"
                        comment = undefined;
                        break;
                    default:
                        // not a valid extension; leave it as it was and append def extension
                        name = str;
                }
            }

            if (!name)
                return Promise.resolve()

            if (!validRx.test(name)) {
                core.warningNotification(lf("Invalid file name"))
                return Promise.resolve()
            }

            const fileName = `${name}.${ext}`;
            if (pkg.mainEditorPkg().sortedFiles().some(f => f.name == fileName)) {
                core.warningNotification(lf("File already exists"))
                return Promise.resolve()
            }
            let fileText = "";
            if (fileName == customFile) {
                fileText = customFileHeader(pxt.appTarget.appTheme.homeUrl) + customFileText;
            } else if (comment) {
                fileText = `${comment} ${commentText}
`;
            }

            return this.props.parent.updateFileAsync(fileName, fileText, true);
        });
    }

    private addCustomBlocksFile() {
        if (this.props.parent.state.header.githubId || pxt.appTarget.appTheme.addNewTypeScriptFile) {
            this.addProjectFile()
            return
        }
        core.confirmAsync({
            header: lf("Add custom blocks?"),
            body: lf("A new JavaScript file, custom.ts, will be added to your project. You can define custom functions and blocks in that file.")
        }).then(v => {
            if (!v) return undefined;
            return this.props.parent.updateFileAsync(customFile, customFileHeader(pxt.appTarget.appTheme.homeUrl) + customFileText, true);
        });
    }

    renderCore() {
        const showFiles = !!this.props.parent.state.showFiles;
        const targetTheme = pxt.appTarget.appTheme;
        const mainPkg = pkg.mainEditorPkg()
        const plus = showFiles && !pxt.shell.isReadOnly() && (!mainPkg.files[customFile] || pxt.appTarget.appTheme.addNewTypeScriptFile);
        const meta: pkg.PackageMeta = this.getData("open-pkg-meta:" + mainPkg.getPkgId());
        return <div role="tree" className={`ui tiny vertical ${targetTheme.invertedMenu ? `inverted` : ''} menu filemenu landscape only hidefullscreen`}>
            <div role="treeitem" aria-selected={showFiles} aria-expanded={showFiles} aria-label={lf("File explorer toolbar")} key="projectheader" className="link item" onClick={this.toggleVisibility} tabIndex={0} onKeyDown={fireClickOnEnter}>
                {lf("Explorer")}
                <sui.Icon icon={`chevron ${showFiles ? "up" : "down"} icon`} />
                {plus ? <sui.Button className="primary label" icon="plus" title={lf("Add custom blocks?")} onClick={this.handleCustomBlocksClick} onKeyDown={this.handleButtonKeydown} /> : undefined}
                {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
            </div>
            {showFiles ? pxt.Util.concat(pkg.allEditorPkgs().map(p => this.filesWithHeader(p))) : undefined}
        </div>;
    }
}

interface FolderTreeItemProps {
    folder: string;
    children: any;
}

class FolderTreeItem extends sui.StatelessUIElement<FolderTreeItemProps> {
    constructor(props: FolderTreeItemProps) {
        super(props);
    }

    renderCore() {
        const { folder, children } = this.props;

        if (!folder)
            return children;

        return <>
            <div className="folder item" role="treeitem"
                aria-selected={false}
                aria-label={lf("Files in folder {0}", folder)}>
                <i className="folder open outline icon"></i>
                {folder}
            </div>
            {children}
        </>
    }
}
interface FileTreeItemProps {
    file: pkg.File;
    meta: pkg.FileMeta;
    onItemClick: (fn: pkg.File) => void;
    onItemRemove: (fn: pkg.File) => void;
    onItemLocalize: (fn: pkg.File, localizedf: string) => void;
    onErrorClick?: (meta: pkg.FileMeta) => void;
    isActive: boolean;
    hasDelete?: boolean;
    previewUrl?: string;
    shareUrl?: string;
    addLocalizedFile?: string;
    className?: string;
}

class FileTreeItem extends sui.StatelessUIElement<FileTreeItemProps> {
    constructor(props: FileTreeItemProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleRemove = this.handleRemove.bind(this);
        this.handleButtonKeydown = this.handleButtonKeydown.bind(this);
        this.handlePreview = this.handlePreview.bind(this);
        this.handleShare = this.handleShare.bind(this);
        this.handleAddLocale = this.handleAddLocale.bind(this);
    }

    handleClick(e: React.MouseEvent<HTMLElement>) {
        if (this.props.onErrorClick
            && this.props.meta
            && this.props.meta.numErrors
            && this.props.meta.diagnostics
            && this.props.meta.diagnostics[0])
            this.props.onErrorClick(this.props.meta);
        else
            this.props.onItemClick(this.props.file);
        e.stopPropagation();
    }

    handleRemove(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("explorer.file.remove");
        e.preventDefault();
        e.stopPropagation();
        this.props.onItemRemove(this.props.file);
    }

    handlePreview(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("explorer.file.preview");
        e.preventDefault();
        e.stopPropagation();
        window.open(this.props.previewUrl, "_blank");
    }

    handleShare(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("explorer.file.share");
        e.preventDefault();
        e.stopPropagation();
        core.dialogAsync({
            header: lf("Share this tutorial"),
            body: lf("The URL will start the MakeCode editor in your tutorial."),
            copyable: this.props.shareUrl,
            hasCloseIcon: true
        })
    }

    handleAddLocale(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("explorer.file.addlocale");
        const { addLocalizedFile, onItemLocalize } = this.props;
        if (onItemLocalize && addLocalizedFile)
            onItemLocalize(this.props.file, addLocalizedFile);
        e.stopPropagation();
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    renderCore() {
        const { isActive, hasDelete, file, meta, previewUrl, shareUrl, addLocalizedFile, className } = this.props;

        return <a
            onClick={this.handleClick}
            tabIndex={0}
            role="treeitem"
            aria-selected={isActive}
            aria-label={isActive ? lf("{0}, it is the current opened file in the JavaScript editor", file.name) : file.name}
            onKeyDown={fireClickOnEnter}
            className={className}>
            {this.props.children}
            {hasDelete && <sui.Button className="primary label" icon="trash"
                title={lf("Delete file {0}", file.name)}
                onClick={this.handleRemove}
                onKeyDown={this.handleButtonKeydown} />}
            {meta && meta.numErrors ? <span className='ui label red button' role="button" title={lf("Go to error")}>{meta.numErrors}</span> : undefined}
            {shareUrl && <sui.Button className="button primary label" icon="share alternate" title={lf("Share")} onClick={this.handleShare} onKeyDown={fireClickOnEnter} />}
            {previewUrl && <sui.Button className="button primary label" icon="flask" title={lf("Preview")} onClick={this.handlePreview} onKeyDown={fireClickOnEnter} />}
            {!!addLocalizedFile && <sui.Button className="primary label" icon="xicon globe"
                title={lf("Add localized file")}
                onClick={this.handleAddLocale}
                onKeyDown={this.handleButtonKeydown} />}
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
        e.stopPropagation();
        this.props.onItemRefresh(this.props.pkg);
    }

    handleRemove(e: React.MouseEvent<HTMLElement>) {
        e.stopPropagation();
        this.props.onItemRemove(this.props.pkg);
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    renderCore() {
        const { onItemClick, onItemRemove, onItemRefresh, version, // keep these to avoid warnings with ...rest
            isActive, hasRefresh, hasDelete, pkg: p, ...rest } = this.props;

        return <div className="header link item" role="treeitem"
            aria-selected={isActive} aria-expanded={isActive}
            aria-label={lf("{0}, {1}", p.getPkgId(), isActive ? lf("expanded") : lf("collapsed"))}
            onClick={this.handleClick} tabIndex={0} onKeyDown={fireClickOnEnter} {...rest}>
            <sui.Icon icon={`chevron ${isActive ? "up" : "down"} icon`} />
            {hasRefresh ? <sui.Button className="primary label" icon="refresh" title={lf("Refresh extension {0}", p.getPkgId())}
                onClick={this.handleRefresh} onKeyDown={this.handleButtonKeydown} text={version || ''}></sui.Button>
                : version ? <span className="label" style={{background: 'transparent'}}>{version}</span> : undefined}
            {hasDelete ? <sui.Button className="primary label" icon="trash" title={lf("Delete extension {0}", p.getPkgId())}
                onClick={this.handleRemove} onKeyDown={this.handleButtonKeydown} /> : undefined}
            {this.props.children}
        </div>
    }
}