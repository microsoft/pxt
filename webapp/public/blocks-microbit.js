'use strict';

goog.provide('Blockly.Blocks.device');

goog.require('Blockly.Blocks');

function iconToFieldImage(c) {
    var canvas= document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font="56px Icons";
    ctx.textAlign = "center";
    ctx.fillText(c,canvas.width/2, 56);
    return new Blockly.FieldImage(canvas.toDataURL(), 16, 16, '');
}

var buttonsDropdownOn = [
  ["A", "A"],
  ["B", "B"],
  ["A+B", "A+B"],
];

var buttonsDropdownIs = [
  ["A", "A"],
  ["B", "B"],
];

var analogPinsDropdown = [
  ["P0", "P0"],
  ["P1", "P1"],
  ["P2", "P2"]
];

var digitalPinsDropdown = [
  ["P0", "P0"],
  ["P1", "P1"],
  ["P2", "P2"],
  ["P8", "P8"],
  ["P12", "P12"],
  ["P16", "P16"]
];

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

var cameraMessageDropdown = [
    ["take photo", "take photo"],
    ["start video capture", "start video capture"],
    ["stop video capture", "stop video capture"],
    ["toggle front-rear", "toggle front-rear"],
    ["launch photo mode", "launch photo mode"],
    ["launch video mode", "launch video mode"],
    ["stop photo mode", "stop photo mode"],
    ["stop video mode", "stop video mode"],
];

var alertMessageDropdown = [
    ["display toast", "display toast"],
    ["vibrate", "vibrate"],
    ["play sound", "play sound"],
    ["play ringtone", "play ringtone"],
    ["find my phone", "find my phone"],
    ["ring alarm", "ring alarm"],
];

var remoteControlMessageDropdown = [
    ["play","play"],
    ["pause", "pause"],
    ["stop", "stop"],
    ["next track", "next track"],
    ["previous track","previous track"],
    ["forward", "forward"],
    ["rewind","rewind"],
    ["volume up","volume up"],
    ["volume down", "volume down"]    
];

var deviceInfoEventDropdown = [
    ["incoming call", "incoming call"],
    ["incoming message", "incoming message"],
    ["orientation landscape", "orientation landscape"],
    ["orientation portrait", "orientation portrait"],
    ["shaken", "shaken"],
    ["display off", "display off"],
    ["display on", "display on"]
];

var gamepadButtonEventDropdown = [
    ["A down",  "A down"],
    ["A up",    "A up"],
    ["B down",  "B down"],
    ["B up",    "B up"],
    ["C down",  "C down"],
    ["C up",    "C up"],
    ["D down",  "D down"],
    ["D up",    "D up"],
    ["1 down",  "1 down"],
    ["1 up",    "1 up"],
    ["2 down",  "2 down"],
    ["2 up",    "2 up"],
    ["3 down",  "3 down"],
    ["3 up",    "3 up"],
    ["4 down",  "4 down"],
    ["4 up",    "4 up"]
];

var notes = {
    "C": 262,
    "C#": 277,
    "D": 294,
    "Eb": 311,
    "E": 330,
    "F": 349,
    "F#": 370,
    "G": 392,
    "G#": 415,
    "A": 440,
    "Bb": 466,
    "B": 494,
    "C5":523,
};

var dimensionDropdown = [
    ["x", "x"],
    ["y", "y"],
    ["z", "z"],
    ["strength", "strength"]
];

var rotationDropDown = [
    ["pitch", "pitch"],
    ["roll", "roll"],
];

var beatFractions = [
    ["1", "1"],
    ["1/2", "1/2"],
    ["1/4", "1/4"],
    ["1/8", "1/8"],
    ["1/16", "1/16"],
];

var notesDropdown = Object.keys(notes).map(function (note) { return [note, note] });

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
      
      /*
          <value name="value">
            <shadow type="math_number">
              <field name="NUM">1</field>
            </shadow>
          </value>            
      
       */
      xmlList.push(block);
    }    
  }
  return xmlList;
};

