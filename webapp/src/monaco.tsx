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
        group?: string;
    };
    noNamespace?: boolean;
    retType?: string;
}

export interface BuiltinCategoryDefinition {
    name: string;
    blocks: MonacoBlockDefinition[];
    nameid: string;
    attributes: pxtc.CommentAttrs;
    removed?: boolean;
    custom?: boolean; // Only add blocks defined in .blocks and don't query nsMap for more
}

export class Editor extends srceditor.Editor {
    editor: monaco.editor.IStandaloneCodeEditor;
    currFile: pkg.File;
    fileType: FileType = FileType.Unknown;
    extraLibs: pxt.Map<monaco.IDisposable>;
    blockInfo: pxtc.BlocksInfo;
    public nsMap: pxt.Map<MonacoBlockDefinition[]>;
    loadingMonaco: boolean;
    showAdvanced: boolean;
    giveFocusOnLoading: boolean = false;

    private monacoToolbox: MonacoToolbox;

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

            const failedAsync = (file: string, programTooLarge = false) => {
                core.cancelAsyncLoading("switchtoblocks");
                this.forceDiagnosticsUpdate();
                return this.showConversionFailedDialog(file, programTooLarge);
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
                                let tooLarge = false;
                                resp.diagnostics.forEach(d => tooLarge = (tooLarge || d.code === 9266 /* error code when script is too large */));
                                return failedAsync(blockFile, tooLarge);
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

        core.showLoadingAsync("switchtoblocks", lf("switching to blocks..."), promise).done();
    }

