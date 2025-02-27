import * as Blockly from "blockly";
import {
    FUNCTION_CALL_BLOCK_TYPE,
    FUNCTION_CALL_OUTPUT_BLOCK_TYPE,
    FUNCTION_DECLARATION_BLOCK_TYPE,
    FUNCTION_DEFINITION_BLOCK_TYPE,
} from "./constants";
import { getDefinition, idsInUse, isCustomType, StringMap } from "./utils";
import { MsgKey } from "./msg";

type CommonFunctionMixinType = typeof COMMON_FUNCTION_MIXIN;

export interface CommonFunctionMixin extends CommonFunctionMixinType {
    hasStatements_?: boolean;

    populateArgument_(arg: FunctionArgument, connectionMap: ConnectionMap | undefined, input: Blockly.Input): void;
    addFunctionLabel_(text: string): void;
    updateFunctionLabel_(text: string): void;
}

export type CommonFunctionBlock = Blockly.Block & CommonFunctionMixin;

export interface FunctionArgument {
    id: string;
    name: string;
    type: string;
}

export interface ConnectionMapEntry {
    shadow: Element | null;
    block: Blockly.Block | null;
}

export type ConnectionMap = StringMap<ConnectionMapEntry>;

export interface FunctionDefinitionExtraState {
    name: string;
    functionid: string;
    arguments: FunctionArgument[];
}