//https://blockly-demo.appspot.com/static/demos/blockfactory/index.html#tmkc86
/* Blockly.Blocks['device_print_message'] = {
  init: function() {
    this.setHelpUrl("./functions/show-string");
    this.setColour(blockColors.basic);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf031"))
        .appendField("show");
    this.appendValueInput("message")
        .setCheck("String")
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField("string");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Shows the specified string and scrolls it if necessary.');
    this.setInputsInline(true);
 }
}; */

//https://blockly-demo.appspot.com/static/demos/blockfactory/index.html#xiu9u7
/*Blockly.Blocks['device_show_number'] = {
  init: function() {
    this.setHelpUrl('./functions/show-number');
    this.setColour(blockColors.basic);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf1ec"))
        .appendField("show number");
    this.appendValueInput("number")
        .setCheck("Number")
        .setAlign(Blockly.ALIGN_RIGHT);    
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Shows the specified number and scrolls it if necessary.');
  }
};*/

Blockly.Blocks['device_shake_event'] = {
  init: function() {
    this.setHelpUrl('./functions/on-shake');
    this.setColour(blockColors.input);
    this.appendDummyInput()
        .appendField("on shake");
    this.appendStatementInput("HANDLER")
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField("do");
    this.setInputsInline(true);
    this.setTooltip('React to the device being shaken.');
  }
};

/*
Blockly.Blocks['device_gesture_event'] = {
  init: function() {
    this.setHelpUrl('./functions/on-shake');
    this.setColour(blockColors.input);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf135"))
        .appendField("on");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(accelerationEventDropdown), "NAME");        
    this.appendStatementInput("HANDLER")
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField("do");
    this.setInputsInline(true);
    this.setTooltip('React to a gesture.');
  }
};*/

/*
Blockly.Blocks['device_pin_event'] = {
  init: function() {
    this.setHelpUrl('./functions/on-pin-pressed');
    this.setColour(blockColors.input);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf094"))
        .appendField("on pin");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(analogPinsDropdown), "NAME");
    this.appendDummyInput()
        .appendField("pressed");
    this.appendStatementInput("HANDLER")
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField("do");
    this.setInputsInline(true);
    this.setTooltip('React to a pin press.');
  }
}; */

/*
Blockly.Blocks['device_button_event'] = {
  init: function() {
    this.setHelpUrl('./functions/on-button-pressed');
    this.setColour(blockColors.input);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf192"))
        .appendField("on button");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(buttonsDropdownOn), "NAME");
    this.appendDummyInput()
        .appendField("pressed");
    this.appendStatementInput("HANDLER")
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField("do");
    this.setInputsInline(true);
    this.setTooltip('React to a button press.');
  }
}; */

// The old "button is pressed" that also has A+B. We have to keep this one
// defined otherwise old scripts won't load!
Blockly.Blocks['device_get_button'] = {
  init: function() {
    this.setHelpUrl('./functions/button-is-pressed');
    this.setColour(blockColors.input);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf192"))
        .appendField("button");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(buttonsDropdownOn), "NAME");
    this.appendDummyInput()
        .appendField("is pressed");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setTooltip('Test whether a button is pressed or not.');
  }
};

// The new "button is pressed" that doesn't have A+B.
/*
Blockly.Blocks['device_get_button2'] = {
  init: function() {
    this.setHelpUrl('https://live.microbit.co.uk/functions/button-is-pressed');
    this.setColour(blockColors.input);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf192"))
        .appendField("button");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(buttonsDropdownIs), "NAME");
    this.appendDummyInput()
        .appendField("is pressed");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setTooltip('Test whether a button is pressed or not.');
  }
};
*/

/*
Blockly.Blocks['device_get_digital_pin'] = {
    init: function () {
        this.setHelpUrl('./functions/digital-read-pin');
        this.setColour(blockColors.pins);
        this.appendDummyInput()
            .appendField("digital read pin (0,1)")
            .appendField(new Blockly.FieldDropdown(digitalPinsDropdown), "name");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Read the value of a pin (either 0 or 1).');
    }
};*/

