import * as Blockly from "blockly";
import { FieldImageDropdown } from "./field_imagedropdown";
import { FieldLedMatrix } from "./field_ledmatrix";

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
    constructor(blocksInfo: pxtc.BlocksInfo, colors?: string[], colorNames?: string[]) {
        super((colors || DEFAULT_LED_COLORS)[0], {
            blocksInfo,
            columns: "4",
            data: (colors || DEFAULT_LED_COLORS).map((color, index) => ([{
                src: generateImageData(color),
                width: 16,
                height: 16,
                alt: colorNames?.[index] || color
            }, color])),
        });
    }

    onColorSelected(index: number) {
        if (!this.sourceBlock_) return;
        const field = this.sourceBlock_.getField("LEDS") as FieldLedMatrix;

        field.setActiveColorIndex(index + 1); // +1 to account for the off color at index 0
    }

    doValueUpdate_(newValue: string) {
        super.doValueUpdate_(newValue);

        this.onColorSelected(DEFAULT_LED_COLORS.indexOf(newValue));
    }
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