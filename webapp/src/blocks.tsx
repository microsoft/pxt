/// <reference path="../../built/blockly.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";
import defaultToolbox from "./toolbox"

import Util = pxt.Util;
let lf = Util.lf

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;
    delayLoadXml: string;
    loadingXml: boolean;
    blockInfo: pxtc.BlocksInfo;
    compilationResult: pxt.blocks.BlockCompilationResult;
    isFirstBlocklyLoad = true;
    currentComment: B.Comment;
    selectedEventGroup: string;

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

            let promise = compiler.getBlocksAsync()
                .finally(() => { this.loadingXml = false })
                .then(bi => {
                    this.blockInfo = bi;
                    pxt.blocks.initBlocks(this.blockInfo, this.editor, defaultToolbox.documentElement)

                    let xml = this.delayLoadXml;
                    this.delayLoadXml = undefined;
                    this.loadBlockly(xml);
                    this.isFirstBlocklyLoad = false;
                }).finally(() => {
                    editorDiv.removeChild(loading);
                });

            if (this.isFirstBlocklyLoad) {
                core.showLoadingAsync(lf("loading..."), promise).done();
            } else {
                promise.done();
            }
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

    updateHelpCard() {
        let selected = Blockly.selected;
        if (selected && selected.inputList && selected.codeCard) {
            //Unfortunately Blockly doesn't provide an API for getting all of the fields of a blocks
            let props: any = {};
            for (let i = 0; i < selected.inputList.length; i++) {
                let input = selected.inputList[i];
                for (let j = 0; j < input.fieldRow.length; j++) {
                    let field = input.fieldRow[j];
                    if (field.name != undefined && field.value_ != undefined) {
                        props[field.name] = field.value_;
                    }
                }
            }

            let card: pxt.CodeCard = selected.codeCard;
            card.description = goog.isFunction(selected.tooltip) ? selected.tooltip() : selected.tooltip;
            card.blocksXml = this.updateFields(card.blocksXml, props);
            this.parent.setHelpCard(card);
        }
        else {
            this.parent.setHelpCard(null);
        }
    }

    contentSize(): { height: number; width: number } {
        if (this.editor) {
            return pxt.blocks.blocksMetrics(this.editor);
        }
        return undefined;
    }

    /**
     * Takes the XML definition of the block that will be shown on the help card and modifies the XML
     * so that the field names are updated to match any field names of dropdowns on the selected block
     */
    private updateFields(originalXML: string, newFieldValues: any): string {
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

            let serializer = new XMLSerializer();
            return serializer.serializeToString(doc);
        }
        else {
            return originalXML;
        }
    }

    prepare() {
        let blocklyDiv = document.getElementById('blocksEditor');
        let toolboxDiv = document.getElementById('blocklyToolboxDefinition');
        let blocklyOptions: Blockly.Options = {
            toolbox: toolboxDiv,
            scrollbars: true,
            media: pxt.webConfig.pxtCdnUrl + "blockly/media/",
            sound: true,
            trashcan: false,
            collapse: false,
            comments: true,
            disable: false,
            zoom: {
                enabled: true,
                controls: true,
                /* wheel: true, wheel as a zoom is confusing and incosistent with monaco */
                maxScale: 2.5,
                minScale: .2,
                scaleSpeed: 1.05
            },
            rtl: Util.userLanguageRtl()
        };
        Util.jsonMergeFrom(blocklyOptions, pxt.appTarget.appTheme.blocklyOptions || {});
        this.editor = Blockly.inject(blocklyDiv, blocklyOptions);
        pxt.blocks.initMouse(this.editor);
        this.editor.addChangeListener((ev) => {
            if (ev.recordUndo) {
                this.changeCallback();
            }
            if (ev.type == 'create') {
                pxt.tickEvent("blocks.create");
                if (ev.xml.tagName == 'SHADOW')
                    this.cleanUpShadowBlocks();
            }
            if (ev.type == 'ui') {
                if (ev.element == 'category') {
                    let toolboxVisible = !!ev.newValue;
                    this.parent.setState({ hideEditorFloats: toolboxVisible });
                }
                else if (ev.element == 'commentOpen') {
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
                        else if (ev.group == this.selectedEventGroup && this.currentComment) {
                            this.currentComment.setVisible(true)
                            this.selectedEventGroup = undefined
                        }
                    }
                }
            }
            if (ev.element == 'field' && ev.type == Blockly.Events.CHANGE) {
                this.updateHelpCard();
            }
        })
        Blockly.bindEvent_(this.editor.getCanvas(), 'blocklySelectChange', this, () => {
            this.updateHelpCard();

            if (this.currentComment) {
                this.currentComment.setVisible(false)
            }

            const selected = Blockly.selected
            if (selected && selected.comment && typeof (selected.comment) !== "string") {
                (selected.comment as Blockly.Comment).setVisible(true)
                this.currentComment = selected.comment
            }
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

    highlightStatement(brk: pxtc.LocationInfo) {
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return;
        let bid = pxt.blocks.findBlockId(this.compilationResult.sourceMap, brk);
        this.editor.traceOn(true);
        this.editor.highlightBlock(bid);
    }

    openTypeScript() {
        pxt.tickEvent("blocks.showjavascript");
        this.parent.openTypeScriptAsync().done();
    }

    menu() {
        return (
            <sui.Item text={lf("JavaScript") } textClass="landscape only" icon="align left" onClick={() => this.openTypeScript() }
                tooltip={lf("Convert code to JavaScript")} tooltipPosition="bottom left"
            />
        )
    }

    cleanUpShadowBlocks() {
        const blocks = this.editor.getTopBlocks(false);
        blocks.filter(b => b.isShadow_).forEach(b => b.dispose(false));
    }
}
