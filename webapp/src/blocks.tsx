/// <reference path="../../pxtblocks/blockly.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";

import Util = pxt.Util;
let lf = Util.lf

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;
    delayLoadXml: string;
    loadingXml: boolean;
    blockInfo: ts.pxt.BlocksInfo;
    compilationResult: pxt.blocks.BlockCompilationResult;

    setVisible(v: boolean) {
        super.setVisible(v);
        this.isVisible = v;
        let classes = '.blocklyToolboxDiv, .blocklyWidgetDiv, .blocklyToolboxDiv';
        if (this.isVisible) {
            $(classes).show();
            // Fire a resize event since the toolbox may have changed width and height.
            Blockly.fireUiEvent(window, 'resize');
        }
        else $(classes).hide();
    }

    saveToTypeScript(): string {
        try {
            this.compilationResult = pxt.blocks.compile(this.editor, this.blockInfo);
            return this.compilationResult.source;
        } catch (e) {
            pxt.reportException(e, { blocks: this.serializeBlocks() })
            core.errorNotification(lf("Sorry, we were not able to convert this program."))
            return '';
        }
    }

    domUpdate() {
        if (this.delayLoadXml) {
            if (this.loadingXml) return
            this.loadingXml = true

            let loading = document.createElement("div");
            loading.className = "ui inverted loading";
            let editorDiv = document.getElementById("blocksEditor");
            editorDiv.appendChild(loading);

            compiler.getBlocksAsync()
                .finally(() => { this.loadingXml = false })
                .then(bi => {
                    this.blockInfo = bi;

                    let toolbox = document.getElementById('blocklyToolboxDefinition');
                    pxt.blocks.initBlocks(this.blockInfo, this.editor, toolbox)

                    let xml = this.delayLoadXml;
                    this.delayLoadXml = undefined;
                    this.loadBlockly(xml);

                })
                .done(() => {
                    editorDiv.removeChild(loading);
                }, e => {
                    editorDiv.removeChild(loading);
                })
        }
    }

    saveBlockly(): string {
        // make sure we don't return an empty document before we get started
        // otherwise it may get saved and we're in trouble
        if (this.delayLoadXml) return this.delayLoadXml;
        return this.serializeBlocks();
    }

    serializeBlocks(): string {
        let xml = pxt.blocks.saveWorkspaceXml(this.editor);
        pxt.debug(xml)
        return xml;
    }

    loadBlockly(s: string): boolean {
        if (this.serializeBlocks() == s) {
            pxt.debug('blocks already loaded...');
            return false;
        }

        this.editor.clear();
        try {
            let text = s || `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>`;
            let xml = Blockly.Xml.textToDom(text);
            Blockly.Xml.domToWorkspace(this.editor, xml);

            this.editor.clearUndo();
        } catch (e) {
            pxt.log(e);
        }

        this.changeCallback();

        return true;
    }

    updateHelpCard(fieldName?: string, newValue?: string) {
        let selected = Blockly.selected;
        if (selected && selected.codeCard) {
            let card: pxt.CodeCard = selected.codeCard;
            card.description = goog.isFunction(selected.tooltip) ? selected.tooltip() : selected.tooltip;
            if (fieldName != undefined && newValue != undefined) {
                let parser = new DOMParser();
                let doc = parser.parseFromString(card.blocksXml, "application/xml");
                let blocks = doc.getElementsByTagName("block");
                if (blocks.length >= 1) {
                    let setInnerText = (c: any) => {
                        //Remove any existing children
                        while (c.firstChild) {
                            c.removeChild(c.firstChild);
                        }
                        let tn = doc.createTextNode(newValue);
                        c.appendChild(tn)
                    };

                    let block = blocks[0];
                    let fieldNodes = Array.prototype.filter.call(block.childNodes, (c: any) => c.nodeName == 'field' && c.getAttribute('name') == fieldName);
                    if (fieldNodes.length > 0) {
                        setInnerText(fieldNodes[0]);
                    }
                    else {
                        let c = doc.createElement('field');
                        c.setAttribute('name', fieldName);
                        setInnerText(c);
                        block.appendChild(c);
                    }

                    let serializer = new XMLSerializer();
                    card.blocksXml = serializer.serializeToString(doc);
                }
            }
            this.parent.setHelpCard(card);
        }
        else {
            this.parent.setHelpCard(null);
        }
    }

    prepare() {
        let blocklyDiv = document.getElementById('blocksEditor');
        let toolboxDiv = document.getElementById('blocklyToolboxDefinition');
        this.editor = Blockly.inject(blocklyDiv, {
            toolbox: toolboxDiv,
            scrollbars: true,
            media: pxt.webConfig.pxtCdnUrl + "blockly/media/",
            sound: true,
            trashcan: false,
            collapse: false,
            comments: false,
            zoom: {
                enabled: true,
                controls: true,
                wheel: true,
                maxScale: 2.5,
                minScale: .1,
                scaleSpeed: 1.1
            },
            rtl: Util.userLanguageRtl()
        });
        this.editor.addChangeListener((ev) => {
            if (ev.recordUndo)
                this.changeCallback();
            if (ev.type == 'ui' && ev.element == 'category') {
                let toolboxVisible = !!ev.newValue;
                this.parent.setState({ hideEditorFloats: toolboxVisible });
            }
            if (ev.element == 'field') {
                this.updateHelpCard(ev.name, ev.newValue);
            }
        })
        Blockly.bindEvent_(this.editor.getCanvas(), 'blocklySelectChange', this, () => {
            this.updateHelpCard();
        })

        this.isReady = true
    }

    undo() {
        this.editor.undo();
    }

    getId() {
        return "blocksEditor"
    }

    getViewState() {
        // ZOOM etc
        return {}
    }

    setViewState(pos: {}) {
    }

    getCurrentSource() {
        return this.saveBlockly();
    }

    acceptsFile(file: pkg.File) {
        return file.getExtension() == "blocks"
    }

    loadFile(file: pkg.File) {
        this.setDiagnostics(file)
        this.delayLoadXml = file.content;
        this.editor.clearUndo();
    }

    setDiagnostics(file: pkg.File) {
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return;

        // clear previous warnings
        this.editor.getAllBlocks().forEach(b => b.setWarningText(null));
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

    highlightStatement(brk: ts.pxt.LocationInfo) {
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return;
        let bid = pxt.blocks.findBlockId(this.compilationResult.sourceMap, brk);
        this.editor.traceOn(true);
        this.editor.highlightBlock(bid);
    }

    openTypeScript() {
        pxt.tickEvent("text.showText");
        this.parent.saveTypeScriptAsync(true).done();
    }

    menu() {
        return (
            <sui.Button text={lf("JavaScript") } textClass="ui landscape only" icon="keyboard" onClick={() => this.openTypeScript() } />
        )
    }
}
