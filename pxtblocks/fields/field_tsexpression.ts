/// <reference path="../../localtypings/blockly.d.ts" />

namespace pxtblockly {
    export class FieldTsExpression extends Blockly.FieldTextInput implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        /**
         * Same as parent, but adds a different class to text when disabled
         */
        public updateEditable() {
            let group = this.fieldGroup_;
            if (!this.EDITABLE || !group) {
              return;
            }
            if (this.sourceBlock_.isEditable()) {
              pxt.BrowserUtils.addClass(group, 'blocklyEditableText');
              pxt.BrowserUtils.removeClass(group, 'blocklyGreyExpressionBlockText');
              (this.fieldGroup_ as any).style.cursor = this.CURSOR;
            } else {
              pxt.BrowserUtils.addClass(group, 'blocklyGreyExpressionBlockText');
              pxt.BrowserUtils.removeClass(group, 'blocklyEditableText');
              (this.fieldGroup_ as any).style.cursor = '';
            }
        }
    }
}