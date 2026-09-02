import { fromFormatToHex, fromFormatToHSV, fromHexToFormat, fromHSVToFormat } from "./util";
import * as Blockly from "blockly";

const thumbStylePrefix = `--blocklyFieldSliderBackgroundColor: ${createSliderGradient()}; --blocklyFieldSliderThumbBorderColor: #ffffff; `

export class ColorPickerWidget {
    private hueSlider: HTMLInputElement;
    private saturationSlider: HTMLInputElement;
    private valueSlider: HTMLInputElement;

    private colorPreview: HTMLDivElement
    private canvas: HTMLCanvasElement;
    private canvasContainer: HTMLDivElement;
    private saturationValueHandle: HTMLDivElement;

    private hsv: number[] = [0, 100, 100];

    private animFrameRequest: number | undefined;


    constructor(
        private setKeyboardControlActive: (active: boolean) => void,
        private isKeyboardControlActive: () => boolean,
        private focusHtmlInput: () => void,
        private onColorChanged: (hsv: number[]) => void,
    ) {
    }

    createDom(container: HTMLDivElement, hsv: number[]) {
        if (this.hueSlider) return;

        this.hsv = hsv;

        this.hueSlider = document.createElement("input");
        this.hueSlider.classList.add("blocklyFieldSlider");
        this.hueSlider.classList.add("hueSlider");
        this.hueSlider.type = "range";
        this.hueSlider.min = "0";
        this.hueSlider.max = "359";
        this.hueSlider.value = hsv[0] + "";
        this.hueSlider.step = "1";
        this.hueSlider.setAttribute("style", thumbStylePrefix + `--blocklyFieldSliderThumbColor: hsl(${this.hsv[0]}, 100%, 50%)`);
        this.hueSlider.setAttribute("aria-label", lf("Hue"));
        container.appendChild(this.hueSlider);

        this.saturationSlider = document.createElement("input");
        this.saturationSlider.classList.add("screen-reader-only");
        this.saturationSlider.type = "range";
        this.saturationSlider.min = "0";
        this.saturationSlider.max = "100";
        this.saturationSlider.value = hsv[1] + "";
        this.saturationSlider.step = "1";
        this.saturationSlider.setAttribute("aria-label", lf("Saturation"));
        container.appendChild(this.saturationSlider);

        this.valueSlider = document.createElement("input");
        this.valueSlider.classList.add("screen-reader-only");
        this.valueSlider.type = "range";
        this.valueSlider.min = "0";
        this.valueSlider.max = "100";
        this.valueSlider.value = hsv[2] + "";
        this.valueSlider.step = "1";
        this.valueSlider.setAttribute("aria-label", lf("Value"));
        container.appendChild(this.valueSlider);

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexDirection = "row";
        container.appendChild(row);

        this.colorPreview = document.createElement("div");
        this.colorPreview.style.width = "100px";
        this.colorPreview.style.height = "100px";
        this.colorPreview.style.backgroundColor = fromFormatToHex("hsv", this.hsv);
        row.appendChild(this.colorPreview);

        this.canvasContainer = document.createElement("div");
        this.canvasContainer.style.position = "relative";
        this.canvasContainer.style.width = "200px";
        this.canvasContainer.style.height = "100px";
        row.appendChild(this.canvasContainer);

        this.canvas = document.createElement("canvas");
        this.canvas.width = 200;
        this.canvas.height = 100;
        this.canvasContainer.appendChild(this.canvas);

        renderCanvas(this.canvas);

        this.saturationValueHandle = document.createElement("div");
        this.saturationValueHandle.classList.add("saturation-value-handle");

        this.canvasContainer.appendChild(this.saturationValueHandle);

        container.style.width = "308px";
        container.style.overflowX = "hidden";
        container.style.overflowY = "hidden";

        const focus = () => {
            // In firefox, stealing focus from the range input interrupts
            // the dragging of the slider
            if (!pxt.BrowserUtils.isFirefox()) {
                if (!this.isKeyboardControlActive()) {
                    this.focusHtmlInput();
                }
            }
        };

        // Configure event handler.
        for (let i = 0; i < 3; i++) {
            const slider = [this.hueSlider, this.saturationSlider, this.valueSlider][i];
            Blockly.browserEvents.bind(slider, "focus", this, (event: FocusEvent) => {
                focus();
            });
            Blockly.browserEvents.bind(slider, "input", this, (event: InputEvent) => {
                const val = parseFloat(slider.value) || 0;
                if (val !== null && val !== this.hsv[i]) {
                    this.hsv[i] = Math.round(val);

                    const newColor = fromFormatToHex("hsv", this.hsv);

                    this.updateBackgroundColor(newColor);
                    this.onColorChanged(this.hsv);
                    focus();
                }
            });
        }

        let pointerDown = false;

        const updateSaturationValue = (e: PointerEvent) => {
            if (!pointerDown) return;
            e.preventDefault();

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const saturation = Math.round(Math.max(0, Math.min(100, (x / this.canvas.width) * 100)));
            const value = Math.round(Math.max(0, Math.min(100, (1 - (y / this.canvas.height)) * 100)));

            this.hsv[1] = saturation;
            this.hsv[2] = value;
            this.saturationSlider.value = saturation + "";
            this.valueSlider.value = value + "";

            const newColor = fromFormatToHex("hsv", this.hsv);

            this.updateBackgroundColor(newColor);
            this.onColorChanged(this.hsv);
            focus();
        };

        this.canvasContainer.addEventListener("pointerdown", (e: PointerEvent) => {
            pointerDown = true;
            updateSaturationValue(e);
        });

        this.canvasContainer.addEventListener("pointermove", updateSaturationValue);

        const onPointerUp = (e: PointerEvent) => {
            updateSaturationValue(e);
            pointerDown = false;
        }

        for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
            this.canvasContainer.addEventListener(ev, onPointerUp);
        }

