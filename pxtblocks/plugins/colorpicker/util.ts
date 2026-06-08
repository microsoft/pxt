import { rgbToHex, cmykToRgb, hslToRgb, hsvToRgb, rgbToCmyk, hexToRgb, rgbToHsl, rgbToHsv, hsvToHsl, hslToHsv } from "./conversions";

export enum FieldColorPickerNumberType {
    Degrees,
    Percentage,
    RGB
}

export function fromFormatToHex(format: string, color: number[]) {
    switch (format.toLowerCase()) {
        case "cmyk":
            return rgbToHex(cmykToRgb(color));
        case "hsl":
            return rgbToHex(hslToRgb(color));
        case "hsv":
            return rgbToHex(hsvToRgb(color));
        case "rgb":
            return rgbToHex(color);
        default:
            throw new Error(`Unsupported color format: ${format}`);
    }
}

export function fromHexToFormat(format: string, hex: string): number[] {
    switch (format.toLowerCase()) {
        case "cmyk":
            return rgbToCmyk(hexToRgb(hex));
        case "hsl":
            return rgbToHsl(hexToRgb(hex));
        case "hsv":
            return rgbToHsv(hexToRgb(hex));
        case "rgb":
            return hexToRgb(hex);
        default:
            throw new Error(`Unsupported color format: ${format}`);
    }
}

export function fromHSVToFormat(format: string, hsv: number[]): number[] {
    switch (format.toLowerCase()) {
        case "cmyk":
            return rgbToCmyk(hsvToRgb(hsv));
        case "hsl":
            return hsvToHsl(hsv);
        case "hsv":
            return hsv;
        case "rgb":
            return hsvToRgb(hsv);
        default:
            throw new Error(`Unsupported color format: ${format}`);
    }
}

export function fromFormatToHSV(format: string, color: number[]): number[] {
    switch (format.toLowerCase()) {
        case "cmyk":
            return rgbToHsv(cmykToRgb(color));
        case "hsl":
            return hslToHsv(color);
        case "hsv":
            return color;
        case "rgb":
            return rgbToHsv(color);
        default:
            throw new Error(`Unsupported color format: ${format}`);
    }
}

export function getFieldTypesForFormat(format: string): FieldColorPickerNumberType[] {
    switch (format.toLowerCase()) {
        case "cmyk":
            return [FieldColorPickerNumberType.Percentage, FieldColorPickerNumberType.Percentage, FieldColorPickerNumberType.Percentage, FieldColorPickerNumberType.Percentage];
        case "hsl":
        case "hsv":
            return [FieldColorPickerNumberType.Degrees, FieldColorPickerNumberType.Percentage, FieldColorPickerNumberType.Percentage];
        case "rgb":
            return [FieldColorPickerNumberType.RGB, FieldColorPickerNumberType.RGB, FieldColorPickerNumberType.RGB];
        default:
            throw new Error(`Unsupported color format: ${format}`);
    }
}



