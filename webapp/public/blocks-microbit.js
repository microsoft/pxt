'use strict';

goog.provide('Blockly.Blocks.device');

goog.require('Blockly.Blocks');


var leftRightDropdown = [
  ["right", "right"],
  ["left", "left"],
];

var spritePropertyDropdown = [
  ["x", "x"],
  ["y", "y"],
  ["direction", "direction"],
  ["blink", "blink"],
  ["brightness", "brightness"]
];

var accelerationEventDropdown = [
  ["shake", "shake"],
  ["screen up", "screen up"],
  ["screen down", "screen down"],  
  ["logo up", "logo up"],  
  ["logo down", "logo down"],  
];

var beatFractions = [
    ["1", "1"],
    ["1/2", "1/2"],
    ["1/4", "1/4"],
    ["1/8", "1/8"],
    ["1/16", "1/16"],
];

var blockColors = {
    basic: 190,
    led: 3,
    input: 300,
    loops: 120,
    pins: 351,
    music: 52,
    game: 176,
    //comments: 156,
    images: 45,
    variables: 330,
    devices: 156,
    radio: 270,
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
Blockly.Blocks['device_build_image'] = {
    init: function()
    {
        this.setColour(blockColors.images);
        this.appendDummyInput().appendField("create image");
        this.appendDummyInput().appendField("    0     1     2     3     4");
        this.appendDummyInput().appendField("0").appendField(new Blockly.FieldCheckbox("FALSE"), "LED00").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED10").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED20").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED30").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED40");
        this.appendDummyInput().appendField("1").appendField(new Blockly.FieldCheckbox("FALSE"), "LED01").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED11").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED21").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED31").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED41");
        this.appendDummyInput().appendField("2").appendField(new Blockly.FieldCheckbox("FALSE"), "LED02").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED12").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED22").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED32").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED42");
        this.appendDummyInput().appendField("3").appendField(new Blockly.FieldCheckbox("FALSE"), "LED03").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED13").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED23").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED33").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED43");
        this.appendDummyInput().appendField("4").appendField(new Blockly.FieldCheckbox("FALSE"), "LED04").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED14").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED24").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED34").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED44");
        this.setOutput(true, 'image');
        this.setTooltip('An image that fits on the LED array.');
        this.setHelpUrl("./functions/create-image");
    }
};

Blockly.Blocks['device_build_big_image'] = {
    init: function()
    {
        this.setColour(blockColors.images);
        this.appendDummyInput().appendField("create big image");
        this.appendDummyInput().appendField("    0     1     2     3     4       5     6     7     8     9");

        this.appendDummyInput().appendField("0").appendField(new Blockly.FieldCheckbox("FALSE"), "LED00").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED10").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED20").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED30").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED40")
            .appendField("   ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED50").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED60").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED70").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED80").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED90");

        this.appendDummyInput().appendField("1").appendField(new Blockly.FieldCheckbox("FALSE"), "LED01").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED11").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED21").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED31").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED41")
            .appendField("   ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED51").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED61").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED71").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED81").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED91");

        this.appendDummyInput().appendField("2").appendField(new Blockly.FieldCheckbox("FALSE"), "LED02").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED12").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED22").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED32").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED42")
            .appendField("   ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED52").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED62").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED72").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED82").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED92");

        this.appendDummyInput().appendField("3").appendField(new Blockly.FieldCheckbox("FALSE"), "LED03").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED13").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED23").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED33").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED43")
            .appendField("   ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED53").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED63").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED73").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED83").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED93");

        this.appendDummyInput().appendField("4").appendField(new Blockly.FieldCheckbox("FALSE"), "LED04").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED14").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED24").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED34").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED44")
            .appendField("   ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED54").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED64").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED74").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED84").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED94");


        this.setOutput(true, 'image');
        this.setTooltip("A larger image that will be scrolled across the LED display.");
        this.setHelpUrl("./functions/create-image");
    }
};

Blockly.Blocks['device_show_image_offset'] = {
  init: function() {
    this.setHelpUrl('./functions/show-image');
    this.setColour(blockColors.images);
    this.appendDummyInput()
        .appendField("show image");
    this.appendValueInput("sprite").setCheck('image');
    this.appendValueInput("offset")
        .setCheck("Number")
        .appendField("at offset");
    this.setTooltip('For a given (possibly big) image, display only frame, starting at offset.');
    this.setPreviousStatement(!0);
    this.setNextStatement(!0);
    this.setInputsInline(true);
  }
};