/*
Blockly.Blocks['device_set_digital_pin'] = {
    init: function () {
        this.setHelpUrl('./functions/digital-write-pin');
        this.setColour(blockColors.pins);
        this.appendDummyInput()
            .appendField("digital write (0,1)");
        this.appendValueInput("value")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("to pin")
            .appendField(new Blockly.FieldDropdown(digitalPinsDropdown), "name");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip('Set the value of a pin (either 0 or 1).');
    }
};*/

/*
Blockly.Blocks['device_get_analog_pin'] = {
    init: function () {
        this.setHelpUrl('./functions/analog-read-pin');
        this.setColour(blockColors.pins);
        this.appendDummyInput()
            .appendField("analog read pin")
            .appendField(new Blockly.FieldDropdown(analogPinsDropdown), "name");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Read an analog value on a pin (between 0 and 1023).');
    }
};*/

/*
Blockly.Blocks['device_set_analog_pin'] = {
    init: function () {
        this.setHelpUrl('./functions/analog-write-pin');
        this.setColour(blockColors.pins);
        this.appendDummyInput()
            .appendField("analog write");
        this.appendValueInput("value")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("to pin")
            .appendField(new Blockly.FieldDropdown(analogPinsDropdown), "name");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip('Set an analog value on a pin (between 0 and 1023).');
    }
};*/

/*
Blockly.Blocks['device_set_analog_period'] = {
    init: function () {
        this.setHelpUrl('./functions/analog-set-period');
        this.setColour(blockColors.pins);
        this.appendDummyInput()
            .appendField("analog set period");
        this.appendValueInput("micros")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("(micros) to pin")
            .appendField(new Blockly.FieldDropdown(analogPinsDropdown), "pin");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip('Configures the PWM in micro-seconds.');
    }
};*/

/*
Blockly.Blocks['device_set_servo_pin'] = {
    init: function () {
        this.setHelpUrl('./functions/servo-write-pin');
        this.setColour(blockColors.pins);
        this.appendDummyInput()
            .appendField("servo write");
        this.appendValueInput("value")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("to pin")
            .appendField(new Blockly.FieldDropdown(analogPinsDropdown), "name");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip('Sets the angle of the shaft of a servo in degrees between 0 and 180. For a continuous servo, will set the speed of the servo.');
    }
};*/

/*
Blockly.Blocks['device_set_servo_pulse'] = {
    init: function () {
        this.setHelpUrl('./functions/servo-set-pulse');
        this.setColour(blockColors.pins);
        this.appendDummyInput()
            .appendField("servo set pulse");
        this.appendValueInput("micros")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("(micros) to pin")
            .appendField(new Blockly.FieldDropdown(analogPinsDropdown), "pin");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip('Configures the period to be 20ms and sets the pulse width, based on the value it is given.');
    }
};*/

/*
Blockly.Blocks['math_map'] = {
    init: function () {
        this.setHelpUrl('./functions/map');
        this.setColour(blockColors.pins);
        this.appendValueInput("value")
            .setCheck("Number")
            .appendField("map");
        this.appendValueInput("fromLow")
            .setCheck("Number")
            .appendField("from low");
        this.appendValueInput("fromHigh")
            .setCheck("Number")
            .appendField("from high");
        this.appendValueInput("toLow")
            .setCheck("Number")
            .appendField("to low");
        this.appendValueInput("toHigh")
            .setCheck("Number")
            .appendField("to high");
        this.setInputsInline(false);                                  
        this.setOutput(true, "Number");
        this.setTooltip("Re-maps a number from one range to another.");
    }
};*/

/*
Blockly.Blocks['device_get_brightness'] = {
    init: function () {
        this.setHelpUrl('./functions/brightness');
        this.setColour(blockColors.led);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf042"))
            .appendField("brightness");
        this.setOutput(true, "Number");
        this.setTooltip('Get the current brightness of the screen (between 0 and 255).');
    }
};*/

/*
Blockly.Blocks['device_set_brightness'] = {
    init: function () {
        this.setHelpUrl('./functions/set-brightness');
        this.setColour(blockColors.led);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf042"))
            .appendField("set brightness");
        this.appendValueInput("value")
            .setCheck("Number");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip('Set the current brightness of the screen (between 0 and 255).');
    }
};*/

