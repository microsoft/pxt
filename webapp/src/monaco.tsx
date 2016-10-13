/// <reference path="../../node_modules/monaco-editor/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />


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

const MIN_EDITOR_FONT_SIZE = 10
const MAX_EDITOR_FONT_SIZE = 40

enum FileType {
    Unknown,
    TypeScript,
    Markdown
}

export class Editor extends srceditor.Editor {
    editor: monaco.editor.IStandaloneCodeEditor;
    currFile: pkg.File;
    fileType: FileType = FileType.Unknown;
    extraLibs: { [path: string]: monaco.IDisposable };

    hasBlocks() {
        if (!this.currFile) return true
        let blockFile = this.currFile.getVirtualFileName();
        return (blockFile && pkg.mainEditorPkg().files[blockFile] != null)
    }

    openBlocks() {
        pxt.tickEvent("typescript.showBlocks");
        const header = this.parent.state.header;
        if (header) {
            header.editor = pxt.BLOCKS_PROJECT_NAME;
            header.pubCurrent = false
        }

        let promise = Promise.resolve().then(() => {
            let blockFile = this.currFile.getVirtualFileName();
            if (!blockFile) {
                let mainPkg = pkg.mainEditorPkg();
                if (!mainPkg || !mainPkg.files["main.blocks"]) {
                    if (mainPkg) {
                        this.parent.setFile(mainPkg.files["main.ts"]);
                    }
                    return;
                }
                this.currFile = mainPkg.files["main.ts"];
                blockFile = this.currFile.getVirtualFileName();
            }

            const failedAsync = (file: string) => {
                core.cancelAsyncLoading();
                this.forceDiagnosticsUpdate();
                return this.showConversionFailedDialog(file);
            }

            if (!this.hasBlocks())
                return

            // needed to test roundtrip
            let js = this.formatCode();

            // might be undefined
            let mainPkg = pkg.mainEditorPkg();
            let xml: string;

            // it's a bit for a wild round trip:
            // 1) convert blocks to js to see if any changes happened, otherwise, just reload blocks
            // 2) decompile js -> blocks then take the decompiled blocks -> js
            // 3) check that decompiled js == current js % white space
            let blocksInfo: pxtc.BlocksInfo;
            return this.parent.saveFileAsync()
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
                            if (!resp.success) return failedAsync(blockFile);
                            xml = resp.outfiles[blockFile];
                            Util.assert(!!xml);
                            // try to convert back to typescript
                            let workspace = pxt.blocks.loadWorkspaceXml(xml);
                            if (!workspace) return failedAsync(blockFile);

                            let b2jsr = pxt.blocks.compile(workspace, blocksInfo);

                            const cleanRx = /[\s;]/g;
                            if (b2jsr.source.replace(cleanRx, '') != js.replace(cleanRx, '')) {
                                pxt.tickEvent("typescript.conversionFailed");
                                console.log('js roundtrip failed:')
                                console.log('-- original:');
                                console.log(js.replace(cleanRx, ''));
                                console.log('-- roundtrip:');
                                console.log(b2jsr.source.replace(cleanRx, ''));
                                pxt.reportError("compile", "decompilation failure", {
                                    js: js,
                                    blockly: xml,
                                    jsroundtrip: b2jsr.source
                                })
                                return failedAsync(blockFile);
                            }

                            return mainPkg.setContentAsync(blockFile, xml)
                                .then(() => this.parent.setFile(mainPkg.files[blockFile]));
                        })
                }).catch(e => {
                    pxt.reportException(e, { js: this.currFile.content });
                    core.errorNotification(lf("Oops, something went wrong trying to convert your code."));
                });
        });

        core.showLoadingAsync(lf("switching to blocks..."), promise).done();
    }

    showConversionFailedDialog(blockFile: string): Promise<void> {
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
                this.parent.removeFile(bf, true);
            } else {
                pxt.tickEvent("typescript.discardText");
                this.parent.setFile(bf);
            }
        })
    }

    decompile(blockFile: string): Promise<boolean> {
        let xml: string;
        return compiler.decompileAsync(blockFile)
            .then(resp => {
                return Promise.resolve(resp.success);
            })
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

    initEditorCss() {
        let colorDict: { [ns: string]: { color: string, fns: string[] } } = {};
        let head = document.head || document.getElementsByTagName('head')[0],
            style = (document.getElementById('monacoeditorStyles') as HTMLStyleElement) || document.createElement('style');
        style.id = "monacoeditorStyles";
        style.type = 'text/css';

        compiler.getBlocksAsync()
            .then((blockInfo: pxtc.BlocksInfo) => {
                if (!blockInfo) return;
                blockInfo.blocks
                    .forEach(fn => {
                        let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
                        let nsn = blockInfo.apis.byQName[ns];
                        if (nsn) ns = nsn.attributes.block || ns;
                        if (nsn && nsn.attributes.color) {
                            if (!colorDict[ns])
                                colorDict[ns] = { color: nsn.attributes.color, fns: [] };
                            colorDict[ns].fns.push(fn.name);
                        }
                    });
            }).then(() => {
                let cssContent = "";
                Object.keys(colorDict).forEach(function (ns) {
                    let element = colorDict[ns];
                    let color = element.color;
                    let cssTag = `.token.ts.identifier.${ns}, .token.ts.identifier.` + element.fns.join(', .token.ts.identifier.');
                    cssContent += `${cssTag} { color: ${color}; }`;
                })
                return cssContent;
            }).done((cssContent: string) => {
                if (style.sheet) {
                    style.textContent = cssContent;
                } else {
                    style.appendChild(document.createTextNode(cssContent));
                }
                head.appendChild(style);
            });
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
        if (this.fileType != FileType.TypeScript) return;

        function spliceStr(big: string, idx: number, deleteCount: number, injection: string = "") {
            return big.slice(0, idx) + injection + big.slice(idx + deleteCount)
        }

        let position = this.editor.getPosition()
        let data = this.textAndPosition(position)
        let cursorOverride = this.editor.getModel().getOffsetAt(position)
        if (cursorOverride >= 0) {
            isAutomatic = false
            data.charNo = cursorOverride
        }
        let tmp = pxtc.format(data.programText, data.charNo)
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
        this.editor.setPosition(position)
        return formatted
    }

    getCurrLinePrefix() {
        let pos = this.editor.getPosition()
        let line = this.editor.getModel().getLineContent(pos.lineNumber)
        return line.slice(0, pos.lineNumber)
    }

    isIncomplete() {
        return this.editor ? (this.editor as any)._view.contentWidgets._widgets["editor.widget.suggestWidget"].isVisible : false;
    }

    prepare() {
        this.extraLibs = Object.create(null);
        this.editor = pxt.vs.initMonacoAsync(document.getElementById("monacoEditorInner"));
        if (!this.editor) {
            // Todo: create a text area if we weren't able to load the monaco editor correctly.
            return;
        };

        this.editor.updateOptions({ fontSize: this.parent.settings.editorFontSize });

        let removeFromContextMenu = ["editor.action.changeAll",
            "editor.action.quickOutline",
            "editor.action.goToDeclaration",
            "editor.action.previewDeclaration",
            "editor.action.referenceSearch.trigger"]

        let disabledFromCommands = ["editor.unfold",
            "editor.unFoldRecursively",
            "editor.fold",
            "editor.foldRecursively",
            "editor.foldAll",
            "editor.unFoldAll",
            "editor.foldLevel1",
            "editor.foldLevel2",
            "editor.foldLevel3",
            "editor.foldLevel4",
            "editor.foldLevel5"]

        this.editor.getActions().forEach(action => removeFromContextMenu.indexOf(action.id) > -1 ? (action as any)._actual.menuOpts = undefined : null);

        this.editor.getActions().forEach(action => disabledFromCommands.indexOf(action.id) > -1 ? (action as any)._enabled = false : null);

        this.editor.getActions().filter(action => action.id == "editor.action.format")[0]
            .run = () => Promise.resolve(this.beforeCompile());

        this.editor.getActions().filter(action => action.id == "editor.action.quickCommand")[0]
            .label = lf("Show Commands");

        this.editor.addAction({
            id: "save",
            label: lf("Save"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
            keybindingContext: "!editorReadonly",
            run: () => Promise.resolve(this.parent.typecheckNow())
        });

        this.editor.addAction({
            id: "runSimulator",
            label: lf("Run Simulator"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            keybindingContext: "!editorReadonly",
            run: () => Promise.resolve(this.parent.runSimulator())
        });

        if (pxt.appTarget.compile && pxt.appTarget.compile.hasHex) {
            this.editor.addAction({
                id: "compileHex",
                label: lf("Download"),
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter],
                keybindingContext: "!editorReadonly",
                run: () => Promise.resolve(this.parent.compile())
            });
        }

        this.editor.addAction({
            id: "zoomIn",
            label: lf("Zoom In"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.NUMPAD_ADD, monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_EQUAL],
            run: () => Promise.resolve(this.zoomIn())
        });

        this.editor.addAction({
            id: "zoomOut",
            label: lf("Zoom Out"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.NUMPAD_SUBTRACT, monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_MINUS],
            run: () => Promise.resolve(this.zoomOut())
        });

        this.editor.onDidBlurEditorText(() => {
            if (this.isIncomplete()) {
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({noSyntaxValidation: true});
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({noSemanticValidation: true});
            } else {
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({noSyntaxValidation: false});
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({noSemanticValidation: false});
            }
        })

        this.editor.onDidLayoutChange((e: monaco.editor.EditorLayoutInfo) => {
            // Update editor font size in settings after a ctrl+scroll zoom
            let currentFont = this.editor.getConfiguration().fontInfo.fontSize;
            if (this.parent.settings.editorFontSize != currentFont) {
                this.parent.settings.editorFontSize = currentFont;
                this.forceDiagnosticsUpdate();
            }
        })

        this.editor.onDidChangeModelContent((e: monaco.editor.IModelContentChangedEvent2) => {
            if (this.currFile.isReadonly()) return;

            if (this.highlightDecorations)
                this.editor.deltaDecorations(this.highlightDecorations, []);

            if (this.lastSet != null) {
                this.lastSet = null
            } else {
                if (!e.isRedoing && !e.isUndoing && !this.editor.getValue()) {
                    this.editor.setValue(" ");
                }
                this.updateDiagnostics();
                pxt.tickEvent("typescript.edit");
                this.changeCallback();
            }
        });

        this.editorViewZones = [];

        this.isReady = true
    }

    zoomIn() {
        if (this.parent.settings.editorFontSize >= MAX_EDITOR_FONT_SIZE) return;
        let currentFont = this.editor.getConfiguration().fontInfo.fontSize;
        this.parent.settings.editorFontSize = currentFont + 1;
        this.editor.updateOptions({ fontSize: this.parent.settings.editorFontSize });
        this.forceDiagnosticsUpdate();
    }

    zoomOut() {
        if (this.parent.settings.editorFontSize <= MIN_EDITOR_FONT_SIZE) return;
        let currentFont = this.editor.getConfiguration().fontInfo.fontSize;
        this.parent.settings.editorFontSize = currentFont - 1;
        this.editor.updateOptions({ fontSize: this.parent.settings.editorFontSize });
        this.forceDiagnosticsUpdate();
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
        if (v) this.editor.setValue(v);
        else this.editor.setValue(" ");
    }

    overrideFile(content: string) {
        this.editor.setValue(content);
    }

    loadFile(file: pkg.File) {
        this.initEditorCss();

        let ext = file.getExtension()
        let modeMap: any = {
            "cpp": "cpp",
            "json": "json",
            "md": "text",
            "ts": "typescript",
            "js": "javascript",
            "blocks": "xml",
            "asm": "asm"
        }
        let mode = "text"
        if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]

        this.editor.updateOptions({ readOnly: file.isReadonly() });

        this.currFile = file;
        let proto = "pkg:" + this.currFile.getName();
        let model = monaco.editor.getModels().filter((model) => model.uri.toString() == proto)[0];
        if (!model) model = monaco.editor.createModel(pkg.mainPkg.readFile(this.currFile.getName()), mode, monaco.Uri.parse(proto));
        if (model) this.editor.setModel(model);

        if (mode == "typescript")
            pxt.vs.syncModels(pkg.mainPkg, this.extraLibs, file.getName(), file.isReadonly());

        this.setValue(file.content)
        this.setDiagnostics(file, this.snapshotState())

        this.fileType = mode == "typescript" ? FileType.TypeScript : ext == "md" ? FileType.Markdown : FileType.Unknown;

        if (this.fileType == FileType.Markdown)
            this.parent.setSideMarkdown(file.content);
    }

    snapshotState() {
        return this.editor.getModel().getLinesContent()
    }

    setViewState(pos: monaco.IPosition) {
        if (!pos || Object.keys(pos).length === 0) return;
        this.editor.setPosition(pos)
        this.editor.setScrollPosition(pos)
    }

    setDiagnostics(file: pkg.File, snapshot: string[]) {
        Util.assert(this.currFile == file)
        this.diagSnapshot = snapshot
        this.forceDiagnosticsUpdate()
    }

    private diagSnapshot: string[];
    private annotationLines: number[];
    private editorViewZones: number[];
    private errorLines: number[];

    updateDiagnostics() {
        if (this.needsDiagUpdate())
            this.forceDiagnosticsUpdate();
    }

    private needsDiagUpdate() {
        if (!this.annotationLines) return false
        let lines: string[] = this.editor.getModel().getLinesContent()
        for (let line of this.annotationLines) {
            if (this.diagSnapshot[line] !== lines[line])
                return true;
        }
        return false;
    }

    forceDiagnosticsUpdate() {
        if (this.fileType != FileType.TypeScript) return

        let file = this.currFile
        let lines: string[] = this.editor.getModel().getLinesContent();
        let fontSize = this.parent.settings.editorFontSize - 3;
        let lineHeight = this.editor.getConfiguration().lineHeight;

        let viewZones = this.editorViewZones || [];
        this.annotationLines = [];

        (this.editor as any).changeViewZones(function (changeAccessor: any) {
            viewZones.forEach(id => {
                changeAccessor.removeZone(id);
            });
        });
        this.editorViewZones = [];
        this.errorLines = [];

        if (file && file.diagnostics) {
            for (let d of file.diagnostics) {
                if (this.errorLines.filter(lineNumber => lineNumber == d.line).length > 0 || this.errorLines.length > 0) continue;
                let viewZoneId: any = null;
                (this.editor as any).changeViewZones(function (changeAccessor: any) {
                    let domNode = document.createElement('div');
                    domNode.className = d.category == ts.DiagnosticCategory.Error ? "error-view-zone" : "warning-view-zone";
                    domNode.style.setProperty("font-size", fontSize.toString() + "px");
                    domNode.style.setProperty("line-height", lineHeight.toString() + "px");
                    domNode.innerText = ts.flattenDiagnosticMessageText(d.messageText, "\n");
                    viewZoneId = changeAccessor.addZone({
                        afterLineNumber: d.line + 1,
                        heightInLines: 1,
                        domNode: domNode
                    });
                });
                this.editorViewZones.push(viewZoneId);
                this.errorLines.push(d.line);
                if (lines[d.line] === this.diagSnapshot[d.line]) {
                    this.annotationLines.push(d.line)
                }
            }
        }
    }

    private highlightDecorations: string[] = [];

    highlightStatement(brk: pxtc.LocationInfo) {
        if (!brk || !this.currFile || this.currFile.name != brk.fileName || !this.editor) return;
        let position = this.editor.getModel().getPositionAt(brk.start);
        if (!position) return;
        this.highlightDecorations = this.editor.deltaDecorations(this.highlightDecorations, [
            {
                range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + brk.length),
                options: { inlineClassName: 'highlight-statement' }
            },
        ]);
    }
}
