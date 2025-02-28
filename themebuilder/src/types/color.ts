export type RgbaColor = {
    r: number;
    g: number;
    b: number;
    a: number;
}

export class Color {
    value: string;
    private parsedColor: RgbaColor | null = null;

    constructor(value: string) {
        this.value = value;
    }

    // Method to get a lightened color
    getLightened(amount: number): Color {
        const { r, g, b, a } = this.getParsedColor();
        const factor = amount - 1;
        const newR = Math.min(255, Math.max(0, r + Math.round(255 * factor)));
        const newG = Math.min(255, Math.max(0, g + Math.round(255 * factor)));
        const newB = Math.min(255, Math.max(0, b + Math.round(255 * factor)));
        return new Color(this.rgbaToHex(newR, newG, newB, a));
    }

    // Method to get a darkened color
    getDarkened(amount: number): Color {
        const { r, g, b, a } = this.getParsedColor();
        const factor = 1 - amount;
        const newR = Math.min(255, Math.max(0, r + Math.round(255 * factor)));
        const newG = Math.min(255, Math.max(0, g + Math.round(255 * factor)));
        const newB = Math.min(255, Math.max(0, b + Math.round(255 * factor)));
        return new Color(this.rgbaToHex(newR, newG, newB, a));
    }

    // Method to get a version of this color with a different alpha
    getWithAlpha(alpha: number): Color {
        const { r, g, b, a } = this.getParsedColor();
        return new Color(`rgba(${r}, ${g}, ${b}, ${alpha})`);
    }

    toHex(): string {
        const { r, g, b, a } = this.getParsedColor();
        return this.rgbaToHex(r, g, b, a);
    }

    toRgba(): string {
        const { r, g, b, a } = this.getParsedColor();
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // Ranges from 0 to 255, 0 being dark and 255 being light
    getLuminance(): number {
        const { r, g, b } = this.getParsedColor();
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance;
    }

    isDarkColor(): boolean {
        return this.getLuminance() < 127;
    }

    getParsedColor(): RgbaColor {
        if (!this.parsedColor) {
            this.parsedColor = this.parseColor();
        }
        return this.parsedColor;
    }

    private parseColor(): RgbaColor {
        let r = 0, g = 0, b = 0, a = 1;

        if (this.value.startsWith('#')) {
            const hex = this.value.slice(1);
            if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            } else if (hex.length === 8) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
                a = parseInt(hex.slice(6, 8), 16) / 255;
            } else {
                throw new Error('Invalid hex color format');
            }
        } else if (this.value.startsWith('rgb')) {
            const rgb = this.value.match(/([\d\.]+)/g);
            if (rgb && rgb.length >= 3) {
                r = parseInt(rgb[0]);
                g = parseInt(rgb[1]);
                b = parseInt(rgb[2]);
                if (rgb.length === 4) {
                    a = parseFloat(rgb[3]);
                }
            } else {
                throw new Error('Invalid rgb color format');
            }
        } else {
            throw new Error('Unsupported color format');
        }

        return { r, g, b, a };
    }

    // Utility method to convert RGBA to hex
    private rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
        const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
        const rgbHex = ((1 << 24) + (r << 16) + (g << 8) + b)
            .toString(16)
            .slice(1)
            .toUpperCase();
        return `#${rgbHex}${alphaHex}`;
    }
}
