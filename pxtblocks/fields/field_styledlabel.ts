/// <reference path="../../localtypings/pxtblockly.d.ts" />

namespace pxtblockly {
    export interface StyleOptions extends Blockly.FieldCustomOptions {
        bold: boolean;
        italics: boolean;
    }

    export class FieldStyledLabel extends Blockly.FieldLabel implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(value: string, options?: StyleOptions, opt_validator?: Function) {
            super(value, getClass(options));
        }
    }

    function getClass(options?: StyleOptions) {
        if (options) {
            if (options.bold && options.italics) {
                return 'blocklyBoldItalicizedText'
            }
            else if (options.bold) {
                return 'blocklyBoldText'
            }
            else if (options.italics) {
                return 'blocklyItalicizedText'
            }
        }
        return undefined;
    }
}