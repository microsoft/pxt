/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly"
import { installBuiltinHelpInfo } from "../help";
import { FunctionDefinitionBlock, FunctionManager } from "../plugins/functions";
import { createFlyoutHeadingLabel } from "../toolbox";
import { FieldProcedure } from "../fields";
import { cachedBlockInfo, setOutputCheck } from "../loader";
import { domToWorkspaceNoEvents } from "../importer";

import { shouldDuplicateOnDrag } from "../plugins/duplicateOnDrag";
import { PathObject } from "../plugins/renderer/pathObject";
import { FieldImageNoText } from "../fields/field_imagenotext";

export function initFunctions() {
    const msg = Blockly.Msg;

    // New functions implementation messages
    msg.FUNCTION_CREATE_NEW = lf("Make a Function...");
    msg.FUNCTION_WARNING_DUPLICATE_ARG = lf("Functions cannot use the same argument name more than once.");
    msg.FUNCTION_WARNING_ARG_NAME_IS_FUNCTION_NAME = lf("Argument names must not be the same as the function name.");
    msg.FUNCTION_WARNING_EMPTY_NAME = lf("Function and argument names cannot be empty.");
    msg.FUNCTIONS_DEFAULT_FUNCTION_NAME = lf("doSomething");
    msg.FUNCTIONS_DEFAULT_BOOLEAN_ARG_NAME = lf("bool");
    msg.FUNCTIONS_DEFAULT_STRING_ARG_NAME = lf("text");
    msg.FUNCTIONS_DEFAULT_NUMBER_ARG_NAME = lf("num");
    msg.FUNCTIONS_DEFAULT_CUSTOM_ARG_NAME = lf("arg");
    msg.FUNCTION_FLYOUT_LABEL = lf("Your Functions");
    msg.FUNCTIONS_CREATE_CALL_OPTION = lf("Create 'call {0}'", "%1");
    msg.FUNCTIONS_DEFNORETURN_TITLE = lf("function");
    msg.PROCEDURES_HUE = pxt.toolbox.getNamespaceColor("functions");
    msg.REPORTERS_HUE = pxt.toolbox.getNamespaceColor("variables");

    // builtin procedures_defnoreturn
    const proceduresDefId = "procedures_defnoreturn";
    const proceduresDef = pxt.blocks.getBlockDefinition(proceduresDefId);

    msg.PROCEDURES_DEFNORETURN_TITLE = proceduresDef.block["PROCEDURES_DEFNORETURN_TITLE"];
    msg.PROCEDURE_ALREADY_EXISTS = proceduresDef.block["PROCEDURE_ALREADY_EXISTS"];

    (Blockly.Blocks['procedures_defnoreturn']).init = function () {
        let nameField = new Blockly.FieldTextInput('',
            (Blockly as any).Procedures.rename);
        //nameField.setSpellcheck(false); //TODO
        this.appendDummyInput()
            .appendField((Blockly as any).Msg.PROCEDURES_DEFNORETURN_TITLE)
            .appendField(nameField, 'NAME')
            .appendField('', 'PARAMS');
        this.setColour(pxt.toolbox.getNamespaceColor('functions'));
        this.arguments_ = [];
        this.argumentVarModels_ = [];
        this.hat = "cap";
        this.setStatements_(true);
        this.statementConnection_ = null;
    };
    installBuiltinHelpInfo(proceduresDefId);

    // builtin procedures_defnoreturn
    const proceduresCallId = "procedures_callnoreturn";
    const proceduresCallDef = pxt.blocks.getBlockDefinition(proceduresCallId);

    msg.PROCEDURES_CALLRETURN_TOOLTIP = proceduresDef.tooltip.toString();

    Blockly.Blocks['procedures_callnoreturn'] = {
        init: function () {
            let nameField = new FieldProcedure('');
            this.appendDummyInput('TOPROW')
                .appendField(proceduresCallDef.block['PROCEDURES_CALLNORETURN_TITLE'])
                .appendField(nameField, 'NAME');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour(pxt.toolbox.getNamespaceColor('functions'));
            this.arguments_ = [];
            this.quarkConnections_ = {};
            this.quarkIds_ = null;
        },
        /**
         * Returns the name of the procedure this block calls.
         * @return {string} Procedure name.
         * @this Blockly.Block
         */
        getProcedureCall: function () {
            // The NAME field is guaranteed to exist, null will never be returned.
            return /** @type {string} */ (this.getFieldValue('NAME'));
        },
        /**
         * Notification that a procedure is renaming.
         * If the name matches this block's procedure, rename it.
         * @param {string} oldName Previous name of procedure.
         * @param {string} newName Renamed procedure.
         * @this Blockly.Block
         */
        renameProcedure: function (oldName: string, newName: string) {
            if (Blockly.Names.equals(oldName, this.getProcedureCall())) {
                this.setFieldValue(newName, 'NAME');
            }
        },
        /**
         * Procedure calls cannot exist without the corresponding procedure
         * definition.  Enforce this link whenever an event is fired.
         * @param {!Blockly.Events.Abstract} event Change event.
         * @this Blockly.Block
         */
        onchange: function (event: any) {
            if (!this.workspace || this.workspace.isFlyout || this.isInsertionMarker()) {
                // Block is deleted or is in a flyout or insertion marker.
                return;
            }
            if (event.type == Blockly.Events.CREATE &&
                event.ids.indexOf(this.id) != -1) {
                // Look for the case where a procedure call was created (usually through
                // paste) and there is no matching definition.  In this case, create
                // an empty definition block with the correct signature.
                let name = this.getProcedureCall();
                let def = Blockly.Procedures.getDefinition(name, this.workspace);
                if (def && (def.type != this.defType_ ||
                    JSON.stringify((def as any).arguments_) != JSON.stringify(this.arguments_))) {
                    // The signatures don't match.
                    def = null;
                }
                if (!def) {
                    Blockly.Events.setGroup(event.group);
                    /**
                     * Create matching definition block.
                     * <xml>
                     *   <block type="procedures_defreturn" x="10" y="20">
                     *     <field name="NAME">test</field>
                     *   </block>
                     * </xml>
                     */
                    let xml = Blockly.utils.xml.createElement('xml');
                    let block = Blockly.utils.xml.createElement('block');
                    block.setAttribute('type', this.defType_);
                    let xy = this.getRelativeToSurfaceXY();
                    let x = xy.x + (Blockly as any).SNAP_RADIUS * (this.RTL ? -1 : 1);
                    let y = xy.y + (Blockly as any).SNAP_RADIUS * 2;
                    block.setAttribute('x', x);
                    block.setAttribute('y', y);
                    let field = Blockly.utils.xml.createElement('field');
                    field.setAttribute('name', 'NAME');
                    field.appendChild(document.createTextNode(this.getProcedureCall()));
                    block.appendChild(field);
                    xml.appendChild(block);
                    domToWorkspaceNoEvents(xml, this.workspace);
                    Blockly.Events.setGroup(false);
                }
            } else if (event.type == Blockly.Events.DELETE) {
                // Look for the case where a procedure definition has been deleted,
                // leaving this block (a procedure call) orphaned.  In this case, delete
                // the orphan.
                let name = this.getProcedureCall();
                let def = Blockly.Procedures.getDefinition(name, this.workspace);
                if (!def) {
                    Blockly.Events.setGroup(event.group);
                    this.dispose(true, false);
                    Blockly.Events.setGroup(false);
                }
            }
        },
        mutationToDom: function () {
            const mutationElement = document.createElement("mutation");
            mutationElement.setAttribute("name", this.getProcedureCall());
            return mutationElement;
        },
        domToMutation: function (element: Element) {
            const name = element.getAttribute("name");
            this.renameProcedure(this.getProcedureCall(), name);
        },
        /**
         * Add menu option to find the definition block for this call.
         * @param {!Array} options List of menu options to add to.
         * @this Blockly.Block
         */
        customContextMenu: function (options: any) {
            let option: any = { enabled: true };
            option.text = (Blockly as any).Msg.PROCEDURES_HIGHLIGHT_DEF;
            let name = this.getProcedureCall();
            let workspace = this.workspace;
            option.callback = function () {
                let def = Blockly.Procedures.getDefinition(name, workspace) as Blockly.BlockSvg;
                if (def) def.select();
            };
            options.push(option);
        },
        defType_: 'procedures_defnoreturn'
    }
    installBuiltinHelpInfo(proceduresCallId);

    // New functions implementation function_definition
    const functionDefinitionId = "function_definition";
    const functionDefinition = pxt.blocks.getBlockDefinition(functionDefinitionId);

    msg.FUNCTIONS_EDIT_OPTION = functionDefinition.block["FUNCTIONS_EDIT_OPTION"];
    installBuiltinHelpInfo(functionDefinitionId);

    // New functions implementation function_call
    const functionCallId = "function_call";
    const functionCall = pxt.blocks.getBlockDefinition(functionCallId);

    msg.FUNCTIONS_CALL_TITLE = functionCall.block["FUNCTIONS_CALL_TITLE"];
    msg.FUNCTIONS_GO_TO_DEFINITION_OPTION = functionCall.block["FUNCTIONS_GO_TO_DEFINITION_OPTION"];
    installBuiltinHelpInfo(functionCallId);
    installBuiltinHelpInfo("function_call_output");

    const functionReturnId = "function_return";
    Blockly.Blocks[functionReturnId] = {
        init: function () {
            initReturnStatement(this);
        }
    };
    installBuiltinHelpInfo(functionReturnId);

    Blockly.Procedures.flyoutCategory = flyoutCategory;

    // Configure function editor argument icons
    const iconsMap: pxt.Map<string> = {
        number: pxt.blocks.defaultIconForArgType("number"),
        boolean: pxt.blocks.defaultIconForArgType("boolean"),
        string: pxt.blocks.defaultIconForArgType("string"),
        Array: pxt.blocks.defaultIconForArgType("Array")
    };
    const customNames: pxt.Map<string> = {};

    const functionOptions = pxt.appTarget.runtime && pxt.appTarget.runtime.functionsOptions;
    if (functionOptions && functionOptions.extraFunctionEditorTypes) {
        functionOptions.extraFunctionEditorTypes.forEach(t => {
            iconsMap[t.typeName] = t.icon || pxt.blocks.defaultIconForArgType();

            if (t.defaultName) {
                customNames[t.typeName] = t.defaultName;
            }
        });
    }

    for (const type of Object.keys(iconsMap)) {
        FunctionManager.getInstance().setIconForType(type, iconsMap[type]);
    }

    for (const type of Object.keys(customNames)) {
        FunctionManager.getInstance().setArgumentNameForType(type, customNames[type]);
    }

    if (Blockly.Blocks["argument_reporter_custom"]) {
        // The logic for setting the output check relies on the internals of PXT
        // too much to be refactored into pxt-blockly, so we need to monkey patch
        // it here
        (Blockly.Blocks["argument_reporter_custom"]).domToMutation = function (xmlElement: Element) {
            const typeName = xmlElement.getAttribute('typename');
            this.typeName_ = typeName;

            setOutputCheck(this, typeName, cachedBlockInfo);
        };
    }

    const makeCreateCallOptionOriginal = (Blockly.Blocks["function_definition"] as FunctionDefinitionBlock).makeCallOption;
    Blockly.Blocks["function_definition"].makeCallOption = function (this: FunctionDefinitionBlock) {
        const option = makeCreateCallOptionOriginal.call(this);
        const functionName = this.getName();
        option.text = pxt.Util.lf("Create 'call {0}'", functionName);
        return option;
    };
}

