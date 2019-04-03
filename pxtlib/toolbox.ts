namespace pxt.toolbox {
    export const blockColors: Map<number | string> = {
        loops: '#107c10',
        logic: '#006970',
        math: '#712672',
        variables: '#A80000',
        functions: '#005a9e',
        text: '#996600',
        arrays: '#A94400',
        advanced: '#3c3c3c',
        addpackage: '#717171',
        search: '#000',
        debug: '#e03030',
        default: '#dddddd',
        topblocks: '#aa8f00'
    }

    export const blockIcons: Map<number | string> = {
        loops: '\uf01e',
        logic: '\uf074',
        math: '\uf1ec',
        variables: '\uf039',
        functions: '\uf109',
        text: '\uf035',
        arrays: '\uf0cb',
        advancedcollapsed: '\uf078',
        advancedexpanded: '\uf077',
        more: '\uf141',
        addpackage: '\uf055',
        search: '\uf002',
        debug: '\uf111',
        default: '\uf12e',
        topblocks: '\uf005'
    }

    let toolboxStyleBuffer: string = '';
    export function appendToolboxIconCss(className: string, i: string): void {
        if (toolboxStyleBuffer.indexOf(className) > -1) return;

        if (i.length === 1) {
            const icon = Util.unicodeToChar(i);
            toolboxStyleBuffer += `
                .blocklyTreeIcon.${className}::before {
                    content: "${icon}";
                }
            `;
        }
        else {
            toolboxStyleBuffer += `
                .blocklyTreeIcon.${className} {
                    background-image: url("${Util.pathJoin(pxt.webConfig.commitCdnUrl, encodeURI(i))}")!important;
                    width: 30px;
                    height: 100%;
                    background-size: 20px !important;
                    background-repeat: no-repeat !important;
                    background-position: 50% 50% !important;
                }
            `;
        }
    }

    export function getNamespaceColor(ns: string): string {
        ns = ns.toLowerCase();
        if (pxt.appTarget.appTheme.blockColors && pxt.appTarget.appTheme.blockColors[ns])
            return pxt.appTarget.appTheme.blockColors[ns] as string;
        if (pxt.toolbox.blockColors[ns])
            return pxt.toolbox.blockColors[ns] as string;
        return "";
    }

    export function getNamespaceIcon(ns: string): string {
        ns = ns.toLowerCase();
        if (pxt.appTarget.appTheme.blockIcons && pxt.appTarget.appTheme.blockIcons[ns]) {
            return pxt.appTarget.appTheme.blockIcons[ns] as string;
        }
        if (pxt.toolbox.blockIcons[ns]) {
            return pxt.toolbox.blockIcons[ns] as string;
        }
        return "";
    }

    export function advancedTitle() { return Util.lf("{id:category}Advanced"); }
    export function addPackageTitle() { return Util.lf("{id:category}Extensions"); }

    /**
     * Convert blockly hue to rgb
     */
    export function convertColor(colour: string): string {
        const hue = parseInt(colour);
        if (!isNaN(hue)) {
            return hueToRgb(hue);
        }
        return colour;
    }

    export function hueToRgb(hue: number) {
        const HSV_SATURATION = 0.45;
        const HSV_VALUE = 0.65 * 255;
        const rgbArray = hsvToRgb(hue, HSV_SATURATION, HSV_VALUE);
        return `#${componentToHex(rgbArray[0])}${componentToHex(rgbArray[1])}${componentToHex(rgbArray[2])}`;
    }

    /**
     * Converts an HSV triplet to an RGB array.  V is brightness because b is
     *   reserved for blue in RGB.
     * Closure's HSV to RGB function: https://github.com/google/closure-library/blob/master/closure/goog/color/color.js#L613
     */
    function hsvToRgb(h: number, s: number, brightness: number) {
        let red = 0;
        let green = 0;
        let blue = 0;
        if (s == 0) {
            red = brightness;
            green = brightness;
            blue = brightness;
        } else {
            let sextant = Math.floor(h / 60);
            let remainder = (h / 60) - sextant;
            let val1 = brightness * (1 - s);
            let val2 = brightness * (1 - (s * remainder));
            let val3 = brightness * (1 - (s * (1 - remainder)));
            switch (sextant) {
                case 1:
                    red = val2;
                    green = brightness;
                    blue = val1;
                    break;
                case 2:
                    red = val1;
                    green = brightness;
                    blue = val3;
                    break;
                case 3:
                    red = val1;
                    green = val2;
                    blue = brightness;
                    break;
                case 4:
                    red = val3;
                    green = val1;
                    blue = brightness;
                    break;
                case 5:
                    red = brightness;
                    green = val1;
                    blue = val2;
                    break;
                case 6:
                case 0:
                    red = brightness;
                    green = val3;
                    blue = val1;
                    break;
            }
        }
        return [Math.floor(red), Math.floor(green), Math.floor(blue)];
    }

    function componentToHex(c: number) {
        const hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    export function fadeColor(hex: string, luminosity: number, lighten: boolean): string {
        // #ABC => ABC
        hex = hex.replace(/[^0-9a-f]/gi, '');

        // ABC => AABBCC
        if (hex.length < 6)
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

        // tweak
        let rgb = "#";
        for (let i = 0; i < 3; i++) {
            let c = parseInt(hex.substr(i * 2, 2), 16);
            c = Math.round(Math.min(Math.max(0, lighten ? c + (c * luminosity) : c - (c * luminosity)), 255));
            let cStr = c.toString(16);
            rgb += ("00" + cStr).substr(cStr.length);
        }

        return rgb;
    }
}