import * as Blockly from "blockly";
import { FUNCTION_CALL_OUTPUT_BLOCK_TYPE } from "../functions/constants";
import { CommonFunctionBlock } from "../functions/commonFunctionMixin";
import { InlineSvgsExtensionBlock } from "../functions";
import { FieldImageNoText } from "../../fields/field_imagenotext";

type ListCreateMixinType = typeof LIST_CREATE_MIXIN;

interface ListCreateMixin extends ListCreateMixinType { }

export type ListCreateBlock = InlineSvgsExtensionBlock & ListCreateMixin;

const LIST_CREATE_MIXIN = {
    valueConnections_: [] as Blockly.Connection[],
    horizontalAfter_: 3,
    itemCount_: 3,
    /**
     * Create XML to represent list inputs.
     * @return {!Element} XML storage element.
     * @this {Blockly.Block}
     */
    mutationToDom: function (this: ListCreateBlock) {
        const container = Blockly.utils.xml.createElement('mutation');
        container.setAttribute('items', this.itemCount_ + "");
        if (this.horizontalAfter_) {
            container.setAttribute('horizontalafter', this.horizontalAfter_ + "");
        }
        return container;
    },
    /**
     * Parse XML to restore the list inputs.
     * @param {!Element} xmlElement XML storage element.
     * @this {Blockly.Block}
     */
    domToMutation: function (this: ListCreateBlock, xmlElement: Element) {
        this.itemCount_ = parseInt(xmlElement.getAttribute('items'), 10);
        const horizontalAfterOverride = xmlElement.getAttribute('horizontalafter');
        if (horizontalAfterOverride) {
            this.horizontalAfter_ = parseInt(horizontalAfterOverride, 10);
        }
        this.updateShape_();
    },
    storeConnections_: function (this: ListCreateBlock) {
        this.valueConnections_ = [];
        for (let i = 0; i < this.itemCount_; i++) {
            this.valueConnections_.push(this.getInput('ADD' + i).connection.targetConnection);
        }
    },
    restoreConnections_: function (this: ListCreateBlock) {
        for (let i = 0; i < this.itemCount_; i++) {
            this.valueConnections_[i]?.reconnect(this, 'ADD' + i);
        }
    },

    addItem_: function (this: ListCreateBlock) {
        this.storeConnections_();
        const update = () => {
            this.itemCount_++;
        };
        this.update_(update);
        this.restoreConnections_();
        // Add shadow block
        if (this.itemCount_ > 1) {
            // Find shadow type
            const firstInput = this.getInput('ADD' + 0);
            if (firstInput && firstInput.connection.targetConnection) {
                // Create a new shadow DOM with the same type as the first input
                // but with an empty default value
                const newInput = this.getInput('ADD' + (this.itemCount_ - 1));
                const shadowInputDom = firstInput.connection.getShadowDom();
                const newShadowType = shadowInputDom && shadowInputDom.getAttribute('type');
                if (newShadowType) {
                    const shadowDom = createBlockDom('shadow', newShadowType);
                    const childValues = getChildrenByTag(shadowInputDom, 'value');

                    for (let i = 0; i < childValues.length; i++) {
                        const input = childValues[i];
                        const inputName = input.getAttribute('name');
                        const valueShadow = getChildrenByTag(input, 'shadow')[0];
                        const valueShadowType = valueShadow && valueShadow.getAttribute('type');
                        appendValueDom(shadowDom, inputName, valueShadowType);
                    }
                    newInput.connection.setShadowDom(shadowDom);
                }

                const targetConnection = firstInput.connection.targetConnection;
                const connectedBlock = targetConnection && targetConnection.getSourceBlock();
                const newFieldType = connectedBlock && connectedBlock.type;
                if (!newFieldType || newFieldType === newShadowType) {
                    // block in the slot matches shadow; respawn to emit shadow block
                    newInput.connection.setShadowDom(newInput.connection.getShadowDom());
                } else {
                    // copy field as well if it's not the same type as the shadow
                    const blockDom = createBlockDom('block', newFieldType);
                    if (connectedBlock) {
                        if (newFieldType === FUNCTION_CALL_OUTPUT_BLOCK_TYPE) {
                            const mutation = Blockly.utils.xml.createElement('mutation');
                            mutation.setAttribute('name', (connectedBlock as CommonFunctionBlock).getName());
                            blockDom.appendChild(mutation);
                        } else if (connectedBlock.inputList) {
                            for (let i = 0; i < connectedBlock.inputList.length; i++) {
                                const input = connectedBlock.inputList[i];
                                const valueShadow = input.connection && input.connection.getShadowDom();
                                const valueShadowType = valueShadow && valueShadow.getAttribute('type');
                                appendValueDom(blockDom, input.name, valueShadowType);
                            }
                        }
                    }
                    const fieldBlock = Blockly.Xml.domToBlock(blockDom, this.workspace);
                    newInput.connection.connect(fieldBlock.outputConnection);
                }
            }
        }

        function getChildrenByTag(domNode: Element, tag: string) {
            const output: Element[] = [];
            if (!domNode || !domNode.children)
                return output;

            for (let i = 0; i < domNode.children.length; i++) {
                const child = domNode.children[i];
                if (child.tagName === tag) {
                    output.push(child);
                }
            }
            return output;
        }

        function appendValueDom(parent: Element, name: string, type: string) {
            if (!name || !type)
                return;
            const value = Blockly.utils.xml.createElement('value');
            value.setAttribute('name', name);
            value.appendChild(createBlockDom('shadow', type));
            parent.appendChild(value);
        }

        function createBlockDom(tag: string, type: string) {
            const shadowDom = Blockly.utils.xml.createElement(tag);
            shadowDom.setAttribute('type', type);
            shadowDom.setAttribute('id', Blockly.utils.idGenerator.genUid());
            return shadowDom;
        }
    },
    removeItem_: function (this: ListCreateBlock) {
        this.storeConnections_();
        const update = () => {
            this.itemCount_--;
        };
        this.update_(update);
        this.restoreConnections_();
    },
    update_: function (this: ListCreateBlock, update: () => void) {
        Blockly.Events.setGroup(true);
        const block = this;
        const oldMutationDom = block.mutationToDom();
        const oldMutation = oldMutationDom && Blockly.Xml.domToText(oldMutationDom);
        // Update the mutation
        if (update) update.call(this);
        // Allow the source block to rebuild itself.
        this.updateShape_();
        // Mutation may have added some elements that need initializing.
        if (block instanceof Blockly.BlockSvg) {
            block.initSvg();
        }
        // Ensure that any bump is part of this mutation's event group.
        const group = Blockly.Events.getGroup();
        const newMutationDom = block.mutationToDom();
        const newMutation = newMutationDom && Blockly.Xml.domToText(newMutationDom);
        if (oldMutation != newMutation) {
            Blockly.Events.fire(new Blockly.Events.BlockChange(
                block, 'mutation', null, oldMutation, newMutation));
            setTimeout(function () {
                Blockly.Events.setGroup(group);
                block.bumpNeighbours();
                Blockly.Events.setGroup(false);
            }, Blockly.config.bumpDelay);
        }
        if (block.rendered && block instanceof Blockly.BlockSvg) {
            block.queueRender();
        }
        Blockly.Events.setGroup(false);
    },
    /**
     * Modify this block to have the correct number of inputs.
     * @private
     * @this {Blockly.Block}
     */
    updateShape_: function (this: ListCreateBlock) {
        const add = () => {
            this.addItem_();
        };
        const remove = () => {
            this.removeItem_();
        };
        if (this.itemCount_) {
            if (this.getInput('EMPTY')) this.removeInput('EMPTY');
            if (!this.getInput('TITLE')) {
                this.appendDummyInput('TITLE')
                    .appendField(Blockly.Msg['LISTS_CREATE_WITH_INPUT_WITH']);
            }
        } else {
            if (this.getInput('TITLE')) this.removeInput('TITLE');
            if (!this.getInput('EMPTY')) {
                this.appendDummyInput('EMPTY')
                    .appendField(Blockly.Msg['LISTS_CREATE_EMPTY_TITLE']);
            }
        }
        let i = 0;
        // Add new inputs.
        for (i = 0; i < this.itemCount_; i++) {
            if (!this.getInput('ADD' + i)) {
                this.appendValueInput('ADD' + i);
            }
        }
        // Remove deleted inputs.
        while (this.getInput('ADD' + i)) {
            this.removeInput('ADD' + i);
            i++;
        }
        if (this.getInput('BUTTONS')) this.removeInput('BUTTONS');
        const buttons = this.appendDummyInput('BUTTONS');
        if (this.itemCount_ > 0) {
            buttons.appendField(new FieldImageNoText(this.REMOVE_IMAGE_DATAURI, 24, 24, "*", remove, false));
        }
        buttons.appendField(new FieldImageNoText(this.ADD_IMAGE_DATAURI, 24, 24, "*", add, false));

        /* Switch to vertical list when the list is too long */
        const showHorizontalList = this.itemCount_ <= this.horizontalAfter_;
        this.setInputsInline(showHorizontalList);

        if (this.workspace instanceof Blockly.WorkspaceSvg) {
            const renderer = this.workspace.getRenderer();
            this.setOutputShape(showHorizontalList ?
                renderer.getConstants().SHAPES["ROUND"] : renderer.getConstants().SHAPES["SQUARE"]);
        }
    }
};

Blockly.Blocks["lists_create_with"] = {
    ...LIST_CREATE_MIXIN,
    init: function(this: ListCreateBlock) {
        Blockly.Extensions.apply('inline-svgs', this, false);
        this.setHelpUrl(Blockly.Msg['LISTS_CREATE_WITH_HELPURL']);
        this.setStyle('list_blocks');
        this.updateShape_();
        this.setOutput(true, 'Array');
        if (this.workspace instanceof Blockly.WorkspaceSvg) {
            const renderer = this.workspace.getRenderer();
            this.setOutputShape(renderer.getConstants().SHAPES["ROUND"]);
        }
        this.setInputsInline(true);
        this.setTooltip(Blockly.Msg['LISTS_CREATE_WITH_TOOLTIP']);
    }
}