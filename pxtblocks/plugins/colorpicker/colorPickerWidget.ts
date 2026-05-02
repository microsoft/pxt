import { fromFormatToHex, fromFormatToHSV, fromHexToFormat, fromHSVToFormat } from "./util";
import * as Blockly from "blockly";

const thumbStylePrefix = `--blocklyFieldSliderBackgroundColor: ${createSliderGradient()}; --blocklyFieldSliderThumbBorderColor: #ffffff; `

export class ColorPickerWidget {
    private slider: HTMLInputElement;
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
        if (this.slider) return;

        this.hsv = hsv;

        this.slider = document.createElement("input");
        this.slider.classList.add("blocklyFieldSlider");
        this.slider.classList.add("hueSlider");
        this.slider.type = "range";
        this.slider.min = "0";
        this.slider.max = "359";
        this.slider.value = "0";
        this.slider.step = "1";
        this.slider.setAttribute("style", thumbStylePrefix + `--blocklyFieldSliderThumbColor: hsl(${this.hsv[0]}, 100%, 50%)`);
        container.appendChild(this.slider);

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
        Blockly.browserEvents.bind(this.slider, "input", this, (event: InputEvent) => {
            const val = parseFloat(this.slider.value) || 0;
            if (val !== null && val !== this.hsv[0]) {
                this.hsv[0] = Math.round(val);

                const newColor = fromFormatToHex("hsv", this.hsv);

                this.updateBackgroundColor(newColor);
                this.onColorChanged(this.hsv);
                focus();
            }
        });

        Blockly.browserEvents.bind(this.slider, "focus", this, (event: FocusEvent) => {
            focus();
        });

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
    }

    protected updateBackgroundColor(color: string) {
        if (this.slider) {
            this.slider.value = this.hsv[0] + "";
        }

        if (this.animFrameRequest) {
            cancelAnimationFrame(this.animFrameRequest);
        }
        this.animFrameRequest = requestAnimationFrame(() => {
            if (this.slider) {
                this.slider.setAttribute("style", thumbStylePrefix + `--blocklyFieldSliderThumbColor: hsl(${this.hsv[0]}, 100%, 50%)`);
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

        if (this.slider) {
            this.slider.remove();
            this.slider = undefined;
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
        if (this.slider) {
            this.slider.focus();
        }
    }

    private sliderPointerdownListener = (e: PointerEvent) => {
        this.setKeyboardControlActive(false);
    }

    private sliderKeydownListener = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowUp': {
                e.preventDefault();
                this.focusHtmlInput();
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
                break;
            }
        }
    }

    private sliderBlurListener = (e: FocusEvent) => {
        this.setKeyboardControlActive(false);
    }

    private addEventListeners() {
        this.slider.addEventListener('keydown', this.sliderKeydownListener);
        this.slider.addEventListener('blur', this.sliderBlurListener);
        this.slider.addEventListener("pointerdown", this.sliderPointerdownListener);
    }

    private removeEventListeners() {
        this.slider.removeEventListener('keydown', this.sliderKeydownListener);
        this.slider.removeEventListener('blur', this.sliderBlurListener);
        this.slider.removeEventListener('pointerdown', this.sliderPointerdownListener);
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
`)