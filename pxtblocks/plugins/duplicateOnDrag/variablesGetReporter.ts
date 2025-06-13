import * as Blockly from "blockly";
import { DUPLICATE_ON_DRAG_MUTATION_KEY } from "./duplicateOnDrag";
import { PathObject } from "../renderer/pathObject";

type VariablesGetReporterMixinType = typeof VARIABLES_GET_REPORTER_MIXIN;

interface VariablesGetReporterMixin extends VariablesGetReporterMixinType {}

export type VariablesGetReporterBlock = Blockly.BlockSvg & VariablesGetReporterMixin;

const VARIABLES_GET_REPORTER_MIXIN = {
    duplicateOnDrag_: false,

    mutationToDom(this: VariablesGetReporterBlock) {
        const container = Blockly.utils.xml.createElement("mutation");
        if (this.duplicateOnDrag_) {
            container.setAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY, "true");
        }
        return container;
    },

    domToMutation(this: VariablesGetReporterBlock, xmlElement: Element) {
        if (xmlElement.hasAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)) {
            this.duplicateOnDrag_ = xmlElement.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY).toLowerCase() === "true";
            if (this.pathObject) {
                (this.pathObject as PathObject).setHasDottedOutlineOnHover(this.duplicateOnDrag_);
            }
        }
    },
};

Blockly.Extensions.registerMutator("variables_get_reporter_mutator", VARIABLES_GET_REPORTER_MIXIN);

Blockly.defineBlocksWithJsonArray([
    {
        "type": "variables_get_reporter",
        "message0": "%1",
        "args0": [
          {
            "type": "field_variable",
            "name": "VAR",
            "variable": "%{BKY_VARIABLES_DEFAULT_NAME}",
            "variableTypes": [""],
          }
        ],
        "output": null,
        "colour": "%{BKY_VARIABLES_HUE}",
        "outputShape": new Blockly.zelos.ConstantProvider().SHAPES.ROUND,
        "helpUrl": "%{BKY_VARIABLES_GET_HELPURL}",
        "tooltip": "%{BKY_VARIABLES_GET_TOOLTIP}",
        "extensions": ["contextMenu_variableReporter"],
        "mutator": "variables_get_reporter_mutator"
      }
]);