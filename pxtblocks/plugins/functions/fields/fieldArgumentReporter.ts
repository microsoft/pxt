import * as Blockly from "blockly";
import { isFunctionArgumentReporter } from "../utils";
import { ArgumentReporterBlock } from "../blocks/argumentReporterBlocks";

export class FieldArgumentReporter extends Blockly.FieldLabelSerializable {
    protected override getDisplayText_(): string {
        const source = this.getSourceBlock();
        if (source && isFunctionArgumentReporter(source)) {
            const localizeKey = (source as ArgumentReporterBlock).getLocalizationName();

            const localized = localizeKey && pxt.U.rlf(localizeKey);
            if (localized && localized !== localizeKey) {
                return localized;
            }
        }

        return super.getDisplayText_();
    }
}

Blockly.registry.register(Blockly.registry.Type.FIELD, "field_argument_reporter", FieldArgumentReporter);