        this.updateBackgroundColor(fromFormatToHex("hsv", this.hsv));
        this.addEventListeners();
    }

    updateColorChannel(format: string, channel: number, value: number) {
        if (format === "hsv") {
            this.hsv[channel] = value;
        }
        else if (format === "hsl" && channel === 0) {
            this.hsv[0] = value;
        }
        else {
            const values = fromHSVToFormat(format, this.hsv);
            values[channel] = value;
            this.hsv = fromFormatToHSV(format, values);
        }

        this.updateBackgroundColor(fromFormatToHex("hsv", this.hsv));

        return this.hsv.slice();
    }

    protected updateBackgroundColor(color: string) {
        if (this.hueSlider) {
            this.hueSlider.value = this.hsv[0] + "";
        }

        if (this.animFrameRequest) {
            cancelAnimationFrame(this.animFrameRequest);
        }
        this.animFrameRequest = requestAnimationFrame(() => {
            if (this.hueSlider) {
                this.hueSlider.setAttribute("style", thumbStylePrefix + `--blocklyFieldSliderThumbColor: hsl(${this.hsv[0]}, 100%, 50%)`);
            }

            if (this.colorPreview) {
                this.colorPreview.style.backgroundColor = color;
            }

            if (this.canvas) {
                this.canvas.style.backgroundColor = `hsl(${this.hsv[0]}, 100%, 50%)`;
            }

            if (this.saturationValueHandle) {
                this.saturationValueHandle.style.left = `${(this.hsv[1] / 100) * this.canvas.width - this.saturationValueHandle.offsetWidth / 2}px`;
                this.saturationValueHandle.style.top = `${((100 - this.hsv[2]) / 100) * this.canvas.height - this.saturationValueHandle.offsetHeight / 2}px`;
                this.saturationValueHandle.style.backgroundColor = color;
            }
            this.animFrameRequest = undefined;
        });
    }

    dispose() {
        this.removeEventListeners();

        if (this.animFrameRequest) {
            cancelAnimationFrame(this.animFrameRequest);
            this.animFrameRequest = undefined;
        }

        if (this.hueSlider) {
            this.hueSlider.remove();
            this.hueSlider = undefined;
        }

        if (this.saturationSlider) {
            this.saturationSlider.remove();
            this.saturationSlider = undefined;
        }

        if (this.valueSlider) {
            this.valueSlider.remove();
            this.valueSlider = undefined;
        }

        if (this.colorPreview) {
            this.colorPreview.remove();
            this.colorPreview = undefined;
        }

        if (this.canvas) {
            this.canvas.remove();
            this.canvas = undefined;
        }
    }

    focusSlider() {
        if (this.hueSlider) {
            this.hueSlider.focus();
        }
    }

    private sliderPointerdownListener = (e: PointerEvent) => {
        this.setKeyboardControlActive(false);
    }

    private sliderKeydownListener = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowUp': {
                e.preventDefault();
                if (e.target === this.valueSlider) {
                    this.saturationSlider.focus();
                }
                else if (e.target === this.saturationSlider) {
                    this.hueSlider.focus();
                }
                else {
                    this.focusHtmlInput();
                }
                break;
            }
            case 'Enter':
            case ' ': {
                e.preventDefault();
                e.stopPropagation();
                Blockly.hideChaff();
                break;
            }
            case "ArrowDown": {
                e.preventDefault();
                e.stopPropagation();
                if (e.target === this.hueSlider) {
                    this.saturationSlider.focus();
                }
                else if (e.target === this.saturationSlider) {
                    this.valueSlider.focus();
                }
                break;
            }
        }
    }

    private sliderBlurListener = (e: FocusEvent) => {
        if (e.relatedTarget === this.hueSlider ||
            e.relatedTarget === this.saturationSlider ||
            e.relatedTarget === this.valueSlider) {
            return;
        }
        this.setKeyboardControlActive(false);
    }

    private addEventListeners() {
        this.hueSlider.addEventListener('keydown', this.sliderKeydownListener);
        this.hueSlider.addEventListener('blur', this.sliderBlurListener);
        this.hueSlider.addEventListener("pointerdown", this.sliderPointerdownListener);
        this.saturationSlider.addEventListener('keydown', this.sliderKeydownListener);
        this.saturationSlider.addEventListener('blur', this.sliderBlurListener);
        this.saturationSlider.addEventListener("pointerdown", this.sliderPointerdownListener);
        this.valueSlider.addEventListener('keydown', this.sliderKeydownListener);
        this.valueSlider.addEventListener('blur', this.sliderBlurListener);
        this.valueSlider.addEventListener("pointerdown", this.sliderPointerdownListener);
    }

    private removeEventListeners() {
        this.hueSlider.removeEventListener('keydown', this.sliderKeydownListener);
        this.hueSlider.removeEventListener('blur', this.sliderBlurListener);
        this.hueSlider.removeEventListener('pointerdown', this.sliderPointerdownListener);
        this.saturationSlider.removeEventListener('keydown', this.sliderKeydownListener);
        this.saturationSlider.removeEventListener('blur', this.sliderBlurListener);
        this.saturationSlider.removeEventListener('pointerdown', this.sliderPointerdownListener);
        this.valueSlider.removeEventListener('keydown', this.sliderKeydownListener);
        this.valueSlider.removeEventListener('blur', this.sliderBlurListener);
        this.valueSlider.removeEventListener('pointerdown', this.sliderPointerdownListener);
    }
}