export const COMMON_FUNCTION_MIXIN = {
    name_: "",
    functionId_: "",
    arguments_: [] as FunctionArgument[],

    mutationToDom: function (this: CommonFunctionBlock): Element | null {
        this.ensureIds_();
        const container = Blockly.utils.xml.createElement("mutation");
        container.setAttribute("name", this.name_);
        container.setAttribute("functionid", this.functionId_);
        this.arguments_.forEach(function (arg) {
            const argNode = Blockly.utils.xml.createElement("arg");
            argNode.setAttribute("name", arg.name);
            argNode.setAttribute("id", arg.id);
            argNode.setAttribute("type", arg.type);
            container.appendChild(argNode);
        });

        return container;
    },

    domToMutation: function (this: CommonFunctionBlock, xmlElement: Element) {
        const args: FunctionArgument[] = [];
        for (let i = 0; i < xmlElement.childNodes.length; ++i) {
            // During domToWorkspace, it's possible that the element has some whitespace text child nodes.
            // Ignore those.
            const c = xmlElement.childNodes[i] as Element;
            if (c.nodeName.toLowerCase() == "arg") {
                args.push({
                    id: c.getAttribute("id")!,
                    name: c.getAttribute("name")!,
                    type: c.getAttribute("type")!,
                });
            }
        }

        this.arguments_ = args;
        this.name_ = xmlElement.getAttribute("name")!;

        this.restoreSavedFunctionId(xmlElement.getAttribute("functionid")!);
    },

    saveExtraState: function (this: CommonFunctionBlock): FunctionDefinitionExtraState | null {
        return {
            name: this.name_,
            functionid: this.functionId_,
            arguments: this.arguments_.slice(),
        };
    },

    loadExtraState: function (this: CommonFunctionBlock, state: FunctionDefinitionExtraState) {
        this.arguments_ = state.arguments.slice();
        this.name_ = state.name;

        this.restoreSavedFunctionId(state.functionid);
    },

    restoreSavedFunctionId: function (this: CommonFunctionBlock, functionId_: string) {
        const allIds = idsInUse(this.workspace);
        if (allIds.indexOf(functionId_) < 0) {
            this.functionId_ = functionId_;
        }
        this.ensureIds_();

        let hw: { height: number; width: number } | null = null;
        if (this instanceof Blockly.BlockSvg) {
            hw = this.getHeightWidth();
        }

        if (this.type !== FUNCTION_DEFINITION_BLOCK_TYPE || (hw && !hw.height && !hw.width)) {
            this.updateDisplay_();
        } else if (!this.getFieldValue("function_name") && this.name_) {
            // pxt-blockly handle old function case where name was stored in text_
            this.setFieldValue(this.name_, "function_name");
            this.updateDisplay_();
        }
    },

    getName: function (this: CommonFunctionBlock) {
        return this.name_;
    },

    getFunctionId: function (this: CommonFunctionBlock) {
        return this.functionId_;
    },

    getArguments: function (this: CommonFunctionBlock) {
        return this.arguments_;
    },

    removeValueInputs_: function (this: CommonFunctionBlock) {
        // Delete inputs directly instead of with block.removeInput to avoid splicing
        // out of the input list at every index.
        const newInputList = [];
        for (let i = 0, input; (input = this.inputList[i]); i++) {
            if (input.type == Blockly.inputs.inputTypes.VALUE) {
                input.dispose();
            } else {
                newInputList.push(input);
            }
        }
        this.inputList = newInputList;
    },

    createAllInputs_: function (this: CommonFunctionBlock) {
        let hasTitle = false;
        let hasName = false;
        this.inputList.forEach(function (i) {
            if (i.name == "function_title") {
                hasTitle = true;
            } else if (i.name == "function_name") {
                hasName = true;
            }
        });

        // Create the main label if it doesn't exist.
        if (!hasTitle) {
            let labelText = "";
            switch (this.type) {
                case FUNCTION_CALL_OUTPUT_BLOCK_TYPE:
                case FUNCTION_CALL_BLOCK_TYPE:
                    labelText = Blockly.Msg[MsgKey.FUNCTIONS_CALL_TITLE];
                    break;
                case FUNCTION_DEFINITION_BLOCK_TYPE:
                case FUNCTION_DECLARATION_BLOCK_TYPE:
                    labelText = Blockly.Msg[MsgKey.FUNCTIONS_DEFNORETURN_TITLE];
                    break;
            }
            this.appendDummyInput("function_title").appendField(labelText, "function_title");
        }

        // Create or update the function name (overridden by the block type).
        if (hasName) {
            this.updateFunctionLabel_(this.getName());
        } else {
            this.addFunctionLabel_(this.getName());
        }

        this.updateArgumentInputs_();
    },

    updateArgumentInputs_(this: CommonFunctionBlock) {
        // remove deleted arguments
        for (const input of this.inputList) {
            if (input.type !== Blockly.inputs.inputTypes.VALUE) continue;
            if (!this.arguments_.some(a => a.id === input.name)) {

                if (this.type === FUNCTION_DEFINITION_BLOCK_TYPE) {
                    const target = input.connection.targetBlock();
                    if (target) target.dispose();
                }
                this.removeInput(input.name);
            }
        }

        // create and reorder inputs
        let inputIndex = this.inputList.findIndex(i => i.type === Blockly.inputs.inputTypes.VALUE);
        if (inputIndex === -1) {
            inputIndex = this.inputList.length;
        }
        for (const arg of this.arguments_) {
            let input = this.inputList.find(i => i.name === arg.id);
            const newInput = !input;

            if (newInput) {
                input = this.appendValueInput(arg.id)
            }

            if (this.inputList.indexOf(input) !== inputIndex) {
                this.moveInputBefore(input.name, this.inputList[inputIndex + 1]?.name);
            }

            if (isCustomType(arg.type)) {
                input.setCheck(arg.type);
            }
            else {
                input.setCheck(arg.type.charAt(0).toUpperCase() + arg.type.slice(1));
            }

            if (!this.isInsertionMarker() && newInput) {
                this.populateArgument_(arg, undefined, input);
            }

            inputIndex++;
        }

        // If collapse button present, move after arguments
        if (this.inputList.some(i => i.name === "function_collapse")) {
            this.moveInputBefore("function_collapse", null);
        }

        // Move the statement input (block mouth) back to the end.
        if (this.hasStatements_) {
            this.moveInputBefore("STACK", null);
        }
    },

    updateDisplay_: function (this: CommonFunctionBlock) {
        let wasRendered = this.rendered;

        this.createAllInputs_();

        if (wasRendered && !this.isInsertionMarker() && this instanceof Blockly.BlockSvg) {
            this.initSvg();
            this.queueRender();
        }
    },

    setStatements_: function (this: CommonFunctionBlock, hasStatements: boolean) {
        if (this.hasStatements_ === hasStatements) {
            return;
        }
        if (hasStatements) {
            this.appendStatementInput("STACK");
        } else {
            this.removeInput("STACK", true);
        }
        this.hasStatements_ = hasStatements;
    },

    ensureIds_: function (this: CommonFunctionBlock) {
        switch (this.type) {
            case FUNCTION_DEFINITION_BLOCK_TYPE:
                if (!this.functionId_ || this.functionId_ == "null") {
                    this.functionId_ = Blockly.utils.idGenerator.genUid();
                }
                for (let i = 0; i < this.arguments_.length; ++i) {
                    if (!this.arguments_[i].id) {
                        this.arguments_[i].id = Blockly.utils.idGenerator.genUid();
                    }
                }
                break;
            case FUNCTION_CALL_OUTPUT_BLOCK_TYPE:
            case FUNCTION_CALL_BLOCK_TYPE:
                const def = getDefinition(this.name_, this.workspace);
                if (def) {
                    this.functionId_ = def.getFunctionId();
                    const defArgs = def.getArguments();
                    for (let i = 0; i < this.arguments_.length; ++i) {
                        for (let j = 0; j < defArgs.length; ++j) {
                            if (defArgs[j].name == this.arguments_[i].name) {
                                this.arguments_[i].id = defArgs[j].id;
                                break;
                            }
                        }
                    }
                }
                break;
        }
    },
};
