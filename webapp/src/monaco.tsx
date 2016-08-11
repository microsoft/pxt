/// <reference path="../../node_modules/monaco-editor/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />
/// <reference path="fuse.d.ts" />


import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";
import * as data from "./data";
import * as codecard from "./codecard";


import Util = pxt.Util;
const lf = Util.lf

export const cursorMarker = "\uE108"

export class Editor extends srceditor.Editor {
    editor: monaco.editor.IStandaloneCodeEditor;
    currFile: pkg.File;
    isTypescript = false;

    hasBlocks() {
        if (!this.currFile) return true
        let blockFile = this.currFile.getVirtualFileName();
        return (blockFile && pkg.mainEditorPkg().files[blockFile] != null)
    }

    openBlocks() {
        pxt.tickEvent("typescript.showBlocks");

        let blockFile = this.currFile.getVirtualFileName();
        if (!blockFile) {
            let mainPkg = pkg.mainEditorPkg();
            if (mainPkg)
                this.parent.setFile(mainPkg.files["main.blocks"] || mainPkg.files["main.ts"]);
            return;
        }

        if (!this.hasBlocks())
            return

        const failedAsync = () => {
            let bf = pkg.mainEditorPkg().files[blockFile];
            return core.confirmAsync({
                header: lf("Oops, there is a problem converting your code."),
                body: lf("We are unable to convert your JavaScript code back to blocks. You can keep working in JavaScript or discard your changes and go back to the previous Blocks version."),
                agreeLbl: lf("Discard and go to Blocks"),
                agreeClass: "cancel",
                agreeIcon: "cancel",
                disagreeLbl: lf("Stay in JavaScript"),
                disagreeClass: "positive",
                disagreeIcon: "checkmark", 
                deleteLbl: lf("Remove Blocks file"),
                size: "medium",
                hideCancel: !bf
            }).then(b => {
                // discard                
                if (!b) {
                    pxt.tickEvent("typescript.keepText");
                } else if (b == 2) {
                    pxt.tickEvent("typescript.removeBlocksFile");
                    this.parent.removeFile(bf);
                } else {
                    pxt.tickEvent("typescript.discardText");
                    this.parent.setFile(bf);
                }
            })
        }

        this.checkRoundTrip(blockFile, failedAsync)
    }

    checkRoundTrip(blockFile: string, failedAsync: () => Promise<void>) {
        // needed to test roundtrip
        let js = this.formatCode();

        // might be undefined
        let mainPkg = pkg.mainEditorPkg();
        let xml: string;

        // it's a bit for a wild round trip:
        // 1) convert blocks to js to see if any changes happened, otherwise, just reload blocks
        // 2) decompile js -> blocks then take the decompiled blocks -> js
        // 3) check that decompiled js == current js % white space
        let blocksInfo: ts.pxt.BlocksInfo;
        this.parent.saveFileAsync()
            .then(() => compiler.getBlocksAsync())
            .then((bi) => {
                blocksInfo = bi;
                pxt.blocks.initBlocks(blocksInfo);
                let oldWorkspace = pxt.blocks.loadWorkspaceXml(mainPkg.files[blockFile].content);
                if (oldWorkspace) {
                    let oldJs = pxt.blocks.compile(oldWorkspace, blocksInfo).source;
                    if (oldJs == js) {
                        console.log('js not changed, skipping decompile');
                        pxt.tickEvent("typescript.noChanges")
                        return this.parent.setFile(mainPkg.files[blockFile]);
                    }
                }
                return compiler.decompileAsync(this.currFile.name)
                    .then(resp => {
                        if (!resp.success) return failedAsync();
                        xml = resp.outfiles[blockFile];
                        Util.assert(!!xml);
                        // try to convert back to typescript
                        let workspace = pxt.blocks.loadWorkspaceXml(xml);
                        if (!workspace) return failedAsync();

                        let b2jsr = pxt.blocks.compile(workspace, blocksInfo);

                        const cleanRx = /[\s;]/g;
                        if (b2jsr.source.replace(cleanRx, '') != js.replace(cleanRx, '')) {
                            pxt.tickEvent("typescript.conversionFailed");
                            console.log('js roundtrip failed:')
                            console.log('-- original:');
                            console.log(js.replace(cleanRx, ''));
                            console.log('-- roundtrip:');
                            console.log(b2jsr.source.replace(cleanRx, ''));
                            pxt.reportError('decompilation failure', {
                                js: js,
                                blockly: xml,
                                jsroundtrip: b2jsr.source
                            })
                            return failedAsync();
                        }

                        return mainPkg.setContentAsync(blockFile, xml)
                            .then(() => this.parent.setFile(mainPkg.files[blockFile]));
                    })
            }).catch(e => {
                pxt.reportException(e, { js: this.currFile.content });
                core.errorNotification(lf("Oops, something went wrong trying to convert your code."));
            }).done()
    }

    menu(): JSX.Element {
        if (!this.hasBlocks()) return null
        return <sui.Button class="ui floating" textClass="ui landscape only" text={lf("Blocks") } icon="puzzle" onClick={() => this.openBlocks() } />
    }

    undo() {
        this.editor.trigger('keyboard', monaco.editor.Handler.Undo, null);
    }

    display() {
        return (
            <div>
                <div className='full-abs' id='monacoEditorInner' />
            </div>
        )
    }

