'use strict';

goog.provide('Blockly.Blocks.device');

goog.require('Blockly.Blocks');


Blockly.FieldCheckbox.prototype.init = function(block) {
  if (this.sourceBlock_) {
    // Checkbox has already been initialized once.
    return;
  }
  Blockly.FieldCheckbox.superClass_.init.call(this, block);
  // The checkbox doesn't use the inherited text element.
  // Instead it uses a custom checkmark element that is either visible or not.
  this.checkElement_ = Blockly.createSvgElement('text',
      {'class': 'blocklyText blocklyLed', 'x': 0, 'y': 12}, this.fieldGroup_);
  var textNode = document.createTextNode('■');
  this.checkElement_.appendChild(textNode);
  this.checkElement_.style.display = this.state_ ? 'block' : 'none';
};

var blockColors = {
    loops: 120,
    variables: 330,
}

Blockly.Variables.flyoutCategory = function(workspace) {
  var variableList = Blockly.Variables.allVariables(workspace);
  variableList.sort(goog.string.caseInsensitiveCompare);
  // In addition to the user's variables, we also want to display the default
  // variable name at the top.  We also don't want this duplicated if the
  // user has created a variable of the same name.
  goog.array.remove(variableList, Blockly.Msg.VARIABLES_DEFAULT_NAME);
  variableList.unshift(Blockly.Msg.VARIABLES_DEFAULT_NAME);

  var xmlList = [];
  // variables getters first
  for (var i = 0; i < variableList.length; i++) {
      // <block type="variables_get" gap="24">
      //   <field name="VAR">item</field>
      // </block>
      var block = goog.dom.createDom('block');
      block.setAttribute('type', 'variables_get');
      block.setAttribute('gap', 8);
      var field = goog.dom.createDom('field', null, variableList[i]);
      field.setAttribute('name', 'VAR');
      block.appendChild(field);
      xmlList.push(block);
  }
  xmlList[xmlList.length - 1].setAttribute('gap', 24);

  for (var i = 0; i < Math.min(1,variableList.length); i++) {
    {
      // <block type="variables_set" gap="8">
      //   <field name="VAR">item</field>
      // </block>
      var block = goog.dom.createDom('block');
      block.setAttribute('type', 'variables_set');
      block.setAttribute('gap', 8);
      var field = goog.dom.createDom('field', null, variableList[i]);
      field.setAttribute('name', 'VAR');
      block.appendChild(field);
      xmlList.push(block);
    }
    {
      // <block type="variables_get" gap="24">
      //   <field name="VAR">item</field>
      // </block>
      var block = goog.dom.createDom('block');
      block.setAttribute('type', 'variables_change');
      block.setAttribute('gap', 24);
      var value = goog.dom.createDom('value');
      value.setAttribute('name', 'VALUE');
      var shadow = goog.dom.createDom('shadow');
      shadow.setAttribute("type", "math_number");
      value.appendChild(shadow);
      var field = goog.dom.createDom('field');
      field.setAttribute('name', 'NUM');
      field.innerText = 1;
      shadow.appendChild(field);
      block.appendChild(value);
      
      xmlList.push(block);
    }    
  }
  return xmlList;
};

Blockly.Blocks['math_op2'] = {
  init: function() {
    this.setHelpUrl('./blocks/contents');
    this.setColour(230);
    this.appendValueInput("x")
        .setCheck("Number")
        .appendField(new Blockly.FieldDropdown([["min", "min"], ["max", "max"]]), "op")
        .appendField("of");
    this.appendValueInput("y")
        .setCheck("Number")
        .appendField("and");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setTooltip('Math operators.');
  }
};

Blockly.Blocks['math_op3'] = {
  init: function() {
    this.setHelpUrl('./blocks/contents');
    this.setColour(230);
    this.appendDummyInput()
        .appendField("absolute of");
    this.appendValueInput("x")
        .setCheck("Number")
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setTooltip('Math operators.');
  }
};

Blockly.Blocks['device_while'] = {
  init: function() {
    this.setHelpUrl('./blocks/while');
    this.setColour(blockColors.loops);
    this.appendValueInput("COND")
        .setCheck("Boolean")
        .appendField("while");
    this.appendStatementInput("DO")
        .appendField("do");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Run the same sequence of actions while the condition is met. Don\'t forget to pause!');
  }
};

