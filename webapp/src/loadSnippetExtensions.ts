/// <reference path="../../localtypings/pxtblockly.d.ts" />
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as pkg from './package';
import * as toolbox from "./toolbox";
import { SnippetBuilder } from './snippetBuilder'

function getSnippetExtensions() {
    return pkg
        .allEditorPkgs()
        .map(ep => ep.getKsPkg())
        .map(p => !!p && p.config)
        .filter(config => config.snippetBuilders);
}

function openSnippetDialog(config: pxt.SnippetConfig, editor: Blockly.WorkspaceSvg, parent: pxt.editor.IProjectView) {
    const wrapper = document.body.appendChild(document.createElement('div'));
    const props = { parent: parent, mainWorkspace: editor, config };
    const snippetBuilder = ReactDOM.render(
        React.createElement(SnippetBuilder, props),
        wrapper
    ) as SnippetBuilder;
    snippetBuilder.show();
}

export function initializeSnippetExtensions(ns: string, extraBlocks: (toolbox.BlockDefinition | toolbox.ButtonDefinition)[], editor: Blockly.WorkspaceSvg, parent: pxt.editor.IProjectView) {
    const snippetExtensions = getSnippetExtensions();

    snippetExtensions.forEach(config => {
        config.snippetBuilders.forEach(snippet => {
            if (ns == snippet.namespace) {
                extraBlocks.push({
                    name: `SNIPPET${name}_BUTTON`,
                    type: "button",
                    attributes: {
                        blockId: `SNIPPET${name}_BUTTON`,
                        label: snippet.label ? pxt.Util.rlf(snippet.label) : pxt.Util.lf("Editor"),
                        weight: 101,
                        group: snippet.group && snippet.group,
                    },
                    callback: () => {
                        openSnippetDialog(snippet, editor, parent);
                    }
                });
            }
        });
    })
}