/*
Blockly.Blocks['device_get_acceleration'] = {
    init: function () {
        this.setHelpUrl('./functions/acceleration');
        this.setColour(blockColors.input);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf135"))
            .appendField("acceleration (mg)");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(dimensionDropdown), "NAME");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Returns the acceleration on an axis (between -2048 and 2047).');
    }
};*/

/*
Blockly.Blocks['device_get_rotation'] = {
    init: function () {
        this.setHelpUrl('./functions/rotation');
        this.setColour(blockColors.input);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf197"))
            .appendField("rotation (°)");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(rotationDropDown), "NAME");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Returns the rotation in degrees.');
    }
}; */

/*
Blockly.Blocks['device_get_magnetic_force'] = {
    init: function () {
        this.setHelpUrl('./functions/magnetic-force');
        this.setColour(blockColors.input);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf076"))
            .appendField("magnetic force (microT)");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(dimensionDropdown), "NAME");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Get the magnetic force on an axis (in micro Tesla).');
    }
};*/

/*
Blockly.Blocks['device_get_light_level'] = {
    init: function () {
        this.setHelpUrl('./functions/light-level');
        this.setColour(blockColors.input);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf185"))
            .appendField("light level");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Get the light level from 0 (dark) to 255 (bright).');
    }
}; */

/*
Blockly.Blocks['device_get_running_time'] = {
    init: function () {
        this.setHelpUrl('./functions/running_time');
        this.setColour(blockColors.input);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf017"))
            .appendField("running time (ms)");
        this.setOutput(true, "Number");
        this.setTooltip('Get the number of milliseconds elapsed since the script began. 1,000 milliseconds = 1 second');
    }
};*/

//https://blockly-demo.appspot.com/static/demos/blockfactory/index.html#nwf7c5
/*
Blockly.Blocks['device_clear_display'] = {
  init: function() {
    this.setHelpUrl('./functions/clear-screen');
    this.setColour(blockColors.basic);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf12d"))
        .appendField("clear screen");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Turns all LEDs off.');
  }
};*/

/*
//https://blockly-demo.appspot.com/static/demos/blockfactory/index.html#rhpgfx
Blockly.Blocks['device_plot'] = {
  init: function() {
    this.setHelpUrl('./functions/plot');
    this.setColour(blockColors.led);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf205"))
        .appendField("plot");
    this.appendValueInput("x")
        .setCheck("Number")
        .appendField("x");
    this.appendValueInput("y")
        .setCheck("Number")
        .appendField("y");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Turns the LED at coordinates (x, y) on.');
  }
};*/

/*
Blockly.Blocks['device_unplot'] = {
  init: function() {
    this.setHelpUrl('./functions/unplot');
    this.setColour(blockColors.led);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf204"))
        .appendField("unplot");
    this.appendValueInput("x")
        .setCheck("Number")
        .appendField("x");
    this.appendValueInput("y")
        .setCheck("Number")
        .appendField("y");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Turns the LED at coordinates (x, y) off.');
  }
};*/

/*
Blockly.Blocks['device_stop_animation'] = {
  init: function() {
    this.setHelpUrl('./functions/stop-animation');
    this.setColour(blockColors.led);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf04d"))
        .appendField("stop animation");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Cancels all current and pending animations.');
  }
};*/

//https://blockly-demo.appspot.com/static/demos/blockfactory/index.html#jw5b4i
/*
Blockly.Blocks['device_point'] = {
  init: function() {
    this.setHelpUrl('./functions/point');
    this.setColour(blockColors.led);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf10c"))
        .appendField("point");
    this.appendValueInput("x")
        .setCheck("Number")
        .appendField("x");
    this.appendValueInput("y")
        .setCheck("Number")
        .appendField("y");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setTooltip('Returns true if the LED at coordinates (x, y) is on, false otherwise.');
  }
};*/

/*
Blockly.Blocks['device_plot_bar_graph'] = {
  init: function() {
    this.setHelpUrl('./functions/plot-bar-graph');
    this.setColour(blockColors.led);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf080"))
        .appendField("plot bar graph");
    this.appendValueInput("value")
        .setCheck("Number")
        .appendField("of");
    this.appendValueInput("high")
        .setCheck("Number")
        .appendField("up to");
   // this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Displays a bar graph of the value compared to high.');
  }
};*/

