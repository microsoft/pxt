/// <reference path="../../localtypings/blockly.d.ts" />

namespace pxtblockly {

    export class FieldTextInput extends Blockly.FieldTextInput implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(value: string, options: Blockly.FieldCustomOptions, validator?: Function) {
            super(value, validator);
        }
    }
}