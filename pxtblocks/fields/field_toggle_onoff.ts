/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { BaseFieldToggle } from "./field_toggle";
import { FieldCustomOptions } from "./field_utils";

export class FieldToggleOnOff extends BaseFieldToggle {
    constructor(state: string, params: FieldCustomOptions, opt_validator?: Blockly.FieldValidator) {
        super(state, params, lf("ON"), lf("OFF"), opt_validator);
    }
}