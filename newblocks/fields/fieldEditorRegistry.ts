/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldAnimationEditor } from "./field_animation";
import { FieldTilemap } from "./field_tilemap";
import { FieldTextInput } from "./field_textinput";
import { FieldCustom, FieldCustomConstructor } from "./field_utils";
import { FieldSpriteEditor } from "./field_sprite";
import { FieldGridPicker } from "./field_gridpicker";

interface FieldEditorOptions {
    field: FieldCustomConstructor;
    validator?: any;
}

let registeredFieldEditors: pxt.Map<FieldEditorOptions> = {};

export function initFieldEditors() {
    registerFieldEditor('text', FieldTextInput);
    // registerFieldEditor('note', FieldNote);
    registerFieldEditor('gridpicker', FieldGridPicker);
    // registerFieldEditor('textdropdown', FieldTextDropdown);
    // registerFieldEditor('numberdropdown', FieldNumberDropdown);
    // registerFieldEditor('imagedropdown', FieldImageDropdown);
    // registerFieldEditor('colorwheel', FieldColorWheel);
    // registerFieldEditor('toggle', FieldToggle);
    // registerFieldEditor('toggleonoff', FieldToggleOnOff);
    // registerFieldEditor('toggleyesno', FieldToggleYesNo);
    // registerFieldEditor('toggleupdown', FieldToggleUpDown);
    // registerFieldEditor('toggledownup', FieldToggleDownUp);
    // registerFieldEditor('togglehighlow', FieldToggleHighLow);
    // registerFieldEditor('togglewinlose', FieldToggleWinLose);
    // registerFieldEditor('colornumber', FieldColorNumber);
    // registerFieldEditor('images', FieldImages);
    registerFieldEditor('sprite', FieldSpriteEditor);
    registerFieldEditor('animation', FieldAnimationEditor);
    registerFieldEditor('tilemap', FieldTilemap);
    // registerFieldEditor('tileset', FieldTileset);
    // registerFieldEditor('speed', FieldSpeed);
    // registerFieldEditor('turnratio', FieldTurnRatio);
    // registerFieldEditor('protractor', FieldProtractor);
    // registerFieldEditor('position', FieldPosition);
    // registerFieldEditor('melody', FieldCustomMelody);
    // registerFieldEditor('soundeffect', FieldSoundEffect);
    // registerFieldEditor('autocomplete', FieldAutoComplete);
    // if (pxt.appTarget.appTheme?.songEditor) {
    //     registerFieldEditor('musiceditor', FieldMusicEditor);
    // }
}

export function registerFieldEditor(selector: string, field: FieldCustomConstructor, validator?: any) {
    if (registeredFieldEditors[selector] == undefined) {
        registeredFieldEditors[selector] = {
            field: field,
            validator: validator
        }
    }
}

export function createFieldEditor(selector: string, text: string, params: any): FieldCustom {
    if (registeredFieldEditors[selector] == undefined) {
        console.error(`Field editor ${selector} not registered`);
        return null;
    }

    if (!params) {
        params = {};
    }

    pxt.Util.assert(params.lightMode == undefined, "lightMode is a reserved parameter for custom fields");

    params.lightMode = pxt.options.light;

    let customField = registeredFieldEditors[selector];
    let instance = new customField.field(text, params, customField.validator);
    return instance;
}