namespace pxtblockly {
    export namespace svg {
        export function hasClass(el: SVGElement, cls: string): boolean {
            return pxt.BrowserUtils.containsClass(el, cls);
        }

        export function addClass(el: SVGElement, cls: string) {
            pxt.BrowserUtils.addClass(el, cls);
        }

        export function removeClass(el: SVGElement, cls: string) {
            pxt.BrowserUtils.removeClass(el, cls);
        }
    }
    export function parseColour(colour: string | number): string {
        const hue = Number(colour);
        if (!isNaN(hue)) {
            return Blockly.hueToRgb(hue);
        } else if (goog.isString(colour) && (colour as string).match(/^#[0-9a-fA-F]{6}$/)) {
            return colour as string;
        } else {
            return '#000';
        }
    }

    /**
     * Converts a bitmap into a square image suitable for display. In light mode the preview
     * is drawn with no transparency (alpha is filled with background color)
     */
    export function bitmapToImageURI(frame: pxt.sprite.Bitmap, sideLength: number, lightMode: boolean) {
        const colors = pxt.appTarget.runtime.palette.slice(1);
        const canvas = document.createElement("canvas");
        canvas.width = sideLength;
        canvas.height = sideLength;

        // Works well for all of our default sizes, does not work well if the size is not
        // a multiple of 2 or is greater than 32 (i.e. from the decompiler)
        const cellSize = Math.min(sideLength / frame.width, sideLength / frame.height);

        // Center the image if it isn't square
        const xOffset = Math.max(Math.floor((sideLength * (1 - (frame.width / frame.height))) / 2), 0);
        const yOffset = Math.max(Math.floor((sideLength * (1 - (frame.height / frame.width))) / 2), 0);

        let context: CanvasRenderingContext2D;
        if (lightMode) {
            context = canvas.getContext("2d", { alpha: false });
            context.fillStyle = "#dedede";
            context.fillRect(0, 0, sideLength, sideLength);
        }
        else {
            context = canvas.getContext("2d");
        }

        for (let c = 0; c < frame.width; c++) {
            for (let r = 0; r < frame.height; r++) {
                const color = frame.get(c, r);

                if (color) {
                    context.fillStyle = colors[color - 1];
                    context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                }
                else if (lightMode) {
                    context.fillStyle = "#dedede";
                    context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                }
            }
        }

        return canvas.toDataURL();
    }
}