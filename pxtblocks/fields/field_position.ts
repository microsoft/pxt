/// <reference path="../../localtypings/blockly.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

namespace pxtblockly {

    export interface FieldPositionOptions extends Blockly.FieldCustomOptions {
        screenWidth?: number;
        screenHeight?: number;
        xInputName?: string;
        yInputName?: string;
    }

    export class FieldPosition extends Blockly.FieldNumber implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        private params: FieldPositionOptions;
        private selectorDiv_: HTMLElement;

        constructor(text: string, params: FieldPositionOptions, validator?: Function) {
            super(text, validator);
            this.params = params;
            if (!this.params.screenHeight) this.params.screenHeight = 120;
            if (!this.params.screenWidth) this.params.screenWidth = 160;
            if (!this.params.xInputName) this.params.xInputName = "x";
            if (!this.params.yInputName) this.params.yInputName = "y"
        }

        showEditor_() {
            super.showEditor_();

            const simFrame = this.getSimFrame();
            if (!simFrame) return;

            const customContent = document.getElementById('custom-content');
            this.selectorDiv_ = document.createElement('div');
            customContent.appendChild(this.selectorDiv_);

            const lightboxDiv = document.createElement('div');
            lightboxDiv.className = 'blocklyLightboxDiv';
            this.selectorDiv_.appendChild(lightboxDiv);

            const canvasOverlayDiv = document.createElement('div');
            canvasOverlayDiv.className = 'blocklyCanvasOverlayDiv';
            this.selectorDiv_.appendChild(canvasOverlayDiv);

            const crossX = document.createElement('div');
            crossX.className = 'cross-x';
            canvasOverlayDiv.appendChild(crossX);
            const crossY = document.createElement('div');
            crossY.className = 'cross-y';
            canvasOverlayDiv.appendChild(crossY);

            // Position overlay div
            const bBox = simFrame.getBoundingClientRect();
            const paddingX = 20;
            const paddingY = 20;
            const simAspectRatio = 0.75;
            const left = bBox.left + paddingX;
            const top = bBox.top + paddingY;
            canvasOverlayDiv.style.top = top + 'px';
            canvasOverlayDiv.style.left = left + 'px';
            const width = (bBox.width - 2 * paddingX);
            const height = width * simAspectRatio;
            canvasOverlayDiv.style.height = height + 'px';
            canvasOverlayDiv.style.width = width + 'px';

            // Position initial crossX and crossY
            let initialX = height / 2;
            let initialY = width / 2;
            const { currentX, currentY } = this.getXY();
            if (currentX && currentX > 0 && currentX <= this.params.screenWidth
                && currentY && currentY > 0 && currentY <= this.params.screenHeight) {
                initialX = currentY / this.params.screenHeight * height;
                initialY = currentX / this.params.screenWidth * width;
            }
            crossX.style.top = initialX + 'px';
            crossY.style.left = initialY + 'px';

            Blockly.bindEvent_(lightboxDiv, 'mouseup', this, () => {
                this.close();
            });

            Blockly.bindEvent_(canvasOverlayDiv, 'mousemove', this, (e: MouseEvent) => {
                const x = e.clientX - left;
                const y = e.clientY - top;

                crossX.style.top = y + 'px';
                crossY.style.left = x + 'px';
            });

            Blockly.bindEvent_(canvasOverlayDiv, 'mouseup', this, (e: MouseEvent) => {
                const x = e.clientX - left;
                const y = e.clientY - top;

                const normalizedX = Math.round(x / width * this.params.screenWidth);
                const normalizedY = Math.round(y / height * this.params.screenHeight);

                this.close();
                this.setXY(normalizedX, normalizedY);
            });

            // Position widget div
            this.selectorDiv_.style.left = '0px';
            this.selectorDiv_.style.top = '0px';
            this.selectorDiv_.style.height = '100%';
            this.selectorDiv_.style.width = '100%';
        }

        private setXY(x: number, y: number) {
            const parentBlock = this.sourceBlock_.parentBlock_;
            if (!parentBlock) return; // warn
            for (let i = 0; i < parentBlock.inputList.length; i++) {
                const input = parentBlock.inputList[i];
                if (input.name === this.params.xInputName) {
                    const targetField = this.getTargetField(input);
                    if (!targetField) continue;
                    targetField.setValue(x);
                } else if (input.name === this.params.yInputName) {
                    const targetField = this.getTargetField(input);
                    if (!targetField) continue;
                    targetField.setValue(y);
                }
            }
        }

        private getXY() {
            let currentX: string;
            let currentY: string;
            const parentBlock = this.sourceBlock_.parentBlock_;
            if (!parentBlock) return null; // warn
            for (let i = 0; i < parentBlock.inputList.length; i++) {
                const input = parentBlock.inputList[i];
                if (input.name === this.params.xInputName) {
                    const targetField = this.getTargetField(input);
                    if (!targetField) continue;
                    currentX = targetField.getValue();
                } else if (input.name === this.params.yInputName) {
                    const targetField = this.getTargetField(input);
                    if (!targetField) continue;
                    currentY = targetField.getValue();
                }
            }

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

        private getSimFrame(): HTMLIFrameElement {
            try {
                return document.getElementById('simulators').firstChild.firstChild as HTMLIFrameElement;
            } catch (e) {
                return null;
            }
        }

        widgetDispose_() {
            const that = this;
            return function () {
                (Blockly.FieldNumber.superClass_ as any).widgetDispose_.call(that)();
                that.close(true);
            }
        }

        private close(skipWidget?: boolean) {
            if (!skipWidget) Blockly.WidgetDiv.hideIfOwner(this);

            // Destroy the selector div
            if (!this.selectorDiv_) return;
            goog.dom.removeNode(this.selectorDiv_);
        }
    }

}