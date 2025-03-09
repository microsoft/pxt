/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldAnimationEditor } from "./field_animation";
import { FieldTilemap } from "./field_tilemap";
import { FieldTextInput } from "./field_textinput";
import { FieldCustom, FieldCustomConstructor } from "./field_utils";
import { FieldSpriteEditor } from "./field_sprite";
import { FieldGridPicker } from "./field_gridpicker";
import { FieldColorNumber } from "./field_colour";
import { FieldImages } from "./field_images";
import { FieldTextDropdown } from "./field_textdropdown";
import { FieldNumberDropdown } from "./field_numberdropdown";
import { FieldImageDropdown } from "./field_imagedropdown";
import { FieldNote } from "./field_note";
import { FieldCustomMelody } from "./field_melodySandbox";
import { FieldToggle } from "./field_toggle";
import { FieldToggleDownUp } from "./field_toggle_downup";
import { FieldToggleHighLow } from "./field_toggle_highlow";
import { FieldToggleOnOff } from "./field_toggle_onoff";
import { FieldToggleUpDown } from "./field_toggle_updown";
import { FieldToggleWinLose } from "./field_toggle_winlose";
import { FieldToggleYesNo } from "./field_toggle_yesno";
import { FieldProtractor } from "./field_protractor";
import { FieldPosition } from "./field_position";
import { FieldSpeed } from "./field_speed";
import { FieldTileset } from "./field_tileset";
import { FieldTurnRatio } from "./field_turnratio";
import { FieldMusicEditor } from "./field_musiceditor";
import { FieldSoundEffect } from "./field_sound_effect";
import { FieldAutoComplete } from "./field_autocomplete";
import { FieldColorWheel } from "./field_colorwheel";
import { FieldScopedValueSelector } from "./field_scopedvalueselector";

interface FieldEditorOptions {
    field: FieldCustomConstructor;
    validator?: any;
}

let registeredFieldEditors: pxt.Map<FieldEditorOptions> = {};

export function initFieldEditors() {
    registerFieldEditor('text', FieldTextInput);
    registerFieldEditor('note', FieldNote);
    registerFieldEditor('gridpicker', FieldGridPicker);
    registerFieldEditor('textdropdown', FieldTextDropdown);
    registerFieldEditor('numberdropdown', FieldNumberDropdown);
    registerFieldEditor('imagedropdown', FieldImageDropdown);
    registerFieldEditor('colorwheel', FieldColorWheel);
    registerFieldEditor('toggle', FieldToggle);
    registerFieldEditor('toggleonoff', FieldToggleOnOff);
    registerFieldEditor('toggleyesno', FieldToggleYesNo);
    registerFieldEditor('toggleupdown', FieldToggleUpDown);
    registerFieldEditor('toggledownup', FieldToggleDownUp);
    registerFieldEditor('togglehighlow', FieldToggleHighLow);
    registerFieldEditor('togglewinlose', FieldToggleWinLose);
    registerFieldEditor('colornumber', FieldColorNumber);
    registerFieldEditor('images', FieldImages);
    registerFieldEditor('sprite', FieldSpriteEditor);
    registerFieldEditor('animation', FieldAnimationEditor);
    registerFieldEditor('tilemap', FieldTilemap);
    registerFieldEditor('tileset', FieldTileset);
    registerFieldEditor('speed', FieldSpeed);
    registerFieldEditor('turnratio', FieldTurnRatio);
    registerFieldEditor('protractor', FieldProtractor);
    registerFieldEditor('position', FieldPosition);
    registerFieldEditor('melody', FieldCustomMelody);
    registerFieldEditor('soundeffect', FieldSoundEffect);
    registerFieldEditor('autocomplete', FieldAutoComplete);
    registerFieldEditor('scopedvalueselector', FieldScopedValueSelector);
    if (pxt.appTarget.appTheme?.songEditor) {
        registerFieldEditor('musiceditor', FieldMusicEditor);
    }
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
        pxt.error(`Field editor ${selector} not registered`);
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