import * as Blockly from "blockly";

export class FieldString extends Blockly.FieldTextInput {
    static quotePadding = 0;
    quoteLeft_: Element;
    quoteRight_: Element;
    quoteSize_: number;
    quoteWidth_: number;
    quoteLeftX_: number;
    quoteRightX_: number;
    quoteY_: number;

    initView(): void {
        // Add quotes around the string
        // Positioned on render, after text size is calculated.
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

    protected updateSize_(margin?: number): void {
        super.updateSize_(margin);

        const sWidth = this.value_ ? this.size_.width : 1;

        const xPadding = 3;
        let addedWidth = this.positionLeft(sWidth + xPadding);
        this.textElement_.setAttribute('x', addedWidth + "");
        addedWidth += this.positionRight(addedWidth + sWidth + xPadding);

        this.size_.width = sWidth + addedWidth;
    }

    positionLeft(x: number) {
        if (!this.quoteLeft_) {
            return 0;
        }
        let addedWidth = 0;
        if (this.sourceBlock_.RTL) {
            this.quoteLeftX_ = x + this.quoteWidth_ + FieldString.quotePadding * 2;
            addedWidth = this.quoteWidth_ + FieldString.quotePadding;
        } else {
            this.quoteLeftX_ = 0;
            addedWidth = this.quoteWidth_ + FieldString.quotePadding;
        }
        this.quoteLeft_.setAttribute('transform',
            'translate(' + this.quoteLeftX_ + ',' + this.quoteY_ + ')'
        );
        return addedWidth;
    }

    positionRight(x: number) {
        if (!this.quoteRight_) {
            return 0;
        }
        let addedWidth = 0;
        if (this.sourceBlock_.RTL) {
            this.quoteRightX_ = FieldString.quotePadding;
            addedWidth = this.quoteWidth_ + FieldString.quotePadding;
        } else {
            this.quoteRightX_ = x + FieldString.quotePadding;
            addedWidth = this.quoteWidth_ + FieldString.quotePadding;
        }
        this.quoteRight_.setAttribute('transform',
            'translate(' + this.quoteRightX_ + ',' + this.quoteY_ + ')'
        );
        return addedWidth;
    }
}

Blockly.Css.register(`
.field-text-quote {
    fill: #a31515 !important;
}
`);

Blockly.fieldRegistry.register('field_string', FieldString);