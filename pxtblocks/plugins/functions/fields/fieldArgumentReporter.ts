import * as Blockly from "blockly";
import { isFunctionArgumentReporter } from "../utils";
import { ArgumentReporterBlock } from "../blocks/argumentReporterBlocks";

let localizeFunction: (arg: FieldArgumentReporter, block: ArgumentReporterBlock) => string;

export class FieldArgumentReporter extends Blockly.FieldLabelSerializable {
    protected override getDisplayText_(): string {
        const source = this.getSourceBlock();
        if (source && isFunctionArgumentReporter(source) && localizeFunction) {
            const localized = localizeFunction(this, source as ArgumentReporterBlock);

            if (localized) {
                return localized;
            }
        }

        return super.getDisplayText_();
    }
}

export function setArgumentReporterLocalizeFunction(func: (arg: FieldArgumentReporter, block: ArgumentReporterBlock) => string) {
    localizeFunction = func;
}

Blockly.registry.register(Blockly.registry.Type.FIELD, "field_argument_reporter", FieldArgumentReporter);