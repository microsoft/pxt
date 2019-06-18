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

        private static eyedropper_DATAURI = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjI0cHgiCiAgIGhlaWdodD0iMjRweCIKICAgdmlld0JveD0iMCAwIDI0IDI0IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcyIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjkxIHIxMzcyNSIKICAgc29kaXBvZGk6ZG9jbmFtZT0icG9zaXRpb25fZXllZHJvcHBlci5zdmciPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTIzIj4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjNjY2NjY2IgogICAgIGJvcmRlcm9wYWNpdHk9IjEiCiAgICAgb2JqZWN0dG9sZXJhbmNlPSIxMCIKICAgICBncmlkdG9sZXJhbmNlPSIxMCIKICAgICBndWlkZXRvbGVyYW5jZT0iMTAiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjE0MjUiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iMTA4OCIKICAgICBpZD0ibmFtZWR2aWV3MjEiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGlua3NjYXBlOnpvb209IjYuOTUzMjE2NyIKICAgICBpbmtzY2FwZTpjeD0iOC4wNTkyNTM3IgogICAgIGlua3NjYXBlOmN5PSIxMi42NjA3NiIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIwIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2ZzIiIC8+CiAgPCEtLSBHZW5lcmF0b3I6IFNrZXRjaCA0My4yICgzOTA2OSkgLSBodHRwOi8vd3d3LmJvaGVtaWFuY29kaW5nLmNvbS9za2V0Y2ggLS0+CiAgPHRpdGxlCiAgICAgaWQ9InRpdGxlNCI+QXJ0Ym9hcmQ8L3RpdGxlPgogIDxkZXNjCiAgICAgaWQ9ImRlc2M2Ij5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KICA8ZGVmcwogICAgIGlkPSJkZWZzOCI+CiAgICA8aW5rc2NhcGU6cGVyc3BlY3RpdmUKICAgICAgIHNvZGlwb2RpOnR5cGU9Imlua3NjYXBlOnBlcnNwM2QiCiAgICAgICBpbmtzY2FwZTp2cF94PSIwIDogMTIgOiAxIgogICAgICAgaW5rc2NhcGU6dnBfeT0iMCA6IDEwMDAgOiAwIgogICAgICAgaW5rc2NhcGU6dnBfej0iMjQgOiAxMiA6IDEiCiAgICAgICBpbmtzY2FwZTpwZXJzcDNkLW9yaWdpbj0iMTIgOiA4IDogMSIKICAgICAgIGlkPSJwZXJzcGVjdGl2ZTQxNTEiIC8+CiAgPC9kZWZzPgogIDxyZWN0CiAgICAgc3R5bGU9ImZpbGw6IzU3NWU3NTtmaWxsLW9wYWNpdHk6MTtzdHJva2U6IzU3NWU3NTtzdHJva2Utd2lkdGg6MS42MzQyNjg4ODtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIgogICAgIGlkPSJyZWN0NDE3MyIKICAgICB3aWR0aD0iMC45MTY4Mzk3MiIKICAgICBoZWlnaHQ9IjIwLjMzMDU0OSIKICAgICB4PSIxMS41NDE1OCIKICAgICB5PSIxLjgzNDcyNTQiIC8+CiAgPHJlY3QKICAgICB5PSItMjIuMTY1Mjc2IgogICAgIHg9IjExLjU0MTU4IgogICAgIGhlaWdodD0iMjAuMzMwNTQ5IgogICAgIHdpZHRoPSIwLjkxNjgzOTcyIgogICAgIGlkPSJyZWN0NDE3NSIKICAgICBzdHlsZT0iZmlsbDojNTc1ZTc1O2ZpbGwtb3BhY2l0eToxO3N0cm9rZTojNTc1ZTc1O3N0cm9rZS13aWR0aDoxLjYzNDI2ODg4O3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiCiAgICAgdHJhbnNmb3JtPSJtYXRyaXgoMCwxLC0xLDAsMCwwKSIgLz4KICA8cmVjdAogICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlOm5vbmU7c3Ryb2tlLXdpZHRoOjAuNTtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIgogICAgIGlkPSJyZWN0NDE4NSIKICAgICB3aWR0aD0iNS41ODIxNDg2IgogICAgIGhlaWdodD0iNS40NjQ2Mjk3IgogICAgIHg9IjkuMjA4OTI1MiIKICAgICB5PSI5LjI2NzY4NDkiIC8+Cjwvc3ZnPgo=";
        private static eyedropperEventKey_: any;

        constructor(text: string, params: FieldPositionOptions, validator?: Function) {
            super(text, '0', '100', null, '100', 'Value', validator);
            this.params = params;
            if (!this.params.screenHeight) this.params.screenHeight = 120;
            if (!this.params.screenWidth) this.params.screenWidth = 160;
            if (!this.params.xInputName) this.params.xInputName = "x";
            if (!this.params.yInputName) this.params.yInputName = "y"

            if (this.params.min) this.min_ = parseInt(this.params.min)
            if (this.params.max) this.max_ = parseInt(this.params.max)
            // Find out which field we're on (x or y) and set the appropriate max.
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

            super.showEditor_();

            const simFrame = this.getSimFrame();
            if (!simFrame) return;

            let div = Blockly.DropDownDiv.getContentDiv();

            // Add position picker button
            let button = document.createElement('button');
            button.setAttribute('class', 'positionEyedropper');
            let image = document.createElement('img');
            image.src = FieldPosition.eyedropper_DATAURI;
            button.appendChild(image);
            div.appendChild(button);
            FieldPosition.eyedropperEventKey_ =
                Blockly.bindEventWithChecks_(button, 'mousedown', this,
                    this.activeEyedropper_);

        }

        private activeEyedropper_() {
            const simFrame = this.getSimFrame();
            if (!simFrame) return;

            if (this.selectorDiv_) return;

            // compute position and make sure we have something to show
            const bBox = simFrame.getBoundingClientRect();
            const paddingX = 20;
            const paddingY = 20;
            const simAspectRatio = 0.75;
            const left = bBox.left + paddingX;
            const top = bBox.top + paddingY;
            const width = (bBox.width - 2 * paddingX);
            const height = width * simAspectRatio;
            if (width < 0 || height < 0)
                return;

            // dimiss if window is resized
            this.resizeHandler = this.resizeHandler.bind(this);
            window.addEventListener("resize", this.resizeHandler, false);

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
            const label = document.createElement('div');
            label.className = 'label'
            canvasOverlayDiv.appendChild(label);

            // Position overlay div
            canvasOverlayDiv.style.top = top + 'px';
            canvasOverlayDiv.style.left = left + 'px';
            canvasOverlayDiv.style.height = height + 'px';
            canvasOverlayDiv.style.width = width + 'px';

            const setPos = (x: number, y: number) => {
                x = Math.round(Math.max(0, Math.min(width, x)));
                y = Math.round(Math.max(0, Math.min(height, y)));

                crossX.style.top = y + 'px';
                crossY.style.left = x + 'px';
                label.style.left = (x + 4) + 'px';
                label.style.top = (y + 2) + 'px';

                x = Math.round(Math.max(0, Math.min(this.params.screenWidth, x / width * this.params.screenWidth)));
                y = Math.round(Math.max(0, Math.min(this.params.screenHeight, y / height * this.params.screenHeight)));

                label.textContent = `${this.params.xInputName}=${x}, ${this.params.yInputName}=${y}`;
            }

            // Position initial crossX and crossY
            const { currentX, currentY } = this.getXY();
            setPos(
                currentX / this.params.screenWidth * width,
                currentY / this.params.screenHeight * height);

            Blockly.bindEvent_(lightboxDiv, 'mouseup', this, () => {
                this.close();
            });

            Blockly.bindEvent_(canvasOverlayDiv, 'mousemove', this, (e: MouseEvent) => {
                const x = e.clientX - left;
                const y = e.clientY - top;

                setPos(x, y);
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

        private resizeHandler() {
            this.close();
        }

        private setXY(x: number, y: number) {
            const xField = this.getFieldByName(this.params.xInputName);
            if (xField) xField.setValue(String(x));
            const yField = this.getFieldByName(this.params.yInputName);
            if (yField) yField.setValue(String(y));
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
                (Blockly.FieldNumber as any).superClass_.widgetDispose_.call(that)();
                that.close(true);
            }
        }

        dispose() {
            super.dispose();

            if (FieldPosition.eyedropperEventKey_) {
                Blockly.unbindEvent_(FieldPosition.eyedropperEventKey_);
            }
        }

        private close(skipWidget?: boolean) {
            if (!skipWidget) {
                Blockly.WidgetDiv.hideIfOwner(this);
                Blockly.DropDownDiv.hideIfOwner(this);
            }

            // remove resize listener
            window.removeEventListener("resize", this.resizeHandler);

            // Destroy the selector div
            if (!this.selectorDiv_) return;
            goog.dom.removeNode(this.selectorDiv_);
            this.selectorDiv_ = undefined;
        }
    }

}