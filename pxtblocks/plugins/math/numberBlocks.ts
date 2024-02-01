import * as Blockly from "blockly";
import { FieldSlider } from "./fieldSlider";

const provider = new Blockly.zelos.ConstantProvider();

Blockly.defineBlocksWithJsonArray([
    // Block for integer numeric value.
    {
        "type": "math_integer",
        "message0": "%1",
        "args0": [{
            "type": "field_number",
            "name": "NUM",
            "precision": 1
        }],
        "output": "Number",
        "outputShape": provider.SHAPES.ROUND,
        "style": "field_blocks",
        "helpUrl": "%{BKY_MATH_NUMBER_HELPURL}",
        "tooltip": "%{BKY_MATH_NUMBER_TOOLTIP}",
        "extensions": ["parent_tooltip_when_inline"]
    },

    // Block for whole numeric value.
    {
        "type": "math_whole_number",
        "message0": "%1",
        "args0": [{
            "type": "field_number",
            "name": "NUM",
            "min": 0,
            "precision": 1
        }],
        "output": "Number",
        "outputShape": provider.SHAPES.ROUND,
        "style": "field_blocks",
        "helpUrl": "%{BKY_MATH_NUMBER_HELPURL}",
        "tooltip": "%{BKY_MATH_NUMBER_TOOLTIP}",
        "extensions": ["parent_tooltip_when_inline"]
    },

    // Block for positive numeric value.
    {
        "type": "math_positive_number",
        "message0": "%1",
        "args0": [{
            "type": "field_number",
            "name": "NUM",
            "min": 0
        }],
        "output": "Number",
        "outputShape": provider.SHAPES.ROUND,
        "style": "field_blocks",
        "helpUrl": "%{BKY_MATH_NUMBER_HELPURL}",
        "tooltip": "%{BKY_MATH_NUMBER_TOOLTIP}",
        "extensions": ["parent_tooltip_when_inline"]
    },

    // Block for numeric value with min and max.
    {
        "type": "math_number_minmax",
        "message0": "%1",
        "args0": [{
            "type": "field_slider",
            "name": "SLIDER",
            "value": 0,
            "step": 1,
            "labelText": "Number"
        }],
        "output": "Number",
        "outputShape": provider.SHAPES.ROUND,
        "style": "field_blocks",
        "helpUrl": "%{BKY_MATH_NUMBER_HELPURL}",
        "tooltip": "%{BKY_MATH_NUMBER_TOOLTIP}",
        "mutator": "math_number_minmax_mutator",
        "extensions": ["parent_tooltip_when_inline"]
    },
])

const MATH_NUMBER_MINMAX_MIXIN = {
    /**
     * Create XML to represent whether the 'divisorInput' should be present.
     * @return {Element} XML storage element.
     * @this Blockly.Block
     */
    mutationToDom: function (this: Blockly.Block) {
        const slider = this.inputList[0].fieldRow[0] as unknown as FieldSlider
        let container = Blockly.utils.xml.createElement('mutation');
        if (slider.hasMin()) container.setAttribute('min', slider.getMin() + "");
        if (slider.hasMax()) container.setAttribute('max', slider.getMax() + "");
        if (slider.getLabel() != undefined) container.setAttribute('label', slider.getLabel());
        if (slider.getStep() != undefined) container.setAttribute('step', slider.getStep() + "");
        // if (slider.sliderColor_ != undefined) container.setAttribute('color', slider.sliderColor_);
        if (slider.getPrecision() != undefined) container.setAttribute('precision', slider.getPrecision() + "");
        return container;
    },
    /**
     * Parse XML to restore the 'divisorInput'.
     * @param {!Element} xmlElement XML storage element.
     * @this Blockly.Block
     */
    domToMutation: function (this: Blockly.Block, xmlElement: Element) {
        const slider = this.inputList[0].fieldRow[0] as unknown as FieldSlider
        const min = (xmlElement.getAttribute('min'));
        const max = (xmlElement.getAttribute('max'));
        const step = (xmlElement.getAttribute('step'));
        const label = (xmlElement.getAttribute('label'));
        // const color = (xmlElement.getAttribute('color'));
        const precision = (xmlElement.getAttribute('precision'));
        slider.setLabel(label);
        slider.setOptions(min, max, step, precision);
        // slider.setColor(color);
    }
};

Blockly.Extensions.registerMutator('math_number_minmax_mutator', MATH_NUMBER_MINMAX_MIXIN);