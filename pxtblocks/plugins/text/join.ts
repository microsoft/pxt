import * as Blockly from "blockly";
import { InlineSvgsExtensionBlock } from "../functions";

type TextJoinMixinType = typeof TEXT_JOIN_MUTATOR_MIXIN;

interface TextJoinMixin extends TextJoinMixinType { }

export type TextJoinBlock = InlineSvgsExtensionBlock & TextJoinMixin;


const TEXT_JOIN_MUTATOR_MIXIN = {
    itemCount_: 0,
    valueConnections_: [] as Blockly.Connection[],

    mutationToDom: function (this: TextJoinBlock) {
        const container = Blockly.utils.xml.createElement('mutation');
        container.setAttribute('items', this.itemCount_ + "");
        return container;
    },
    domToMutation: function (this: TextJoinBlock, xmlElement: Element) {
        this.itemCount_ = parseInt(xmlElement.getAttribute('items'), 10);
        this.updateShape_();
    },
    storeValueConnections_: function (this: TextJoinBlock) {
        this.valueConnections_ = [];
        for (let i = 0; i < this.itemCount_; i++) {
            this.valueConnections_.push(this.getInput('ADD' + i).connection.targetConnection);
        }
    },
    restoreValueConnections_: function (this: TextJoinBlock) {
        for (let i = 0; i < this.itemCount_; i++) {
            this.valueConnections_[i]?.reconnect(this, 'ADD' + i);
        }
    },
    addItem_: function (this: TextJoinBlock) {
        this.storeValueConnections_();
        const update = () => {
            this.itemCount_++;
        };
        this.update_(update);
        this.restoreValueConnections_();
        // Add shadow block
        if (this.itemCount_ > 1) {
            // Find shadow type
            const firstInput = this.getInput('ADD' + 0);
            if (firstInput && firstInput.connection.targetConnection) {
                // Create a new shadow DOM with the same type as the first input
                // but with an empty default value
                const newInput = this.getInput('ADD' + (this.itemCount_ - 1));
                const shadowInputDom = firstInput.connection.getShadowDom();
                if (shadowInputDom) {
                    const shadowDom = Blockly.utils.xml.createElement('shadow');
                    const shadowInputType = shadowInputDom.getAttribute('type');
                    shadowDom.setAttribute('type', shadowInputType);
                    if (shadowDom) {
                        shadowDom.setAttribute('id', Blockly.utils.idGenerator.genUid());
                        newInput.connection.setShadowDom(shadowDom);
                        // newInput.connection.respawnShadow_();
                    }
                }
            }
        }
    },
    removeItem_: function (this: TextJoinBlock) {
        this.storeValueConnections_();
        const update = () => {
            this.itemCount_--;
        };
        this.update_(update);
        this.restoreValueConnections_();
    },
    update_: function (this: TextJoinBlock, update: () => void) {
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
    updateShape_: function (this: TextJoinBlock) {
        const that = this;
        const add = function () {
            that.addItem_();
        };
        const remove = function () {
            that.removeItem_();
        };
        // pxt-blockly: our join block can't be empty
        if (this.getInput('EMPTY')) {
            this.removeInput('EMPTY');
        }
        if (!this.getInput('TITLE')) {
            this.appendDummyInput('TITLE')
                .appendField(Blockly.Msg['TEXT_JOIN_TITLE_CREATEWITH']);
        }
        // Add new inputs.
        let i: number;
        for (i = 0; i < this.itemCount_; i++) {
            if (!this.getInput('ADD' + i)) {
                const input = this.appendValueInput('ADD' + i)
                    // pxt-blockly: pxt-blockly/pull/112
                    .setAlign(Blockly.inputs.Align.LEFT);
                // if (i == 0) {
                //   input.appendField(Blockly.Msg['TEXT_JOIN_TITLE_CREATEWITH']);
                // }
            }
        }
        // Remove deleted inputs.
        while (this.getInput('ADD' + i)) {
            this.removeInput('ADD' + i);
            i++;
        }

        // pxt-blockly: Use +/- buttons for mutation
        if (this.getInput('BUTTONS')) this.removeInput('BUTTONS');
        const buttons = this.appendDummyInput('BUTTONS');
        if (this.itemCount_ > 1) {
            buttons.appendField(new Blockly.FieldImage(this.REMOVE_IMAGE_DATAURI, 24, 24, "*", remove, false));
        }
        buttons.appendField(new Blockly.FieldImage(this.ADD_IMAGE_DATAURI, 24, 24, "*", add, false));

        // Switch to vertical list when there are too many items
        const horizontalLayout = this.itemCount_ <= 4;
        this.setInputsInline(horizontalLayout);
        if (this.workspace instanceof Blockly.WorkspaceSvg) {
            const renderer = this.workspace.getRenderer();
            this.setOutputShape(horizontalLayout ?
                renderer.getConstants().SHAPES["ROUND"] : renderer.getConstants().SHAPES["SQUARE"]);
        }
    }
};

/**
 * Performs final setup of a text_join block.
 * @this {Blockly.Block}
 */
const TEXT_JOIN_EXTENSION = function (this: TextJoinBlock) {
    // Add the quote mixin for the itemCount_ = 0 case.
    // this.mixin(Blockly.Constants.Text.QUOTE_IMAGE_MIXIN);
    // Initialize the mutator values.
    Blockly.Extensions.apply('inline-svgs', this, false);
    this.itemCount_ = 2;
    this.updateShape_();
};

Blockly.Extensions.registerMutator('pxt_text_join_mutator',
    TEXT_JOIN_MUTATOR_MIXIN,
    TEXT_JOIN_EXTENSION
);

Blockly.defineBlocksWithJsonArray([
    {
        "type": "text_join",
        "message0": "",
        "output": "String",
        "outputShape": new Blockly.zelos.ConstantProvider().SHAPES.ROUND,
        "style": "text_blocks",
        "helpUrl": "%{BKY_TEXT_JOIN_HELPURL}",
        "tooltip": "%{BKY_TEXT_JOIN_TOOLTIP}",
        "mutator": "pxt_text_join_mutator"
      },
])