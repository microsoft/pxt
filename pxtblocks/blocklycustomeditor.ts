
namespace pxt.blocks {

    interface FieldEditorOptions {
        field: Blockly.FieldCustomConstructor;
        validator?: any;
    }

    let registeredFieldEditors: Map<FieldEditorOptions> = {};

    export function initFieldEditors() {
        // Initialize PXT custom editors
        const noteValidator = (text: string): string => {
            if (text === null) {
                return null;
            }
            text = String(text);

            let n = parseFloat(text || '0');
            if (isNaN(n) || n < 0) {
                // Invalid number.
                return null;
            }
            // Get the value in range.
            return String(Math.round(Number(text)));
        };
        registerFieldEditor('text', pxtblockly.FieldTextInput);
        registerFieldEditor('note', pxtblockly.FieldNote, noteValidator);
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
        registerFieldEditor('speed', pxtblockly.FieldSpeed);
        registerFieldEditor('turnratio', pxtblockly.FieldTurnRatio);
        registerFieldEditor('protractor', pxtblockly.FieldProtractor);
        registerFieldEditor('position', pxtblockly.FieldPosition);
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