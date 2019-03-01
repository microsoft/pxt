/// <reference path="../../localtypings/blockly.d.ts" />
/// <reference path="../../built/pxtsim.d.ts" />

namespace pxtblockly {

    export class FieldBreakpoint extends Blockly.FieldNumber implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: any;

        private state_: boolean;
        private checkElement_: any;

        private toggleThumb_: any;

        public CURSOR = 'pointer';

        private type_: string;

        constructor(state: string, params: Blockly.FieldCustomOptions, opt_validator?: Function) {
            super(state, undefined, undefined, undefined, opt_validator);
            this.params = params;
            this.setValue(state);
            this.addArgType('toggle');
            this.type_ = params.type;
        }

        init() {
            if (this.fieldGroup_) {
                // Field has already been initialized once.
                return;
            }
            // Build the DOM.
            this.fieldGroup_ = Blockly.utils.createSvgElement('g', {}, null);
            if (!this.visible_) {
                (this.fieldGroup_ as any).style.display = 'none';
            }
            // Add an attribute to cassify the type of field.
            if ((this as any).getArgTypes() !== null) {
                if (this.sourceBlock_.isShadow()) {
                    (this.sourceBlock_ as any).svgGroup_.setAttribute('data-argument-type',
                        (this as any).getArgTypes());
                } else {
                    // Fields without a shadow wrapper, like square dropdowns.
                    this.fieldGroup_.setAttribute('data-argument-type', (this as any).getArgTypes());
                }
            }
            // Adjust X to be flipped for RTL. Position is relative to horizontal start of source block.
            const size = this.getSize();
            this.checkElement_ = Blockly.utils.createSvgElement('g',
                {
                    'class': `blocklyToggle ${this.state_ ? 'blocklyToggleOnBreakpoint' : 'blocklyToggleOffBreakpoint'}`,
                    'transform': `translate(8, ${size.height / 2})`,
                }, this.fieldGroup_);
            this.toggleThumb_ = Blockly.utils.createSvgElement('polygon',
                {
                    'class': 'blocklyToggleRect',
                    'points': '50,5 100,5 125,30 125,80 100,105 50,105 25,80 25,30'
                },
                this.checkElement_);

            let fieldX = (this.sourceBlock_.RTL) ? -size.width / 2 : size.width / 2;
            /** @type {!Element} */
            this.textElement_ = Blockly.utils.createSvgElement('text',
                {
                    'class': 'blocklyText',
                    'x': fieldX,
                    'dy': '0.6ex',
                    'y': size.height / 2
                },
                this.fieldGroup_);

            this.updateEditable();
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().appendChild(this.fieldGroup_);

            this.switchToggle(this.state_);
            this.setValue(this.getValue());

            // Force a render.
            this.render_();
            this.size_.width = 0;
            (this as any).mouseDownWrapper_ =
                Blockly.bindEventWithChecks_((this as any).getClickTarget_(), 'mousedown', this,
                    (this as any).onMouseDown_);
        }

        updateWidth() {
            this.size_.width = 30;
            this.arrowWidth_ = 0;
        }

        /**
         * Return 'TRUE' if the toggle is ON, 'FALSE' otherwise.
         * @return {string} Current state.
         */
        getValue() {
            return this.toVal(this.state_);
        };

        /**
         * Set the checkbox to be checked if newBool is 'TRUE' or true,
         * unchecks otherwise.
         * @param {string|boolean} newBool New state.
         */
        setValue(newBool: string) {
            let newState = this.fromVal(newBool);
            if (this.state_ !== newState) {
                if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
                    Blockly.Events.fire(new (Blockly.Events as any).BlockChange(
                        this.sourceBlock_, 'field', this.name, this.state_, newState));
                }
                this.state_ = newState;

                this.switchToggle(this.state_);
            }
        }

        switchToggle(newState: boolean) {
            if (this.checkElement_) {
                this.updateWidth();
                if (newState) {
                    pxtblockly.svg.addClass(this.checkElement_, 'blocklyToggleOnBreakpoint');
                    pxtblockly.svg.removeClass(this.checkElement_, 'blocklyToggleOffBreakpoint');
                } else {
                    pxtblockly.svg.removeClass(this.checkElement_, 'blocklyToggleOnBreakpoint');
                    pxtblockly.svg.addClass(this.checkElement_, 'blocklyToggleOffBreakpoint');
                }
                this.checkElement_.setAttribute('transform', `translate(-7, -1) scale(0.3)`);
            }
        }

        updateTextNode_() {
            super.updateTextNode_();
            if (this.textElement_)
                pxtblockly.svg.addClass(this.textElement_ as SVGElement, 'blocklyToggleText');
        }

        render_() {
            if (this.visible_ && this.textElement_) {
                // Replace the text.
                goog.dom.removeChildren(/** @type {!Element} */(this.textElement_));
                this.updateWidth();
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
                this.setValue(this.toVal(newState));
            }
        }

        private toVal(newState: boolean): string {
            if (this.type_ == "number") return String(newState ? '1' : '0');
            else return String(newState ? 'true' : 'false');
        }

        private fromVal(val: string): boolean {
            if (typeof val == "string") {
                if (val == "1" || val.toUpperCase() == "TRUE") return true;
                return false;
            }
            return !!val;
        }
    }
}