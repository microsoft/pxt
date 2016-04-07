/// <reference path="../../kindblocks/blockly.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";

import Util = ks.Util;
var lf = Util.lf

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;
    delayLoadXml: string;
    loadingXml: boolean;
    blockInfo: ts.ks.BlocksInfo;
    compilationResult: ks.blocks.BlockCompilationResult;

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
        let cfg = pkg.mainPkg.config
        this.compilationResult = ks.blocks.compile(this.editor, this.blockInfo, {
            name: cfg.name,
            description: cfg.description
        })
        return this.compilationResult.source;
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
                    ks.blocks.initBlocks(this.blockInfo, this.editor, toolbox)

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
        let xml = Blockly.Xml.workspaceToDom(this.editor);
        let text = Blockly.Xml.domToPrettyText(xml);
        console.log(text)
        return text;
    }

    loadBlockly(s: string): boolean {
        if (this.serializeBlocks() == s) {
            console.log('blocks already loaded...');
            return false;
        }

        this.editor.clear();
        try {
            let text = s || "<xml></xml>";
            let xml = Blockly.Xml.textToDom(text);
            Blockly.Xml.domToWorkspace(this.editor, xml);
            
            this.editor.clearUndo();
        } catch (e) {
            console.log(e);
        }
        
        this.changeCallback();

        return true;
    }

    updateHelpCard() {
        let selected = Blockly.selected;
        let card = selected ? selected.codeCard : undefined;
        this.parent.setHelp(card);
    }

    prepare() {
        let blocklyDiv = document.getElementById('blocksEditor');
        let toolboxDiv = document.getElementById('blocklyToolboxDefinition');
        this.editor = Blockly.inject(blocklyDiv, {
            toolbox: toolboxDiv,
            scrollbars: true,
            media: (window as any).appCdnRoot + "blockly/media/",
            sound: true,
            trashcan: false,
            zoom: {
                enabled: true,
                controls: true,
                wheel: true,
                maxScale: 2.5,
                minScale: .1,
                scaleSpeed: 1.1
            },
        });
        this.editor.addChangeListener((ev) => {
            if (ev.recordUndo)
                this.changeCallback();
            if (ev.type == 'ui' && ev.element == 'category') {
                let toolboxVisible = !!ev.newValue;
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

    setTheme(theme: srceditor.Theme) {
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

        let tsfile = file.epkg.lookupFile(file.getName() + ".ts");
        if (!tsfile || !tsfile.diagnostics) return;

        // only show errors
        let diags = tsfile.diagnostics.filter(d => d.category == ts.DiagnosticCategory.Error);
        let sourceMap = this.compilationResult.sourceMap;

        diags.forEach(diag => {
            let bid = ks.blocks.findBlockId(sourceMap, diag);
            if (bid) {
                let b = this.editor.getBlockById(bid)
                if (b) {
                    let txt = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
                    b.setWarningText(txt);
                }
            }
        })
    }

    highlightStatement(brk: ts.ks.LocationInfo) {
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return;
        let bid = ks.blocks.findBlockId(this.compilationResult.sourceMap, brk);
        this.editor.traceOn(true);
        this.editor.highlightBlock(bid);
    }

    openTypeScript() {
        this.parent.saveTypeScriptAsync(true).done();
    }

    menu() {
        return (
            <sui.Button text={lf("Show Code") } textClass="ui landscape only" icon="keyboard" onClick={() => this.openTypeScript() } />
        )
    }
}