/*
Blockly.Blocks['device_temperature'] = {
    init: function () {
        this.setHelpUrl('./functions/temperature');
        this.setColour(blockColors.input);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf06d"))
            .appendField("temperature (°C)");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Returns a temperature in Celsius degrees.');
    }
};
*/

/*
Blockly.Blocks['device_heading'] = {
    init: function () {
        this.setHelpUrl('./functions/compass-heading');
        this.setColour(blockColors.input);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf14e"))
            .appendField("compass heading (°)");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Returns an orientation (between 0 and 360°). 0 is North.');
    }
};
*/

/*
Blockly.Blocks['device_show_leds'] = {
    init: function()
    {
        this.setColour(blockColors.basic);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf00a"))
            .appendField("show leds");
        this.appendDummyInput().appendField(new Blockly.FieldCheckbox("FALSE"), "LED00").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED10").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED20").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED30").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED40");
        this.appendDummyInput().appendField(new Blockly.FieldCheckbox("FALSE"), "LED01").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED11").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED21").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED31").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED41");
        this.appendDummyInput().appendField(new Blockly.FieldCheckbox("FALSE"), "LED02").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED12").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED22").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED32").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED42");
        this.appendDummyInput().appendField(new Blockly.FieldCheckbox("FALSE"), "LED03").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED13").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED23").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED33").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED43");
        this.appendDummyInput().appendField(new Blockly.FieldCheckbox("FALSE"), "LED04").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED14").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED24").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED34").appendField(" ").appendField(new Blockly.FieldCheckbox("FALSE"), "LED44");
        this.setTooltip('Show the given led pattern on the display.');
        this.setHelpUrl("./functions/show-leds");
    }
}; */

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

/*
Blockly.Blocks['device_pause'] = {
  init: function() {
    this.setHelpUrl('./functions/pause');
    this.setColour(blockColors.basic);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf110"))
        .appendField("pause (ms)");
    this.appendValueInput("pause")
        .setCheck("Number");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Stop execution for the given delay, hence allowing other threads of execution to run.');
  }
};
*/

/*
Blockly.Blocks['device_forever'] = {
  init: function() {
    this.setHelpUrl('./functions/forever');
    this.setColour(blockColors.basic);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf01e"))
        .appendField("forever");
    this.appendStatementInput("HANDLER")
        .setCheck("null");
    this.setInputsInline(true);
    //this.setPreviousStatement(true, "null");
    this.setTooltip('Run a sequence of operations repeatedly, in the background.');
  }
};*/

Blockly.Blocks['device_comment2'] = {
  init: function() {
    this.setHelpUrl('./td/comment');
    this.setColour(blockColors.comments);
    this.appendDummyInput()
        .appendField("comment:")
        .appendField(new Blockly.FieldTextInput("..."), "comment");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Comment a piece of code. Comment is preserved when converting.');
  }
};

Blockly.Blocks['device_comment'] = {
  init: function() {
    this.setHelpUrl('./td/comment');
    this.setColour(blockColors.comments);
    this.appendDummyInput()
        .appendField("// comment");
    this.appendValueInput("comment")
        .setCheck("String");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Comment a piece of code. Comment is preserved when converting.');
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
    this.setHelpUrl('./blocks/contents');
    this.setColour(230);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf074"))
        .appendField("pick random 0 to")
        .appendField(new Blockly.FieldTextInput("0", Blockly.FieldTextInput.numberValidator), "limit");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setTooltip('Returns a random integer between 0 and the specified bound (inclusive).');
  }
};

Blockly.Blocks['game_start_countdown'] = {
  init: function() {
    this.setHelpUrl('./blocks/game-library');
    this.setColour(blockColors.game);
    this.appendValueInput("duration")
        .setCheck("Number")
        .appendField("start countdown of ");
    this.appendDummyInput()
        .appendField("ms");
    this.setInputsInline(true);
    this.setTooltip('Starts a countdown game.');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
  }
};

