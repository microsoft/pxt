namespace image {
    export function createImage(leds:string) : Image {
        return null;
    }
}

interface Image {
    /**
     * Shows an frame from the image at offset ``x offset``.
     * @param xOffset TODO
     */
    //% help=functions/show-image weight=69 shim=micro_bit::showImage
    showImage(xOffset: number) : void;

    plotImage(xOffset: number): void;

    clear() : void;

    setPixelBrightness(x:number, y:number, v : number) : void;

    pixelBrightness(x:number, y:number) : number;
}