Blockly.Blocks['device_scroll_image'] = {
  init: function() {
    this.setHelpUrl('./functions/scroll-image');
    this.setColour(blockColors.images);
    this.appendDummyInput()
        .appendField("scroll image");
    this.appendValueInput("sprite").setCheck('image')
        .setAlign(Blockly.ALIGN_RIGHT);
//        .appendField("image");
    this.appendValueInput("frame offset")
        .setCheck("Number")
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField("with offset");
    this.appendValueInput("delay")
        .setCheck("Number")
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField("and interval (ms)");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Display an image, scrolling it if it doesn\'t fit on the display.');
    this.setInputsInline(true);
  }
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

Blockly.Blocks['game_turn_sprite'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendDummyInput().appendField("turn");
        this.appendValueInput("sprite")
            .setCheck("sprite")
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(leftRightDropdown), "direction");
        this.appendValueInput("angle")
            .setCheck("Number")
            .appendField("by");
        this.appendDummyInput().appendField("degrees");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Turns the sprite by the given amount');
        this.setHelpUrl("./functions/sprites-library");
    }
};

Blockly.Blocks['game_sprite_bounce'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendValueInput("sprite")
            .setCheck("sprite")
            .appendField("if");
        this.appendDummyInput().appendField("on edge, bounce");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('If touching the edge of the screen, then bounce away');
        this.setHelpUrl("./functions/sprites-library");
    }
};

Blockly.Blocks['game_sprite_touching_sprite'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendValueInput("sprite")
            .setCheck("sprite");
        this.appendValueInput("other")
            .setCheck("sprite")
            .appendField("touching");
        this.appendDummyInput().appendField("?");
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setTooltip('Reports true if both sprites are touching.');
        this.setHelpUrl("./functions/sprites-library");
    }
};

Blockly.Blocks['game_sprite_touching_edge'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendValueInput("sprite")
            .setCheck("sprite");
        this.appendDummyInput()
            .appendField("touching edge?");
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setTooltip('Reports true if the sprite is on the edge of the screen.');
        this.setHelpUrl("./functions/sprites-library");
    }
};

Blockly.Blocks['game_sprite_property'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(spritePropertyDropdown), "property");
        this.appendValueInput("sprite")
            .setCheck("sprite")
            .appendField("of");
        this.setInputsInline(true);
        this.setOutput(true, 'Number');
        this.setTooltip('Reports the property of the sprite');
        this.setHelpUrl("./functions/sprites-library");
    }
};

Blockly.Blocks['game_sprite_change_xy'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendDummyInput().appendField("change");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(spritePropertyDropdown), "property");
        this.appendValueInput("sprite")
            .setCheck("sprite")
            .appendField("of");
        this.appendValueInput("value")
            .setCheck("Number")
            .appendField("by");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Change the property of the sprite by the given amount');
        this.setHelpUrl("./functions/sprites-library");
    }
};

Blockly.Blocks['game_sprite_set_property'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendDummyInput().appendField("set");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(spritePropertyDropdown), "property");
        this.appendValueInput("sprite")
            .setCheck("sprite")
            .appendField("of");
        this.appendValueInput("value")
            .setCheck("Number")
            .appendField("to");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Sets the property of the sprite');
        this.setHelpUrl("./functions/sprites-library");
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


Blockly.Blocks['device_beat'] = {
    init: function()
    {
        this.setColour(blockColors.music);
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(beatFractions), "fraction");
        this.appendDummyInput()
            .appendField("beat (ms)");
        this.setOutput(true, "Number");
        this.setInputsInline(true);
        this.setTooltip('Gets the duration of a fraction of a beat from the current tempo (bpm)');
        this.setHelpUrl("./functions/tempo");
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
function monkeyPatchBlock(name, url) {
    var old = Blockly.Blocks[name].init;
    Blockly.Blocks[name].init = function () {
        // The magic of dynamic this-binding.
        old.call(this);
        this.setHelpUrl(url);
    };
}

monkeyPatchBlock("controls_if", "./blocks/if");
monkeyPatchBlock("controls_repeat_ext", "./blocks/repeat");
monkeyPatchBlock("variables_set", "./blocks/assign");
//monkeyPatchBlock("variables_get", "./blocks/number");
monkeyPatchBlock("math_number", "./blocks/number");
monkeyPatchBlock("logic_compare", "./blocks/boolean");
monkeyPatchBlock("logic_operation", "./blocks/boolean");
monkeyPatchBlock("logic_negate", "./blocks/boolean");
monkeyPatchBlock("logic_boolean", "./blocks/boolean");
monkeyPatchBlock("math_arithmetic", "./blocks/boolean");
