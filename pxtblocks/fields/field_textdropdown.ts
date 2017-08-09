/// <reference path="../../localtypings/blockly.d.ts" />

namespace pxtblockly {

    export interface FieldTextDropdownOptions extends Blockly.FieldCustomDropdownOptions {
    }

    export class FieldTextDropdown extends Blockly.FieldTextDropdown implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(text: string, options: FieldTextDropdownOptions, validator?: Function) {
            super(text, options.data, validator);
        }
    }
}