// this renders a canvas with a transparent grayscale HSV map that can
// be placed over a solid color backgroud to create a saturation/value picker.
// we do it this was instead of re-rendering it from scratch for each hue
// because it's way more performant to just change the background color of the
// canvas element
function renderCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // render a saturation/value map for a red hue
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const saturation = x / canvas.width;
            const value = 1 - (y / canvas.height);

            ctx.fillStyle = fromFormatToHex("hsv", [0, saturation * 100, value * 100])
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const imageData = ctx.getImageData(0, 0, width, height);

    // now loop over each pixel and convert the red channel to transparency
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];

        // because the hue we rendered was pure red, we can figure out how transparent the pixel
        // should be by looking at difference between the red value and one of the other channels,
        // which will be the same. green is an arbitrary choice, blue would also work
        const diff = r - g;
        imageData.data[i + 3] = 255 - diff;

        // make the map grayscale by copying over one of the other channels to red
        imageData.data[i] = g;
    }

    ctx.putImageData(imageData, 0, 0);
}

export function createSliderGradient() {
    const slices = 10;
    const colors: string[] = [];

    for (let i = 0; i < slices; i++) {
        const hue = (360 / slices) * i;
        colors.push(`hsl(${hue}, 100%, 50%)`)
    }
    colors.push(`hsl(0, 100%, 50%)`)

    return `linear-gradient(to right, ${colors.join(", ")})`
}


Blockly.Css.register(`
.saturation-value-handle {
    position: absolute;
    width: 26px;
    height: 26px;
    border-radius: 13px;
    border: 2px solid white;
}
input[type=range].blocklyFieldSlider.hueSlider {
    height: 35px;
}
input[type=range].blocklyFieldSlider.hueSlider::-webkit-slider-runnable-track {
    margin-top: 10px;
    height: 11px;
}
input[type=range].blocklyFieldSlider.hueSlider::-webkit-slider-thumb {
    margin-top: -7px;
    -webkit-box-shadow: 0 0 0 2px var(--blocklyFieldSliderThumbBorderColor);
    -moz-box-shadow: 0 0 0 2px var(--blocklyFieldSliderThumbBorderColor);
    box-shadow: 0 0 0 2px var(--blocklyFieldSliderThumbBorderColor);
}
input[type=range].blocklyFieldSlider.hueSlider::-moz-range-track {
    margin-top: 10px;
    height: 11px;
}
input[type=range].blocklyFieldSlider.hueSlider::-moz-range-thumb {
    margin-top: -7px;
    -webkit-box-shadow: 0 0 0 2px var(--blocklyFieldSliderThumbBorderColor);
    -moz-box-shadow: 0 0 0 2px var(--blocklyFieldSliderThumbBorderColor);
    box-shadow: 0 0 0 2px var(--blocklyFieldSliderThumbBorderColor);
}
input.screen-reader-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
    white-space: nowrap;
    border-width: 0;
}
`)