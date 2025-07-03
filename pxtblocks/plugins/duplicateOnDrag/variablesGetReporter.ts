import * as Blockly from "blockly";
import { updateDuplicateOnDragState } from "./duplicateOnDrag";


Blockly.Blocks["variables_get_reporter"] = {
    init: function (this: Blockly.BlockSvg) {
        this.jsonInit({
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
        });

        updateDuplicateOnDragState(this);
    }
}