    textAndPosition(pos: monaco.IPosition) {
        let programText = this.editor.getValue()
        let lines = pos.lineNumber
        let chars = pos.column
        let charNo = 0;
        for (; charNo < programText.length; ++charNo) {
            if (lines == 0) {
                if (chars-- == 0)
                    break;
            } else if (programText[charNo] == '\n') lines--;
        }

        return { programText, charNo }
    }

    beforeCompile() {
        this.formatCode()
    }

    formatCode(isAutomatic = false): string {
        if (!this.isTypescript) return;

        function spliceStr(big: string, idx: number, deleteCount: number, injection: string = "") {
            return big.slice(0, idx) + injection + big.slice(idx + deleteCount)
        }

        let data = this.textAndPosition(this.editor.getPosition())
        let cursorOverride = data.programText.indexOf(cursorMarker)
        if (cursorOverride >= 0) {
            isAutomatic = false
            data.programText = Util.replaceAll(data.programText, cursorMarker, "")
            data.charNo = cursorOverride
        }
        let tmp = ts.pxt.format(data.programText, data.charNo)
        if (isAutomatic && tmp.formatted == data.programText)
            return;
        let formatted = tmp.formatted
        let line = 1
        let col = 0
        //console.log(data.charNo, tmp.pos)
        for (let i = 0; i < formatted.length; ++i) {
            let c = formatted.charCodeAt(i)
            col++
            if (i >= tmp.pos)
                break;
            if (c == 10) { line++; col = 0 }
        }
        this.editor.setValue(formatted)
        this.editor.setScrollPosition(line)
        return formatted
    }

    getCurrLinePrefix() {
        let pos = this.editor.getPosition()
        let line = this.editor.getModel().getLineContent(pos.lineNumber)
        return line.slice(0, pos.lineNumber)
    }

    isIncomplete() {
        return false;
    }

    prepare() {
        this.editor = pxt.vs.initMonacoAsync(document.getElementById("monacoEditorInner"));

        let removeFromContextMenu = ["editor.action.changeAll",
                                    "editor.action.quickOutline",
                                    "editor.action.goToDeclaration",
                                    "editor.action.previewDeclaration",
                                    "editor.action.referenceSearch.trigger"]

        this.editor.getActions().forEach(action => removeFromContextMenu.indexOf(action.id) > -1 ? (action as any)._shouldShowInContextMenu = false : null );

        this.editor.getActions().filter(action => action.id == "editor.action.format")[0]
            .run = () => Promise.resolve(this.formatCode());

        this.editor.getActions().filter(action => action.id == "editor.action.quickCommand")[0]
            .label = lf("Show Commands");

        this.editor.addAction({
            id: "save",
            label: lf("Save"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
            enablement: {writeableEditor: true},
            contextMenuGroupId: "4_tools/*",
            run: () => Promise.resolve(this.parent.saveFile())
        });

        this.editor.addAction({
            id: "runSimulator",
            label: lf("Run Simulator"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            enablement: {writeableEditor: true},
            contextMenuGroupId: "4_tools/*",
            run: () => Promise.resolve(this.parent.runSimulator())
        });

        if (pxt.appTarget.compile && pxt.appTarget.compile.hasHex) {
            this.editor.addAction({
                id: "compileHex",
                label: lf("Compile Hex"),
                enablement: {writeableEditor: true},
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter],
                contextMenuGroupId: "4_tools/*",
                run: () => Promise.resolve(this.parent.compile())
            });
        }

        this.editor.onDidFocusEditorText(() => {
            pxt.vs.syncModels(pkg.mainPkg);
        })

        this.editor.onDidChangeModelContent((e: monaco.editor.IModelContentChangedEvent2) => {
            if (!this.isTypescript) return;

            if (this.lastSet != null) {
                this.lastSet = null
            } else {
                pxt.log("change call back ")
                this.changeCallback();
            }
        });

        this.isReady = true
    }

    getId() {
        return "monacoEditor"
    }

    getViewState() {
        return this.editor.getPosition()
    }

    getCurrentSource() {
        return this.editor.getValue()
    }

    acceptsFile(file: pkg.File) {
        return true
    }

    private lastSet: string;
    private setValue(v: string) {
        this.lastSet = v;
        this.editor.setValue(v);
    }

    overrideFile(content: string) {
        this.editor.setValue(content);
    }

    loadFile(file: pkg.File) {
        pxt.vs.syncModels(pkg.mainPkg);

        let ext = file.getExtension()
        let modeMap: any = {
            "cpp": "cpp",
            "json": "json",
            "md": "text",
            "ts": "typescript",
            "js": "javascript",
            "blocks": "xml",
            "asm": "bat"
        }
        let mode = "text"
        if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]

        this.editor.updateOptions({readOnly: file.isReadonly()});

        this.currFile = file;
        let proto = "pkg:" + this.currFile.getName();
        let model = monaco.editor.getModels().filter((model) => model.uri.toString() == proto)[0];
        if (!model) model = monaco.editor.createModel(pkg.mainPkg.readFile(this.currFile.getName()),mode,monaco.Uri.parse(proto));
        if (model) this.editor.setModel(model);

        this.setValue(file.content)
        this.setDiagnostics(file, this.snapshotState())

        this.isTypescript = mode == "typescript";
    }

    snapshotState() {
        return this.editor.getModel() ? this.editor.getModel().getLinesContent() : []
    }

    setViewState(pos: monaco.IPosition) {
        if (Object.keys(pos).length === 0) return;
        this.editor.setPosition(pos)
        this.editor.setScrollPosition(pos)
    }
}
