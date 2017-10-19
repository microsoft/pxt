/// <reference path="../../localtypings/pxtblockly.d.ts" />

namespace pxtblockly {

    export interface FieldNumberDropdownOptions extends Blockly.FieldCustomDropdownOptions {
        min?: number;
        max?: number;
        precision?: any;
    }

    export class FieldNumberDropdown extends Blockly.FieldNumberDropdown implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private menuGenerator_: any;

        constructor(value: number | string, options: FieldNumberDropdownOptions, opt_validator?: Function) {
            super(value, options.data, options.min, options.max, options.precision, opt_validator);
        }

        getOptions() {
            let newOptions: string[][];
            if (this.menuGenerator_) {
                newOptions = JSON.parse(this.menuGenerator_).map((x: number) => {
                    return (typeof x == 'object') ? x : [String(x), String(x)]
                });
            }
            return newOptions;
        }
    }
}