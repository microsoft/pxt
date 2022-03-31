namespace pxtblockly {
    export abstract class FieldBase<U> extends Blockly.Field implements Blockly.FieldCustom {
        isFieldCustom_: true;
        SERIALIZABLE = true;
        options: U;
        protected valueText: string;
        protected loaded: boolean;
        protected workspace: Blockly.Workspace;

        constructor(text: string, params: U, validator?: Function) {
            super(text, validator);
            this.options = params;
            if (text && !this.valueText) this.valueText = text;
        }

        protected abstract onInit(): void;
        protected abstract onDispose(): void;
        protected abstract onValueChanged(newValue: string): string;

        init() {
            super.init();
            this.onInit();
       }

        dispose() {
            this.onDispose();
        }

        getValue() {
            return this.valueText;
        }

        doValueUpdate_(newValue: string) {
            if (newValue === null) return;

            this.valueText = this.loaded ? this.onValueChanged(newValue) : newValue;
        }

        getDisplayText_() {
            return this.valueText;
        }

        onLoadedIntoWorkspace() {
            if (this.loaded) return;
            this.loaded = true;
            this.valueText = this.onValueChanged(this.valueText);
        }

        protected getAnchorDimensions() {
            const boundingBox = this.getScaledBBox() as any;
            if (this.sourceBlock_.RTL) {
                boundingBox.right += Blockly.FieldDropdown.CHECKMARK_OVERHANG;
            } else {
                boundingBox.left -= Blockly.FieldDropdown.CHECKMARK_OVERHANG;
            }
            return boundingBox;
        };

        protected isInitialized() {
            return !!this.fieldGroup_;
        }

        protected getBlockData() {
            return pxt.blocks.getBlockDataForField(this.sourceBlock_, this.name);
        }

        protected setBlockData(value: string) {
            pxt.blocks.setBlockDataForField(this.sourceBlock_, this.name, value);
        }

        protected getSiblingBlock(inputName: string, useGrandparent = false) {
            const block = useGrandparent ? this.sourceBlock_.parentBlock_ : this.sourceBlock_;

            if (!block || !block.inputList) return undefined;

            for (const input of block.inputList) {
                if (input.name === inputName) {
                    return input.connection.targetBlock();
                }
            }

            return undefined;
        }

        protected getSiblingField(fieldName: string, useGrandparent = false) {
            const block = useGrandparent ? this.sourceBlock_.parentBlock_ : this.sourceBlock_;
            return block.getField(fieldName);
        }
    }
}