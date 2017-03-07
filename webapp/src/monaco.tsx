/// <reference path="../../localtypings/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />


import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";
import * as data from "./data";
import * as codecard from "./codecard";
import * as blocks from "./blocks"


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
    extraLibs: pxt.Map<monaco.IDisposable>;
    definitions: pxt.Map<pxt.vs.NameDefiniton>;
    loadingMonaco: boolean;

    hasBlocks() {
        if (!this.currFile) return true
        let blockFile = this.currFile.getVirtualFileName();
        return (blockFile && pkg.mainEditorPkg().files[blockFile] != null)
    }

    public openBlocks() {
        pxt.tickEvent("typescript.showBlocks");
        const header = this.parent.state.header;
        if (header) {
            header.editor = pxt.BLOCKS_PROJECT_NAME;
            header.pubCurrent = false
        }

        let promise = Promise.resolve().then(() => {
            if (!this.hasBlocks())
                return

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
                .then((bi: pxtc.BlocksInfo) => {
                    blocksInfo = bi;
                    pxt.blocks.initBlocks(blocksInfo);
                    const oldWorkspace = pxt.blocks.loadWorkspaceXml(mainPkg.files[blockFile].content);
                    if (oldWorkspace) {
                        const oldJs = pxt.blocks.compile(oldWorkspace, blocksInfo).source;
                        if (pxtc.format(oldJs, 0).formatted == pxtc.format(this.editor.getValue(), 0).formatted) {
                            pxt.debug('js not changed, skipping decompile');
                            pxt.tickEvent("typescript.noChanges")
                            return this.parent.setFile(mainPkg.files[blockFile]);
                        }
                    }
                    return compiler.decompileAsync(this.currFile.name, blocksInfo, oldWorkspace, blockFile)
                        .then(resp => {
                            if (!resp.success) {
                                this.currFile.diagnostics = resp.diagnostics;
                                return failedAsync(blockFile);
                            }
                            xml = resp.outfiles[blockFile];
                            Util.assert(!!xml);
                            return mainPkg.setContentAsync(blockFile, xml)
                                .then(() => this.parent.setFile(mainPkg.files[blockFile]));
                        })
                }).catch(e => {
                    pxt.reportException(e);
                    core.errorNotification(lf("Oops, something went wrong trying to convert your code."));
                });
        });

        core.showLoadingAsync(lf("switching to blocks..."), promise).done();
    }

    public showConversionFailedDialog(blockFile: string): Promise<void> {
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
            size: "medium",
            hideCancel: !bf
        }).then(b => {
            // discard
            if (!b) {
                pxt.tickEvent("typescript.keepText");
            } else {
                pxt.tickEvent("typescript.discardText");
                this.overrideFile(this.parent.saveBlocksToTypeScript());
                this.parent.setFile(bf);
            }
        })
    }

    public decompileAsync(blockFile: string): Promise<boolean> {
        return compiler.decompileAsync(blockFile)
            .then(resp => resp.success);
    }

    display() {
        return (
            <div className='full-abs' id="monacoEditorArea">
                <div id='monacoEditorToolbox' className='injectionDiv' />
                <div id='monacoEditorInner' />
            </div>
        )
    }

    private defineEditorTheme() {
        const inverted = pxt.appTarget.appTheme.invertedMonaco;
        const invertedColorluminosityMultipler = 0.6;
        let fnDict = this.definitions;
        let rules: monaco.editor.IThemeRule[] = [];
        Object.keys(fnDict).forEach((ns) => {
            let element = fnDict[ns];
            if (element.metaData && element.metaData.color && element.fns) {
                let hexcolor = pxt.blocks.convertColour(element.metaData.color);
                hexcolor = (inverted ? Blockly.PXTUtils.fadeColour(hexcolor, invertedColorluminosityMultipler, true) : hexcolor).replace('#', '');
                Object.keys(element.fns).forEach((fn) => {
                    rules.push({ token: `identifier.ts ${fn}`, foreground: hexcolor });
                });
                rules.push({ token: `identifier.ts ${ns}`, foreground: hexcolor });
            }
        })

        rules.push({ token: `identifier.ts if`, foreground: '5B80A5', });
        rules.push({ token: `identifier.ts else`, foreground: '5B80A5', });
        rules.push({ token: `identifier.ts while`, foreground: '5BA55B', });
        rules.push({ token: `identifier.ts for`, foreground: '5BA55B', });

        monaco.editor.defineTheme('pxtTheme', {
            base: inverted ? 'vs-dark' : 'vs', // can also be vs-dark or hc-black
            inherit: true, // can also be false to completely replace the builtin rules
            rules: rules
        });

        this.editor.updateOptions({ theme: 'pxtTheme' });
    }

    beforeCompile() {
        if (this.editor)
            this.formatCode()
    }

    public formatCode(isAutomatic = false): string {
        Util.assert(this.editor != undefined); // Guarded
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

    private textAndPosition(pos: monaco.IPosition) {
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

    isIncomplete() {
        return this.editor && (this.editor as any)._view ?
            (this.editor as any)._view.contentWidgets._widgets["editor.widget.suggestWidget"].isVisible :
            false;
    }

    resize(e?: Event) {
        let monacoArea = document.getElementById('monacoEditorArea');
        let monacoToolbox = document.getElementById('monacoEditorToolbox')
        if (monacoArea && monacoToolbox && this.editor)
            this.editor.layout({ width: monacoArea.offsetWidth - monacoToolbox.offsetWidth - 1, height: monacoArea.offsetHeight });
    }

    prepare() {
        this.isReady = true
    }

    public loadMonacoAsync(): Promise<void> {
        if (this.editor || this.loadingMonaco) return Promise.resolve();
        this.loadingMonaco = true;
        this.extraLibs = Object.create(null);

        let editorArea = document.getElementById("monacoEditorArea");
        let editorElement = document.getElementById("monacoEditorInner");

        return pxt.vs.initMonacoAsync(editorElement).then((editor) => {
            this.editor = editor;
            this.loadingMonaco = false;

            this.editor.updateOptions({ fontSize: this.parent.settings.editorFontSize });

            this.editor.getActions().filter(action => action.id == "editor.action.formatDocument")[0]
                .run = () => Promise.resolve(this.beforeCompile());

            this.editor.addAction({
                id: "save",
                label: lf("Save"),
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
                keybindingContext: "!editorReadonly",
                precondition: "!editorReadonly",
                contextMenuGroupId: "0_pxtnavigation",
                contextMenuOrder: 0.2,
                run: () => Promise.resolve(this.parent.typecheckNow())
            });

            this.editor.addAction({
                id: "runSimulator",
                label: lf("Run Simulator"),
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                keybindingContext: "!editorReadonly",
                precondition: "!editorReadonly",
                contextMenuGroupId: "0_pxtnavigation",
                contextMenuOrder: 0.21,
                run: () => Promise.resolve(this.parent.runSimulator())
            });

            if (pxt.appTarget.compile && pxt.appTarget.compile.hasHex) {
                this.editor.addAction({
                    id: "compileHex",
                    label: lf("Download"),
                    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter],
                    keybindingContext: "!editorReadonly",
                    precondition: "!editorReadonly",
                    contextMenuGroupId: "0_pxtnavigation",
                    contextMenuOrder: 0.22,
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
                    (monaco.languages.typescript.typescriptDefaults as any)._diagnosticsOptions = ({ noSyntaxValidation: true, noSemanticValidation: true });
                } else {
                    (monaco.languages.typescript.typescriptDefaults as any)._diagnosticsOptions = ({ noSyntaxValidation: false, noSemanticValidation: false });
                }
            })

            if (pxt.appTarget.appTheme.hasReferenceDocs) {
                let referenceContextKey = this.editor.createContextKey("editorHasReference", false)
                this.editor.addAction({
                    id: "reference",
                    label: lf("Help"),
                    keybindingContext: "!editorReadonly && editorHasReference",
                    precondition: "!editorReadonly && editorHasReference",
                    contextMenuGroupId: "navigation",
                    contextMenuOrder: 0.1,
                    run: () => Promise.resolve(this.loadReference())
                });

                this.editor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
                    let word = this.editor.getModel().getWordUntilPosition(e.position);
                    if (word && word.word != "") {
                        referenceContextKey.set(true);
                    } else {
                        referenceContextKey.reset()
                    }
                })
            }

            this.editor.onDidLayoutChange((e: monaco.editor.EditorLayoutInfo) => {
                // Update editor font size in settings after a ctrl+scroll zoom
                let currentFont = this.editor.getConfiguration().fontInfo.fontSize;
                if (this.parent.settings.editorFontSize != currentFont) {
                    this.parent.settings.editorFontSize = currentFont;
                    this.forceDiagnosticsUpdate();
                }
                // Update widgets
                let toolbox = document.getElementById('monacoEditorToolbox');
                toolbox.style.height = `${this.editor.getLayoutInfo().contentHeight}px`;
                let flyout = document.getElementById('monacoFlyoutWidget');
                flyout.style.height = `${this.editor.getLayoutInfo().contentHeight}px`;
            })

            const monacoEditorInner = document.getElementById('monacoEditorInner');
            monacoEditorInner.ondragenter = ((ev: DragEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
            });
            monacoEditorInner.ondragover = ((ev: DragEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                let mouseTarget = this.editor.getTargetAtClientPoint(ev.clientX, ev.clientY);
                let position = mouseTarget.position;
                if (position && this.editor.getPosition() != position)
                    this.editor.setPosition(position);
                this.editor.focus();
            });
            monacoEditorInner.ondrop = ((ev: DragEvent) => {
                let insertText = ev.dataTransfer.getData('text'); // IE11 only support "text"
                if (!insertText)
                    return;
                ev.preventDefault();
                ev.stopPropagation();

                let mouseTarget = this.editor.getTargetAtClientPoint(ev.clientX, ev.clientY);
                let position = mouseTarget.position;
                let model = this.editor.getModel();
                let currPos = this.editor.getPosition();
                let cursor = model.getOffsetAt(currPos)
                if (!position) // IE11 fails to locate the mouse
                    position = currPos;

                insertText = (currPos.column > 1) ? '\n' + insertText :
                    model.getWordUntilPosition(currPos) != undefined && model.getWordUntilPosition(currPos).word != '' ?
                        insertText + '\n' : insertText;
                if (insertText.indexOf('{{}}') > -1) {
                    cursor += (insertText.indexOf('{{}}'));
                    insertText = insertText.replace('{{}}', '');
                } else
                    cursor += (insertText.length);

                this.editor.pushUndoStop();
                this.editor.executeEdits("", [
                    {
                        identifier: { major: 0, minor: 0 },
                        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                        text: insertText,
                        forceMoveMarkers: false
                    }
                ]);
                this.editor.pushUndoStop();

                let endPos = model.getPositionAt(cursor);
                this.editor.setPosition(endPos);
                this.editor.focus();
            });


            this.editor.onDidFocusEditorText(() => {
                this.resetFlyout(true);
            })

            this.editorViewZones = [];

            this.setupToolbox(editorArea);
        })
    }

    undo() {
        if (!this.editor) return;
        this.editor.trigger('keyboard', monaco.editor.Handler.Undo, null);
    }

    redo() {
        if (!this.editor) return;
        this.editor.trigger('keyboard', monaco.editor.Handler.Redo, null)
    }

    zoomIn() {
        if (!this.editor) return;
        if (this.parent.settings.editorFontSize >= MAX_EDITOR_FONT_SIZE) return;
        let currentFont = this.editor.getConfiguration().fontInfo.fontSize;
        this.parent.settings.editorFontSize = currentFont + 1;
        this.editor.updateOptions({ fontSize: this.parent.settings.editorFontSize });
        this.forceDiagnosticsUpdate();
    }

    zoomOut() {
        if (!this.editor) return;
        if (this.parent.settings.editorFontSize <= MIN_EDITOR_FONT_SIZE) return;
        let currentFont = this.editor.getConfiguration().fontInfo.fontSize;
        this.parent.settings.editorFontSize = currentFont - 1;
        this.editor.updateOptions({ fontSize: this.parent.settings.editorFontSize });
        this.forceDiagnosticsUpdate();
    }

    private loadReference() {
        Util.assert(this.editor != undefined); // Guarded
        let currentPosition = this.editor.getPosition();
        let wordInfo = this.editor.getModel().getWordAtPosition(currentPosition);
        if (!wordInfo) return;
        let prevWordInfo = this.editor.getModel().getWordUntilPosition(new monaco.Position(currentPosition.lineNumber, wordInfo.startColumn - 1));
        if (prevWordInfo && wordInfo) {
            let namespaceName = prevWordInfo.word.replace(/([A-Z]+)/g, "-$1");
            let methodName = wordInfo.word.replace(/([A-Z]+)/g, "-$1");
            this.parent.setSideDoc(`/reference/${namespaceName}/${methodName}`);
        } else if (wordInfo) {
            let methodName = wordInfo.word.replace(/([A-Z]+)/g, "-$1");
            this.parent.setSideDoc(`/reference/${methodName}`);
        }
    }

    private setupToolbox(editorElement: HTMLElement) {
        // Monaco flyout widget
        let flyoutWidget = {
            getId: function (): string {
                return 'pxt.flyout.widget';
            },
            getDomNode: function (): HTMLElement {
                if (!this.domNode) {
                    this.domNode = document.createElement('div');
                    this.domNode.id = 'monacoFlyoutWidget';
                    this.domNode.style.top = `0`;
                    this.domNode.className = 'monacoFlyout';
                    // Hide by default
                    this.domNode.style.display = 'none';
                    this.domNode.innerText = 'Flyout';
                }
                return this.domNode;
            },
            getPosition: function (): monaco.editor.IOverlayWidgetPosition {
                return null;
            }
        };
        this.editor.addOverlayWidget(flyoutWidget);
    }

    private selectedCategoryRow: HTMLElement;
    private selectedCategoryColor: string;
    private selectedCategoryBackgroundColor: string;

    private resetFlyout(clear?: boolean) {
        // Hide the flyout
        let flyout = document.getElementById('monacoFlyoutWidget');
        flyout.innerHTML = '';
        flyout.style.display = 'none';

        // Hide the currnet toolbox category
        if (this.selectedCategoryRow) {
            this.selectedCategoryRow.style.background = `${this.selectedCategoryBackgroundColor}`;
            this.selectedCategoryRow.style.color = `${this.selectedCategoryColor}`;
            this.selectedCategoryRow.className = 'blocklyTreeRow';
        }

        if (clear) {
            this.selectedCategoryRow = null;
        }
    }

    private updateToolbox() {
        let appTheme = pxt.appTarget.appTheme;
        if (!appTheme.monacoToolbox || pxt.shell.isReadOnly()) return;
        // Toolbox div
        let toolbox = document.getElementById('monacoEditorToolbox');
        // Move the monaco editor to make room for the toolbox div
        this.editor.getLayoutInfo().glyphMarginLeft = 200;
        this.editor.layout();
        let monacoEditor = this;
        // clear the toolbox
        toolbox.innerHTML = '';

        // Add an overlay widget for the toolbox
        toolbox.style.height = `${monacoEditor.editor.getLayoutInfo().contentHeight}px`;
        let root = document.createElement('div');
        root.className = 'blocklyTreeRoot';
        toolbox.appendChild(root);
        let group = document.createElement('div');
        group.setAttribute('role', 'group');
        root.appendChild(group);

        let fnDef = this.definitions;
        Object.keys(fnDef).sort((f1, f2) => {
            // sort by fn weight
            const fn1 = fnDef[f1];
            const fn2 = fnDef[f2];
            const w2 = (fn2.metaData ? fn2.metaData.weight || 50 : 50)
                + (fn2.metaData && fn2.metaData.advanced ? 0 : 1000);
            + (fn2.metaData && fn2.metaData.blockId ? 10000 : 0)
            const w1 = (fn1.metaData ? fn1.metaData.weight || 50 : 50)
                + (fn1.metaData && fn1.metaData.advanced ? 0 : 1000);
            + (fn1.metaData && fn1.metaData.blockId ? 10000 : 0)
            return w2 - w1;
        }).filter(ns => fnDef[ns].metaData != null && fnDef[ns].metaData.color != null).forEach(function (ns) {
            let metaElement = fnDef[ns];
            let fnElement = fnDef[ns];

            monacoEditor.addToolboxCategory(group, ns, metaElement.metaData.color, metaElement.metaData.icon, true, fnElement.fns);
        })

        Editor.addBuiltinCategories(group, monacoEditor);

        // Add the toolbox buttons
        if (pxt.appTarget.cloud && pxt.appTarget.cloud.packages) {
            this.addToolboxCategory(group, "", "#717171", "addpackage", false, null, () => {
                this.resetFlyout();
                this.parent.addPackage();
            }, lf("{id:category}Add Package"))
        }

        // Inject toolbox icon css
        pxt.blocks.injectToolboxIconCss();
    }

    static addBuiltinCategories(group: HTMLDivElement, monacoEditor: Editor) {
        monacoEditor.addToolboxCategory(group, "", pxt.blocks.blockColors["logic"].toString(), "logic", false, {
            "if": {
                sig: ``,
                snippet: `if (true) {

}`,
                comment: lf("Runs code if the condition is true"),
                metaData: {
                    callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                    paramDefl: {}
                }
            }, "if ": {
                sig: ``,
                snippet: `if (true) {

} else {

}`,
                comment: lf("Runs code if the condition is true; else run other code"),
                metaData: {
                    callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                    paramDefl: {}
                }
            },"switch": {
                sig: ``,
                snippet: `switch(item) {
    case 0:
        break;
    case 1:
        break;
}`,
                comment: lf("Runs different code based on a value"),
                metaData: {
                    callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                    paramDefl: {}
                }
            }
        }, null, lf("{id:category}Logic"));
        monacoEditor.addToolboxCategory(group, "", pxt.blocks.blockColors["loops"].toString(), "loops", false, {
            "while": {
                sig: `while(...)`,
                snippet: `while(true) {

}`,
                comment: lf("Repeat code while condition is true"),
                metaData: {
                    callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                    paramDefl: {}
                }
            },
            "for": {
                sig: ``,
                snippet: `for(let i = 0; i < 5; i++) {

}`,
                comment: lf("Repeat code a number of times in a loop"),
                metaData: {
                    callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                    paramDefl: {}
                }
            }
        }, null, lf("{id:category}Loops"));
    }

    private addToolboxCategory(
        group: HTMLDivElement,
        ns: string,
        metaColor: string,
        icon: string,
        injectIconClass: boolean = true,
        fns?: pxt.Map<pxt.vs.MethodDef>,
        onClick?: () => void,
        category?: string) {
        let appTheme = pxt.appTarget.appTheme;
        let monacoEditor = this;
        // Create a tree item
        let treeitem = document.createElement('div');
        let treerow = document.createElement('div');
        treeitem.setAttribute('role', 'treeitem');
        let color = pxt.blocks.convertColour(metaColor);
        treeitem.onclick = (ev: MouseEvent) => {
            pxt.tickEvent("monaco.toolbox.click");

            let monacoFlyout = document.getElementById('monacoFlyoutWidget');
            monacoEditor.resetFlyout(false);

            // Hide the toolbox if the current category is clicked twice
            if (monacoEditor.selectedCategoryRow == treerow) {
                monacoEditor.selectedCategoryRow = null;
                monacoFlyout.style.display = 'none';

                treerow.className = 'blocklyTreeRow';
                return;
            } else {
                // Selected category
                treerow.style.background = appTheme.invertedToolbox ?
                    `${Blockly.PXTUtils.fadeColour(color, (Blockly as any).Options.invertedMultiplier, false)}` :
                    `${color}`;
                treerow.style.color = '#fff';
                treerow.className += ' blocklyTreeSelected';
                monacoEditor.selectedCategoryRow = treerow;
                if (appTheme.invertedToolbox) {
                    // Inverted toolbox
                    monacoEditor.selectedCategoryColor = '#fff';
                    monacoEditor.selectedCategoryBackgroundColor = color;
                } else {
                    monacoEditor.selectedCategoryColor = color;
                    monacoEditor.selectedCategoryBackgroundColor = 'none';
                }
            }

            monacoFlyout.style.left = `${monacoEditor.editor.getLayoutInfo().lineNumbersLeft}px`;
            monacoFlyout.style.height = `${monacoEditor.editor.getLayoutInfo().contentHeight}px`;
            monacoFlyout.style.display = 'block';
            monacoFlyout.className = 'monacoFlyout';
            monacoFlyout.style.transform = 'none';

            if (onClick) {
                // No flyout
                onClick();
            } else {
                // Create a flyout and add the category methods in there
                Object.keys(fns).sort((f1, f2) => {
                    // sort by fn weight
                    const fn1 = fns[f1];
                    const fn2 = fns[f2];
                    const w2 = (fn2.metaData ? fn2.metaData.weight || 50 : 50)
                        + (fn2.metaData && fn2.metaData.advanced ? 0 : 1000);
                    + (fn2.metaData && fn2.metaData.blockId ? 10000 : 0)
                    const w1 = (fn1.metaData ? fn1.metaData.weight || 50 : 50)
                        + (fn1.metaData && fn1.metaData.advanced ? 0 : 1000);
                    + (fn1.metaData && fn1.metaData.blockId ? 10000 : 0)
                    return w2 - w1;
                }).forEach((fn) => {
                    let monacoBlock = document.createElement('div');
                    monacoBlock.className = 'monacoDraggableBlock';

                    monacoBlock.style.fontSize = `${monacoEditor.parent.settings.editorFontSize}px`;
                    monacoBlock.style.backgroundColor = `${color}`;
                    monacoBlock.style.borderColor = `${color}`;
                    monacoBlock.draggable = true;

                    const elem = fns[fn];
                    const snippet = elem.snippet;
                    const comment = elem.comment;
                    const metaData = elem.metaData;

                    let methodToken = document.createElement('span');
                    methodToken.innerText = fn;
                    let sigToken = document.createElement('span'); sigToken.className = 'sig';
                    // completion is a bit busted but looks better
                    sigToken.innerText = snippet
                        .replace(/^[^(]*\(/, '(')
                        .replace(/^\s*\{\{\}\}\n/gm, '')
                        .replace(/\{\n\}/g, '{}')
                        .replace(/(?:\{\{)|(?:\}\})/g, '');

                    monacoBlock.title = comment;

                    monacoBlock.onclick = (ev2: MouseEvent) => {
                        pxt.tickEvent("monaco.toolbox.itemclick");

                        monacoEditor.resetFlyout(true);

                        let model = monacoEditor.editor.getModel();
                        let currPos = monacoEditor.editor.getPosition();
                        let cursor = model.getOffsetAt(currPos)
                        let insertText = ns ? `${ns}.${snippet}` : snippet;
                        insertText = (currPos.column > 1) ? '\n' + insertText :
                            model.getWordUntilPosition(currPos) != undefined && model.getWordUntilPosition(currPos).word != '' ?
                                insertText + '\n' : insertText;

                        if (insertText.indexOf('{{}}') > -1) {
                            cursor += (insertText.indexOf('{{}}'));
                            insertText = insertText.replace('{{}}', '');
                        } else
                            cursor += (insertText.length);

                        insertText = insertText.replace(/(?:\{\{)|(?:\}\})/g, '');
                        monacoEditor.editor.pushUndoStop();
                        monacoEditor.editor.executeEdits("", [
                            {
                                identifier: { major: 0, minor: 0 },
                                range: new monaco.Range(currPos.lineNumber, currPos.column, currPos.lineNumber, currPos.column),
                                text: insertText,
                                forceMoveMarkers: false
                            }
                        ]);
                        monacoEditor.editor.pushUndoStop();
                        let endPos = model.getPositionAt(cursor);
                        monacoEditor.editor.setPosition(endPos);
                        monacoEditor.editor.focus();
                        //monacoEditor.editor.setSelection(new monaco.Range(currPos.lineNumber, currPos.column, endPos.lineNumber, endPos.column));
                    };
                    monacoBlock.ondragstart = (ev2: DragEvent) => {
                        pxt.tickEvent("monaco.toolbox.itemdrag");
                        let clone = monacoBlock.cloneNode(true) as HTMLDivElement;

                        setTimeout(function () {
                            monacoFlyout.style.transform = "translateX(-9999px)";
                        });

                        let insertText = ns ? `${ns}.${snippet}` : snippet;
                        ev2.dataTransfer.setData('text', insertText); // IE11 only supports text
                    }
                    monacoBlock.ondragend = (ev2: DragEvent) => {
                        monacoFlyout.style.transform = "none";
                        monacoEditor.resetFlyout(true);
                    }

                    monacoBlock.appendChild(methodToken);
                    monacoBlock.appendChild(sigToken);
                    monacoFlyout.appendChild(monacoBlock);
                })
            }
        };
        group.appendChild(treeitem);
        treerow.className = 'blocklyTreeRow';
        treeitem.appendChild(treerow);
        let iconBlank = document.createElement('span');
        let iconNone = document.createElement('span');
        let label = document.createElement('span');

        let iconClass = `blocklyTreeIcon${icon ? (ns || icon).toLowerCase() : 'Default'}`.replace(/\s/g, '');
        iconBlank.className = 'blocklyTreeIcon';
        iconBlank.setAttribute('role', 'presentation');
        iconNone.className = `blocklyTreeIcon ${iconClass}`;
        iconNone.setAttribute('role', 'presentation');
        iconNone.style.display = 'inline-block';

        label.className = 'blocklyTreeLabel';
        treerow.appendChild(iconBlank);
        treerow.appendChild(iconNone);
        treerow.appendChild(label);

        if (appTheme.coloredToolbox) {
            // Colored toolbox
            treerow.style.color = `${color}`;
            treerow.style.borderLeft = `8px solid ${color}`;
        } else if (appTheme.invertedToolbox) {
            // Inverted toolbox
            treerow.style.color = '#fff';
            treerow.style.background = (color || '#ddd');
            treerow.onmouseenter = () => {
                if (treerow != monacoEditor.selectedCategoryRow) {
                    treerow.style.background = Blockly.PXTUtils.fadeColour(color || '#ddd', (Blockly as any).Options.invertedMultiplier, false);
                }
            }
            treerow.onmouseleave = () => {
                if (treerow != monacoEditor.selectedCategoryRow) {
                    treerow.style.background = (color || '#ddd');
                }
            }
        } else {
            // Standard toolbox
            treerow.style.borderLeft = `8px solid ${color}`;
        }
        if (icon && injectIconClass) {
            pxt.blocks.appendToolboxIconCss(iconClass, icon);
        }
        treerow.style.paddingLeft = '0px';
        label.innerText = `${Util.capitalize(category || ns)}`;
    }

    getId() {
        return "monacoEditor"
    }

    getViewState() {
        return this.editor ? this.editor.getPosition() : {};
    }

    getCurrentSource() {
        return this.editor ? this.editor.getValue() : this.currSource;
    }

    acceptsFile(file: pkg.File) {
        return true
    }

    private setValue(v: string) {
        this.editor.setValue(v);
    }

    public overrideFile(content: string) {
        Util.assert(this.editor != undefined); // Guarded
        this.editor.setValue(content);
    }

    loadFileAsync(file: pkg.File): Promise<void> {
        let mode = "text";
        this.currSource = file.content;

        let loading = document.createElement("div");
        loading.className = "ui inverted loading dimmer active";
        let editorArea = document.getElementById("monacoEditorArea");
        let editorDiv = document.getElementById("monacoEditorInner");
        editorArea.insertBefore(loading, editorDiv);

        return this.loadMonacoAsync()
            .then(() => {
                if (!this.editor) return;
                let toolbox = document.getElementById('monacoEditorToolbox');

                let ext = file.getExtension()
                let modeMap: any = {
                    "cpp": "cpp",
                    "h": "cpp",
                    "json": "json",
                    "md": "text",
                    "ts": "typescript",
                    "js": "javascript",
                    "svg": "xml",
                    "blocks": "xml",
                    "asm": "asm"
                }
                if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]

                const readOnly = file.isReadonly() || pxt.shell.isReadOnly();
                this.editor.updateOptions({ readOnly: readOnly });

                let proto = "pkg:" + file.getName();
                let model = monaco.editor.getModels().filter((model) => model.uri.toString() == proto)[0];
                if (!model) model = monaco.editor.createModel(pkg.mainPkg.readFile(file.getName()), mode, monaco.Uri.parse(proto));
                if (model) this.editor.setModel(model);

                if (mode == "typescript") {
                    toolbox.innerHTML = '';
                    this.beginLoadToolbox(file);
                }

                // Set the current file
                this.currFile = file;

                this.setValue(file.content)
                this.setDiagnostics(file, this.snapshotState())

                this.fileType = mode == "typescript" ? FileType.TypeScript : ext == "md" ? FileType.Markdown : FileType.Unknown;

                if (this.fileType == FileType.Markdown)
                    this.parent.setSideMarkdown(file.content);

                this.currFile.setForceChangeCallback((from: string, to: string) => {
                    if (from != to) {
                        pxt.debug(`File changed (from ${from}, to ${to}). Reloading editor`)
                        this.loadFileAsync(this.currFile);
                    }
                });

                if (!file.isReadonly()) {
                    model.onDidChangeContent((e: monaco.editor.IModelContentChangedEvent2) => {
                        // Remove any Highlighted lines
                        if (this.highlightDecorations)
                            this.editor.deltaDecorations(this.highlightDecorations, []);

                        // Remove any current error shown, as a change has been made.
                        let viewZones = this.editorViewZones || [];
                        (this.editor as any).changeViewZones(function (changeAccessor: any) {
                            viewZones.forEach((id: any) => {
                                changeAccessor.removeZone(id);
                            });
                        });
                        this.editorViewZones = [];

                        if (!e.isRedoing && !e.isUndoing && !this.editor.getValue()) {
                            this.editor.setValue(" ");
                        }
                        this.updateDiagnostics();
                        this.changeCallback();
                    });
                }

                if (mode == "typescript" && !file.isReadonly()) {
                    toolbox.className = 'monacoToolboxDiv';
                } else {
                    toolbox.className = 'monacoToolboxDiv hide';
                }

                this.resize();
                this.resetFlyout(true);
            }).finally(() => {
                editorArea.removeChild(loading);
            });
    }

    private beginLoadToolbox(file: pkg.File) {
        pxt.vs.syncModels(pkg.mainPkg, this.extraLibs, file.getName(), file.isReadonly())
            .then((definitions) => {
                this.definitions = definitions;
                this.defineEditorTheme();
                this.updateToolbox();
                this.resize();
            });
    }

    unloadFileAsync(): Promise<void> {
        if (this.currFile && this.currFile.getName() == "this/" + pxt.CONFIG_NAME) {
            // Reload the header if a change was made to the config file: pxt.json
            return this.parent.reloadHeaderAsync();
        }
        return Promise.resolve();
    }

    snapshotState() {
        return this.editor && this.editor.getModel() ? this.editor.getModel().getLinesContent() : null;
    }

    setViewState(pos: monaco.IPosition) {
        if (!this.editor) return;
        if (!pos || Object.keys(pos).length === 0) return;
        this.editor.setPosition(pos)
        this.editor.setScrollPosition(pos)
    }

    setDiagnostics(file: pkg.File, snapshot: string[]) {
        Util.assert(this.editor != undefined); // Guarded
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

    private forceDiagnosticsUpdate() {
        if (this.fileType != FileType.TypeScript) return

        let file = this.currFile
        let lines: string[] = this.editor.getModel().getLinesContent();
        let fontSize = this.parent.settings.editorFontSize - 3;
        let lineHeight = this.editor.getConfiguration().lineHeight;
        let borderSize = lineHeight / 10;

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
                    let wrapper = document.createElement('div');
                    wrapper.className = `zone-widget error-view-zone`;
                    let container = document.createElement('div');
                    container.className = `zone-widget-container marker-widget`;
                    container.setAttribute('role', 'tooltip');
                    container.style.setProperty("border", `solid ${borderSize}px rgb(255, 90, 90)`);
                    container.style.setProperty("border", `solid ${borderSize}px rgb(255, 90, 90)`);
                    container.style.setProperty("top", `${lineHeight / 4}`);
                    let domNode = document.createElement('div');
                    domNode.className = `block descriptioncontainer`;
                    domNode.style.setProperty("font-size", fontSize.toString() + "px");
                    domNode.style.setProperty("line-height", lineHeight.toString() + "px");
                    domNode.innerText = ts.flattenDiagnosticMessageText(d.messageText, "\n");
                    container.appendChild(domNode);
                    wrapper.appendChild(container);
                    viewZoneId = changeAccessor.addZone({
                        afterLineNumber: d.line + 1,
                        heightInLines: 1,
                        domNode: wrapper
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
