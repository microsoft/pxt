/// <reference path="../../localtypings/blockly.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

namespace pxtblockly {

    export interface FieldPositionOptions extends Blockly.FieldCustomOptions {
        min?: string;
        max?: string;
        screenWidth?: number;
        screenHeight?: number;
        xInputName?: string;
        yInputName?: string;
    }

    export class FieldPosition extends Blockly.FieldSlider implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        private params: FieldPositionOptions;
        private selectorDiv_: HTMLElement;
        private resetCrosshair: () => void;

        constructor(text: string, params: FieldPositionOptions, validator?: Function) {
            super(text, '0', '100', '1', '100', 'Value', validator);
            this.params = params;
            if (!this.params.screenHeight) this.params.screenHeight = 120;
            if (!this.params.screenWidth) this.params.screenWidth = 160;
            if (!this.params.xInputName) this.params.xInputName = "x";
            if (!this.params.yInputName) this.params.yInputName = "y"

            if (this.params.min) this.min_ = parseInt(this.params.min)
            if (this.params.max) this.max_ = parseInt(this.params.max)
        }

        showEditor_() {
            // Find out which field we're in (x or y) and set the appropriate max.
            const xField = this.getFieldByName(this.params.xInputName);
            if (xField === this) {
                this.max_ = this.params.screenWidth;
                this.labelText_ = this.params.xInputName;
            }
            const yField = this.getFieldByName(this.params.yInputName);
            if (yField === this) {
                this.max_ = this.params.screenHeight;
                this.labelText_ = this.params.yInputName;
            }

            // Call super to render the slider and show the dropdown div
            super.showEditor_();

            // Now render the screen in the dropdown div below the slider
            this.renderScreenPicker();
        }

        doValueUpdate_(value: string) {
            super.doValueUpdate_(value);
            if (this.resetCrosshair) this.resetCrosshair();
        }

        protected renderScreenPicker() {
            let contentDiv = Blockly.DropDownDiv.getContentDiv() as HTMLDivElement;
            this.selectorDiv_ = document.createElement('div');
            this.selectorDiv_.className = "blocklyCanvasOverlayOuter";
            contentDiv.appendChild(this.selectorDiv_);

            const canvasOverlayDiv = document.createElement('div');
            canvasOverlayDiv.className = 'blocklyCanvasOverlayDiv';
            this.selectorDiv_.appendChild(canvasOverlayDiv);

            const crossX = document.createElement('div');
            crossX.className = 'cross-x';
            canvasOverlayDiv.appendChild(crossX);
            const crossY = document.createElement('div');
            crossY.className = 'cross-y';
            canvasOverlayDiv.appendChild(crossY);
            const label = document.createElement('div');
            label.className = 'label'
            canvasOverlayDiv.appendChild(label);

            const width = this.params.screenWidth * 1.5;
            const height = this.params.screenHeight * 1.5;

            canvasOverlayDiv.style.height = height + 'px';
            canvasOverlayDiv.style.width = width + 'px';

            // The slider is set to a fixed width, so we have to resize it
            // to match the screen size
            const slider = contentDiv.getElementsByClassName("goog-slider-horizontal")[0] as HTMLDivElement;
            if (slider) {
                slider.style.width = width + "px";

                // Because we resized the slider, we need to update the handle position. The closure
                // slider won't update unless the value changes so change it and un-change it
                const value = parseFloat(this.getValue());

                if (!isNaN(value) && value > this.getMin()) {
                    this.setValue((value - 1) + "");
                    this.setValue(value + "");
                }
            }

            const setPos = (x: number, y: number) => {
                x = Math.round(Math.max(0, Math.min(width, x)));
                y = Math.round(Math.max(0, Math.min(height, y)));

                crossX.style.top = y + 'px';
                crossY.style.left = x + 'px';

                x = Math.round(Math.max(0, Math.min(this.params.screenWidth, x / width * this.params.screenWidth)));
                y = Math.round(Math.max(0, Math.min(this.params.screenHeight, y / height * this.params.screenHeight)));

                label.textContent = `${this.params.xInputName}=${x} ${this.params.yInputName}=${y}`;

                // Position the label so that it doesn't go outside the screen bounds
                const bb = label.getBoundingClientRect();
                if (x > this.params.screenWidth / 2) {
                    label.style.left = (x * (width / this.params.screenWidth) - bb.width - 8) + 'px';
                }
                else {
                    label.style.left = (x * (width / this.params.screenWidth) + 4) + 'px';
                }

                if (y > this.params.screenHeight / 2) {
                    label.style.top = (y * (height / this.params.screenHeight) - bb.height - 6) + "px"
                }
                else {
                    label.style.top = (y * (height / this.params.screenHeight)) + 'px';
                }
            }

            // Position initial crossX and crossY
            this.resetCrosshair = () => {
                const { currentX, currentY } = this.getXY();
                setPos(
                    currentX / this.params.screenWidth * width,
                    currentY / this.params.screenHeight * height);
            };

            this.resetCrosshair();


            Blockly.bindEvent_(this.selectorDiv_, 'mousemove', this, (e: MouseEvent) => {
                const bb = canvasOverlayDiv.getBoundingClientRect();
                const x = e.clientX - bb.left;
                const y = e.clientY - bb.top;

                setPos(x, y);
            });

            Blockly.bindEvent_(this.selectorDiv_, 'mouseleave', this, this.resetCrosshair);

            Blockly.bindEvent_(this.selectorDiv_, 'click', this, (e: MouseEvent) => {
                const bb = canvasOverlayDiv.getBoundingClientRect();
                const x = e.clientX - bb.left;
                const y = e.clientY - bb.top;

                const normalizedX = Math.round(x / width * this.params.screenWidth);
                const normalizedY = Math.round(y / height * this.params.screenHeight);

                this.close();
                this.setXY(normalizedX, normalizedY);
            });
        }

