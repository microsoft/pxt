
namespace pxt.blocks {

    interface FieldEditorOptions {
        field: Blockly.FieldCustomConstructor;
        validator?: any;
    }

    let registeredFieldEditors: Map<FieldEditorOptions> = {};

    export function initFieldEditors() {
        registerFieldEditor('text', pxtblockly.FieldTextInput);
        registerFieldEditor('note', pxtblockly.FieldNote);
        registerFieldEditor('gridpicker', pxtblockly.FieldGridPicker);
        registerFieldEditor('textdropdown', pxtblockly.FieldTextDropdown);
        registerFieldEditor('numberdropdown', pxtblockly.FieldNumberDropdown);
        registerFieldEditor('imagedropdown', pxtblockly.FieldImageDropdown);
        registerFieldEditor('colorwheel', pxtblockly.FieldColorWheel);
        registerFieldEditor('toggle', pxtblockly.FieldToggle);
        registerFieldEditor('toggleonoff', pxtblockly.FieldToggleOnOff);
        registerFieldEditor('toggleyesno', pxtblockly.FieldToggleYesNo);
        registerFieldEditor('toggleupdown', pxtblockly.FieldToggleUpDown);
        registerFieldEditor('toggledownup', pxtblockly.FieldToggleDownUp);
        registerFieldEditor('togglehighlow', pxtblockly.FieldToggleHighLow);
        registerFieldEditor('togglewinlose', pxtblockly.FieldToggleWinLose);
        registerFieldEditor('colornumber', pxtblockly.FieldColorNumber);
        registerFieldEditor('images', pxtblockly.FieldImages);
        registerFieldEditor('sprite', pxtblockly.FieldSpriteEditor);
        registerFieldEditor('animation', pxtblockly.FieldAnimationEditor);
        registerFieldEditor('tilemap', pxtblockly.FieldTilemap);
        registerFieldEditor('tileset', pxtblockly.FieldTileset);
        registerFieldEditor('speed', pxtblockly.FieldSpeed);
        registerFieldEditor('turnratio', pxtblockly.FieldTurnRatio);
        registerFieldEditor('protractor', pxtblockly.FieldProtractor);
        registerFieldEditor('position', pxtblockly.FieldPosition);
        registerFieldEditor('melody', pxtblockly.FieldCustomMelody);
    }

    export function registerFieldEditor(selector: string, field: Blockly.FieldCustomConstructor, validator?: any) {
        if (registeredFieldEditors[selector] == undefined) {
            registeredFieldEditors[selector] = {
                field: field,
                validator: validator
            }
        }
    }

    export function createFieldEditor(selector: string, text: string, params: any): Blockly.FieldCustom {
        if (registeredFieldEditors[selector] == undefined) {
            console.error(`Field editor ${selector} not registered`);
            return null;
        }

        if (!params) {
            params = {};
        }

        Util.assert(params.lightMode == undefined, "lightMode is a reserved parameter for custom fields");

        params.lightMode = pxt.options.light;

        let customField = registeredFieldEditors[selector];
        let instance = new customField.field(text, params, customField.validator);
        return instance;
    }
}