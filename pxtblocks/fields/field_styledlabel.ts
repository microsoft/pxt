/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustomOptions, FieldCustom } from "./field_utils";

export interface StyleOptions extends FieldCustomOptions {
    bold: boolean;
    italics: boolean;
}

export class FieldStyledLabel extends Blockly.FieldLabel implements FieldCustom {
    public isFieldCustom_ = true;

    constructor(value: string, options?: StyleOptions, opt_validator?: Function) {
        super(value, getClass(options));
    }

    getFieldDescription(): string {
        return this.getText();
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