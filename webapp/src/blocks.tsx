/// <reference path="./blockly.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />
/// <reference path='touchdevelop.d.ts'/>

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as blocklycompiler from "./blocklycompiler"
import * as compiler from "./compiler"
import * as blocklyloader from "./blocklyloader"
import * as sui from "./sui";

import Util = yelm.Util;
var lf = Util.lf

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;
    delayLoadXml: string;
    loadingXml: boolean;
    blockInfo: blocklyloader.BlocksInfo;

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
        return blocklycompiler.compile(this.editor, this.blockInfo, {
            name: cfg.name,
            description: cfg.description
        })
    }

    domUpdate() {
        if (this.delayLoadXml) {
            if (this.loadingXml) return
            this.loadingXml = true

            let loading = document.createElement("div");
            loading.className = "ui inverted loading";
            let editorDiv = document.getElementById("blocksEditor");
            editorDiv.appendChild(loading);

            blocklyloader.getBlocksAsync()
                .finally(() => { this.loadingXml = false })
                .then(bi => {
                    this.blockInfo = bi;

                    let toolbox = document.getElementById('blocklyToolboxDefinition');
                    blocklyloader.injectBlocks(this.editor, toolbox, this.blockInfo)

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
    
    serializeBlocks() : string {
        let xml = Blockly.Xml.workspaceToDom(this.editor);
        let text = Blockly.Xml.domToPrettyText(xml);
        return text;
    }

    loadBlockly(s: string) {
        if (this.serializeBlocks() == s) {
            console.log('blocks already loaded...');
            return;
        }
        
        this.editor.clear();
        try {
            let text = s || "<xml></xml>";
            let xml = Blockly.Xml.textToDom(text);
            Blockly.Xml.domToWorkspace(this.editor, xml);
        } catch (e) {
            console.log(e);
        }
    }

    updateHelpCard() {
        let selected = Blockly.selected;
        let card = selected ? selected.codeCard : undefined;
        this.parent.setHelp(card);
    }

    prepare() {
        let blocklyDiv = document.getElementById('blocksEditor');
        this.editor = Blockly.inject(blocklyDiv, {
            toolbox: document.getElementById('blocklyToolboxDefinition'),
            scrollbars: true,
            media: (window as any).appCdnRoot + "blockly/media/",
            sound: true,
            trashcan:false,
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
            this.changeCallback();
            this.updateHelpCard();
        })
        Blockly.bindEvent_(this.editor.getCanvas(), 'blocklySelectChange', this, () => {
            this.updateHelpCard();
        })

        this.isReady = true
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
    }

    setDiagnostics(file: pkg.File) {
    }

    menu() {
        return (
            <sui.Button text={lf("Show Code") } icon="keyboard" onClick={() => this.parent.saveTypeScript(true) } />
        )
    }
}
