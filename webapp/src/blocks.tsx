/// <reference path="./blockly.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"


var lf = Util.lf

interface ToolboxBlock {
    type: string;
}

interface ToolboxCategory {
    name: string;
    colour: number;
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

    setVisible(v: boolean) {
        super.setVisible(v);
        this.isVisible = v;
        var classes = '.blocklyToolboxDiv, .blocklyWidgetDiv, .blocklyToolboxDiv';
        if (this.isVisible) $(classes).show();
        else $(classes).hide();
    }

    saveBlockly(): string {
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
            console.error(e);
        }
    }

    prepare() {
        var blocklyDiv = document.getElementById('blocksEditor');
        var toolbox: ToolboxCategory[] = [
            {
                name: "Control",
                colour: 130,
                blocks: [
                    {
                        type: "logic_compare"
                    }
                ]
            },
        ];
        var toolboxXml = toolboxToXml(toolbox);
        Blockly.inject(blocklyDiv, {
            toolbox: toolboxXml,
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
        this.loadBlockly(file.content);
    }

    setDiagnostics(file: pkg.File) {
    }
}
