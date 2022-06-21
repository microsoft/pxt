/// <reference path="../../localtypings/pxtblockly.d.ts" />
/// <reference path="./field_textdropdown.ts" />

namespace Blockly {
    export interface FieldTextDropdown {
        showDropdown_(): void
        isTextValid_: boolean;
    }
}

namespace pxtblockly {

    export interface FieldAutoCompleteOptions extends Blockly.FieldCustomOptions {
        // This is a unique key that should be specified by the parent block. The dropdown
        // will only be populated by other blocks with this same key. If not specified, the parent's
        // block type will be used
        key: string;
    }

    export class FieldAutoComplete extends Blockly.FieldTextDropdown implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        protected key: string;
        protected parsedValue: string;

        protected quoteSize_: number;
        protected quoteWidth_: number;
        protected quoteLeftX_: number;
        protected quoteRightX_: number;
        protected quoteY_: number;
        protected quoteLeft_: SVGTextElement;
        protected quoteRight_: SVGTextElement;

        constructor(text: string, options: FieldAutoCompleteOptions, opt_validator?: Function) {
            super(text, () => [] as any, opt_validator);
            this.key = options.key;
            this.isTextValid_ = true;
        }

        isOptionListDynamic() {
            return true;
        }

        getDisplayText_(): string {
            return this.parsedValue || "";
        }

        doValueUpdate_(newValue: string) {
            if (newValue === null) return;

            if (/['"`].*['"`]/.test(newValue)) {
                this.parsedValue = JSON.parse(newValue)
            }
            else {
                this.parsedValue = newValue;
            }

            this.value_ = this.parsedValue
        }

        getValue() {
            if (this.parsedValue) {
                return JSON.stringify(this.parsedValue)
            }
            else return '""';
        }

        getOptions() {
            const workspace = this.sourceBlock_?.workspace;

            if (!workspace) return [];

            const res: [string, string][] = [];
            const fields = getAllFields<FieldAutoComplete>(workspace, field => field instanceof FieldAutoComplete && field.getKey() === this.key);

            const options = fields.map(field => field.ref.getDisplayText_());

            for (const option of options) {
                if (!option.trim() || res.some(tuple => tuple[0] === option)) continue;
                res.push([option, option])
            }

            res.sort((a, b) => a[0].localeCompare(b[0]));

            return res;
        }

        showDropdown_() {
            const options = this.getOptions();

            if (options.length) super.showDropdown_()
        }

        getKey() {
            if (this.key) return this.key;
            if (this.sourceBlock_) return this.sourceBlock_.type;

            return undefined;
        }

        // Copied from field_string in pxt-blockly
        initView(): void {
            // Add quotes around the string
            // Positioned on updatSize, after text size is calculated.
            this.quoteSize_ = 16;
            this.quoteWidth_ = 8;
            this.quoteLeftX_ = 0;
            this.quoteRightX_ = 0;
            this.quoteY_ = 10;
            if (this.quoteLeft_) this.quoteLeft_.parentNode.removeChild(this.quoteLeft_);
            this.quoteLeft_ = Blockly.utils.dom.createSvgElement('text', {
                'font-size': this.quoteSize_ + 'px',
                'class': 'field-text-quote'
            }, this.fieldGroup_);

            super.initView();

            if (this.quoteRight_) this.quoteRight_.parentNode.removeChild(this.quoteRight_);
            this.quoteRight_ = Blockly.utils.dom.createSvgElement('text', {
                'font-size': this.quoteSize_ + 'px',
                'class': 'field-text-quote'
            }, this.fieldGroup_);
            this.quoteLeft_.appendChild(document.createTextNode('"'));
            this.quoteRight_.appendChild(document.createTextNode('"'));
        }

        // Copied from field_string in pxt-blockly
        updateSize_(): void {
            super.updateSize_();

            const sWidth = Math.max(this.size_.width, 1);

            const xPadding = 3;
            let addedWidth = this.positionLeft(sWidth + xPadding);
            this.textElement_.setAttribute('x', addedWidth.toString());
            addedWidth += this.positionRight(addedWidth + sWidth + xPadding);

            this.size_.width = sWidth + addedWidth;
        }

        // Copied from field_string in pxt-blockly
        positionRight(x: number) {
            if (!this.quoteRight_) {
                return 0;
            }
            let addedWidth = 0;
            if (this.sourceBlock_.RTL) {
                this.quoteRightX_ = Blockly.FieldString.quotePadding;
                addedWidth = this.quoteWidth_ + Blockly.FieldString.quotePadding;
            } else {
                this.quoteRightX_ = x + Blockly.FieldString.quotePadding;
                addedWidth = this.quoteWidth_ + Blockly.FieldString.quotePadding;
            }
            this.quoteRight_.setAttribute('transform',
                'translate(' + this.quoteRightX_ + ',' + this.quoteY_ + ')'
            );
            return addedWidth;
        }

        // Copied from field_string in pxt-blockly
        positionLeft(x: number) {
            if (!this.quoteLeft_) {
                return 0;
            }
            let addedWidth = 0;
            if (this.sourceBlock_.RTL) {
                this.quoteLeftX_ = x + this.quoteWidth_ + Blockly.FieldString.quotePadding * 2;
                addedWidth = this.quoteWidth_ + Blockly.FieldString.quotePadding;
            } else {
                this.quoteLeftX_ = 0;
                addedWidth = this.quoteWidth_ + Blockly.FieldString.quotePadding;
            }
            this.quoteLeft_.setAttribute('transform',
                'translate(' + this.quoteLeftX_ + ',' + this.quoteY_ + ')'
            );
            return addedWidth;
        }

        createSVGArrow_() {
            // This creates the little arrow for dropdown fields. Intentionally
            // do nothing
        }

        showPromptEditor_() {
            Blockly.prompt(
                Blockly.Msg['CHANGE_VALUE_TITLE'],
                this.parsedValue,
                (newValue) => {
                    this.setValue(this.getValueFromEditorText_(newValue));
                    this.forceRerender();
                }
            );
        }
    }
}