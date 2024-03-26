/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { installBuiltinHelpInfo, setBuiltinHelpInfo, setHelpResources } from "../help";

export function initLoops() {
    const msg = Blockly.Msg;

    // controls_repeat_ext
    const controlsRepeatExtId = "controls_repeat_ext";
    const controlsRepeatExtDef = pxt.blocks.getBlockDefinition(controlsRepeatExtId);
    msg.CONTROLS_REPEAT_TITLE = controlsRepeatExtDef.block["CONTROLS_REPEAT_TITLE"];
    msg.CONTROLS_REPEAT_INPUT_DO = controlsRepeatExtDef.block["CONTROLS_REPEAT_INPUT_DO"];
    installBuiltinHelpInfo(controlsRepeatExtId);

    // device_while
    const deviceWhileId = "device_while";
    const deviceWhileDef = pxt.blocks.getBlockDefinition(deviceWhileId);
    Blockly.Blocks[deviceWhileId] = {
        init: function () {
            this.jsonInit({
                "message0": deviceWhileDef.block["message0"],
                "args0": [
                    {
                        "type": "input_value",
                        "name": "COND",
                        "check": "Boolean"
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": pxt.toolbox.getNamespaceColor('loops')
            });
            this.appendStatementInput("DO")
                .appendField(deviceWhileDef.block["appendField"]);

            setBuiltinHelpInfo(this, deviceWhileId);
        }
    };

    // pxt_controls_for
    const pxtControlsForId = "pxt_controls_for";
    const pxtControlsForDef = pxt.blocks.getBlockDefinition(pxtControlsForId);
    Blockly.Blocks[pxtControlsForId] = {
        /**
         * Block for 'for' loop.
         * @this Blockly.Block
         */
        init: function () {
            this.jsonInit({
                "message0": pxtControlsForDef.block["message0"],
                "args0": [
                    {
                        "type": "input_value",
                        "name": "VAR",
                        "variable": pxtControlsForDef.block["variable"],
                        "check": "Variable"
                    },
                    {
                        "type": "input_value",
                        "name": "TO",
                        "check": "Number"
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": pxt.toolbox.getNamespaceColor('loops'),
                "inputsInline": true
            });
            this.appendStatementInput('DO')
                .appendField(pxtControlsForDef.block["appendField"]);

            let thisBlock = this;
            setHelpResources(this,
                pxtControlsForId,
                pxtControlsForDef.name,
                function () {
                    return pxt.U.rlf(<string>pxtControlsForDef.tooltip,
                        thisBlock.getInputTargetBlock('VAR') ? thisBlock.getInputTargetBlock('VAR').getField('VAR').getText() : '');
                },
                pxtControlsForDef.url,
                String(pxt.toolbox.getNamespaceColor('loops'))
            );
        },
        /**
         * Return all variables referenced by this block.
         * @return {!Array.<string>} List of variable names.
         * @this Blockly.Block
         */
        getVars: function (): any[] {
            return [this.getField('VAR').getText()];
        },
        /**
         * Notification that a variable is renaming.
         * If the name matches one of this block's variables, rename it.
         * @param {string} oldName Previous name of variable.
         * @param {string} newName Renamed variable.
         * @this Blockly.Block
         */
        renameVar: function (oldName: string, newName: string) {
            const varField = this.getField('VAR');
            if (Blockly.Names.equals(oldName, varField.getText())) {
                varField.setValue(newName);
            }
        }
    };

    // controls_simple_for
    const controlsSimpleForId = "controls_simple_for";
    const controlsSimpleForDef = pxt.blocks.getBlockDefinition(controlsSimpleForId);
    Blockly.Blocks[controlsSimpleForId] = {
        /**
         * Block for 'for' loop.
         * @this Blockly.Block
         */
        init: function () {
            this.jsonInit({
                "message0": controlsSimpleForDef.block["message0"],
                "args0": [
                    {
                        "type": "field_variable",
                        "name": "VAR",
                        "variable": controlsSimpleForDef.block["variable"]
                        // Please note that most multilingual characters
                        // cannot be used as variable name at this point.
                        // Translate or decide the default variable name
                        // with care.
                    },
                    {
                        "type": "input_value",
                        "name": "TO",
                        "check": "Number"
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": pxt.toolbox.getNamespaceColor('loops'),
                "inputsInline": true
            });
            this.appendStatementInput('DO')
                .appendField(controlsSimpleForDef.block["appendField"]);

            let thisBlock = this;
            setHelpResources(this,
                controlsSimpleForId,
                controlsSimpleForDef.name,
                function () {
                    return pxt.U.rlf(<string>controlsSimpleForDef.tooltip, thisBlock.getField('VAR').getText());
                },
                controlsSimpleForDef.url,
                String(pxt.toolbox.getNamespaceColor('loops'))
            );
        },
        /**
         * Return all variables referenced by this block.
         * @return {!Array.<string>} List of variable names.
         * @this Blockly.Block
         */
        getVars: function (): any[] {
            return [this.getField('VAR').getText()];
        },
        /**
         * Notification that a variable is renaming.
         * If the name matches one of this block's variables, rename it.
         * @param {string} oldName Previous name of variable.
         * @param {string} newName Renamed variable.
         * @this Blockly.Block
         */
        renameVar: function (oldName: string, newName: string) {
            const varField = this.getField('VAR');
            if (Blockly.Names.equals(oldName, varField.getText())) {
                varField.setValue(newName);
            }
        },
        /**
         * Add menu option to create getter block for loop variable.
         * @param {!Array} options List of menu options to add to.
         * @this Blockly.Block
         */
        customContextMenu: function (this: Blockly.BlockSvg, options: any[]) {
            if (!this.isCollapsed() && !(this.workspace?.options?.readOnly)) {
                let option: any = { enabled: true };
                let name = this.getField('VAR').getText();
                option.text = lf("Create 'get {0}'", name);
                let xmlField = Blockly.utils.xml.createElement('field');
                xmlField.textContent = name;
                xmlField.setAttribute('name', 'VAR');
                let xmlBlock = Blockly.utils.xml.createElement('block') as HTMLElement;
                xmlBlock.setAttribute('type', 'variables_get');
                xmlBlock.appendChild(xmlField);
                option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                options.push(option);
            }
        }
    };

    // break statement
    const breakBlockDef = pxt.blocks.getBlockDefinition(ts.pxtc.TS_BREAK_TYPE);
    Blockly.Blocks[pxtc.TS_BREAK_TYPE] = {
        init: function () {
            const color = pxt.toolbox.getNamespaceColor('loops');

            this.jsonInit({
                "message0": breakBlockDef.block["message0"],
                "inputsInline": true,
                "previousStatement": null,
                "nextStatement": null,
                "colour": color
            });

            setHelpResources(this,
                ts.pxtc.TS_BREAK_TYPE,
                breakBlockDef.name,
                breakBlockDef.tooltip,
                breakBlockDef.url,
                color,
                undefined/*colourSecondary*/,
                undefined/*colourTertiary*/,
                false/*undeletable*/
            );
        }
    }

    // continue statement
    const continueBlockDef = pxt.blocks.getBlockDefinition(ts.pxtc.TS_CONTINUE_TYPE);
    Blockly.Blocks[pxtc.TS_CONTINUE_TYPE] = {
        init: function () {
            const color = pxt.toolbox.getNamespaceColor('loops');

            this.jsonInit({
                "message0": continueBlockDef.block["message0"],
                "inputsInline": true,
                "previousStatement": null,
                "nextStatement": null,
                "colour": color
            });

            setHelpResources(this,
                ts.pxtc.TS_CONTINUE_TYPE,
                continueBlockDef.name,
                continueBlockDef.tooltip,
                continueBlockDef.url,
                color,
                undefined/*colourSecondary*/,
                undefined/*colourTertiary*/,
                false/*undeletable*/
            );
        }
    }

    const collapsedColor = "#cccccc";
    Blockly.Blocks[pxtc.COLLAPSED_BLOCK] = {
        init: function () {
            this.jsonInit({
                "message0": "...",
                "inputsInline": true,
                "previousStatement": null,
                "nextStatement": null,
                "colour": collapsedColor
            })
            setHelpResources(this,
                ts.pxtc.COLLAPSED_BLOCK,
                "...",
                lf("a few blocks"),
                undefined,
                collapsedColor,
                undefined/*colourSecondary*/,
                undefined/*colourTertiary*/,
                false/*undeletable*/
            );
        }
    }

        // pxt_controls_for_of
        const pxtControlsForOfId = "pxt_controls_for_of";
        const pxtControlsForOfDef = pxt.blocks.getBlockDefinition(pxtControlsForOfId);
        Blockly.Blocks[pxtControlsForOfId] = {
            init: function () {
                this.jsonInit({
                    "message0": pxtControlsForOfDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "VAR",
                            "variable": pxtControlsForOfDef.block["variable"],
                            "check": "Variable"
                        },
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": ["Array", "String"]
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.blockColors['loops'],
                    "inputsInline": true
                });

                this.appendStatementInput('DO')
                    .appendField(pxtControlsForOfDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    pxtControlsForOfId,
                    pxtControlsForOfDef.name,
                    function () {
                        return pxt.Util.rlf(pxtControlsForOfDef.tooltip as string,
                            thisBlock.getInputTargetBlock('VAR') ? thisBlock.getInputTargetBlock('VAR').getField('VAR').getText() : '');
                    },
                    pxtControlsForOfDef.url,
                    String(pxt.toolbox.getNamespaceColor('loops'))
                );
            }
        };

        // controls_for_of
        const controlsForOfId = "controls_for_of";
        const controlsForOfDef = pxt.blocks.getBlockDefinition(controlsForOfId);
        Blockly.Blocks[controlsForOfId] = {
            init: function () {
                this.jsonInit({
                    "message0": controlsForOfDef.block["message0"],
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": controlsForOfDef.block["variable"]
                            // Please note that most multilingual characters
                            // cannot be used as variable name at this point.
                            // Translate or decide the default variable name
                            // with care.
                        },
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.blockColors['loops'],
                    "inputsInline": true
                });

                this.appendStatementInput('DO')
                    .appendField(controlsForOfDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    controlsForOfId,
                    controlsForOfDef.name,
                    function () {
                        return pxt.Util.rlf(controlsForOfDef.tooltip as string, thisBlock.getField('VAR').getText());
                    },
                    controlsForOfDef.url,
                    String(pxt.toolbox.getNamespaceColor('loops'))
                );
            }
        };
}