function initReturnStatement(b: Blockly.Block) {
    const returnDef = pxt.blocks.getBlockDefinition("function_return");

    const buttonAddName = "0_add_button";
    const buttonRemName = "0_rem_button";

    Blockly.Extensions.apply('inline-svgs', b, false);

    let returnValueVisible = true;

    // When the value input is removed, we disconnect the block that was connected to it. This
    // is the id of whatever block was last connected
    let lastConnectedId: string;

    updateShape();

    b.domToMutation = saved => {
        if (saved.hasAttribute("last_connected_id")) {
            lastConnectedId = saved.getAttribute("last_connected_id");
        }
        returnValueVisible = hasReturnValue(saved);
        updateShape();
    }

    b.mutationToDom = () => {
        const mutation = document.createElement("mutation");
        setReturnValue(mutation, !!b.getInput("RETURN_VALUE"));

        if (lastConnectedId) {
            mutation.setAttribute("last_connected_id", lastConnectedId);
        }

        return mutation;
    }

    function updateShape() {
        const returnValueInput = b.getInput("RETURN_VALUE");

        if (returnValueVisible) {
            if (!returnValueInput) {
                // Remove any labels
                while (b.getInput("")) b.removeInput("");

                b.jsonInit({
                    "message0": returnDef.block["message_with_value"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "RETURN_VALUE",
                            "check": null
                        }
                    ],
                    "previousStatement": null,
                    "colour": pxt.toolbox.getNamespaceColor('functions')
                });
            }
            if (b.getInput(buttonAddName)) {
                b.removeInput(buttonAddName);
            }
            if (!b.getInput(buttonRemName)) {
                addMinusButton();
            }

            if (lastConnectedId) {
                const lastConnected = b.workspace.getBlockById(lastConnectedId);
                if (lastConnected && lastConnected.outputConnection && !lastConnected.outputConnection.targetBlock()) {
                    b.getInput("RETURN_VALUE").connection.connect(lastConnected.outputConnection);
                }
                lastConnectedId = undefined;
            }
        }
        else {
            if (returnValueInput) {
                const target = returnValueInput.connection.targetBlock()
                if (target) {
                    if (target.isShadow()) target.setShadow(false);
                    returnValueInput.connection.disconnect();
                    lastConnectedId = target.id;
                }
                b.removeInput("RETURN_VALUE");
                b.jsonInit({
                    "message0": returnDef.block["message_no_value"],
                    "args0": [],
                    "previousStatement": null,
                    "colour": pxt.toolbox.getNamespaceColor('functions')
                })
            }
            if (b.getInput(buttonRemName)) {
                b.removeInput(buttonRemName);
            }
            if (!b.getInput(buttonAddName)) {
                addPlusButton();
            }
        }

        b.setInputsInline(true);
    }

    function setReturnValue(mutation: Element, hasReturnValue: boolean) {
        mutation.setAttribute("no_return_value", hasReturnValue ? "false" : "true")
    }

    function hasReturnValue(mutation: Element) {
        return mutation.getAttribute("no_return_value") !== "true"
    }

    function addPlusButton() {
        addButton(buttonAddName, (b as any).ADD_IMAGE_DATAURI, lf("Add return value"));
    }

    function addMinusButton() {
        addButton(buttonRemName, (b as any).REMOVE_IMAGE_DATAURI, lf("Remove return value"));
    }

    function mutationString() {
        return Blockly.Xml.domToText(b.mutationToDom());
    }

    function fireMutationChange(pre: string, post: string) {
        if (pre !== post)
            Blockly.Events.fire(new Blockly.Events.BlockChange(b, "mutation", null, pre, post));
    }

    function addButton(name: string, uri: string, alt: string) {
        b.appendDummyInput(name)
            .appendField(new FieldImageNoText(uri, 24, 24, alt, () => {
                const oldMutation = mutationString();
                returnValueVisible = !returnValueVisible;

                const preUpdate = mutationString()
                fireMutationChange(oldMutation, preUpdate);

                updateShape();

                const postUpdate = mutationString();
                fireMutationChange(preUpdate, postUpdate);

            }, false))
    }
}