    public showConversionFailedDialog(blockFile: string, programTooLarge: boolean): Promise<void> {
        let bf = pkg.mainEditorPkg().files[blockFile];
        if (programTooLarge) {
            pxt.tickEvent("typescript.programTooLarge");
        }
        return core.confirmAsync({
            header: programTooLarge ? lf("Program too large") : lf("Oops, there is a problem converting your code."),
            body: programTooLarge ?
                lf("Your program is too large to convert into blocks. You can keep working in JavaScript or discard your changes and go back to the previous Blocks version.") :
                lf("We are unable to convert your JavaScript code back to blocks. You can keep working in JavaScript or discard your changes and go back to the previous Blocks version."),
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

    public decompileAsync(blockFile: string): Promise<pxtc.CompileResult> {
        return compiler.decompileAsync(blockFile)
    }

    display() {
        return (
            <div id="monacoEditorArea" className="full-abs">
                <MonacoToolbox ref={e => this.monacoToolbox = e} parent={this} />
                <div id='monacoEditorInner' />
            </div>
        )
    }

    addPackage() {
        pxt.tickEvent("monaco.addpackage");
        this.hideFlyout();
        this.parent.addPackage();
    }

    private defineEditorTheme(hc?: boolean, withNamespaces?: boolean) {
        const inverted = pxt.appTarget.appTheme.invertedMonaco;
        const invertedColorluminosityMultipler = 0.6;
        let rules: monaco.editor.ITokenThemeRule[] = [];
        if (!hc && withNamespaces) {
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
        let monacoToolbox = this.monacoToolbox && this.monacoToolbox.getElement();

        if (monacoArea && this.editor) {
            const toolboxWidth = monacoToolbox && monacoToolbox.offsetWidth || 0;
            this.editor.layout({ width: monacoArea.offsetWidth - toolboxWidth, height: monacoArea.offsetHeight });

            const rgba = (this.editor as any)._themeService._theme.colors['editor.background'].rgba;
            this.parent.updateEditorLogo(toolboxWidth, `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`);

            let toolboxHeight = this.editor ? this.editor.getLayoutInfo().contentHeight : 0;
            if (this.monacoToolbox) this.monacoToolbox.setToolboxHeight(toolboxHeight);
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

            // Accessibility shortcut, add a way to quickly jump to the monaco toolbox
            const arrow = Util.isUserLanguageRtl() ? monaco.KeyCode.RightArrow : monaco.KeyCode.LeftArrow;
            this.editor.addAction({
                id: "jumptoolbox",
                label: lf("Jump to Toolbox"),
                keybindings: [monaco.KeyMod.CtrlCmd | arrow],
                keybindingContext: "!editorReadonly",
                precondition: "!editorReadonly",
                run: () => Promise.resolve(this.moveFocusToToolbox())
            });

            this.editor.onDidLayoutChange((e: monaco.editor.EditorLayoutInfo) => {
                // Update editor font size in settings after a ctrl+scroll zoom
                let currentFont = this.editor.getConfiguration().fontInfo.fontSize;
                if (this.parent.settings.editorFontSize != currentFont) {
                    this.parent.settings.editorFontSize = currentFont;
                    this.forceDiagnosticsUpdate();
                }
                // Update widgets
                const toolbox = document.getElementById('monacoEditorToolbox');
                if (toolbox) toolbox.style.height = `${this.editor.getLayoutInfo().contentHeight}px`;
                const flyout = document.getElementById('monacoFlyoutWidget');
                if (flyout) flyout.style.height = `${this.editor.getLayoutInfo().contentHeight}px`;
            })

            const monacoEditorInner = document.getElementById('monacoEditorInner');
            monacoEditorInner.ondragenter = ((ev: DragEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
            });
            monacoEditorInner.ondragover = ((ev: DragEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                this.dragCurrentPos = {
                    x: ev.clientX,
                    y: ev.clientY
                }
                this.onDragBlockThrottled(ev);
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
                this.hideFlyout();
            })

            this.editorViewZones = [];

            this.setupToolbox(editorArea);
        })
    }

    protected dragCurrentPos = { x: 0, y: 0 };
    protected onDragBlockThrottled = Util.throttle(() => {
        const {x, y} = this.dragCurrentPos;
        let mouseTarget = this.editor.getTargetAtClientPoint(x, y);
        let position = mouseTarget.position;
        if (position && this.editor.getPosition() != position)
            this.editor.setPosition(position);
        this.editor.focus();
    }, 200);

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
                    this.domNode.textContent = 'Flyout';
                }
                return this.domNode;
            },
            getPosition: function (): monaco.editor.IOverlayWidgetPosition {
                return null;
            }
        };
        this.editor.addOverlayWidget(flyoutWidget);
    }

    public closeFlyout() {
        if (!this.editor) return;
        this.hideFlyout();
    }

    private hideFlyout() {
        // Hide the flyout
        let flyout = document.getElementById('monacoFlyoutWidget');
        flyout.innerHTML = '';
        flyout.style.display = 'none';

        // Hide the current toolbox category
        this.monacoToolbox.clearSelection();

        // Clear editor floats
        this.parent.setState({ hideEditorFloats: false });
    }

    public showFlyout(ns: string,
        color: string, icon: string,
        category: string,
        groups?: string[],
        labelLineWidth?: string) {
        if (!this.editor) return;
        let monacoFlyout = document.getElementById('monacoFlyoutWidget');
        const fontSize = this.parent.settings.editorFontSize;

        monacoFlyout.style.left = `${this.editor.getLayoutInfo().lineNumbersLeft}px`;
        monacoFlyout.style.height = `${this.editor.getLayoutInfo().contentHeight}px`;
        monacoFlyout.style.display = 'block';
        monacoFlyout.className = 'monacoFlyout';
        monacoFlyout.style.transform = 'none';
        monacoFlyout.innerHTML = '';

        let fns: MonacoBlockDefinition[];

        if (!snippets.isBuiltin(ns)) {
            fns = this.nsMap[ns].filter(block => !(block.attributes.blockHidden || block.attributes.deprecated));
        }
        else {
            let cat = snippets.getBuiltinCategory(ns);
            let blocks = cat.blocks || [];
            let categoryName = cat.name;
            blocks.forEach(b => { b.noNamespace = true })
            if (!cat.custom && this.nsMap[ns.toLowerCase()]) blocks = blocks.concat(this.nsMap[ns.toLowerCase()].filter(block => !(block.attributes.blockHidden || block.attributes.deprecated)));
            if (!blocks || !blocks.length) return;
            fns = blocks;
        }

        // Create a flyout and add the category methods in there

        // Add the heading label
        if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
            let monacoHeadingLabel = document.createElement('div');
            monacoHeadingLabel.className = 'monacoFlyoutLabel monacoFlyoutHeading';
            let monacoHeadingIcon = document.createElement('span');
            let iconClass = `blocklyTreeIcon${icon ? (ns || icon).toLowerCase() : 'Default'}`.replace(/\s/g, '');
            monacoHeadingIcon.className = `monacoFlyoutHeadingIcon blocklyTreeIcon ${iconClass}`;
            monacoHeadingIcon.setAttribute('role', 'presentation');
            monacoHeadingIcon.style.display = 'inline-block';
            monacoHeadingIcon.style.color = `${color}`;

            let monacoHeadingText = document.createElement('div');
            monacoHeadingText.className = `monacoFlyoutHeadingText`;
            monacoHeadingText.style.display = 'inline-block';
            monacoHeadingText.style.fontSize = `${fontSize + 5}px`;
            monacoHeadingText.textContent = category ? category : `${Util.capitalize(ns)}`;

            monacoHeadingLabel.appendChild(monacoHeadingIcon);
            monacoHeadingLabel.appendChild(monacoHeadingText);
            monacoFlyout.appendChild(monacoHeadingLabel);
        }

        // Organize and rearrange methods into groups
        let blockGroups: pxt.Map<MonacoBlockDefinition[]> = {}
        let sortedGroups: string[] = [];
        if (groups) sortedGroups = groups;

        // Organize the blocks into the different groups
        for (let bi = 0; bi < fns.length; ++bi) {
            let blk = fns[bi];
            let group = blk.attributes.group || 'other';
            if (!blockGroups[group]) blockGroups[group] = [];
            blockGroups[group].push(blk);
        }

        // Add any missing groups to the sorted groups list
        Object.keys(blockGroups).sort().forEach(group => {
            if (sortedGroups.indexOf(group) == -1) {
                sortedGroups.push(group);
            }
        })

        // Add labels and insert the blocks into the flyout
        for (let bg = 0; bg < sortedGroups.length; ++bg) {
            let group = sortedGroups[bg];
            // Add the group label
            if (group != 'other') {
                let groupLabel = document.createElement('div');
                groupLabel.className = 'monacoFlyoutLabel blocklyFlyoutGroup';
                let groupLabelText = document.createElement('div');
                groupLabelText.className = 'monacoFlyoutLabelText';
                groupLabelText.style.display = 'inline-block';
                groupLabelText.style.fontSize = `${fontSize}px`;
                groupLabelText.textContent = pxt.Util.rlf(`{id:group}${group}`);
                groupLabel.appendChild(groupLabelText);
                monacoFlyout.appendChild(groupLabel);

                let groupLabelLine = document.createElement('hr');
                groupLabelLine.className = 'monacoFlyoutLabelLine';
                groupLabelLine.align = 'left';
                groupLabelLine.style.width = `${Math.min(parseInt(labelLineWidth) || groupLabelText.offsetWidth, 350)}px`;
                groupLabel.appendChild(groupLabelLine);
            }

            // Add the blocks in that group
            if (blockGroups[group]) {
                const filters = this.parent.state.editorState ? this.parent.state.editorState.filters : undefined;
                const categoryState = filters ? (filters.namespaces && filters.namespaces[ns] != undefined ? filters.namespaces[ns] : filters.defaultState) : undefined;
                this.createMonacoBlocks(this, monacoFlyout, ns, blockGroups[group], color, filters, categoryState);
            }
        }

        // Hide editor floats
        this.parent.setState({ hideEditorFloats: true });
    }

    public moveFocusToToolbox() {
        // Set focus in toolbox
        if (this.monacoToolbox) this.monacoToolbox.focus();
    }

    public moveFocusToFlyout() {
        // Set focus in the flyout
        const monacoFlyout = document.getElementById('monacoFlyoutWidget');
        const topBlock = monacoFlyout.getElementsByClassName("monacoDraggableBlock")[0] as HTMLElement;
        if (topBlock) topBlock.focus();
    }

    private updateToolbox() {
        let appTheme = pxt.appTarget.appTheme;
        if (!appTheme.monacoToolbox || pxt.shell.isReadOnly()) return;
        // Move the monaco editor to make room for the toolbox div
        this.editor.getLayoutInfo().glyphMarginLeft = 200;
        this.editor.layout();

        const namespaces = this.getNamespaces().map(ns => [ns, this.getNamespaceAttrs(ns)] as [string, pxtc.CommentAttrs]);
        this.monacoToolbox.setState({
            namespaces: namespaces,
            showAdvanced: this.showAdvanced
        })
    }

    getNamespaceAttrs(ns: string) {
        const builtin = snippets.getBuiltinCategory(ns);
        if (builtin) {
            builtin.attributes.color = pxt.blocks.getNamespaceColor(builtin.nameid);
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
        if (config.loopsBlocks && !snippets.loops.removed) namespaces.push(snippets.loops.nameid);
        if (config.logicBlocks && !snippets.logic.removed) namespaces.push(snippets.logic.nameid);
        if (config.variablesBlocks && !snippets.variables.removed) namespaces.push(snippets.variables.nameid);
        if (config.mathBlocks && !snippets.maths.removed) namespaces.push(snippets.maths.nameid);
        if (config.functionBlocks && !snippets.functions.removed) namespaces.push(snippets.functions.nameid);
        if (config.textBlocks && !snippets.text.removed) namespaces.push(snippets.text.nameid);
        if (config.listsBlocks && !snippets.arrays.removed) namespaces.push(snippets.arrays.nameid);

        return namespaces;
    }

    private createMonacoBlocks(
        monacoEditor: Editor,
        monacoFlyout: HTMLElement,
        ns: string,
        fns: MonacoBlockDefinition[],
        color: string,
        filters: pxt.editor.ProjectFilters,
        categoryState: pxt.editor.FilterState
    ) {
        let uniqueBlockId = 0; // Used for hex blocks
        // Render the method blocks
        const monacoBlocks = fns.sort((f1, f2) => {
            // sort by fn weight
            const w2 = (f2.attributes.weight || 50) + (f2.attributes.advanced ? 0 : 1000);
            const w1 = (f1.attributes.weight || 50) + (f1.attributes.advanced ? 0 : 1000);
            return w2 - w1;
        }).map(fn => {
            let monacoBlockDisabled = false;
            const fnState = filters ? (filters.fns && filters.fns[fn.name] != undefined ? filters.fns[fn.name] : (categoryState != undefined ? categoryState : filters.defaultState)) : undefined;
            monacoBlockDisabled = fnState == pxt.editor.FilterState.Disabled;
            if (fnState == pxt.editor.FilterState.Hidden) return;

            let monacoBlockArea = document.createElement('div');
            monacoBlockArea.className = `monacoBlock ${monacoBlockDisabled ? 'monacoDisabledBlock' : ''}`;
            monacoFlyout.appendChild(monacoBlockArea);
            let monacoBlock = document.createElement('div');
            monacoBlock.className = 'monacoDraggableBlock';
            monacoBlock.tabIndex = 0;
            monacoBlockArea.appendChild(monacoBlock);

            const snippet = fn.snippet;
            const comment = fn.attributes.jsDoc;

            let snippetPrefix = fn.noNamespace ? "" : ns;
            let isInstance = false;

            const element = fn as pxtc.SymbolInfo;
            if (element.attributes.block) {
                if (element.attributes.defaultInstance) {
                    snippetPrefix = element.attributes.defaultInstance;
                }
                else if (element.kind == pxtc.SymbolKind.Method || element.kind == pxtc.SymbolKind.Property) {
                    const params = pxt.blocks.parameterNames(element);
                    snippetPrefix = params.attrNames["this"].name;
                    isInstance = true;
                }
                else if (element.namespace) { // some blocks don't have a namespace such as parseInt
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
            sigToken.textContent = snippet
                .replace(/^[^(]*\(/, '(')
                .replace(/^\s*\{\{\}\}\n/gm, '')
                .replace(/\{\n\}/g, '{}')
                .replace(/(?:\{\{)|(?:\}\})/g, '');

            monacoBlock.title = comment;

            if (!monacoBlockDisabled) {
                monacoBlock.draggable = true;
                monacoBlock.onclick = (e: MouseEvent) => {
                    pxt.tickEvent("monaco.toolbox.itemclick");
                    monacoEditor.hideFlyout();

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
                monacoBlock.ondragstart = (e: DragEvent) => {
                    pxt.tickEvent("monaco.toolbox.itemdrag");
                    let clone = monacoBlock.cloneNode(true) as HTMLDivElement;

                    setTimeout(function () {
                        monacoFlyout.style.transform = "translateX(-9999px)";
                    });

                    let insertText = snippetPrefix ? `${snippetPrefix}.${snippet}` : snippet;
                    e.dataTransfer.setData('text', insertText); // IE11 only supports text
                }
                monacoBlock.ondragend = (e: DragEvent) => {
                    monacoFlyout.style.transform = "none";
                    monacoEditor.hideFlyout();
                }
                // Highlight on hover
                const highlightBlock = () => {
                    monacoBlock.style.backgroundColor = monacoBlockDisabled ?
                        `${Blockly.PXTUtils.fadeColour(color || '#ddd', 0.8, false)}` :
                        `${Blockly.PXTUtils.fadeColour(color || '#ddd', 0.1, false)}`;
                }
                const unhighlightBlock = () => {
                    monacoBlock.style.backgroundColor = monacoBlockDisabled ?
                        `${Blockly.PXTUtils.fadeColour(color || '#ddd', 0.8, false)}` :
                        `${color}`;
                }
                monacoBlock.onmouseenter = (e: MouseEvent) => {
                    highlightBlock();
                }
                monacoBlock.onmouseleave = (e: MouseEvent) => {
                    unhighlightBlock();
                }
                monacoBlock.onfocus = (e: FocusEvent) => {
                    highlightBlock();
                }
                monacoBlock.onblur = (e: FocusEvent) => {
                    unhighlightBlock();
                }
            }

            if (!fn.snippetOnly) {
                if (isInstance) {
                    const instanceToken = document.createElement('span');
                    instanceToken.textContent = snippetPrefix + '.';
                    instanceToken.className = 'sigPrefix';
                    monacoBlock.appendChild(instanceToken);
                }
                let methodToken = document.createElement('span');
                methodToken.textContent = fn.name;
                monacoBlock.appendChild(methodToken);
            }
            monacoBlock.appendChild(sigToken);

            // Draw the shape of the block
            monacoBlock.style.fontSize = `${monacoEditor.parent.settings.editorFontSize}px`;
            monacoBlock.style.backgroundColor = monacoBlockDisabled ?
                `${Blockly.PXTUtils.fadeColour(color || '#ddd', 0.8, false)}` :
                `${color}`;
            monacoBlock.style.borderColor = `${Blockly.PXTUtils.fadeColour(color || '#ddd', 0.2, false)}`;
            if (fn.retType && fn.retType == "boolean") {
                // Show a hexagonal shape
                monacoBlock.style.borderRadius = "0px";
                const monacoBlockHeight = monacoBlock.offsetHeight - 2; /* Take 2 off to account for the missing border */
                const monacoHexBlockId = uniqueBlockId++;
                monacoBlock.id = `monacoHexBlock${monacoHexBlockId}`;
                monacoBlock.className += ' monacoHexBlock';
                const styleBlock = document.createElement('style') as HTMLStyleElement;
                styleBlock.innerHTML = `
                        #monacoHexBlock${monacoHexBlockId}:before,
                        #monacoHexBlock${monacoHexBlockId}:after {
                            border-top: ${monacoBlockHeight / 2}px solid transparent;
                            border-bottom: ${monacoBlockHeight / 2}px solid transparent;
                        }
                        #monacoHexBlock${monacoHexBlockId}:before {
                            border-right: 17px solid ${color};
                        }
                        #monacoHexBlock${monacoHexBlockId}:after {
                            border-left: 17px solid ${color};
                        }
                    `;
                monacoBlockArea.insertBefore(styleBlock, monacoBlock);
            } else if (fn.retType && fn.retType != "void") {
                // Show a round shape
                monacoBlock.style.borderRadius = "40px";
            } else {
                // Show a normal shape
                monacoBlock.style.borderRadius = "3px";
            }
            return monacoBlock;
        })
        monacoBlocks.forEach((monacoBlock, index) => {
            // Accessibility
            const isRtl = Util.isUserLanguageRtl();
            monacoBlock.onkeydown = (e: KeyboardEvent) => {
                let charCode = (typeof e.which == "number") ? e.which : e.keyCode
                if (charCode == 40) { //  DOWN
                    // Next item
                    if (index < monacoBlocks.length - 1) monacoBlocks[index + 1].focus();
                } else if (charCode == 38) { // UP
                    // Previous item
                    if (index > 0) monacoBlocks[index - 1].focus();
                } else if ((charCode == 37 && !isRtl) || (charCode == 38 && isRtl)) { // (LEFT & LTR) or (RIGHT & RTL)
                    // Focus back to toolbox
                    monacoEditor.moveFocusToToolbox();
                } else if (charCode == 27) { // ESCAPE
                    // Focus back to toolbox and close Flyout
                    monacoEditor.hideFlyout();
                    monacoEditor.moveFocusToToolbox();
                } else {
                    sui.fireClickOnEnter.call(this, e);
                }
            }
        });
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

                this.defineEditorTheme(hc);
                if (mode == "typescript") {
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
                    this.monacoToolbox.show();
                } else {
                    this.monacoToolbox.hide();
                }

                this.resize();
                this.hideFlyout();

                if (this.giveFocusOnLoading) {
                    this.editor.focus();
                }
            }).finally(() => {
                editorArea.removeChild(loading);
            });
    }

    private beginLoadToolbox(file: pkg.File, hc?: boolean) {
        compiler.getBlocksAsync().then(bi => {
            this.blockInfo = bi
            this.nsMap = this.partitionBlocks();
            this.updateToolbox();
            this.resize();
            pxt.vs.syncModels(pkg.mainPkg, this.extraLibs, file.getName(), file.isReadonly())
            this.defineEditorTheme(hc, true);
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
                        startLineNumber: d.line + 1,
                        startColumn: d.column,
                        endLineNumber: d.endLine == undefined ? endPos.lineNumber : d.endLine + 1,
                        endColumn: d.endColumn == undefined ? endPos.column : d.endColumn
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
        let end = this.editor.getModel().getPositionAt(brk.start + brk.length);
        if (!position || !end) return;
        this.highlightDecorations = this.editor.deltaDecorations(this.highlightDecorations, [
            {
                range: new monaco.Range(position.lineNumber, position.column, end.lineNumber, end.column),
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


export interface MonacoToolboxProps {
    parent: Editor;
}

export interface MonacoToolboxState {
    showAdvanced?: boolean;
    namespaces?: [string, pxtc.CommentAttrs][];
    visible?: boolean;
    selectedNs?: string;
    height?: number;
}

export class MonacoToolbox extends data.Component<MonacoToolboxProps, MonacoToolboxState> {

    private rootElement: HTMLElement;

    private selectedItem: CategoryItem;
    private selectedIndex: number;
    private items: TreeRowProperties[];

    constructor(props: MonacoToolboxProps) {
        super(props);
        this.state = {
            showAdvanced: false
        }
    }

    getElement() {
        return this.rootElement;
    }

    hide() {
        this.setState({ visible: false })
    }

    show() {
        this.setState({ visible: true })
    }

    setToolboxHeight(height: number) {
        if (this.rootElement) this.rootElement.style.height = `${height}px`;
    }

    clearSelection() {
        this.setState({ selectedNs: undefined })
        this.selectedIndex = 0;
    }

    setSelectedItem(item: CategoryItem) {
        this.selectedItem = item;
    }

    setPreviousItem() {
        if (this.selectedIndex > 0) {
            const newIndex = --this.selectedIndex;
            this.setSelection(this.items[newIndex], newIndex);
        }
    }

    setNextItem() {
        if (this.items.length - 1 > this.selectedIndex) {
            const newIndex = ++this.selectedIndex;
            this.setSelection(this.items[newIndex], newIndex);
        }
    }

    setSelection(treeRow: TreeRowProperties, index: number) {
        const {parent} = this.props;
        const {ns, icon, color, category, groups, labelLineWidth} = treeRow;
        pxt.tickEvent("monaco.toolbox.click");

        if (this.state.selectedNs == ns) {
            this.clearSelection();

            // Hide flyout
            parent.closeFlyout();
        } else {
            this.setState({ selectedNs: ns})
            this.selectedIndex = index;
            if (treeRow.advanced && !this.state.showAdvanced) this.showAdvanced();

            // Show flyout
            parent.showFlyout(ns, color, icon, category, groups, labelLineWidth);
        }
    }

    focus() {
        if (!this.rootElement) return;
        if (this.selectedItem && this.selectedItem.getTreeRow()) {
            // Focus the selected item
            this.selectedItem.getTreeRow().focus();
        } else {
            // Focus first item in the toolbox
            const topCategory = this.rootElement.getElementsByClassName('blocklyTreeRow')[0] as HTMLDivElement;
            if (topCategory) topCategory.focus();
        }
    }

    moveFocusToFlyout() {
        const {parent} = this.props;
        parent.moveFocusToFlyout();
    }

    closeFlyout() {
        const {parent} = this.props;
        parent.closeFlyout();
    }

    addPackage() {
        const {parent} = this.props;
        parent.addPackage();
    }

    componentDidUpdate(prevProps: MonacoToolboxProps, prevState: MonacoToolboxState) {
        // Inject toolbox icon css
        pxt.blocks.injectToolboxIconCss();
    }

    advancedClicked() {
        pxt.tickEvent("monaco.advanced");
        this.showAdvanced();
    }

    showAdvanced() {
        const {parent} = this.props;
        this.setState({ showAdvanced: !this.state.showAdvanced });
        parent.resize();
    }

    renderCore() {
        const {parent} = this.props;
        const {namespaces, showAdvanced, visible, selectedNs} = this.state;
        if (!namespaces || !visible) return <div style={{ display: 'none' }} />

        // Filter toolbox categories
        const filters = parent.parent.state.editorState && parent.parent.state.editorState.filters;
        function filterCategory(ns: string, fns: MonacoBlockDefinition[]): boolean {
            if (!fns || !fns.length) return false;

            const categoryState = filters ? (filters.namespaces && filters.namespaces[ns] != undefined ? filters.namespaces[ns] : filters.defaultState) : undefined;
            let hasChild = false;
            if (filters && categoryState !== undefined && fns) {
                Object.keys(fns).forEach((fn) => {
                    const fnState = filters.fns && filters.fns[fn] != undefined ? filters.fns[fn] : (categoryState != undefined ? categoryState : filters.defaultState);
                    if (fnState == pxt.editor.FilterState.Disabled || fnState == pxt.editor.FilterState.Visible) hasChild = true;
                })
            } else {
                hasChild = true;
            }
            if (!hasChild) return false;
            return true;
        }

        let index = 0;
        function createCategories(names: [string, pxtc.CommentAttrs][], isAdvanced?: boolean): TreeRowProperties[] {
            return names
                .sort(([, md1], [, md2]) => {
                    // sort by fn weight
                    const w2 = (md2 ? md2.weight || 50 : 50);
                    const w1 = (md1 ? md1.weight || 50 : 50);
                    return w2 - w1;
                }).map(([ns, md]) => {
                    if (!snippets.isBuiltin(ns)) {
                        const blocks = parent.nsMap[ns].filter(block => !(block.attributes.blockHidden || block.attributes.deprecated));
                        if (!filterCategory(ns, blocks)) return undefined;
                        const categoryName = md.block ? md.block : undefined;
                        return {
                            ns: ns,
                            category: categoryName,
                            color: md.color,
                            icon: md.icon,
                            groups: md.groups,
                            labelLineWidth: md.labelLineWidth,
                            injectIconClass: true,
                            advanced: isAdvanced,
                            index: index++
                        }
                    }
                    else {
                        const cat = snippets.getBuiltinCategory(ns);
                        let blocks = cat.blocks || [];
                        const categoryName = cat.name;
                        blocks.forEach(b => { b.noNamespace = true })
                        if (!cat.custom && parent.nsMap[ns.toLowerCase()]) blocks = blocks.concat(parent.nsMap[ns.toLowerCase()].filter(block => !(block.attributes.blockHidden || block.attributes.deprecated)));
                        if (!filterCategory(ns, blocks)) return undefined;
                        return {
                            ns: ns,
                            category: categoryName,
                            color: md.color,
                            icon: md.icon,
                            groups: md.groups,
                            labelLineWidth: md.labelLineWidth,
                            advanced: isAdvanced,
                            index: index++
                        }
                    }
                }).filter(cat => !!cat);
        }

        const hasAdvanced = namespaces.some(([, md]) => md.advanced);
        const hasPackages = !pxt.shell.isReadOnly() && pxt.appTarget.cloud && pxt.appTarget.cloud.packages;

        let nonAdvancedCategories = createCategories(namespaces.filter(([, md]) => !(md.advanced)));
        let advancedCategories = hasAdvanced ? createCategories(namespaces.filter(([, md]) => md.advanced), true) : [];

        this.items = nonAdvancedCategories.concat(advancedCategories);

        return <div ref={e => this.rootElement = e} id='monacoEditorToolbox' className='monacoToolboxDiv'>
            <div className="blocklyTreeRoot">
                <div role="tree">
                    {nonAdvancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.ns} toolbox={this} selected={selectedNs == treeRow.ns} treeRow={treeRow} onCategoryClick={this.setSelection.bind(this) } />
                    )) }
                    {hasAdvanced ? <TreeSeparator key="advancedseparator" /> : undefined}
                    {hasAdvanced ? <CategoryItem toolbox={this} treeRow={{ ns: "", category: pxt.blocks.advancedTitle(), color: pxt.blocks.getNamespaceColor('advanced'), icon: showAdvanced ? 'advancedexpanded' : 'advancedcollapsed' }} onCategoryClick={this.advancedClicked.bind(this) }/> : undefined}
                    {showAdvanced ? advancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.ns} toolbox={this} selected={selectedNs == treeRow.ns} treeRow={treeRow} onCategoryClick={this.setSelection.bind(this) } />
                    )) : undefined}
                    {hasPackages && showAdvanced ? <TreeRow treeRow={{ ns: "", category: pxt.blocks.addPackageTitle(), color: '#717171', icon: "addpackage" }} onClick={this.addPackage.bind(this) } /> : undefined }
                </div>
            </div>
        </div>
    }
}

export interface CategoryItemProps extends TreeRowProps {
    toolbox: MonacoToolbox;
    onCategoryClick?: (treeRow: TreeRowProperties, index: number) => void;
}

export interface CategoryItemState {
    selected?: boolean;
}

export class CategoryItem extends data.Component<CategoryItemProps, CategoryItemState> {
    private treeRowElement: TreeRow;

    constructor(props: CategoryItemProps) {
        super(props);
        this.state = {
            selected: props.selected
        }
    }

    getTreeRow() {
        return this.treeRowElement;
    }

    componentWillReceiveProps(nextProps: CategoryItemProps) {
        const newState: CategoryItemState = {};
        if (nextProps.selected != undefined) {
            newState.selected = nextProps.selected;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    componentDidUpdate(prevProps: CategoryItemProps, prevState: CategoryItemState) {
        if (this.state.selected) {
            this.props.toolbox.setSelectedItem(this);
            this.treeRowElement.focus();
        }
    }

    handleClick = () => {
        if (this.props.onCategoryClick) this.props.onCategoryClick(this.props.treeRow, this.props.treeRow.index);
    }

    renderCore() {
        const {toolbox} = this.props;
        const {selected} = this.state;

        const previousItem = () => {
            pxt.tickEvent("monaco.toolbox.keyboard.prev");
            toolbox.setPreviousItem();
        }
        const nextItem = () => {
            pxt.tickEvent("monaco.toolbox.keyboard.next");
            toolbox.setNextItem();
        }
        const isRtl = Util.isUserLanguageRtl();
        const onKeyDown = (e: React.KeyboardEvent) => {
            let charCode = (typeof e.which == "number") ? e.which : e.keyCode
            if (charCode == 40) { //  DOWN
                nextItem();
            } else if (charCode == 38) { // UP
                previousItem();
            } else if ((charCode == 39 && !isRtl) || (charCode == 37 && isRtl)) { // (LEFT & LTR) || (RIGHT & RTL)
                // Focus inside flyout
                toolbox.moveFocusToFlyout();
            } else if (charCode == 27) { // ESCAPE
                // Close the flyout
                toolbox.closeFlyout();
            } else {
                sui.fireClickOnEnter.call(this, e);
            }
        }

        return <TreeItem>
            <TreeRow ref={e => this.treeRowElement = e} {...this.props} selected={selected} onClick={this.handleClick} onKeyDown={onKeyDown.bind(this) }/>
        </TreeItem>
    }
}

export interface TreeRowProperties {
    ns: string;
    color: string;
    icon: string;
    category?: string;
    groups?: string[];
    labelLineWidth?: string;
    injectIconClass?: boolean;
    advanced?: boolean; /*@internal*/
    index?: number; /*@internal*/
}

export interface TreeRowProps {
    treeRow: TreeRowProperties;
    onClick?: () => void;
    onKeyDown?: () => void;
    selected?: boolean;
}

export class TreeRow extends data.Component<TreeRowProps, {}> {

    private treeRow: HTMLElement;

    focus() {
        this.treeRow.focus();
    }

    getProperties() {
        const {treeRow} = this.props;
        return treeRow;
    }

    renderCore() {
        const {selected, onClick, onKeyDown} = this.props;
        const {ns, icon, color, category, injectIconClass} = this.props.treeRow;
        const appTheme = pxt.appTarget.appTheme;
        let metaColor = pxt.blocks.convertColour(color);

        const invertedMultipler = appTheme.blocklyOptions
            && (appTheme.blocklyOptions as B.ExtendedOptions).toolboxOptions
            && (appTheme.blocklyOptions as B.ExtendedOptions).toolboxOptions.invertedMultiplier || 0.3;

        let onmouseenter = () => {
            if (appTheme.invertedToolbox) {
                this.treeRow.style.backgroundColor = Blockly.PXTUtils.fadeColour(metaColor || '#ddd', invertedMultipler, false);
            }
        }
        let onmouseleave = () => {
            if (appTheme.invertedToolbox) {
                this.treeRow.style.backgroundColor = (metaColor || '#ddd');
            }
        }
        let treeRowStyle: React.CSSProperties = {
            paddingLeft: '0px'
        }
        let treeRowClass = 'blocklyTreeRow';
        if (appTheme.coloredToolbox) {
            // Colored toolbox
            treeRowStyle.color = `${metaColor}`;
            treeRowStyle.borderLeft = `8px solid ${metaColor}`;
        } else if (appTheme.invertedToolbox) {
            // Inverted toolbox
            treeRowStyle.backgroundColor = (metaColor || '#ddd');
            treeRowStyle.color = '#fff';
        } else {
            // Standard toolbox
            treeRowStyle.borderLeft = `8px solid ${metaColor}`;
        }

        // Selected
        if (selected) {
            treeRowClass += ' blocklyTreeSelected';
            if (appTheme.invertedToolbox) {
                treeRowStyle.backgroundColor = `${Blockly.PXTUtils.fadeColour(color, (Blockly as any).Options.invertedMultiplier, false)}`;
            } else {
                treeRowStyle.backgroundColor = (metaColor || '#ddd');
            }
            treeRowStyle.color = '#fff';
        }

        // Icon
        const iconClass = `blocklyTreeIcon${icon ? (ns || icon).toLowerCase() : 'Default'}`.replace(/\s/g, '');
        if (icon && injectIconClass) {
            pxt.blocks.appendToolboxIconCss(iconClass, icon);
        }

        return <div ref={e => this.treeRow = e} className={treeRowClass}
            style={treeRowStyle} tabIndex={0}
            onMouseEnter={onmouseenter} onMouseLeave={onmouseleave}
            onClick={onClick} onKeyDown={onKeyDown ? onKeyDown : sui.fireClickOnEnter}>
            <span className="blocklyTreeIcon" role="presentation"></span>
            <span style={{ display: 'inline-block' }} className={`blocklyTreeIcon ${iconClass}`} role="presentation"></span>
            <span className="blocklyTreeLabel">{category ? category : `${Util.capitalize(ns)}`}</span>
        </div>
    }
}

export class TreeSeparator extends data.Component<{}, {}> {
    renderCore() {
        return <TreeItem>
            <div className="blocklyTreeSeparator"></div>
        </TreeItem>
    }
}

export interface TreeItemProps {
    children?: any;
}

export class TreeItem extends data.Component<TreeItemProps, {}> {
    renderCore() {
        return <div role="treeitem">
            {this.props.children}
        </div>
    }
}