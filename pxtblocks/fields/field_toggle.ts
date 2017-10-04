/// <reference path="../../localtypings/blockly.d.ts" />

namespace pxtblockly {

    export class FieldToggle extends Blockly.FieldNumber implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: any;

        private state_: boolean;
        private checkElement_: any;
        private descElement_: any;

        public static TOGGLE_WIDTH: number = 40;
        public static TOGGLE_WIDTH_RECT: number = 60;

        constructor(state: string, params: any, opt_validator?: Function) {
            super(state, opt_validator);
            this.params = params;
            this.setValue(state);
            this.addArgType('toggle');
        }

        /**
         * Install this checkbox on a block.
         */
        init() {
            if (this.fieldGroup_) {
                // Checkbox has already been initialized once.
                return;
            }
            FieldToggle.superClass_.init.call(this);
            // The checkbox doesn't use the inherited text element.
            // Instead it uses a custom checkmark element that is either visible or not.
            const size = (this as any).getSize();
            this.checkElement_ = Blockly.utils.createSvgElement('g',
                {
                    'class': `blocklyToggle ${this.state_ ? 'blocklyToggleOn' : 'blocklyToggleOff'}`,
                    'transform': `translate(8, ${size.height / 2})`,
                }, this.fieldGroup_)
            if (this.isCircle()) {
                const circleElement = Blockly.utils.createSvgElement('circle',
                {
                    'class': 'blocklyToggleCircle',
                    'cx': 0, 'cy': 0, 'r': 14,
                    'cursor': 'pointer'
                },
                this.checkElement_);
            } else {
                const rectElement = Blockly.utils.createSvgElement('rect',
                {
                    'class': 'blocklyToggleRect',
                    'x': -14, 'y': -14, 'height': 28,
                    'width': 28, 'rx': 3, 'ry': 3,
                    'cursor': 'pointer'
                },
                this.checkElement_);
            }
            this.descElement_ = Blockly.utils.createSvgElement('text',
                {
                    'class': 'blocklyText blocklyToggleText', 'y': 5,
                    'x': this.state_ ? -12 : -8
                },
                this.checkElement_);
            let textNode = document.createTextNode(this.getDescriptionText_(this.state_));
            this.descElement_.appendChild(textNode);
            this.switchToggle(this.state_);
        };

        updateWidth() {
            this.size_.width = this.isCircle() ? FieldToggle.TOGGLE_WIDTH : FieldToggle.TOGGLE_WIDTH_RECT;
            this.arrowWidth_ = 0;
        }

        private isCircle() {
            return this.sourceBlock_.isShadow();
        }

        getDescriptionText_(newState: boolean) {
            return newState ? "ON" : "OFF";
        }

        /**
         * Return 'TRUE' if the toggle is ON, 'FALSE' otherwise.
         * @return {string} Current state.
         */
        getValue() {
            return String(this.state_ ? 1 : 0);
        };

        /**
         * Set the checkbox to be checked if newBool is 'TRUE' or true,
         * unchecks otherwise.
         * @param {string|boolean} newBool New state.
         */
        setValue(newBool: string) {
            let newState = (typeof newBool == 'string') ?
                (newBool == '1') : !!newBool;
            if (this.state_ !== newState) {
                if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
                    Blockly.Events.fire(new (Blockly.Events as any).BlockChange(
                        this.sourceBlock_, 'field', this.name, this.state_, newState));
                }
                this.state_ = newState;
                this.switchToggle(newState);
            }
        }

        switchToggle(newState: boolean) {
            if (this.checkElement_) {
                const size = (this as any).getSize();
                if (newState) {
                    this.checkElement_.setAttribute('transform', `translate(${this.isCircle() ? 32 : 44}, ${size.height / 2})`);
                    this.checkElement_.classList.add('blocklyToggleOn');
                    this.checkElement_.classList.remove('blocklyToggleOff');
                } else {
                    this.checkElement_.setAttribute('transform', `translate(${this.isCircle() ? 8 : 16}, ${size.height / 2})`);
                    this.checkElement_.classList.add('blocklyToggleOff');
                    this.checkElement_.classList.remove('blocklyToggleOn');
                }
                goog.dom.removeChildren(/** @type {!Element} */(this.descElement_));
                let textNode = document.createTextNode(this.getDescriptionText_(newState));
                this.descElement_.appendChild(textNode);
                this.descElement_.setAttribute('x', newState ? -8 : -12);
            }
        }

        /**
         * Toggle the state of the toggle.
         * @private
         */
        showEditor_() {
            let newState = !this.state_;
            /*
            if (this.sourceBlock_) {
              // Call any validation function, and allow it to override.
              newState = this.callValidator(newState);
            }*/
            if (newState !== null) {
                this.setValue(String(newState ? '1' : '0'));
            }
        }

    }
}