Blockly.Blocks['game_score'] = {
  init: function() {
    this.setHelpUrl('./blocks/game-library');
    this.setColour(blockColors.game);
    this.appendDummyInput()
        .appendField("score");
    this.setInputsInline(true);
    this.setTooltip('Gets the current score.');
    this.setOutput(true, 'Number');
  }
};

Blockly.Blocks['game_add_score'] = {
  init: function() {
    this.setHelpUrl('./blocks/game-library');
    this.setColour(blockColors.game);
    this.appendValueInput("points")
        .setCheck("Number")
        .appendField("change score by");
    this.setInputsInline(true);
    this.setTooltip('Change score by the given amount of points.');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
  }
};

Blockly.Blocks['game_game_over'] = {
  init: function() {
    this.setHelpUrl('./blocks/game-library');
    this.setColour(blockColors.game);
    this.appendDummyInput()
        .appendField("game over");
    this.setInputsInline(true);
    this.setTooltip('Ends the game.');
    this.setPreviousStatement(true);
    this.setNextStatement(false);
  }
};

Blockly.Blocks['game_create_sprite'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendDummyInput().appendField("create sprite at");
        this.appendValueInput("x")
            .setCheck("Number")
            .appendField("x:");
        this.appendValueInput("y")
            .setCheck("Number")
            .appendField("y:");
        this.setInputsInline(true);
        this.setOutput(true, 'sprite');
        this.setTooltip('An LED sprite.');
        this.setHelpUrl("./functions/sprites-library");
    }
};