Blockly.Blocks['device_random'] = {
  init: function() {
    this.setHelpUrl('./functions/random');
    this.setColour(230);
    this.appendDummyInput()
        .appendField("pick random 0 to")
        .appendField(new Blockly.FieldTextInput("0", Blockly.FieldTextInput.numberValidator), "limit");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setTooltip('Returns a random integer between 0 and the specified bound (inclusive).');
  }
};

Blockly.Blocks['controls_simple_for'] = {
  /**
   * Block for 'for' loop.
   * @this Blockly.Block
   */
  init: function() {
    this.setHelpUrl("./blocks/for");
    this.setColour(Blockly.Blocks.loops.HUE);
    this.appendDummyInput()
        .appendField("for")
        .appendField(new Blockly.FieldVariable(null), 'VAR')
        .appendField("from 0 to");
    this.appendValueInput("TO")
        .setCheck("Number")
        .setAlign(Blockly.ALIGN_RIGHT);
    this.appendStatementInput('DO')
        .appendField(Blockly.Msg.CONTROLS_FOR_INPUT_DO);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setInputsInline(true);
    // Assign 'this' to a variable for use in the tooltip closure below.
    var thisBlock = this;
    this.setTooltip(function() {
      return Blockly.Msg.CONTROLS_FOR_TOOLTIP.replace('%1',
          thisBlock.getFieldValue('VAR'));
    });
  },
  /**
   * Return all variables referenced by this block.
   * @return {!Array.<string>} List of variable names.
   * @this Blockly.Block
   */
  getVars: function() {
    return [this.getFieldValue('VAR')];
  },
  /**
   * Notification that a variable is renaming.
   * If the name matches one of this block's variables, rename it.
   * @param {string} oldName Previous name of variable.
   * @param {string} newName Renamed variable.
   * @this Blockly.Block
   */
  renameVar: function(oldName, newName) {
    if (Blockly.Names.equals(oldName, this.getFieldValue('VAR'))) {
      this.setFieldValue(newName, 'VAR');
    }
  },
  /**
   * Add menu option to create getter block for loop variable.
   * @param {!Array} options List of menu options to add to.
   * @this Blockly.Block
   */
  customContextMenu: function(options) {
    if (!this.isCollapsed()) {
      var option = {enabled: true};
      var name = this.getFieldValue('VAR');
      option.text = Blockly.Msg.VARIABLES_SET_CREATE_GET.replace('%1', name);
      var xmlField = goog.dom.createDom('field', null, name);
      xmlField.setAttribute('name', 'VAR');
      var xmlBlock = goog.dom.createDom('block', null, xmlField);
      xmlBlock.setAttribute('type', 'variables_get');
      option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
      options.push(option);
    }
  }
};


Blockly.Blocks['variables_change'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("change")
        .appendField(new Blockly.FieldVariable("item"), "VAR");
    this.appendValueInput("VALUE")
        .setCheck("Number")
        .appendField("by");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Changes the value of the variable by this amount');
    this.setHelpUrl('./blocks/assign');
    this.setColour(blockColors.variables);
  }
};

Blockly.BlockSvg.START_HAT = true;

// Here's a helper to override the help URL for a block that's *already defined
// by Blockly*. For blocks that we define ourselves, just change the call to
// setHelpUrl in the corresponding definition above.
function monkeyPatchBlock(id, name, url) {
    var old = Blockly.Blocks[id].init;
    // fix sethelpurl
    Blockly.Blocks[id].init = function () {
        // The magic of dynamic this-binding.
        old.call(this);
        this.setHelpUrl(url);
        if (!old.codeCard) {
            var tb = document.getElementById('blocklyToolboxDefinition');
            var xml = tb ? tb.querySelector("category block[type~='" + id + "']") : undefined;
            this.codeCard = {
                name: name,
                description: this.tooltip,
                blocksXml: xml ? ("<xml>" + xml.outerHTML + "</xml>") : undefined,
                url: url
            }
        }
    };
}

monkeyPatchBlock("controls_if", "if", "blocks/if");
monkeyPatchBlock("controls_repeat_ext", "for loop", "blocks/repeat");
monkeyPatchBlock("variables_set", "variable assignment", "blocks/assign");
monkeyPatchBlock("math_number", "number", "blocks/number");
monkeyPatchBlock("logic_compare", "boolean operator", "blocks/boolean");
monkeyPatchBlock("logic_operation", "boolean operation", "blocks/boolean");
monkeyPatchBlock("logic_negate", "not operator", "blocks/boolean");
monkeyPatchBlock("logic_boolean", "boolean value", "blocks/boolean");
monkeyPatchBlock("math_arithmetic", "arithmetic operation", "blocks/boolean");
