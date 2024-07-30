import * as Blockly from "blockly";

export interface FieldAutocapitalizeTextInputConfig extends Blockly.FieldTextInputConfig {
    disableAutocapitalize?: boolean;
}

export class FieldAutocapitalizeTextInput extends Blockly.FieldTextInput {
    protected disableAutocapitalize = false;

    constructor(value: string, validator?: Blockly.FieldValidator, config?: FieldAutocapitalizeTextInputConfig) {
        super(value, validator, config);
    }

    setAutocapitalize(autocapitalize: boolean) {
        this.disableAutocapitalize = !autocapitalize;

        if (this.htmlInput_) {
            if (this.disableAutocapitalize) {
                this.htmlInput_.setAttribute("autocapitalize", "none");
            } else {
                this.htmlInput_.removeAttribute("autocapitalize");
            }
        }
    }

    protected configure_(config: FieldAutocapitalizeTextInputConfig): void {
        super.configure_(config);

        if (config.disableAutocapitalize !== undefined) {
            this.disableAutocapitalize = config.disableAutocapitalize;
        }
    }

    protected widgetCreate_(): HTMLInputElement | HTMLTextAreaElement {
        const input = super.widgetCreate_();

        if (this.disableAutocapitalize) {
            input.setAttribute("autocapitalize", "none");
        }

        return input;
    }
}

Blockly.fieldRegistry.register("field_autocapitalize_text_input", FieldAutocapitalizeTextInput);
