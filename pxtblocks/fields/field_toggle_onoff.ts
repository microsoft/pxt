/// <reference path="../../localtypings/blockly.d.ts" />
/// <reference path="./field_toggle.ts" />

namespace pxtblockly {

    export class FieldToggleOnOff extends FieldToggle implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(state: string, params: Blockly.FieldCustomOptions, opt_validator?: Function) {
            super(state, params, opt_validator);
        }

        getTrueText() {
            return lf("ON");
        }

        getFalseText() {
            return lf("OFF");
        }
    }
}