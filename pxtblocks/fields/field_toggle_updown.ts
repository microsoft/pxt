/// <reference path="../../localtypings/blockly.d.ts" />
/// <reference path="./field_toggle.ts" />

namespace pxtblockly {

    export interface FieldToggleUpDownOptions extends Blockly.FieldCustomOptions {
        inverted?: boolean;
    }

    export class FieldToggleUpDown extends FieldToggle implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        inverted: boolean;

        constructor(state: string, params: FieldToggleUpDownOptions, opt_validator?: Function) {
            super(state, params, opt_validator);
            this.inverted = !!params.inverted;
        }

        getTrueText() {
            return this.inverted ? lf("down"): lf("up");
        }

        getFalseText() {
            return this.inverted ?  lf("up") : lf("down");
        }
    }
}