import * as Blockly from "blockly";
import { FieldImageDropdown } from "./field_imagedropdown";
import { FieldLedMatrix } from "./field_ledmatrix";
import { mkTransparentTileImage } from "./field_tileset";

const TRANSPARENT_OPTION_KEY = "$transparent";

export const DEFAULT_LED_COLORS = [
    "#FFFFFF",
    "#ED1C23",
    "#B97858",
    "#FF7D27",
    "#FFCA0C",
    "#FFF200",
    "#EEE5B2",
    "#22B14D",
    "#B4E61D",
    "#00A2E8",
    "#99D9EB",
    "#3E47CB",
    "#7092BE",
    "#A249A4",
    "#880014",
    "#FFAEC9"
]

export function getDefaultColorNames() {
    return [
        lf("{id:color}white"),
        lf("{id:color}red"),
        lf("{id:color}brown"),
        lf("{id:color}orange"),
        lf("{id:color}yellow"),
        lf("{id:color}light yellow"),
        lf("{id:color}cream"),
        lf("{id:color}green"),
        lf("{id:color}light green"),
        lf("{id:color}blue"),
        lf("{id:color}light blue"),
        lf("{id:color}dark blue"),
        lf("{id:color}gray"),
        lf("{id:color}purple"),
        lf("{id:color}dark red"),
        lf("{id:color}pink")
    ]
}

export class FieldLEDMatrixColorPicker extends FieldImageDropdown {
    constructor(blocksInfo: pxtc.BlocksInfo, colors?: string[], colorNames?: string[], protected includeTransparency = false) {
        super((colors || DEFAULT_LED_COLORS)[0], {
            blocksInfo,
            columns: "4",
            data: generateOptions(colors, colorNames, includeTransparency)
        });
    }

    onColorSelected(index: number) {
        if (!this.sourceBlock_) return;
        const field = this.sourceBlock_.getField("LEDS") as FieldLedMatrix;

        field.setActiveColorIndex(index);
    }

    doValueUpdate_(newValue: string) {
        super.doValueUpdate_(newValue);

        const options = this.getOptions();
        const index = options.findIndex(([_, value]) => value === newValue);
        if (index === -1) return;

        if (this.includeTransparency) {
            this.onColorSelected(index);
        }
        else {
            this.onColorSelected(index + 1); // +1 to account for the off color at index 0
        }
    }
}

function generateOptions(colors: string[], colorNames: string[], includeTransparency: boolean): [Blockly.ImageProperties, string][] {
    if (!colors) colors = DEFAULT_LED_COLORS;
    if (!colorNames) colorNames = getDefaultColorNames();

    const options: [Blockly.ImageProperties, string][] = [];

    if (includeTransparency) {
        options.push([{
            src: mkTransparentTileImage(16),
            width: 16,
            height: 16,
            alt: lf("{id:color}transparency")
        }, TRANSPARENT_OPTION_KEY]);
    }

    for (let i = 0; i < colors.length; i++) {
        options.push([{
            src: generateImageData(colors[i]),
            width: 16,
            height: 16,
            alt: colorNames[i] || colors[i]
        }, colors[i]]);
    }

    return options;
}

function generateImageData(color: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 16, 16);
    return canvas.toDataURL();
}