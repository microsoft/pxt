/// <reference path="../../localtypings/blockly.d.ts" />

namespace pxtblockly {

    export interface FieldNumberDropdownOptions extends Blockly.FieldCustomDropdownOptions {
        min?: number;
        max?: number;
        precision?: any;
    }

    export class FieldNumberDropdown extends Blockly.FieldNumberDropdown implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(value: number | string, options: FieldNumberDropdownOptions, validator?: Function) {
            super(value, options.data, options.min, options.max, options.precision, validator);
        }
    }
}