Blockly.Blocks['game_move_sprite'] = {
    init: function()
    {
        this.setColour(blockColors.game);
        this.appendDummyInput().appendField("move");
        this.appendValueInput("sprite")
            .setCheck("sprite")
        this.appendValueInput("leds")
            .setCheck("Number")
            .appendField("by");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Moves the sprite by the given LEDs');
        this.setHelpUrl("./functions/sprites-library");
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

/*
Blockly.Blocks['devices_camera'] = {
    init: function()
    {
        this.setColour(blockColors.devices);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf030"))
            .appendField("tell camera to ");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(cameraMessageDropdown), "property");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Sends a camera event');
        this.setHelpUrl("./functions/tell-camera-to");
    }
};*/

/*
Blockly.Blocks['devices_alert'] = {
    init: function()
    {
        this.setColour(blockColors.devices);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf0f3"))
            .appendField("raise alert to ");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(alertMessageDropdown), "property");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Sends an alert event');
        this.setHelpUrl("./functions/raise-alert-to");
    }
};*/

/*
Blockly.Blocks['devices_remote_control'] = {
    init: function()
    {
        this.setColour(blockColors.devices);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf144"))
            .appendField("tell remote control to ");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(remoteControlMessageDropdown), "property");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Sends an remote control event');
        this.setHelpUrl("./functions/tell-remote-control-to");
    }
};*/

/*
Blockly.Blocks['devices_gamepad_event'] = {
    init: function()
    {
        this.setColour(blockColors.devices);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf11b"))
            .appendField("on gamepad button");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(gamepadButtonEventDropdown), "NAME");
        this.appendStatementInput("HANDLER")
            .setAlign(Blockly.ALIGN_RIGHT)
            .appendField("do");
        this.setInputsInline(true);
        this.setTooltip('Registers code to run when the micro:bit receives a gamepad (DPAD) from the device');
        this.setHelpUrl("./functions/on-gamepad-button");
    }
};*/

/*
Blockly.Blocks['devices_device_info_event'] = {
    init: function()
    {
        this.setColour(blockColors.devices);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf10a"))
            .appendField("on notified");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(deviceInfoEventDropdown), "NAME");
        this.appendStatementInput("HANDLER")
            .setAlign(Blockly.ALIGN_RIGHT)
            .appendField("do");
        this.setInputsInline(true);
        this.setTooltip('Registers code to run when the micro:bit receives an event from the device');
        this.setHelpUrl("./functions/on-device-notification");
    }
};*/

/*
Blockly.Blocks['devices_signal_strength'] = {
    init: function () {
        this.setHelpUrl('./functions/signal-strength');
        this.setColour(blockColors.devices);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf012"))
            .appendField("signal strengh");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Gets the signal strength reported by the paired device from 0 (no signal) to 4 (full strength).');
    }
};*/

/*
Blockly.Blocks['devices_signal_strength_changed_event'] = {
    init: function()
    {
        this.setColour(blockColors.devices);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf012"))
            .appendField("on signal strength changed");
        this.appendStatementInput("HANDLER")
            .setAlign(Blockly.ALIGN_RIGHT)
            .appendField("do");
        this.setInputsInline(true);
        this.setTooltip('Registers code to run when the signal strength on the paired device changes.');
        this.setHelpUrl("./functions/on-signal-strength-changed-event");
    }
};*/

Blockly.Blocks['radio_set_group'] = {
    init: function()
    {
        this.setColour(blockColors.radio);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf0c0"))
            .appendField("set group");
        this.appendValueInput("ID")
            .setCheck("Number");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Sets the radio to listen to packets sent with the given group id.');
        this.setHelpUrl("./functions/set-group");
    }
};

Blockly.Blocks['radio_broadcast'] = {
    init: function()
    {
        this.setColour(blockColors.radio);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf1d8"))
            .appendField("broadcast message");
        this.appendValueInput("MESSAGE")
            .setCheck("Number");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Broadcasts a message to other micro:bit over radio.');
        this.setHelpUrl("./functions/broadcast");
    }
};

Blockly.Blocks['radio_broadcast_received_event'] = {
    init: function()
    {
        this.setColour(blockColors.radio);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf1d8"))
            .appendField("on message received")
            .appendField(new Blockly.FieldTextInput("0", Blockly.FieldTextInput.numberValidator), "MESSAGE");
        this.appendStatementInput("HANDLER")
            .setAlign(Blockly.ALIGN_RIGHT)
            .appendField("do");
        this.setInputsInline(true);
        this.setTooltip('Registers code to run when the micro:bit receives an broadcast message over radio.');
        this.setHelpUrl("./functions/on-message-received");
    }
};

Blockly.Blocks['radio_datagram_send'] = {
    init: function()
    {
        this.setColour(blockColors.radio);
        this.appendDummyInput().appendField("send number");
        this.appendValueInput("MESSAGE")
            .setCheck("Number");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Broadcasts a number to other micro:bits over radio.');
        this.setHelpUrl("./functions/send-number");
    }
};

Blockly.Blocks['radio_datagram_send_numbers'] = {
    init: function()
    {
        this.setColour(blockColors.radio);
        this.appendDummyInput().appendField("send numbers");
        this.appendValueInput("VALUE0")
            .setCheck("Number")
            .appendField("0:");
        this.appendValueInput("VALUE1")
            .setCheck("Number")
            .appendField("1:");
        this.appendValueInput("VALUE2")
            .setCheck("Number")
            .appendField("2:");
        this.appendValueInput("VALUE3")
            .setCheck("Number")
            .appendField("3:");
      //  this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Broadcasts a number to other micro:bits over radio.');
        this.setHelpUrl("https://www.microbit.co.uk/functions/send-numbers");
    }
};

Blockly.Blocks['radio_datagram_receive'] = {
    init: function () {
        this.setHelpUrl('./functions/receive-number');
        this.setColour(blockColors.radio);
        this.appendDummyInput()
            .appendField("receive number");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Reads the next packet received by the radio. 0 if queue empty.');
    }
};

Blockly.Blocks['radio_datagram_received_number_at'] = {
    init: function () {
        this.setHelpUrl('./functions/received-number-at');
        this.setColour(blockColors.radio);
        this.appendDummyInput()
            .appendField("received number");
        this.appendValueInput("VALUE")
            .setCheck("Number")
            .appendField("at");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Reads the next packet received by the radio. 0 if queue empty.');
    }
};

Blockly.Blocks['radio_datagram_rssi'] = {
    init: function () {
        this.setHelpUrl('./functions/received-signal-strength');
        this.setColour(blockColors.radio);
        this.appendDummyInput()
            .appendField(iconToFieldImage("\uf012"))
            .appendField("received signal strength");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip('Gets the received signal strength indicator (RSSI) from the packet received by receive number.');
    }
};

Blockly.Blocks['radio_datagram_received_event'] = {
    init: function()
    {
        this.setColour(blockColors.radio);
        this.appendDummyInput().appendField("on data received");
        this.appendStatementInput("HANDLER")
            .setAlign(Blockly.ALIGN_RIGHT)
            .appendField("do");
        this.setInputsInline(true);
        this.setTooltip('Registers code to run when the micro:bit receives a number packet over radio.');
        this.setHelpUrl("./functions/on-packet-received");
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

/*
Blockly.Blocks['device_note'] = {
  init: function() {
    this.setHelpUrl('./functions/note');
    this.setColour(blockColors.music);
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(notesDropdown), "note");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setTooltip('Gets the frequency of a note.');
  }
};*/


["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"].forEach(function (x) {
    Blockly.Blocks['device_note_'+x] = {
        init: function () {
            this.setHelpUrl('./functions/note');
            this.setColour(blockColors.music);
            this.appendDummyInput().appendField(x);
            this.setInputsInline(true);
            this.setOutput(true, "Number");
            this.setTooltip('The '+x+' note from the scale');
        }
    };
});

["1", "1/2", "1/4", "1/8", "1/16"].forEach(function (x) {
    Blockly.Blocks['device_duration_'+x] = {
        init: function () {
            this.setHelpUrl('./functions/note');
            this.setColour(blockColors.music);
            this.appendDummyInput().appendField(x+" beat");
            this.setInputsInline(true);
            this.setOutput(true, "Number");
            this.setTooltip("A duration in ms based on the current tempo.");
        }
    };
});

/*
Blockly.Blocks['device_play_note'] = {
  init: function() {
    this.setHelpUrl('./functions/play-note');
    this.setColour(blockColors.music);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf025"))
        .appendField("play tone (Hz)");
    this.appendValueInput("note")
        .setCheck("Number")
    this.appendDummyInput()
        .appendField("for (ms)");
    this.appendValueInput("duration")
        .setCheck("Number");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Play a given note on P0. You can also provide a specific frequency.');
  }
};*/

/*
Blockly.Blocks['device_ring'] = {
  init: function() {
    this.setHelpUrl('./functions/ring');
    this.setColour(blockColors.music);
    this.appendDummyInput()
        .appendField(iconToFieldImage("\uf025"))
        .appendField("ring tone (Hz)");
    this.appendValueInput("note")
        .setCheck("Number");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Rings a given note on P0. You can also provide a specific frequency.');
  }
};*/

/*
Blockly.Blocks['device_rest'] = {
  init: function() {
    this.setHelpUrl('./functions/rest');
    this.setColour(blockColors.music);
    this.appendDummyInput()
        .appendField("rest (ms)");
    this.appendValueInput("duration")
        .setCheck("Number");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip('Rests (plays nothing) for a specified time through pin P0.');
  }
};*/

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

/*
Blockly.Blocks['device_tempo'] = {
    init: function()
    {
        this.setColour(blockColors.music);
        this.appendDummyInput()
            .appendField("tempo (bpm)");
        this.setOutput(true, "Number");
        this.setInputsInline(true);
        this.setTooltip('Gets the tempo (bpm)');
        this.setHelpUrl("./functions/tempo");
    }
};*/

/*
Blockly.Blocks['device_change_tempo'] = {
    init: function()
    {
        this.setColour(blockColors.music);
        this.appendDummyInput()
            .appendField("change tempo by (bpm)");
        this.appendValueInput("value")
            .setCheck("Number");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Change the tempo by the given amount');
        this.setHelpUrl("./functions/tempo");
    }
};*/

/*
Blockly.Blocks['device_set_tempo'] = {
    init: function()
    {
        this.setColour(blockColors.music);
        this.appendDummyInput()
            .appendField("set tempo to (bpm)");
        this.appendValueInput("value")
            .setCheck("Number");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);            
        this.setTooltip('Sets the tempo to the given amount of beats per minute (bpm)');
        this.setHelpUrl("./functions/tempo");
    }
};*/

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
