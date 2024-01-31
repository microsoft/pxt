import * as Blockly from "blockly";

Blockly.defineBlocksWithJsonArray([  // BEGIN JSON EXTRACT
  // Block for text value
  {
    "type": "text",
    "message0": "%1",
    "args0": [{
      "type": "field_string",
      "name": "TEXT",
      "text": ""
    }],
    "output": "String",
    "outputShape": new Blockly.zelos.ConstantProvider().SHAPES.ROUND,
    "style": "field_blocks",
    "helpUrl": "%{BKY_TEXT_TEXT_HELPURL}",
    "tooltip": "%{BKY_TEXT_TEXT_TOOLTIP}",
    "extensions": [
      //"text_quotes",
      "parent_tooltip_when_inline"
    ]
  }
]);