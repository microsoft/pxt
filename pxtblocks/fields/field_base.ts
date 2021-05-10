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
            if (this.isInitialized()) return;

            // Build the DOM.
            this.fieldGroup_ = Blockly.utils.dom.createSvgElement('g', {}, null) as SVGGElement;
            if (!this.visible_) {
                (this.fieldGroup_ as any).style.display = 'none';
            }

            this.onInit();

            this.updateEditable();
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().appendChild(this.fieldGroup_);

            // Force a render.
            this.render_();
            (this as any).mouseDownWrapper_ = Blockly.bindEventWithChecks_((this as any).getClickTarget_(), "mousedown", this, (this as any).onMouseDown_)
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

        protected isInitialized() {
            return !!this.fieldGroup_;
        }

        protected getBlockData() {
            return pxt.blocks.getBlockDataForField(this.sourceBlock_, this.name);
        }

        protected setBlockData(value: string) {
            pxt.blocks.setBlockDataForField(this.sourceBlock_, this.name, value);
        }
    }
}