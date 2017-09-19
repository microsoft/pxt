/// <reference path="../../localtypings/pxtblockly.d.ts" />

namespace pxtblockly {

    export class FieldTextInput extends Blockly.FieldTextInput implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(value: string, options: Blockly.FieldCustomOptions, opt_validator?: () => void) {
            super(value, opt_validator);
        }
    }
}