function flyoutCategory(workspace: Blockly.WorkspaceSvg, useXml: false): Blockly.utils.toolbox.FlyoutItemInfo[];
function flyoutCategory(workspace: Blockly.WorkspaceSvg, useXml: true): Element[];
function flyoutCategory(workspace: Blockly.WorkspaceSvg, useXml: boolean): Element[] | Blockly.utils.toolbox.FlyoutItemInfo[] {
    if (!useXml) return [];

    let xmlList: Element[] = [];

    if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
        // Add the Heading label
        let headingLabel = createFlyoutHeadingLabel(lf("Functions"),
            pxt.toolbox.getNamespaceColor('functions'),
            pxt.toolbox.getNamespaceIcon('functions'),
            'blocklyFlyoutIconfunctions');
        xmlList.push(headingLabel);
    }

    const newFunction = lf("Make a Function...");
    const newFunctionTitle = lf("New function name:");

    // Add the "Make a function" button
    let button = Blockly.utils.xml.createElement('button');
    button.setAttribute('text', newFunction);
    button.setAttribute('callbackKey', 'CREATE_FUNCTION');

    let createFunction = (name: string) => {
        /**
         * Create matching definition block.
         * <xml>
         *   <block type="procedures_defreturn" x="10" y="20">
         *     <field name="NAME">test</field>
         *   </block>
         * </xml>
         */
        let topBlock = workspace.getTopBlocks(true)[0];
        let x = 10, y = 10;
        if (topBlock) {
            let xy = topBlock.getRelativeToSurfaceXY();
            x = xy.x + (Blockly as any).SNAP_RADIUS * (topBlock.RTL ? -1 : 1);
            y = xy.y + (Blockly as any).SNAP_RADIUS * 2;
        }
        let xml = Blockly.utils.xml.createElement('xml');
        let block = Blockly.utils.xml.createElement('block');
        block.setAttribute('type', 'procedures_defnoreturn');
        block.setAttribute('x', String(x));
        block.setAttribute('y', String(y));
        let field = Blockly.utils.xml.createElement('field');
        field.setAttribute('name', 'NAME');
        field.appendChild(document.createTextNode(name));
        block.appendChild(field);
        xml.appendChild(block);
        let newBlockIds = domToWorkspaceNoEvents(xml, workspace);
        // Close flyout and highlight block
        Blockly.hideChaff();
        let newBlock = workspace.getBlockById(newBlockIds[0]) as Blockly.BlockSvg;
        newBlock.select();
        // Center on the new block so we know where it is
        workspace.centerOnBlock(newBlock.id, true);
    }

    workspace.registerButtonCallback('CREATE_FUNCTION', function (button) {
        let promptAndCheckWithAlert = (defaultName: string) => {
            Blockly.dialog.prompt(newFunctionTitle, defaultName, function (newFunc) {
                pxt.tickEvent('blocks.makeafunction');
                // Merge runs of whitespace.  Strip leading and trailing whitespace.
                // Beyond this, all names are legal.
                if (newFunc) {
                    newFunc = newFunc.replace(/[\s\xa0]+/g, ' ').replace(/^ | $/g, '');
                    if (newFunc == newFunction) {
                        // Ok, not ALL names are legal...
                        newFunc = null;
                    }
                }
                if (newFunc) {
                    if (workspace.getVariableMap().getVariable(newFunc)) {
                        Blockly.dialog.alert(Blockly.Msg.VARIABLE_ALREADY_EXISTS.replace('%1',
                            newFunc.toLowerCase()),
                            function () {
                                promptAndCheckWithAlert(newFunc);  // Recurse
                            });
                    }
                    else if (!Blockly.Procedures.isNameUsed(newFunc, workspace)) {
                        Blockly.dialog.alert(Blockly.Msg.PROCEDURE_ALREADY_EXISTS.replace('%1',
                            newFunc.toLowerCase()),
                            function () {
                                promptAndCheckWithAlert(newFunc);  // Recurse
                            });
                    }
                    else {
                        createFunction(newFunc);
                    }
                }
            });
        };
        promptAndCheckWithAlert('doSomething');
    });
    xmlList.push(button as HTMLElement);

    function populateProcedures(procedureList: any, templateName: any) {
        for (let i = 0; i < procedureList.length; i++) {
            let name = procedureList[i][0];
            let args = procedureList[i][1];
            // <block type="procedures_callnoreturn" gap="16">
            //   <field name="NAME">name</field>
            // </block>
            let block = Blockly.utils.xml.createElement('block');
            block.setAttribute('type', templateName);
            block.setAttribute('gap', '16');
            block.setAttribute('colour', pxt.toolbox.getNamespaceColor('functions'));
            let field = Blockly.utils.xml.createElement('field')
            field.textContent = name;
            field.setAttribute('name', 'NAME');
            block.appendChild(field);
            xmlList.push(block as HTMLElement);
        }
    }

    let tuple = Blockly.Procedures.allProcedures(workspace);
    populateProcedures(tuple[0], 'procedures_callnoreturn');

    return xmlList;
}