        private resizeHandler() {
            this.close();
        }

        private setXY(x: number, y: number) {
            const xField = this.getFieldByName(this.params.xInputName);
            if (xField && typeof xField.getValue() == "number") {
                xField.setValue(String(x));
            }
            const yField = this.getFieldByName(this.params.yInputName);
            if (yField && typeof yField.getValue() == "number") {
                yField.setValue(String(y));
            }
        }

        private getFieldByName(name: string) {
            const parentBlock = this.sourceBlock_.parentBlock_;
            if (!parentBlock) return undefined; // warn
            for (let i = 0; i < parentBlock.inputList.length; i++) {
                const input = parentBlock.inputList[i];
                if (input.name === name) {
                    return this.getTargetField(input);
                }
            }
            return undefined;
        }

        private getXY() {
            let currentX: string;
            let currentY: string;
            const xField = this.getFieldByName(this.params.xInputName);
            if (xField) currentX = xField.getValue();
            const yField = this.getFieldByName(this.params.yInputName);
            if (yField) currentY = yField.getValue();

            return { currentX: parseInt(currentX), currentY: parseInt(currentY) };
        }

        private getTargetField(input: Blockly.Input) {
            const targetBlock = input.connection.targetBlock();
            if (!targetBlock) return null;
            const targetInput = targetBlock.inputList[0];
            if (!targetInput) return null;
            const targetField = targetInput.fieldRow[0];
            return targetField;
        }

        widgetDispose_() {
            const that = this;
            (Blockly.FieldNumber as any).superClass_.widgetDispose_.call(that);
            that.close(true);
        }

        private close(skipWidget?: boolean) {
            if (!skipWidget) {
                Blockly.WidgetDiv.hideIfOwner(this);
                Blockly.DropDownDiv.hideIfOwner(this);
            }

            // remove resize listener
            window.removeEventListener("resize", this.resizeHandler);
            this.resetCrosshair = undefined;

            // Destroy the selector div
            if (!this.selectorDiv_) return;
            goog.dom.removeNode(this.selectorDiv_);
            this.selectorDiv_ = undefined;
        }
    }

}