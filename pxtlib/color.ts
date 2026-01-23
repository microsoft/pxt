namespace pxt {
    export function getWhiteContrastingBackground(color: string) {
        if (contrastRatio("#ffffff", color) >= 4.5) return color;

        const hslColor = hsl(color);

        // There is probably a "smart" way to calculate this, but a cursory search
        // didn't turn up anything so we're just going to decrease the luminosity
        // until we get a contrasting color
        const luminosityStep = 0.05;

        let l = hslColor.l - luminosityStep;
        while (l > 0) {
            const newColor = hslToHex({ h: hslColor.h, s: hslColor.s, l });
            if (contrastRatio("#ffffff", newColor) >= 4.5) return newColor;
            l -= luminosityStep;
        }

        // We couldn't find one, so just return the original
        console.warn(`Couldn't find a contrasting background for color ${color}`);
        return color;
    }

    function hsl(color: string): { h: number, s: number, l: number } {
        const rgb = pxt.toolbox.convertColor(color);

        const r = parseInt(rgb.slice(1, 3), 16) / 255;
        const g = parseInt(rgb.slice(3, 5), 16) / 255;
        const b = parseInt(rgb.slice(5, 7), 16) / 255;

        const max = Math.max(Math.max(r, g), b);
        const min = Math.min(Math.min(r, g), b);

        const diff = max - min;
        let h;
        if (diff === 0)
            h = 0;
        else if (max === r)
            h = ((((g - b) / diff) % 6) + 6) % 6;
        else if (max === g)
            h = (b - r) / diff + 2;
        else if (max === b)
            h = (r - g) / diff + 4;

        let l = (min + max) / 2;
        let s = diff === 0
            ? 0
            : diff / (1 - Math.abs(2 * l - 1));

        return {
            h: h * 60,
            s,
            l
        }
    }


    function relativeLuminance(color: string) {
        const rgb = pxt.toolbox.convertColor(color);

        const r = parseInt(rgb.slice(1, 3), 16) / 255;
        const g = parseInt(rgb.slice(3, 5), 16) / 255;
        const b = parseInt(rgb.slice(5, 7), 16) / 255;

        const r2 = (r <= 0.03928) ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
        const g2 = (g <= 0.03928) ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
        const b2 = (b <= 0.03928) ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

        return 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
    }

    export function contrastRatio(fg: string, bg: string) {
        return (relativeLuminance(fg) + 0.05) / (relativeLuminance(bg) + 0.05)
    }

    function hslToHex(color: { h: number, s: number, l: number }) {
        const chroma = (1 - Math.abs(2 * color.l - 1)) * color.s;
        const hp = color.h / 60.0;
        // second largest component of this color
        const x = chroma * (1 - Math.abs((hp % 2) - 1));

        // 'point along the bottom three faces of the RGB cube'
        let rgb1: number[];
        if (color.h === undefined)
            rgb1 = [0, 0, 0];
        else if (hp <= 1)
            rgb1 = [chroma, x, 0];
        else if (hp <= 2)
            rgb1 = [x, chroma, 0];
        else if (hp <= 3)
            rgb1 = [0, chroma, x];
        else if (hp <= 4)
            rgb1 = [0, x, chroma];
        else if (hp <= 5)
            rgb1 = [x, 0, chroma];
        else if (hp <= 6)
            rgb1 = [chroma, 0, x];

        // lightness match component
        let m = color.l - chroma * 0.5;
        return toHexString(
            Math.round(255 * (rgb1[0] + m)),
            Math.round(255 * (rgb1[1] + m)),
            Math.round(255 * (rgb1[2] + m))
        );
    }

    function toHexString(r: number, g: number, b: number) {
        return "#" + toHex(r) + toHex(g) + toHex(b);
    }

    function toHex(n: number) {
        return ("0" + n.toString(16)).slice(-2)
    }
}