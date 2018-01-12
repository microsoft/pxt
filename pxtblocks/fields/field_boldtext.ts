/// <reference path="../../localtypings/pxtblockly.d.ts" />

namespace pxtblockly {

    export class FieldBoldLabel extends Blockly.FieldLabel implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(value: string, options?: Blockly.FieldCustomOptions, opt_validator?: Function) {
            super(value, 'blocklyBoldText');
        }
    }
}