/// <reference path="../../localtypings/monaco.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as toolboxeditor from "./toolboxeditor"
import * as compiler from "./compiler"
import * as sui from "./sui";
import * as data from "./data";
import * as snippets from "./monacoSnippets"
import * as toolbox from "./toolbox";

import Util = pxt.Util;

const MIN_EDITOR_FONT_SIZE = 10
const MAX_EDITOR_FONT_SIZE = 40

enum FileType {
    Unknown,
    TypeScript,
    Markdown
}

export class Editor extends toolboxeditor.ToolboxEditor {
    editor: monaco.editor.IStandaloneCodeEditor;
    currFile: pkg.File;
    fileType: FileType = FileType.Unknown;
    extraLibs: pxt.Map<monaco.IDisposable>;
    public nsMap: pxt.Map<toolbox.BlockDefinition[]>;
    loadedMonaco: boolean;
    loadingMonaco: boolean;
    giveFocusOnLoading: boolean = false;

    hasBlocks() {
        if (!this.currFile) return true
        let blockFile = this.currFile.getVirtualFileName();
        return (blockFile && pkg.mainEditorPkg().files[blockFile] != null)
    }

    public openBlocks() {
        pxt.tickEvent("typescript.showBlocks");
        if (!this.currFile) return;
        const header = this.parent.state.header;
        if (header) {
            header.editor = pxt.BLOCKS_PROJECT_NAME;
            header.pubCurrent = false
        }

        let promise = Promise.resolve().then(() => {
            if (!this.hasBlocks())
                return undefined;

            let blockFile = this.currFile.getVirtualFileName();
            if (!blockFile) {
                let mainPkg = pkg.mainEditorPkg();
                if (!mainPkg || !mainPkg.files["main.blocks"]) {
                    if (mainPkg) {
                        this.parent.setFile(mainPkg.files["main.ts"]);
                    }
                    return undefined;
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
                .then(() => this.parent.loadBlocklyAsync())
                .then(() => compiler.getBlocksAsync())
                .then((bi: pxtc.BlocksInfo) => {
                    blocksInfo = bi;
                    pxt.blocks.initializeAndInject(blocksInfo);
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
                    const oldWorkspace = values[0] as Blockly.Workspace;
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
            hideCancel: !bf
        }).then(b => {
            // discard
            if (!b) {
                pxt.tickEvent("typescript.keepText", undefined, { interactiveConsent: true });
            } else {
                pxt.tickEvent("typescript.discardText", undefined, { interactiveConsent: true });
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

    private handleToolboxRef = (c: toolbox.Toolbox) => {
        this.toolbox = c;
    }

    display(): JSX.Element {
        return (
            <div id="monacoEditorArea" className="full-abs" style={{ direction: 'ltr' }}>
                <div className={`monacoToolboxDiv ${this.toolbox && !this.toolbox.state.visible ? 'invisible' : ''}`}>
                    <toolbox.Toolbox ref={this.handleToolboxRef} editorname="monaco" parent={this} />
                </div>
                <div id='monacoEditorInner' style={{ float: 'right' }} />
            </div>
        )
    }

    public showPackageDialog() {
        pxt.tickEvent("monaco.addpackage", undefined, { interactiveConsent: true });
        this.hideFlyout();
        this.parent.showPackageDialog();
    }

    private defineEditorTheme(hc?: boolean, withNamespaces?: boolean) {
        const inverted = pxt.appTarget.appTheme.invertedMonaco;
        const invertedColorluminosityMultipler = 0.6;
        let rules: monaco.editor.ITokenThemeRule[] = [];
        if (!hc && withNamespaces) {
            const colors: pxt.Map<string> = {};
            this.getNamespaces().forEach((ns) => {
                const metaData = this.getNamespaceAttrs(ns);
                const blocks = snippets.isBuiltin(ns) ?
                    snippets.getBuiltinCategory(ns).blocks.concat(this.nsMap[ns] || []) : this.nsMap[ns];

                if (metaData.color && blocks) {
                    let hexcolor = fixColor(metaData.color);
                    blocks.forEach((fn) => {
                        rules.push({ token: `identifier.ts ${fn.name}`, foreground: hexcolor });
                    });
                    rules.push({ token: `identifier.ts ${ns}`, foreground: hexcolor });
                    colors[ns] = metaData.color;
                }
            })

            rules.push({ token: `identifier.ts if`, foreground: '5B80A5', });
            rules.push({ token: `identifier.ts else`, foreground: '5B80A5', });
            rules.push({ token: `identifier.ts while`, foreground: '5BA55B', });
            rules.push({ token: `identifier.ts for`, foreground: '5BA55B', });

            const pauseUntil = pxt.appTarget.runtime && pxt.appTarget.runtime.pauseUntilBlock;
            if (pauseUntil) {
                const call = pauseUntil.callName || "pauseUntil";
                const color = pauseUntil.color || colors[pauseUntil.category];

                if (color) {
                    rules.push({ token: `identifier.ts ${call}`, foreground: fixColor(color) });
                }
            }
        }

        const colors = pxt.appTarget.appTheme.monacoColors || {};
        monaco.editor.defineTheme('pxtTheme', {
            base: hc ? 'hc-black' : (inverted ? 'vs-dark' : 'vs'), // can also be vs-dark or hc-black
            inherit: true, // can also be false to completely replace the builtin rules
            rules: rules,
            colors: hc ? {} : colors
        });
        monaco.editor.setTheme('pxtTheme');

        function fixColor(hexcolor: string) {
            hexcolor = pxt.toolbox.convertColor(hexcolor);
            return (inverted ? pxt.toolbox.fadeColor(hexcolor, invertedColorluminosityMultipler, true) : hexcolor).replace('#', '');
        }
    }

    setHighContrast(hc: boolean) {
        if (this.loadedMonaco) this.defineEditorTheme(hc, true);
    }

    beforeCompile() {
        if (this.editor)
            this.editor.getAction('editor.action.formatDocument').run();
    }

    isIncomplete() {
        return this.editor && (this.editor as any)._view ?
            (this.editor as any)._view.contentWidgets._widgets["editor.widget.suggestWidget"].isVisible :
            false;
    }

    resize(e?: Event) {
        let monacoArea = document.getElementById('monacoEditorArea');
        if (!monacoArea) return;
        let monacoToolboxDiv = monacoArea.getElementsByClassName('monacoToolboxDiv')[0] as HTMLElement;

        if (monacoArea && this.editor) {
            const toolboxWidth = monacoToolboxDiv && monacoToolboxDiv.offsetWidth || 0;
            this.editor.layout({ width: monacoArea.offsetWidth - toolboxWidth, height: monacoArea.offsetHeight });

            const rgba = (this.editor as any)._themeService._theme.colors['editor.background'].rgba;
            this.parent.updateEditorLogo(toolboxWidth, `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`);

            let toolboxHeight = this.editor ? this.editor.getLayoutInfo().contentHeight : 0;
            if (monacoToolboxDiv) {
                monacoToolboxDiv.style.height = `${toolboxHeight}px`;
            }
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
            this.loadedMonaco = true;

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
                const toolbox = document.getElementById('monacoToolboxDiv');
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
        const { x, y } = this.dragCurrentPos;
        let mouseTarget = this.editor.getTargetAtClientPoint(x, y);
        if (mouseTarget && mouseTarget.position && this.editor.getPosition() != mouseTarget.position)
            this.editor.setPosition(mouseTarget.position);
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
        if (flyout) {
            pxsim.U.clear(flyout);
            flyout.style.display = 'none';
        }

        // Hide the current toolbox category
        if (this.toolbox)
            this.toolbox.clearSelection();

        // Clear editor floats
        this.parent.setState({ hideEditorFloats: false });
    }

    private updateToolbox() {
        let appTheme = pxt.appTarget.appTheme;
        if (!appTheme.monacoToolbox || pxt.shell.isReadOnly()) return;
        // Move the monaco editor to make room for the toolbox div
        //this.editor.getLayoutInfo().glyphMarginLeft = 200;
        this.editor.layout();

        if (this.toolbox)
            this.toolbox.setState({
                loading: false,
                categories: this.getAllCategories(),
                showSearchBox: this.shouldShowSearch()
            })
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
                const shouldShowToolbox = (
                    mode == "typescript"
                    && pxt.appTarget.appTheme.monacoToolbox
                    && !readOnly
                    && file.name == "main.ts");
                if (shouldShowToolbox) {
                    this.beginLoadToolbox(file, hc);
                } else {
                    if (this.toolbox)
                        this.toolbox.hide();
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

                this.resize();
                this.hideFlyout();

                // Get extension packages
                this.extensions = pkg.allEditorPkgs()
                    .map(ep => ep.getKsPkg()).map(p => !!p && p.config)
                    // Make sure the package has extensions enabled, and is a github package.
                    // Extensions are limited to github packages and ghpages, as we infer their url from the installedVersion config
                    .filter(config => !!config && !!config.extension && /^(file:|github:)/.test(config.installedVersion));

                if (this.giveFocusOnLoading) {
                    this.editor.focus();
                }
            }).finally(() => {
                editorArea.removeChild(loading);
            });
    }

    unloadFileAsync(): Promise<void> {
        if (this.toolbox)
            this.toolbox.clearSearch();
        if (this.currFile && this.currFile.getName() == "this/" + pxt.CONFIG_NAME) {
            // Reload the header if a change was made to the config file: pxt.json
            return this.parent.reloadHeaderAsync();
        }
        return Promise.resolve();
    }

    private beginLoadToolbox(file: pkg.File, hc?: boolean) {
        if (this.toolbox)
            this.toolbox.showLoading();
        compiler.getBlocksAsync().then(bi => {
            this.blockInfo = bi
            this.nsMap = this.partitionBlocks();
            this.updateToolbox();
            pxt.vs.syncModels(pkg.mainPkg, this.extraLibs, file.getName(), file.isReadonly())
            this.defineEditorTheme(hc, true);
        });
    }

    snapshotState() {
        return this.editor && this.editor.getModel() ? this.editor.getModel().getLinesContent() : null;
    }

    setViewState(pos: monaco.IPosition) {
        if (!this.editor) return;
        if (!pos || Object.keys(pos).length === 0) return;
        this.editor.setPosition(pos)
        this.editor.setScrollPosition(pos as monaco.editor.INewScrollPosition)
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
                const addErrorMessage = (message: string) => {
                    monacoErrors.push({
                        severity: monaco.Severity.Error,
                        message: message,
                        startLineNumber: d.line + 1,
                        startColumn: d.column,
                        endLineNumber: d.endLine == undefined ? endPos.lineNumber : d.endLine + 1,
                        endColumn: d.endColumn == undefined ? endPos.column : d.endColumn
                    })
                }
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
            }
            monaco.editor.setModelMarkers(model, 'typescript', monacoErrors);
        }

    }

    private highlightDecorations: string[] = [];
    highlightStatement(stmt: pxtc.LocationInfo, brk?: pxsim.DebuggerBreakpointMessage) {
        if (!stmt) this.clearHighlightedStatements();
        if (!stmt || !this.currFile || this.currFile.name != stmt.fileName || !this.editor)
            return false;
        let position = this.editor.getModel().getPositionAt(stmt.start);
        let end = this.editor.getModel().getPositionAt(stmt.start + stmt.length);
        if (!position || !end) return false;
        this.highlightDecorations = this.editor.deltaDecorations(this.highlightDecorations, [
            {
                range: new monaco.Range(position.lineNumber, position.column, end.lineNumber, end.column),
                options: { inlineClassName: 'highlight-statement' }
            },
        ]);
        if (brk) {
            // center on statement
            this.editor.revealPositionInCenter(position);
        }
        return true;
    }

    clearHighlightedStatements() {
        if (this.editor && this.highlightDecorations)
            this.editor.deltaDecorations(this.highlightDecorations, []);
    }

    private partitionBlocks() {
        const res: pxt.Map<toolbox.BlockDefinition[]> = {};

        const builtInBlocks = snippets.allBuiltinBlocksByName();

        const that = this;
        function setSubcategory(ns: string, subcat: string) {
            if (!that.subcategoryMap[ns]) that.subcategoryMap[ns] = {};
            that.subcategoryMap[ns][subcat] = true;
        }

        this.blockInfo.blocks.forEach(fn => {
            let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];

            // Don't add the block if there exists a block with the same definition
            if (builtInBlocks[fn.qName]) return;

            if (!res[ns]) {
                res[ns] = [];
            }
            res[ns].push(fn);

            const subcat = fn.attributes.subcategory;
            const advanced = fn.attributes.advanced;

            if (advanced) {
                // More subcategory
                setSubcategory(ns, 'more');
            } else if (subcat) {
                setSubcategory(ns, subcat);
            }
        });

        if (snippets.getPauseUntil()) {
            const cat = pxt.appTarget.runtime.pauseUntilBlock.category;
            if (res[cat]) {
                res[cat].push(snippets.getPauseUntil());
            }
        }

        return res;
    }

    ///////////////////////////////////////////////////////////
    ////////////         Toolbox methods          /////////////
    ///////////////////////////////////////////////////////////

    protected clearCaches() {
        super.clearCaches();
        snippets.clearBuiltinBlockCache();
    }

    shouldShowSearch() {
        if (this.parent.state.editorState && this.parent.state.editorState.searchBar != undefined) {
            return this.parent.state.editorState.searchBar;
        }
        return true;
    }

    getBuiltinCategory(ns: string): toolbox.ToolboxCategory {
        return snippets.getBuiltinCategory(ns);
    }

    isBuiltIn(ns: string): boolean {
        return snippets.isBuiltin(ns);
    }

    getNamespaceAttrs(ns: string) {
        const builtin = snippets.getBuiltinCategory(ns);
        if (builtin) {
            builtin.attributes.color = pxt.toolbox.getNamespaceColor(builtin.nameid);
            return builtin.attributes;
        }
        if (!this.blockInfo) return undefined;

        return super.getNamespaceAttrs(ns);
    }

    getNamespaces() {
        const namespaces = Object.keys(this.nsMap)
            .filter(ns => !snippets.isBuiltin(ns) && !!this.getNamespaceAttrs(ns));

        function isRemoved(ns: string): boolean {
            return snippets.getBuiltinCategory(ns).removed;
        }

        let config = pxt.appTarget.runtime || {};
        if (config.loopsBlocks && !isRemoved(toolbox.CategoryNameID.Loops)) namespaces.push(toolbox.CategoryNameID.Loops);
        if (config.logicBlocks && !isRemoved(toolbox.CategoryNameID.Logic)) namespaces.push(toolbox.CategoryNameID.Logic);
        if (config.variablesBlocks && !isRemoved(toolbox.CategoryNameID.Variables)) namespaces.push(toolbox.CategoryNameID.Variables);
        if (config.mathBlocks && !isRemoved(toolbox.CategoryNameID.Maths)) namespaces.push(toolbox.CategoryNameID.Maths);
        if (config.functionBlocks && !isRemoved(toolbox.CategoryNameID.Functions)) namespaces.push(toolbox.CategoryNameID.Functions);
        if (config.listsBlocks && !isRemoved(toolbox.CategoryNameID.Arrays)) namespaces.push(toolbox.CategoryNameID.Arrays);
        if (config.textBlocks && !isRemoved(toolbox.CategoryNameID.Text)) namespaces.push(toolbox.CategoryNameID.Text);

        if (pxt.appTarget.cloud && pxt.appTarget.cloud.packages) {
            namespaces.push(toolbox.CategoryNameID.Extensions);
        }

        return namespaces.concat(super.getNamespaces());
    }

    public moveFocusToToolbox() {
        // Set focus in toolbox
        if (this.toolbox) this.toolbox.focus();
    }

    public moveFocusToFlyout() {
        // Set focus in the flyout
        const monacoFlyout = document.getElementById('monacoFlyoutWidget');
        const topBlock = monacoFlyout.getElementsByClassName("monacoDraggableBlock")[0] as HTMLElement;
        if (topBlock) topBlock.focus();
    }

    ///////////////////////////////////////////////////////////
    ////////////         Flyout methods           /////////////
    ///////////////////////////////////////////////////////////

    public getBlocksForCategory(ns: string, subns?: string): toolbox.BlockDefinition[] {
        if (!snippets.isBuiltin(ns)) {
            return this.filterBlocks(subns, this.nsMap[ns]);
        }
        else {
            return this.getBuiltinBlocks(ns, subns);
        }
    }

    private filterBlocks(subns: string, blocks: toolbox.BlockDefinition[]) {
        return blocks.filter((block => !(block.attributes.blockHidden || block.attributes.deprecated)
            && (block.name.indexOf('_') != 0)
            && ((!subns && !block.attributes.subcategory && !block.attributes.advanced)
                || (subns && ((block.attributes.advanced && subns == 'more')
                    || (block.attributes.subcategory && subns == block.attributes.subcategory))))));
    }

    private getBuiltinBlocks(ns: string, subns: string) {
        let cat = snippets.getBuiltinCategory(ns);
        let blocks = cat.blocks || [];
        blocks.forEach(b => { b.noNamespace = true })
        if (!cat.custom && this.nsMap[ns]) blocks = blocks.concat(this.nsMap[ns].filter(block => !(block.attributes.blockHidden || block.attributes.deprecated)));
        return this.filterBlocks(subns, blocks);
    }

    public showFlyout(treeRow: toolbox.ToolboxCategory) {
        if (!this.editor) return;
        const { nameid: ns } = treeRow;

        // Create a new flyout
        let monacoFlyout = this.createMonacoFlyout();

        if (ns == 'search') {
            try {
                this.showSearchFlyout();
            }
            catch (e) {
                pxt.reportException(e);
                pxsim.U.clear(monacoFlyout);
                this.addNoSearchResultsLabel();
            }
            return;
        }

        if (this.abstractShowFlyout(treeRow) || (treeRow.subcategories && treeRow.subcategories.length > 0)) {
            // Hide editor floats
            this.parent.setState({ hideEditorFloats: true });
        } else {
            this.closeFlyout();
        }
    }

    protected showFlyoutHeadingLabel(ns: string, name: string, subns: string, icon: string, color: string) {
        const categoryName = name || Util.capitalize(subns || ns);
        const iconClass = `blocklyTreeIcon${icon ? (ns || icon).toLowerCase() : 'Default'}`.replace(/\s/g, '');

        this.getMonacoLabel(categoryName,
            'monacoFlyoutLabel monacoFlyoutHeading', true, icon, iconClass, color);
    }

    protected showFlyoutGroupLabel(group: string, groupicon: string, labelLineWidth: string) {
        this.getMonacoLabel(pxt.Util.rlf(`{id:group}${group}`),
            'monacoFlyoutLabel blocklyFlyoutGroup', false, undefined, undefined, undefined, true, labelLineWidth);
    }

    protected showFlyoutBlocks(ns: string, color: string, blocks: toolbox.BlockDefinition[]) {
        let monacoFlyout = this.getMonacoFlyout();
        const filters = this.parent.state.editorState ? this.parent.state.editorState.filters : undefined;
        const categoryState = filters ? (filters.namespaces && filters.namespaces[ns] != undefined ? filters.namespaces[ns] : filters.defaultState) : undefined;
        this.createMonacoBlocks(this, monacoFlyout, ns, blocks, color, filters, categoryState);
    }

    private showSearchFlyout() {
        let monacoBlocks: HTMLDivElement[] = [];
        const searchBlocks = this.toolbox.getSearchBlocks();

        const monacoFlyout = this.getMonacoFlyout();

        const that = this;
        function getNamespaceColor(ns: string) {
            const nsinfo = that.blockInfo.apis.byQName[ns];
            const color =
                (nsinfo ? nsinfo.attributes.color : undefined)
                || pxt.toolbox.getNamespaceColor(ns)
                || `255`;
            return color;
        }

        searchBlocks.forEach((block) => {
            if (!block.name) {
                if (block.attributes.blockId == pxtc.PAUSE_UNTIL_TYPE) {
                    const pauseUntilBlock = snippets.getPauseUntil();
                    if (pauseUntilBlock) {
                        const ns = pauseUntilBlock.attributes.blockNamespace;
                        const color = getNamespaceColor(ns);
                        monacoBlocks.push(this.getMonacoBlock(pauseUntilBlock, ns, color));
                    }
                } else {
                    // For built in blocks, let's search from monaco snippets
                    const builtin = snippets.allBuiltinBlocks()[block.attributes.blockId];
                    if (builtin) {
                        const builtinBlock = builtin[0];
                        const ns = builtin[1];
                        const attr = that.getNamespaceAttrs(ns);
                        monacoBlocks.push(this.getMonacoBlock(builtinBlock, ns, attr.color));
                    } else {
                        pxt.log("couldn't find buildin search qName for block: " + block.attributes.blockId);
                    }
                }
            } else {
                const fn = this.blockInfo.apis.byQName[block.name];
                if (fn) {
                    if (fn.name.indexOf('_') == 0) return;
                    const ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
                    const color = fn.attributes.color || getNamespaceColor(ns);
                    monacoBlocks.push(this.getMonacoBlock(fn, ns, color));
                } else {
                    pxt.log("couldn't find non builtin search by qName: " + block.name);
                }
            }
        })

        this.attachMonacoBlockAccessibility(monacoBlocks);

        if (monacoBlocks.length == 0) {
            this.addNoSearchResultsLabel();
        }
    }

    private addNoSearchResultsLabel() {
        this.getMonacoLabel(lf("No search results..."), 'monacoFlyoutLabel');
    }

    private getMonacoFlyout() {
        return document.getElementById('monacoFlyoutWidget');
    }

    private createMonacoFlyout() {
        let monacoFlyout = this.getMonacoFlyout();

        monacoFlyout.style.left = `${this.editor.getLayoutInfo().lineNumbersLeft}px`;
        monacoFlyout.style.height = `${this.editor.getLayoutInfo().contentHeight}px`;
        monacoFlyout.style.display = 'block';
        monacoFlyout.className = 'monacoFlyout';
        monacoFlyout.style.transform = 'none';
        pxsim.U.clear(monacoFlyout);

        return monacoFlyout;
    }

    ///////////////////////////////////////////////////////////
    ////////////          Block methods           /////////////
    ///////////////////////////////////////////////////////////

    private uniqueBlockId = 0; // Used for hex blocks

    private createMonacoBlocks(
        monacoEditor: Editor,
        monacoFlyout: Element,
        ns: string,
        fns: toolbox.BlockDefinition[],
        color: string,
        filters: pxt.editor.ProjectFilters,
        categoryState: pxt.editor.FilterState
    ) {
        // Render the method blocks
        const monacoBlocks = fns.sort((f1, f2) => {
            // sort by fn weight
            const w2 = (f2.attributes.weight || 50) + (f2.attributes.advanced ? 0 : 1000);
            const w1 = (f1.attributes.weight || 50) + (f1.attributes.advanced ? 0 : 1000);
            return w2 > w1 ? 1 : -1;
        }).map(fn => {
            let monacoBlockDisabled = false;
            const fnState = filters ? (filters.fns && filters.fns[fn.name] != undefined ? filters.fns[fn.name] : (categoryState != undefined ? categoryState : filters.defaultState)) : undefined;
            monacoBlockDisabled = fnState == pxt.editor.FilterState.Disabled;
            if (fnState == pxt.editor.FilterState.Hidden) return undefined;

            return monacoEditor.getMonacoBlock(fn, ns, color, monacoBlockDisabled); // try this
        })
        monacoEditor.attachMonacoBlockAccessibility(monacoBlocks);
    }

    private attachMonacoBlockAccessibility(monacoBlocks: HTMLDivElement[]) {
        const monacoEditor = this;
        monacoBlocks.forEach((monacoBlock, index) => {
            if (!monacoBlock) return;
            // Accessibility
            const isRtl = Util.isUserLanguageRtl();
            monacoBlock.onkeydown = (e: KeyboardEvent) => {
                const charCode = core.keyCodeFromEvent(e);
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

    private getMonacoLabel(label: string, className: string,
        hasIcon?: boolean, icon?: string, iconClass?: string, iconColor?: string,
        hasLine?: boolean, labelLineWidth?: string) {
        const monacoFlyout = this.getMonacoFlyout();
        const fontSize = this.parent.settings.editorFontSize;

        const labelDiv = document.createElement('div');
        labelDiv.className = className;
        const labelText = document.createElement('div');
        labelText.className = 'monacoFlyoutLabelText';
        labelText.style.display = 'inline-block';
        labelText.style.fontSize = `${fontSize + (hasIcon ? 5 : 0)}px`;
        labelText.style.lineHeight = `${fontSize + 5}px`;
        labelText.textContent = label;

        if (hasIcon) {
            let labelIcon = document.createElement('span');
            labelIcon.className = `monacoFlyoutHeadingIcon blocklyTreeIcon ${iconClass}`;
            labelIcon.setAttribute('role', 'presentation');
            labelIcon.style.display = 'inline-block';
            labelIcon.style.color = `${iconColor}`;
            labelIcon.textContent = icon;
            labelDiv.appendChild(labelIcon);
        }
        labelDiv.appendChild(labelText);

        monacoFlyout.appendChild(labelDiv);

        if (hasLine) {
            const labelLine = document.createElement('hr');
            labelLine.className = 'monacoFlyoutLabelLine';
            labelLine.align = 'left';
            labelLine.style.width = `${Math.min(labelLineWidth ? parseInt(labelLineWidth) : labelText.offsetWidth, 350)}px`;
            labelDiv.appendChild(labelLine);
        }
        return labelDiv;
    }

    private getMonacoBlock(fn: toolbox.BlockDefinition, ns: string, color: string, isDisabled?: boolean) {
        // Check if the block is built in, ignore it as it's already defined in snippets
        if (fn.attributes.blockBuiltin) {
            pxt.log("ignoring built in block: " + fn.attributes.blockId);
            return undefined;
        }
        let monacoEditor = this;
        let monacoFlyout = this.getMonacoFlyout();

        const snippet = fn.snippet;
        if (!snippet) {
            return undefined;
        }

        let monacoBlockArea = document.createElement('div');
        monacoBlockArea.className = `monacoBlock ${isDisabled ? 'monacoDisabledBlock' : ''}`;
        monacoFlyout.appendChild(monacoBlockArea);
        let monacoBlock = document.createElement('div');
        monacoBlock.className = 'monacoDraggableBlock';
        monacoBlock.tabIndex = 0;
        monacoBlockArea.appendChild(monacoBlock);

        const comment = fn.attributes.jsDoc;

        let snippetPrefix = fn.noNamespace ? "" : ns;
        let isInstance = false;
        let addNamespace = false;
        let namespaceToUse = "";

        const element = fn as pxtc.SymbolInfo;
        if (element.attributes.block) {
            if (element.attributes.defaultInstance) {
                snippetPrefix = element.attributes.defaultInstance;
            }
            else if (element.namespace) { // some blocks don't have a namespace such as parseInt
                const nsInfo = this.blockInfo.apis.byQName[element.namespace];
                if (nsInfo.attributes.fixedInstances) {
                    let instances = Util.values(this.blockInfo.apis.byQName)
                    let getExtendsTypesFor = function (name: string) {
                        return instances
                            .filter(v => v.extendsTypes)
                            .filter(v => v.extendsTypes.reduce((x, y) => x || y.indexOf(name) != -1, false))
                            .reduce((x, y) => x.concat(y.extendsTypes), [])
                    }
                    // if blockNamespace exists, e.g., "pins", use it for snippet
                    // else use nsInfo.namespace, e.g., "motors"
                    namespaceToUse = element.attributes.blockNamespace || nsInfo.namespace || "";
                    // all fixed instances for this namespace
                    let fixedInstances = instances.filter(value =>
                        value.kind === pxtc.SymbolKind.Variable &&
                        value.attributes.fixedInstance
                    );
                    // first try to get fixed instances whose retType matches nsInfo.name
                    // e.g., DigitalPin
                    let exactInstances = fixedInstances.filter(value =>
                        value.retType == nsInfo.qName)
                        .sort((v1, v2) => v1.name.localeCompare(v2.name));
                    // second choice: use fixed instances whose retType extends type of nsInfo.name
                    // e.g., nsInfo.name == AnalogPin and instance retType == PwmPin
                    let extendedInstances = fixedInstances.filter(value =>
                        getExtendsTypesFor(nsInfo.qName).indexOf(value.retType) !== -1)
                        .sort((v1, v2) => v1.name.localeCompare(v2.name));
                    if (exactInstances.length) {
                        snippetPrefix = `${exactInstances[0].name}`
                    } else if (extendedInstances.length) {
                        snippetPrefix = `${extendedInstances[0].name}`
                    }
                    isInstance = true;
                    addNamespace = true;
                }
                else if (element.kind == pxtc.SymbolKind.Method || element.kind == pxtc.SymbolKind.Property) {
                    const params = pxt.blocks.compileInfo(element);
                    snippetPrefix = params.thisParameter.defaultValue || params.thisParameter.definitionName;
                    isInstance = true;
                }
                else if (nsInfo.kind === pxtc.SymbolKind.Class) {
                    return undefined;
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

        if (!isDisabled) {
            monacoBlock.draggable = true;
            monacoBlock.onclick = (e: MouseEvent) => {
                pxt.tickEvent("monaco.toolbox.itemclick", undefined, { interactiveConsent: true });
                monacoEditor.hideFlyout();

                let model = monacoEditor.editor.getModel();
                let currPos = monacoEditor.editor.getPosition();
                let cursor = model.getOffsetAt(currPos)
                let insertText = snippetPrefix ? `${snippetPrefix}.${snippet}` : snippet;
                insertText = addNamespace ? `${firstWord(namespaceToUse)}.${insertText}` : insertText;
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
                pxt.tickEvent("monaco.toolbox.itemdrag", undefined, { interactiveConsent: true });
                setTimeout(function () {
                    monacoFlyout.style.transform = "translateX(-9999px)";
                });

                let insertText = snippetPrefix ? `${snippetPrefix}.${snippet}` : snippet;
                insertText = addNamespace ? `${firstWord(namespaceToUse)}.${insertText}` : insertText;
                e.dataTransfer.setData('text', insertText); // IE11 only supports text
            }
            monacoBlock.ondragend = (e: DragEvent) => {
                monacoFlyout.style.transform = "none";
                monacoEditor.hideFlyout();
            }
            // Highlight on hover
            const highlightBlock = () => {
                monacoBlock.style.backgroundColor = isDisabled ?
                    `${pxt.toolbox.fadeColor(color || '#ddd', 0.8, false)}` :
                    `${pxt.toolbox.fadeColor(color || '#ddd', 0.1, false)}`;
            }
            const unhighlightBlock = () => {
                monacoBlock.style.backgroundColor = isDisabled ?
                    `${pxt.toolbox.fadeColor(color || '#ddd', 0.8, false)}` :
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
            methodToken.textContent = fn.snippetName || fn.name;
            monacoBlock.appendChild(methodToken);
        }
        monacoBlock.appendChild(sigToken);

        // Draw the shape of the block
        monacoBlock.style.fontSize = `${monacoEditor.parent.settings.editorFontSize}px`;
        monacoBlock.style.lineHeight = `${monacoEditor.parent.settings.editorFontSize + 1}px`;
        monacoBlock.style.backgroundColor = isDisabled ?
            `${pxt.toolbox.fadeColor(color || '#ddd', 0.8, false)}` :
            `${color}`;
        monacoBlock.style.borderColor = `${pxt.toolbox.fadeColor(color || '#ddd', 0.2, false)}`;
        if (fn.retType && fn.retType == "boolean") {
            // Show a hexagonal shape
            monacoBlock.style.borderRadius = "0px";
            const monacoBlockHeight = monacoBlock.offsetHeight - 2; /* Take 2 off to account for the missing border */
            const monacoHexBlockId = monacoEditor.uniqueBlockId++;
            monacoBlock.id = `monacoHexBlock${monacoHexBlockId}`;
            monacoBlock.className += ' monacoHexBlock';
            const styleBlock = document.createElement('style') as HTMLStyleElement;
            styleBlock.appendChild(document.createTextNode(`
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
                `));
            monacoBlockArea.insertBefore(styleBlock, monacoBlock);
        } else if (fn.retType && fn.retType != "void") {
            // Show a round shape
            monacoBlock.style.borderRadius = "40px";
        } else {
            // Show a normal shape
            monacoBlock.style.borderRadius = "3px";
        }
        return monacoBlock;
    }
}

function firstWord(s: string) {
    return /[^\.]+/.exec(s)[0]
}