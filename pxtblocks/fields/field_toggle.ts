/// <reference path="../../localtypings/blockly.d.ts" />

namespace pxtblockly {

    export class FieldToggle extends Blockly.FieldNumber implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: any;

        private state_: boolean;
        private checkElement_: any;
        private circleElement_: any;

        public static TOGGLE_WIDTH: number = 40;
        public static TOGGLE_ON_COLOR: string = "#4DDc64";
        public static TOGGLE_OFF_COLOR: string = "#95a5a6";

        constructor(state: string, params: any, validator?: () => void) {
            super(state, validator);
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
                    'class': 'blocklyToggle',
                    'transform': `translate(8, ${size.height / 2})`,
                }, this.fieldGroup_)
            this.circleElement_ = Blockly.utils.createSvgElement('circle',
                {
                    'class': 'blocklyToggleCircle',
                    'fill': this.state_ ? FieldToggle.TOGGLE_ON_COLOR : FieldToggle.TOGGLE_OFF_COLOR,
                    'cx': 0, 'cy': 0, 'r': 14,
                    'cursor': 'pointer'
                },
                this.checkElement_);
            this.switchToggle(this.state_);
        };

        updateWidth() {
            this.size_.width = FieldToggle.TOGGLE_WIDTH;
            this.arrowWidth_ = 0;
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
                    this.checkElement_.setAttribute('transform', `translate(32, ${size.height / 2})`); //classList.add('toggled')
                } else {
                    this.checkElement_.setAttribute('transform', `translate(8, ${size.height / 2})`); //this.checkElement_.classList.remove('toggled')
                }
                this.circleElement_.setAttribute('fill', newState ? FieldToggle.TOGGLE_ON_COLOR : FieldToggle.TOGGLE_OFF_COLOR);
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