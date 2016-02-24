/// <reference path="./blockly.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path='touchdevelop.d.ts'/>

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as blocklycompiler from "./blocklycompiler"
import * as compiler from "./compiler"
import * as blocklyloader from "./blocklyloader"
import * as sui from "./sui";

var lf = Util.lf

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;
    delayLoadXml: string;
    loadingXml: boolean;
    blockInfo: blocklyloader.BlocksInfo;

    setVisible(v: boolean) {
        super.setVisible(v);
        this.isVisible = v;
        var classes = '.blocklyToolboxDiv, .blocklyWidgetDiv, .blocklyToolboxDiv';
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

                    var toolbox = document.getElementById('blocklyToolboxDefinition');
                    blocklyloader.injectBlocks(this.editor, toolbox, this.blockInfo)
                    
                    var xml = this.delayLoadXml;
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
        if (this.delayLoadXml)
            return this.delayLoadXml;

        var xml = Blockly.Xml.workspaceToDom(this.editor);
        var text = Blockly.Xml.domToPrettyText(xml);
        return text;
    }

    loadBlockly(s: string) {
        var text = s || "<xml></xml>";
        var xml = Blockly.Xml.textToDom(text);
        this.editor.clear();
        try {
            Blockly.Xml.domToWorkspace(this.editor, xml);
        } catch (e) {
            console.log(e);
        }
    }

    prepare() {
        var blocklyDiv = document.getElementById('blocksEditor');
        Blockly.inject(blocklyDiv, {
            toolbox: document.getElementById('blocklyToolboxDefinition'),
            scrollbars: true,
            media: "./blockly/media/",
            sound: true,
            zoom: {
                enabled: true,
                controls: true,
                wheel: true,
                maxScale: 2.5,
                minScale: .1,
                scaleSpeed: 1.1
            },
        });
        this.editor = Blockly.mainWorkspace;
        this.editor.addChangeListener(() => {
            this.changeCallback();
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
            <div className="item">
                <sui.Button class="button floating" text={lf("Show Code") } icon="keyboard" onClick={() => this.parent.saveTypeScript(true)} />
            </div>
        )        
    }
}
