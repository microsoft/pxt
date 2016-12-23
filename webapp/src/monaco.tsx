/// <reference path="../../built/monaco.d.ts" />
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
    extraLibs: pxt.Map<monaco.IDisposable>;
    definitions: pxt.Map<pxt.vs.NameDefiniton>;

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
            size: "medium",
            hideCancel: !bf
        }).then(b => {
            // discard
            if (!b) {
                pxt.tickEvent("typescript.keepText");
            } else {
                pxt.tickEvent("typescript.discardText");
                this.parent.setFile(bf);
            }
        })
    }

    decompileAsync(blockFile: string): Promise<boolean> {
        return compiler.decompileAsync(blockFile)
            .then(resp => resp.success);
    }

    undo() {
        this.editor.trigger('keyboard', monaco.editor.Handler.Undo, null);
    }

    display() {
        return (
            <div className='full-abs' id="monacoEditorArea">
                <div id='monacoEditorToolbox' className='injectionDiv' />
                <div id='monacoEditorInner' />
            </div>
        )
    }

    initEditorCss() {
        let head = document.head || document.getElementsByTagName('head')[0],
            style = (document.getElementById('monacoeditorStyles') as HTMLStyleElement) || document.createElement('style');
        style.id = "monacoeditorStyles";
        style.type = 'text/css';

        const inverted = pxt.appTarget.appTheme.invertedMonaco;
        const invertedColorluminosityMultipler = 0.6;
        let cssContent = "";
        let fnDict = this.definitions;
        Object.keys(fnDict).forEach((ns) => {
            let element = fnDict[ns];
            if (element.metaData && element.metaData.color && element.fns) {
                const hexcolor = pxt.blocks.convertColour(element.metaData.color);
                let cssTag = `.token.ts.identifier.${ns}, .token.ts.identifier.${Object.keys(element.fns).join(', .token.ts.identifier.')}`;
                cssContent += `${cssTag} { color: ${inverted
                    ? Editor.lightenColor(hexcolor, invertedColorluminosityMultipler)
                    : hexcolor}; }`;
            }
        })
        if (style.sheet) {
            style.textContent = cssContent;
        } else {
            style.appendChild(document.createTextNode(cssContent));
        }
        head.appendChild(style);
    }

    static lightenColor(hex: string, luminosity: number): string {
        // #ABC => ABC
        hex = hex.replace(/[^0-9a-f]/gi, '');

        // ABC => AABBCC
        if (hex.length < 6)
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

        // tweak
        let rgb = "#";
        for (let i = 0; i < 3; i++) {
            let c = parseInt(hex.substr(i * 2, 2), 16);
            c = Math.round(Math.min(Math.max(0, c + (c * luminosity)), 255));
            let cStr = c.toString(16);
            rgb += ("00" + cStr).substr(cStr.length);
        }

        return rgb;
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
        let editorArea = document.getElementById("monacoEditorArea");
        let editorElement = document.getElementById("monacoEditorInner");

        this.editor = pxt.vs.initMonacoAsync(editorElement);
        if (!this.editor) {
            // Todo: create a text area if we weren't able to load the monaco editor correctly.
            return;
        };

        this.editor.updateOptions({ fontSize: this.parent.settings.editorFontSize });

        this.editor.getActions().filter(action => action.id == "editor.action.format")[0]
            .run = () => Promise.resolve(this.beforeCompile());

        this.editor.addAction({
            id: "save",
            label: lf("Save"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
            keybindingContext: "!editorReadonly",
            contextMenuGroupId: "0_pxtnavigation",
            contextMenuOrder: 0.2,
            run: () => Promise.resolve(this.parent.typecheckNow())
        });

        this.editor.addAction({
            id: "runSimulator",
            label: lf("Run Simulator"),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            keybindingContext: "!editorReadonly",
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
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSyntaxValidation: true });
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
            } else {
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSyntaxValidation: false });
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false });
            }
        })

        if (pxt.appTarget.appTheme.hasReferenceDocs) {
            let referenceContextKey = this.editor.createContextKey("editorHasReference", false)
            this.editor.addAction({
                id: "reference",
                label: lf("Help"),
                keybindingContext: "!editorReadonly && editorHasReference",
                contextMenuGroupId: "navigation",
                contextMenuOrder: 0.1,
                run: () => Promise.resolve(this.loadReference())
            });

            this.editor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
                let word = this.editor.getModel().getWordAtPosition(e.position);
                if (word) {
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

        this.editor.onDidFocusEditorText(() => {
            this.resetFlyout(true);
        })

        this.editor.onDidChangeModelContent((e: monaco.editor.IModelContentChangedEvent2) => {
            if (this.currFile.isReadonly()) return;

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

        this.editorViewZones = [];

        this.setupToolbox(editorArea);

        this.isReady = true
    }

    resize(e?: Event) {
        let monacoArea = document.getElementById('monacoEditorArea');
        let monacoToolbox = document.getElementById('monacoEditorToolbox')
        this.editor.layout({ width: monacoArea.offsetWidth - monacoToolbox.offsetWidth - 1, height: monacoArea.offsetHeight });
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

    loadReference() {
        let currentPosition = this.editor.getPosition();
        let wordInfo = this.editor.getModel().getWordAtPosition(currentPosition);
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

    setupToolbox(editorElement: HTMLElement) {
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

    private selectedCategoryItem: HTMLElement;
    private selectedCategoryRow: HTMLElement;
    private selectedCategoryColor: string;

    resetFlyout(clear?: boolean) {
        // Hide the flyout
        let flyout = document.getElementById('monacoFlyoutWidget');
        flyout.innerHTML = '';
        flyout.style.display = 'none';

        // Hide the currnet toolbox category
        if (this.selectedCategoryItem) {
            this.selectedCategoryItem.style.background = 'none';
            this.selectedCategoryRow.style.color = `${this.selectedCategoryColor}`;
            this.selectedCategoryRow.className = 'blocklyTreeRow';
        }

        if (clear) {
            this.selectedCategoryItem = null;
            this.selectedCategoryRow = null;
        }
    }

    updateToolbox() {
        let appTheme = pxt.appTarget.appTheme;
        if (!appTheme.monacoToolbox) return;
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
            // Create a tree item
            let treeitem = document.createElement('div');
            let treerow = document.createElement('div');
            treeitem.setAttribute('role', 'treeitem');
            let fnElement = fnDef[ns];
            let color = monacoEditor.convertColour(metaElement.metaData.color);
            treeitem.onclick = (ev: MouseEvent) => {
                pxt.tickEvent("monaco.toolbox.click");

                let monacoFlyout = document.getElementById('monacoFlyoutWidget');
                monacoEditor.resetFlyout(false);

                // Hide the toolbox if the current category is clicked twice
                if (monacoEditor.selectedCategoryItem == treeitem) {
                    monacoEditor.selectedCategoryItem = null;
                    monacoFlyout.style.display = 'none';
                    treerow.className = 'blocklyTreeRow';
                    return;
                } else {
                    // Selected category
                    treeitem.style.background = `${color}`;
                    treerow.style.color = '#fff';
                    treerow.className += ' blocklyTreeSelected';
                    monacoEditor.selectedCategoryItem = treeitem;
                    monacoEditor.selectedCategoryRow = treerow;
                    if (appTheme.invertedToolbox) {
                        // Inverted toolbox
                        monacoEditor.selectedCategoryColor = '#fff';
                    } else {
                        monacoEditor.selectedCategoryColor = color;
                    }
                }

                monacoFlyout.style.left = `${monacoEditor.editor.getLayoutInfo().lineNumbersLeft}px`;
                monacoFlyout.style.height = `${monacoEditor.editor.getLayoutInfo().contentHeight}px`;
                monacoFlyout.style.display = 'block';
                monacoFlyout.className = 'monacoFlyout';

                Object.keys(fnElement.fns).sort((f1, f2) => {
                    // sort by fn weight
                    const fn1 = fnElement.fns[f1];
                    const fn2 = fnElement.fns[f2];
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

                    const elem = fnElement.fns[fn];
                    const sig = elem.sig;
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
                        .replace(/\{\n\}/g, '{}');
                    const docToken = document.createElement('span'); docToken.className = 'docs';
                    docToken.innerText = comment.split('.')[0];

                    monacoBlock.title = comment;

                    monacoBlock.onclick = (ev2: MouseEvent) => {
                        pxt.tickEvent("monaco.toolbox.itemclick");

                        monacoEditor.resetFlyout(true);

                        let model = monacoEditor.editor.getModel();
                        let currPos = monacoEditor.editor.getPosition();
                        let cursor = model.getOffsetAt(currPos)
                        let insertText = `${ns}.${snippet}\n`;

                        if (insertText.indexOf('{{}}') > -1) {
                            cursor += (insertText.indexOf('{{}}'));
                            insertText = insertText.replace('{{}}', '');
                        } else
                            cursor += (insertText.length);
                        monacoEditor.editor.executeEdits("", [
                            {
                                identifier: { major: 0, minor: 0 },
                                range: new monaco.Range(currPos.lineNumber, currPos.column, currPos.lineNumber, currPos.column),
                                text: insertText,
                                forceMoveMarkers: false
                            }
                        ]);
                        let endPos = model.getPositionAt(cursor);
                        monacoEditor.editor.setPosition(endPos);
                        monacoEditor.editor.focus();
                        //monacoEditor.editor.setSelection(new monaco.Range(currPos.lineNumber, currPos.column, endPos.lineNumber, endPos.column));
                    };

                    monacoBlock.appendChild(methodToken);
                    monacoBlock.appendChild(sigToken);
                    monacoBlock.appendChild(docToken);
                    monacoFlyout.appendChild(monacoBlock);
                })
            };
            group.appendChild(treeitem);
            treerow.className = 'blocklyTreeRow';
            treeitem.appendChild(treerow);
            let icon = document.createElement('span');
            let iconNone = document.createElement('span');
            let label = document.createElement('span');

            icon.className = 'blocklyTreeIcon';
            icon.setAttribute('role', 'presentation');
            iconNone.className = 'blocklyTreeIcon blocklyTreeIconNone';
            iconNone.setAttribute('role', 'presentation');
            iconNone.style.display = 'inline-block';

            label.className = 'blocklyTreeLabel';
            treerow.appendChild(icon);
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
            } else {
                // Standard toolbox
                treerow.style.borderLeft = `8px solid ${color}`;
            }
            treerow.style.paddingLeft = '0px';
            label.innerText = `${Util.capitalize(ns)}`;
        })

        // Add the toolbox buttons
        pxt.blocks.initToolboxButtons(toolbox, 'monacoToolboxButtons',
            (pxt.appTarget.cloud.packages && !this.parent.getSandboxMode() ?
                (() => {
                    this.parent.addPackage();
                }) : null),
            (!this.parent.getSandboxMode() ?
                (() => {
                    this.undo();
                }) : null)
        );
    }

    convertColour(colour: string) {
        let hue = parseFloat(colour);
        if (!isNaN(hue)) {
            return Blockly.hueToRgb(hue);
        }
        return colour;
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

    private setValue(v: string) {
        this.editor.setValue(v);
    }

    overrideFile(content: string) {
        this.editor.setValue(content);
    }

    loadFile(file: pkg.File) {
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
        let mode = "text"
        if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]

        this.editor.updateOptions({ readOnly: file.isReadonly() });

        this.currFile = file;
        let proto = "pkg:" + this.currFile.getName();
        let model = monaco.editor.getModels().filter((model) => model.uri.toString() == proto)[0];
        if (!model) model = monaco.editor.createModel(pkg.mainPkg.readFile(this.currFile.getName()), mode, monaco.Uri.parse(proto));
        if (model) this.editor.setModel(model);

        if (mode == "typescript" && !file.isReadonly()) {
            pxt.vs.syncModels(pkg.mainPkg, this.extraLibs, file.getName(), file.isReadonly())
            .then((definitions) => {
                this.definitions = definitions;
                this.initEditorCss();
                this.updateToolbox();
                this.resize();
            });
        }

        this.setValue(file.content)
        this.setDiagnostics(file, this.snapshotState())

        this.fileType = mode == "typescript" ? FileType.TypeScript : ext == "md" ? FileType.Markdown : FileType.Unknown;

        if (this.fileType == FileType.Markdown)
            this.parent.setSideMarkdown(file.content);

        this.currFile.setForceChangeCallback((from: string, to: string) => {
            if (from != to) {
                pxt.debug(`File changed (from ${from}, to ${to}). Reloading editor`)
                this.loadFile(this.currFile);
            }
        });

        if (mode == "typescript" && !file.isReadonly()) {
            toolbox.className = 'monacoToolboxDiv';
        } else {
            toolbox.className = 'monacoToolboxDiv hide';
        }

        this.resize();
        this.resetFlyout(true);
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
