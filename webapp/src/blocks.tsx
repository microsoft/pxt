/// <reference path="../../localtypings/blockly.d.ts" />
/// <reference path="../../typings/globals/jquery/index.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";
import * as data from "./data";
import defaultToolbox from "./toolbox"

import Util = pxt.Util;
let lf = Util.lf

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;
    currFile: pkg.File;
    delayLoadXml: string;
    typeScriptSaveable: boolean;
    loadingXml: boolean;
    loadingXmlPromise: Promise<any>;
    blockInfo: pxtc.BlocksInfo;
    compilationResult: pxt.blocks.BlockCompilationResult;
    isFirstBlocklyLoad = true;
    currentCommentOrWarning: B.Comment | B.Warning;
    selectedEventGroup: string;
    currentHelpCardType: string;
    blockSubset: { [index: string]: number };
    showToolboxCategories: boolean = true;
    cachedToolbox: string;

    setVisible(v: boolean) {
        super.setVisible(v);
        this.isVisible = v;
        let classes = '.blocklyToolboxDiv, .blocklyWidgetDiv, .blocklyToolboxDiv';
        if (this.isVisible) {
            $(classes).show();
            // Fire a resize event since the toolbox may have changed width and height.
            this.parent.fireResize();
        }
        else $(classes).hide();
    }

    saveToTypeScript(): string {
        if (!this.typeScriptSaveable) return undefined;
        try {
            this.compilationResult = pxt.blocks.compile(this.editor, this.blockInfo);
            return this.compilationResult.source;
        } catch (e) {
            pxt.reportException(e)
            core.errorNotification(lf("Sorry, we were not able to convert this program."))
            return undefined;
        }
    }

    domUpdate() {
        if (this.delayLoadXml) {
            if (this.loadingXml) return
            this.loadingXml = true

            let loading = document.createElement("div");
            loading.className = "ui inverted loading";
            let editorArea = document.getElementById('blocksArea');
            let editorDiv = document.getElementById("blocksEditor");
            editorDiv.appendChild(loading);

            this.loadingXmlPromise = compiler.getBlocksAsync()
                .finally(() => { this.loadingXml = false })
                .then(bi => {
                    this.blockInfo = bi;
                    let showCategories = this.showToolboxCategories;
                    let showSearch = true;
                    let toolbox = this.getDefaultToolbox(showCategories);
                    let tb = pxt.blocks.initBlocks(this.blockInfo, toolbox, showCategories, this.blockSubset);
                    this.updateToolbox(tb, showCategories);
                    if (showCategories && showSearch) {
                        pxt.blocks.initSearch(this.editor, tb,
                            searchFor => compiler.apiSearchAsync(searchFor)
                                .then((fns: pxtc.service.SearchInfo[]) => fns),
                            searchTb => this.updateToolbox(searchTb, showCategories));
                    }

                    let xml = this.delayLoadXml;
                    this.delayLoadXml = undefined;
                    this.loadBlockly(xml);

                    this.resize();
                    Blockly.svgResize(this.editor);
                    this.isFirstBlocklyLoad = false;
                }).finally(() => {
                    editorDiv.removeChild(loading);
                });

            if (this.isFirstBlocklyLoad) {
                core.showLoadingAsync(lf("loading..."), this.loadingXmlPromise).done();
            } else {
                this.loadingXmlPromise.done();
            }
            this.loadingXmlPromise = null;
        }
    }

    private saveBlockly(): string {
        // make sure we don't return an empty document before we get started
        // otherwise it may get saved and we're in trouble
        if (this.delayLoadXml) return this.delayLoadXml;
        return this.serializeBlocks();
    }

    private serializeBlocks(normalize?: boolean): string {
        let xml = pxt.blocks.saveWorkspaceXml(this.editor);
        // strip out id, x, y attributes
        if (normalize) xml = xml.replace(/(x|y|id)="[^"]*"/g, '')
        pxt.debug(xml)
        return xml;
    }

    private loadBlockly(s: string): boolean {
        if (this.serializeBlocks() == s) {
            this.typeScriptSaveable = true;
            pxt.debug('blocks already loaded...');
            return false;
        }

        this.typeScriptSaveable = false;
        this.editor.clear();
        try {
            const text = pxt.blocks.importXml(s || `<block type="${ts.pxtc.ON_START_TYPE}"></block>`, this.blockInfo, true);
            const xml = Blockly.Xml.textToDom(text);
            Blockly.Xml.domToWorkspace(xml, this.editor);

            this.initLayout();
            this.editor.clearUndo();
            this.reportDeprecatedBlocks();

            this.typeScriptSaveable = true;
        } catch (e) {
            pxt.log(e);
            this.editor.clear();
            this.switchToTypeScript();
            this.changeCallback();
            return false;
        }

        this.changeCallback();

        return true;
    }

    private initLayout() {
        // layout on first load if no data info
        const needsLayout = this.editor.getTopBlocks(false).some(b => {
            const tp = b.getBoundingRectangle().topLeft;
            return b.type != ts.pxtc.ON_START_TYPE && tp.x == 0 && tp.y == 0
        });
        if (needsLayout)
            pxt.blocks.layout.flow(this.editor);
    }

    private initPrompts() {
        // Overriding blockly prompts to use semantic modals

        /**
         * Wrapper to window.alert() that app developers may override to
         * provide alternatives to the modal browser window.
         * @param {string} message The message to display to the user.
         * @param {function()=} opt_callback The callback when the alert is dismissed.
         */
        Blockly.alert = function (message, opt_callback) {
            return core.dialogAsync({
                hideCancel: true,
                header: lf("Alert"),
                body: message,
                size: "small"
            }).then(() => {
                if (opt_callback) {
                    opt_callback();
                }
            })
        };

        /**
         * Wrapper to window.confirm() that app developers may override to
         * provide alternatives to the modal browser window.
         * @param {string} message The message to display to the user.
         * @param {!function(boolean)} callback The callback for handling user response.
         */
        Blockly.confirm = function (message, callback) {
            return core.confirmAsync({
                header: lf("Confirm"),
                body: message,
                agreeLbl: lf("Yes"),
                agreeClass: "cancel",
                agreeIcon: "cancel",
                disagreeLbl: lf("No"),
                disagreeClass: "positive",
                disagreeIcon: "checkmark",
                size: "small"
            }).then(b => {
                callback(b == 0);
            })
        };

        /**
         * Wrapper to window.prompt() that app developers may override to provide
         * alternatives to the modal browser window. Built-in browser prompts are
         * often used for better text input experience on mobile device. We strongly
         * recommend testing mobile when overriding this.
         * @param {string} message The message to display to the user.
         * @param {string} defaultValue The value to initialize the prompt with.
         * @param {!function(string)} callback The callback for handling user reponse.
         */
        Blockly.prompt = function (message, defaultValue, callback) {
            return core.promptAsync({
                header: message,
                defaultValue: defaultValue,
                agreeLbl: lf("Ok"),
                disagreeLbl: lf("Cancel"),
                size: "small"
            }).then(value => {
                callback(value);
            })
        };
    }

    private reportDeprecatedBlocks() {
        const deprecatedMap: pxt.Map<number> = {};
        let deprecatedBlocksFound = false;

        this.blockInfo.blocks.forEach(symbolInfo => {
            if (symbolInfo.attributes.deprecated) {
                deprecatedMap[symbolInfo.attributes.blockId] = 0;
            }
        });

        this.editor.getAllBlocks().forEach(block => {
            if (deprecatedMap[block.type] >= 0) {
                deprecatedMap[block.type]++;
                deprecatedBlocksFound = true;
            }
        });

        for (const block in deprecatedMap) {
            if (deprecatedMap[block] === 0) {
                delete deprecatedMap[block];
            }
        }

        if (deprecatedBlocksFound) {
            pxt.tickEvent("blocks.usingDeprecated", deprecatedMap);
        }
    }

    public contentSize(): { height: number; width: number } {
        return this.editor ? pxt.blocks.blocksMetrics(this.editor) : undefined;
    }

    /**
     * Takes the XML definition of the block that will be shown on the help card and modifies the XML
     * so that the field names are updated to match any field names of dropdowns on the selected block
     */
    private updateFields(originalXML: string, newFieldValues?: any, mutation?: Element): string {
        let parser = new DOMParser();
        let doc = parser.parseFromString(originalXML, "application/xml");
        let blocks = doc.getElementsByTagName("block");
        if (blocks.length >= 1) {
            //Setting innerText doesn't work if there are no children on the node
            let setInnerText = (c: any, newValue: string) => {
                //Remove any existing children
                while (c.firstChild) {
                    c.removeChild(c.firstChild);
                }
                let tn = doc.createTextNode(newValue);
                c.appendChild(tn)
            };

            let block = blocks[0];

            if (newFieldValues) {
                //Depending on the source, the nodeName may be capitalised
                let fieldNodes = Array.prototype.filter.call(block.childNodes, (c: any) => c.nodeName == 'field' || c.nodeName == 'FIELD');

                for (let i = 0; i < fieldNodes.length; i++) {
                    if (newFieldValues.hasOwnProperty(fieldNodes[i].getAttribute('name'))) {
                        setInnerText(fieldNodes[i], newFieldValues[fieldNodes[i].getAttribute('name')]);
                        delete newFieldValues[fieldNodes[i].getAttribute('name')];
                    }
                }

                //Now that existing field values have been reset, we can create new field values as appropriate
                for (let p in newFieldValues) {
                    let c = doc.createElement('field');
                    c.setAttribute('name', p);
                    setInnerText(c, newFieldValues[p]);
                    block.appendChild(c);
                }
            }
            else if (mutation) {
                const existingMutation = Array.prototype.filter.call(block.childNodes, (c: any) => c.nodeName == 'mutation' || c.nodeName == 'MUTATION');
                if (existingMutation.length) {
                    block.replaceChild(mutation, existingMutation[0]);
                }
                else {
                    block.appendChild(mutation);
                }
            }

            let serializer = new XMLSerializer();
            return serializer.serializeToString(doc);
        }
        else {
            return originalXML;
        }
    }

    isIncomplete() {
        return this.editor ? this.editor.isDragging() : false;
    }

    prepare() {
        this.prepareBlockly();

        this.isReady = true
    }

    private prepareBlockly(showCategories: boolean = true) {
        let blocklyDiv = document.getElementById('blocksEditor');
        blocklyDiv.innerHTML = '';
        let blocklyOptions = this.getBlocklyOptions(showCategories);
        Util.jsonMergeFrom(blocklyOptions, pxt.appTarget.appTheme.blocklyOptions || {});
        this.editor = Blockly.inject(blocklyDiv, blocklyOptions);
        // zoom out on mobile by default
        if (pxt.BrowserUtils.isMobile())
            this.editor.zoomCenter(-4);
        this.editor.addChangeListener((ev) => {
            Blockly.Events.disableOrphans(ev);
            if (ev.type != 'ui') {
                this.changeCallback();
            }
            if (ev.type == 'create') {
                let lastCategory = (this.editor as any).toolbox_ ?
                    ((this.editor as any).toolbox_.lastCategory_ ?
                        (this.editor as any).toolbox_.lastCategory_.element_.innerText.trim()
                        : 'unknown')
                    : 'flyout';
                let blockId = ev.xml.getAttribute('type');
                pxt.tickEvent("blocks.create", { category: lastCategory, block: blockId });
                if (ev.xml.tagName == 'SHADOW')
                    this.cleanUpShadowBlocks();
            }
            if (ev.type == 'ui') {
                if (ev.element == 'category') {
                    let toolboxVisible = !!ev.newValue;
                    this.parent.setState({ hideEditorFloats: toolboxVisible });
                    if (ev.newValue == lf("{id:category}Add Package")) {
                        (this.editor as any).toolbox_.clearSelection();
                        this.parent.addPackage();
                    }
                }
                else if (ev.element == 'commentOpen'
                    || ev.element == 'warningOpen') {
                    /*
                     * We override the default selection behavior so that when a block is selected, its
                     * comment is expanded. However, if a user selects a block by clicking on its comment
                     * icon (the blue question mark), there is a chance that the comment will be expanded
                     * and immediately collapse again because the icon click toggled the state. This hack
                     * prevents two events caused by the same click from opening and then closing a comment
                     */
                    if (ev.group) {
                        // newValue is true if the comment has been expanded
                        if (ev.newValue) {
                            this.selectedEventGroup = ev.group
                        }
                        else if (ev.group == this.selectedEventGroup && this.currentCommentOrWarning) {
                            this.currentCommentOrWarning.setVisible(true)
                            this.selectedEventGroup = undefined
                        }
                    }
                }
                else if (ev.element == 'selected') {
                    if (this.currentCommentOrWarning) {
                        this.currentCommentOrWarning.setVisible(false)
                    }
                    const selected = Blockly.selected
                    if (selected && selected.warning && typeof (selected.warning) !== "string") {
                        (selected.warning as Blockly.Icon).setVisible(true)
                        this.currentCommentOrWarning = selected.warning
                    } else if (selected && selected.comment && typeof (selected.comment) !== "string") {
                        (selected.comment as Blockly.Icon).setVisible(true)
                        this.currentCommentOrWarning = selected.comment
                    }
                }
            }
        })
        this.initPrompts();
        this.resize();
    }

    resize(e?: Event) {
        let blocklyArea = document.getElementById('blocksArea');
        let blocklyDiv = document.getElementById('blocksEditor');
        // Position blocklyDiv over blocklyArea.
        if (blocklyArea && this.editor) {
            blocklyDiv.style.width = blocklyArea.offsetWidth + 'px';
            blocklyDiv.style.height = blocklyArea.offsetHeight + 'px';
            Blockly.svgResize(this.editor);
        }
    }

    hasUndo() {
        return this.editor ? this.editor.undoStack_.length != 0 : false;
    }

    undo() {
        if (!this.editor) return;
        this.editor.undo();
        this.parent.forceUpdate();
    }

    hasRedo() {
        return this.editor ? this.editor.redoStack_.length != 0 : false;
    }

    redo() {
        if (!this.editor) return;
        this.editor.undo(true);
        this.parent.forceUpdate();
    }

    zoomIn() {
        if (!this.editor) return;
        this.editor.zoomCenter(1);
    }

    zoomOut() {
        if (!this.editor) return;
        this.editor.zoomCenter(-1);
    }

    getId() {
        return "blocksArea"
    }

    display() {
        return (
            <div>
                <div id="blocksEditor"></div>
            </div>
        )
    }

    getViewState() {
        // ZOOM etc
        return {}
    }

    setViewState(pos: {}) { }

    getCurrentSource() {
        return this.editor ? this.saveBlockly() : this.currSource;
    }

    acceptsFile(file: pkg.File) {
        return file.getExtension() == "blocks"
    }

    loadFileAsync(file: pkg.File): Promise<void> {
        this.currSource = file.content;
        this.typeScriptSaveable = false;
        this.setDiagnostics(file)
        this.delayLoadXml = file.content;
        this.editor.clearUndo();

        if (this.currFile && this.currFile != file) {
            this.filterToolbox(null);
        }
        this.currFile = file;
        return Promise.resolve();
    }

    public switchToTypeScript() {
        pxt.tickEvent("blocks.switchjavascript");
        this.parent.switchTypeScript();
    }

    setDiagnostics(file: pkg.File) {
        Util.assert(this.editor != undefined); // Guarded
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return;

        // clear previous warnings on non-disabled blocks
        this.editor.getAllBlocks().filter(b => !b.disabled).forEach(b => b.setWarningText(null));
        let tsfile = file.epkg.files[file.getVirtualFileName()];
        if (!tsfile || !tsfile.diagnostics) return;

        // only show errors
        let diags = tsfile.diagnostics.filter(d => d.category == ts.DiagnosticCategory.Error);
        let sourceMap = this.compilationResult.sourceMap;

        diags.filter(diag => diag.category == ts.DiagnosticCategory.Error).forEach(diag => {
            let bid = pxt.blocks.findBlockId(sourceMap, diag);
            if (bid) {
                let b = this.editor.getBlockById(bid)
                if (b) {
                    let txt = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
                    b.setWarningText(txt);
                }
            }
        })
    }

    highlightStatement(brk: pxtc.LocationInfo) {
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return;
        let bid = pxt.blocks.findBlockId(this.compilationResult.sourceMap, brk);
        this.editor.highlightBlock(bid);
    }

    openTypeScript() {
        pxt.tickEvent("blocks.showjavascript");
        this.parent.openTypeScriptAsync().done();
    }

    private cleanUpShadowBlocks() {
        const blocks = this.editor.getTopBlocks(false);
        blocks.filter(b => b.isShadow_).forEach(b => b.dispose(false));
    }

    private getBlocklyOptions(showCategories: boolean = true) {
        const readOnly = pxt.shell.isReadOnly();
        const toolbox = showCategories ?
            document.getElementById('blocklyToolboxDefinitionCategory')
            : document.getElementById('blocklyToolboxDefinitionFlyout');
        const blocklyOptions: Blockly.ExtendedOptions = {
            toolbox: readOnly ? undefined : toolbox,
            scrollbars: true,
            media: pxt.webConfig.pxtCdnUrl + "blockly/media/",
            sound: true,
            trashcan: false,
            collapse: false,
            comments: true,
            disable: false,
            readOnly: readOnly,
            toolboxType: pxt.appTarget.appTheme.coloredToolbox ? 'coloured' : pxt.appTarget.appTheme.invertedToolbox ? 'inverted' : 'normal',
            zoom: {
                enabled: false,
                controls: false,
                /* wheel: true, wheel as a zoom is confusing and incosistent with monaco */
                maxScale: 2.5,
                minScale: .2,
                scaleSpeed: 1.05
            },
            rtl: Util.userLanguageRtl()
        };
        return blocklyOptions;
    }

    private getDefaultToolbox(showCategories: boolean = true): HTMLElement {
        return showCategories ?
            defaultToolbox.documentElement
            : new DOMParser().parseFromString(`<xml id="blocklyToolboxDefinition" style="display: none"></xml>`, "text/xml").documentElement;
    }

    filterToolbox(blockSubset?: { [index: string]: number }, showCategories: boolean = true): Element {
        this.blockSubset = blockSubset;
        this.showToolboxCategories = showCategories;
        let toolbox = this.getDefaultToolbox(showCategories);
        if (!this.blockInfo) return;
        let tb = pxt.blocks.createToolbox(this.blockInfo, toolbox, showCategories, blockSubset);
        this.updateToolbox(tb, showCategories);

        pxt.blocks.cachedSearchTb = tb;
        return tb;
    }

    private updateToolbox(tb: Element, showCategories: boolean = true) {
        // no toolbox when readonly
        if (pxt.shell.isReadOnly()) return;

        pxt.debug('updating toolbox');
        if (((this.editor as any).toolbox_ && showCategories) || ((this.editor as any).flyout_ && !showCategories)) {
            // Toolbox is consistent with current mode, safe to update
            let tbString = new XMLSerializer().serializeToString(tb);
            if (tbString == this.cachedToolbox) return;
            this.cachedToolbox = tbString;
            this.editor.updateToolbox(tb);
        } else {
            // Toolbox mode is different, need to refresh.
            this.editor = undefined;
            this.delayLoadXml = this.getCurrentSource();
            this.loadingXml = false;
            if (this.loadingXmlPromise) {
                this.loadingXmlPromise.cancel();
                this.loadingXmlPromise = null;
            }
            this.prepareBlockly(showCategories);
            this.domUpdate();
            this.editor.scrollCenter();
        }
    }
}
