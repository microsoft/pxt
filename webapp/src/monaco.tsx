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
import * as snippets from "./monacoSnippets"

import Util = pxt.Util;
const lf = Util.lf

const MIN_EDITOR_FONT_SIZE = 10
const MAX_EDITOR_FONT_SIZE = 40

enum FileType {
    Unknown,
    TypeScript,
    Markdown
}

// this is a supertype of pxtc.SymbolInfo (see partitionBlocks)
export interface MonacoBlockDefinition {
    name: string;
    snippet?: string;
    snippetOnly?: boolean;
    attributes: {
        weight?: number;
        advanced?: boolean;
        jsDoc?: string;
        deprecated?: boolean;
        blockHidden?: boolean;
    };
}

export interface BuiltinCategoryDefinition {
    name: string;
    blocks: MonacoBlockDefinition[]
    attributes: pxtc.CommentAttrs;
}

export class Editor extends srceditor.Editor {
    editor: monaco.editor.IStandaloneCodeEditor;
    currFile: pkg.File;
    fileType: FileType = FileType.Unknown;
    extraLibs: pxt.Map<monaco.IDisposable>;
    blockInfo: pxtc.BlocksInfo;
    nsMap: pxt.Map<MonacoBlockDefinition[]>;
    loadingMonaco: boolean;
    showAdvanced: boolean;
    giveFocusOnLoading: boolean = true;

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
                        return pxt.blocks.compileAsync(oldWorkspace, blocksInfo).then((compilationResult) => {
                            const oldJs = compilationResult.source;
                            return compiler.formatAsync(oldJs, 0).then((oldFormatted: any) => {
                                return compiler.formatAsync(this.editor.getValue(), 0).then((newFormatted: any) => {
                                    if (oldFormatted.formatted == newFormatted.formatted) {
                                        pxt.debug('js not changed, skipping decompile');
                                        pxt.tickEvent("typescript.noChanges")
                                        this.parent.setFile(mainPkg.files[blockFile]);
                                        return [oldWorkspace, false]; // return false to indicate we don't want to decompile
                                    } else {
                                        return [oldWorkspace, true];
                                    }
                                });
                            });
                        })
                    }
                    return [oldWorkspace, true];
                }).then((values) => {
                    if (!values) return Promise.resolve();
                    const oldWorkspace = values[0] as B.Workspace;
                    const shouldDecompile = values[1] as boolean;
                    if (!shouldDecompile) return Promise.resolve();
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
                this.parent.saveBlocksToTypeScriptAsync().then((src) => {
                    this.overrideFile(src);
                    this.parent.setFile(bf);
                })
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

    private defineEditorTheme(hc?: boolean) {
        const inverted = pxt.appTarget.appTheme.invertedMonaco;
        const invertedColorluminosityMultipler = 0.6;
        let rules: monaco.editor.ITokenThemeRule[] = [];
        if (!hc) {
            this.getNamespaces().forEach((ns) => {
                const metaData = this.getNamespaceAttrs(ns);
                const blocks = snippets.isBuiltin(ns) ? snippets.getBuiltinCategory(ns).blocks : this.nsMap[ns];

                if (metaData.color && blocks) {
                    let hexcolor = pxt.blocks.convertColour(metaData.color);
                    hexcolor = (inverted ? Blockly.PXTUtils.fadeColour(hexcolor, invertedColorluminosityMultipler, true) : hexcolor).replace('#', '');
                    blocks.forEach((fn) => {
                        rules.push({ token: `identifier.ts ${fn.name}`, foreground: hexcolor });
                    });
                    rules.push({ token: `identifier.ts ${ns}`, foreground: hexcolor });
                }
            })

            rules.push({ token: `identifier.ts if`, foreground: '5B80A5', });
            rules.push({ token: `identifier.ts else`, foreground: '5B80A5', });
            rules.push({ token: `identifier.ts while`, foreground: '5BA55B', });
            rules.push({ token: `identifier.ts for`, foreground: '5BA55B', });
        }

        const colors = pxt.appTarget.appTheme.monacoColors || {};
        monaco.editor.defineTheme('pxtTheme', {
            base: hc ? 'hc-black' : (inverted ? 'vs-dark' : 'vs'), // can also be vs-dark or hc-black
            inherit: true, // can also be false to completely replace the builtin rules
            rules: rules,
            colors: hc ? {} : colors
        });
        monaco.editor.setTheme('pxtTheme');
    }

    setHighContrast(hc: boolean) {
        this.defineEditorTheme(hc);
    }

    beforeCompile() {
        if (this.editor)
            this.editor.getAction('editor.action.formatDocument').run();
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
        let monacoToolbox = document.getElementById('monacoEditorToolbox');

        if (monacoArea && monacoToolbox && this.editor) {
            this.editor.layout({ width: monacoArea.offsetWidth - monacoToolbox.clientWidth, height: monacoArea.offsetHeight });
        }
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
                        forceMoveMarkers: true,
                        isAutoWhitespaceEdit: true
                    }
                ]);
                this.beforeCompile();
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
        this.editor.trigger('keyboard', 'undo', null);
    }

    redo() {
        if (!this.editor) return;
        this.editor.trigger('keyboard', 'redo', null);
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
            this.parent.setSideDoc(`/reference/${namespaceName}/${methodName}`, false);
        } else if (wordInfo) {
            let methodName = wordInfo.word.replace(/([A-Z]+)/g, "-$1");
            this.parent.setSideDoc(`/reference/${methodName}`, false);
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
        group.setAttribute('role', 'tree');
        root.appendChild(group);

        const namespaces = this.getNamespaces().map(ns => [ns, this.getNamespaceAttrs(ns)] as [string, pxtc.CommentAttrs]);
        const hasAdvanced = namespaces.some(([, md]) => md.advanced);


        // Non-advanced categories
        appendCategories(group, namespaces.filter(([, md]) => !(md.advanced)));

        if (hasAdvanced) {
            // Advanced seperator
            group.appendChild(Editor.createTreeSeperator());

            // Advanced toggle
            group.appendChild(this.createCategoryElement("", "#3c3c3c", this.showAdvanced ? 'advancedexpanded' : 'advancedcollapsed',
            false, null, () => {
                this.showAdvanced = !this.showAdvanced;
                this.updateToolbox();
                this.resize();
            }, lf("{id:category}Advanced")))
        }

        if (this.showAdvanced) {
            appendCategories(group, namespaces.filter(([, md]) => md.advanced));
        }

        if ((!hasAdvanced || this.showAdvanced) && pxt.appTarget.cloud && pxt.appTarget.cloud.packages) {
            if (!hasAdvanced) {
                // Add a seperator
                group.appendChild(Editor.createTreeSeperator());
            }

            // Add package button
            group.appendChild(this.createCategoryElement("", "#717171", "addpackage", false, null, () => {
                this.resetFlyout();
                this.parent.addPackage();
            }, lf("{id:category}Add Package")));
        }

        // Inject toolbox icon css
        pxt.blocks.injectToolboxIconCss();

        function appendCategories(group: Element, names: [string, pxtc.CommentAttrs][]) {
            return names
            .sort(([, md1], [, md2]) => {
                // sort by fn weight
                const w2 = (md2 ? md2.weight || 50 : 50);
                const w1 = (md1 ? md1.weight || 50 : 50);
                return w2 - w1;
            }).forEach(([ns, md]) => {

                let el: Element;

                if (!snippets.isBuiltin(ns)) {
                    const blocks = monacoEditor.nsMap[ns].filter(block => !(block.attributes.blockHidden || block.attributes.deprecated));
                    let categoryName = md.block ? md.block : undefined
                    el = monacoEditor.createCategoryElement(ns, md.color, md.icon, true, blocks, undefined, categoryName);
                }
                else {
                    el = monacoEditor.createCategoryElement("", md.color, md.icon, false, snippets.getBuiltinCategory(ns).blocks, null, Util.rlf(`{id:category}${ns}`));
                }
                group.appendChild(el);
            });
        }
    }

    getNamespaceAttrs(ns: string) {
        const builtin = snippets.getBuiltinCategory(ns);
        if (builtin) {
            return builtin.attributes;
        }

        const info = this.blockInfo.apis.byQName[ns];
        if (info && info.attributes.color) {
            return info.attributes;
        }

        return undefined;
    }

    getNamespaces() {
        const namespaces = Object.keys(this.nsMap).filter(ns => !snippets.isBuiltin(ns) && !!this.getNamespaceAttrs(ns));

        let config = pxt.appTarget.runtime || {};
        if (config.loopsBlocks) namespaces.push(snippets.loops.name);
        if (config.logicBlocks) namespaces.push(snippets.logic.name);
        if (config.variablesBlocks) namespaces.push(snippets.variables.name);
        if (config.mathBlocks) namespaces.push(snippets.maths.name);
        if (config.functionBlocks) namespaces.push(snippets.functions.name);
        if (config.textBlocks) namespaces.push(snippets.text.name);
        if (config.listsBlocks) namespaces.push(snippets.arrays.name);

        return namespaces;
    }

    static createTreeSeperator() {
        const treeitem = Editor.createTreeItem();
        const treeSeperator = document.createElement("div");
        treeSeperator.setAttribute("class", "blocklyTreeSeparator");
        treeitem.appendChild(treeSeperator);
        return treeitem;
    }

    static createTreeItem() {
        const treeitem = document.createElement('div');
        treeitem.setAttribute('role', 'treeitem');
        return treeitem;
    }

    private createCategoryElement(
        ns: string,
        metaColor: string,
        icon: string,
        injectIconClass: boolean = true,
        fns?: MonacoBlockDefinition[],
        onClick?: () => void,
        category?: string) {
        // Filter the toolbox
        let filters = this.parent.state.filters;
        const categoryState = filters ? (filters.namespaces && filters.namespaces[ns] != undefined ? filters.namespaces[ns] : filters.defaultState) : undefined;
        let hasChild = false;
        if (filters) {
            Object.keys(fns).forEach((fn) => {
                const fnState = filters.fns && filters.fns[fn] != undefined ? filters.fns[fn] : (categoryState != undefined ? categoryState : filters.defaultState);
                if (fnState == pxt.editor.FilterState.Disabled || fnState == pxt.editor.FilterState.Visible) hasChild = true;
            })
        } else {
            hasChild = true;
        }
        if (!hasChild) return;

        let appTheme = pxt.appTarget.appTheme;
        let monacoEditor = this;
        // Create a tree item
        let treeitem = Editor.createTreeItem();
        let treerow = document.createElement('div');
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
                fns.sort((f1, f2) => {
                    // sort by fn weight
                    const w2 = (f2.attributes.weight || 50) + (f2.attributes.advanced ? 0 : 1000);
                    const w1 = (f1.attributes.weight || 50 ) + (f1.attributes.advanced ? 0 : 1000);
                    return w2 - w1;
                })
                .forEach(fn => {
                    let monacoBlockDisabled = false;
                    const fnState = filters ? (filters.fns && filters.fns[fn.name] != undefined ? filters.fns[fn.name] : (categoryState != undefined ? categoryState : filters.defaultState)) : undefined;
                    monacoBlockDisabled = fnState == pxt.editor.FilterState.Disabled;
                    if (fnState == pxt.editor.FilterState.Hidden) return;

                    let monacoBlockArea = document.createElement('div');
                    let monacoBlock = document.createElement('div');
                    monacoBlock.className = 'monacoDraggableBlock';

                    monacoBlock.style.fontSize = `${monacoEditor.parent.settings.editorFontSize}px`;
                    monacoBlock.style.backgroundColor = monacoBlockDisabled ?
                            `${Blockly.PXTUtils.fadeColour(color || '#ddd', 0.8, false)}` :
                            `${color}`;
                    monacoBlock.style.borderColor = `${color}`;

                    const snippet = fn.snippet;
                    const comment = fn.attributes.jsDoc;

                    let snippetPrefix = ns;

                    const element = fn as pxtc.SymbolInfo;
                    if (element.attributes.block) {
                        if (element.attributes.defaultInstance) {
                            snippetPrefix = element.attributes.defaultInstance;
                        }
                        else {
                            const nsInfo = this.blockInfo.apis.byQName[element.namespace];
                            if (nsInfo.kind === pxtc.SymbolKind.Class) {
                                return;
                            }
                            else if (nsInfo.attributes.fixedInstances) {
                                const instances = Util.values(this.blockInfo.apis.byQName).filter(value =>
                                    value.kind === pxtc.SymbolKind.Variable &&
                                    value.attributes.fixedInstance &&
                                    value.retType === nsInfo.name)
                                    .sort((v1, v2) => v1.name.localeCompare(v2.name));
                                if (instances.length) {
                                    snippetPrefix = `${instances[0].namespace}.${instances[0].name}`
                                }
                            }
                        }
                    }

                    let sigToken = document.createElement('span');
                    if (!fn.snippetOnly) {
                        sigToken.className = 'sig';
                    }
                    // completion is a bit busted but looks better
                    sigToken.innerText = snippet
                        .replace(/^[^(]*\(/, '(')
                        .replace(/^\s*\{\{\}\}\n/gm, '')
                        .replace(/\{\n\}/g, '{}')
                        .replace(/(?:\{\{)|(?:\}\})/g, '');

                    monacoBlock.title = comment;

                    if (!monacoBlockDisabled) {
                        monacoBlock.draggable = true;
                        monacoBlock.onclick = (ev2: MouseEvent) => {
                            pxt.tickEvent("monaco.toolbox.itemclick");

                            monacoEditor.resetFlyout(true);

                            let model = monacoEditor.editor.getModel();
                            let currPos = monacoEditor.editor.getPosition();
                            let cursor = model.getOffsetAt(currPos)
                            let insertText = snippetPrefix ? `${snippetPrefix}.${snippet}` : snippet;
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
                            monacoEditor.beforeCompile();
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

                            let insertText = snippetPrefix ? `${snippetPrefix}.${snippet}` : snippet;
                            ev2.dataTransfer.setData('text', insertText); // IE11 only supports text
                        }
                        monacoBlock.ondragend = (ev2: DragEvent) => {
                            monacoFlyout.style.transform = "none";
                            monacoEditor.resetFlyout(true);
                        }
                    }

                    if (!fn.snippetOnly) {
                        let methodToken = document.createElement('span');
                        methodToken.innerText = fn.name;
                        monacoBlock.appendChild(methodToken);
                    }
                    monacoBlock.appendChild(sigToken);
                    monacoBlockArea.appendChild(monacoBlock);

                    monacoFlyout.appendChild(monacoBlockArea);
                })
            }
        };
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
        label.innerText = category ? category : `${Util.capitalize(ns)}`;

        return treeitem;
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

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
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
                    this.beginLoadToolbox(file, hc);
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
                    model.onDidChangeContent((e: monaco.editor.IModelContentChangedEvent) => {
                        // Remove any Highlighted lines
                        this.clearHighlightedStatements();

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

                if (this.giveFocusOnLoading) {
                    this.editor.focus();
                }

                this.giveFocusOnLoading = true;
            }).finally(() => {
                editorArea.removeChild(loading);
            });
    }

    private beginLoadToolbox(file: pkg.File, hc?: boolean) {
        compiler.getBlocksAsync().then(bi => {
            this.blockInfo = bi
            this.nsMap = this.partitionBlocks();
            pxt.vs.syncModels(pkg.mainPkg, this.extraLibs, file.getName(), file.isReadonly())
            this.defineEditorTheme(hc);
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
        let monacoErrors: monaco.editor.IMarkerData[] = []

        if (file && file.diagnostics) {
            let model = monaco.editor.getModel(monaco.Uri.parse(`pkg:${file.getName()}`))
            for (let d of file.diagnostics) {
                let endPos = model.getPositionAt(d.start + d.length);
                if (typeof d.messageText === 'string') {
                    addErrorMessage(d.messageText as string);
                } else {
                    let curr = d.messageText as ts.DiagnosticMessageChain;
                    while (curr.next != undefined) {
                        addErrorMessage(curr.messageText);
                        curr = curr.next;
                    }
                }
                function addErrorMessage(message: string) {
                    monacoErrors.push({
                        severity: monaco.Severity.Error,
                        message: message,
                        startLineNumber: d.line,
                        startColumn: d.column,
                        endLineNumber: d.endLine || endPos.lineNumber,
                        endColumn: d.endColumn || endPos.column
                    })
                }
            }
            monaco.editor.setModelMarkers(model, 'typescript', monacoErrors);
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

    clearHighlightedStatements() {
        if (this.highlightDecorations)
            this.editor.deltaDecorations(this.highlightDecorations, []);
    }

    private partitionBlocks() {
        const res: pxt.Map<MonacoBlockDefinition[]> = {};

        this.blockInfo.blocks.forEach(fn => {
            const ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
            if (!res[ns]) {
                res[ns] = [];
            }

            res[ns].push(fn);
        });

        return res;
    }
}
