/// <reference path="./blockly.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path='touchdevelop.d.ts'/>

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as blocklycompiler from "./blocklycompiler"


var lf = Util.lf

interface ToolboxBlock {
    type: string;
}

interface ToolboxCategory {
    name: string;
    colour: number;
    gap?: number;
    blocks: ToolboxBlock[];
}

function toolboxToXml(toolbox: ToolboxCategory[]): string {
    return '<xml>\n'
        + toolbox.map(cat => {
            return '  <category name="' + cat.name + '" colour="' + cat.colour + '">\n' + cat.blocks.map(block => {
                return '    <block type="' + block.type + '"></block>\n';
            }).join('\n') + '  </category>\n'
        }).join('\n')
        + '</xml>';
}

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;
    delayLoadXml: string;

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
        return blocklycompiler.compile(this.editor, {
            name: cfg.name,
            description: cfg.description
        })
    }

    domUpdate() {
        if (this.delayLoadXml) {
            var xml = this.delayLoadXml;
            this.delayLoadXml = undefined;
            this.loadBlockly(xml);
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

            // var js = Blockly.JavaScript.workspaceToCode(this.editor);
            // console.log(js);
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
}
