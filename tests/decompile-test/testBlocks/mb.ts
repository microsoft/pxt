/**
 * APIs lifted from pxt-microbit
 */

declare interface Image {
    /**
     * Plots the image at a given column to the screen
     */
    //% help=images/plot-image
    //% parts="ledmatrix" xOffset.defl=0 shim=ImageMethods::plotImage
    plotImage(xOffset?: number): void;

    /**
     * Shows an frame from the image at offset ``x offset``.
     * @param xOffset column index to start displaying the image
     */
    //% help=images/show-image weight=80 blockNamespace=images
    //% blockId=device_show_image_offset block="show image %sprite|at offset %offset" blockGap=8
    //% parts="ledmatrix" shim=ImageMethods::showImage
    showImage(xOffset: number): void;

    /**
     * Draws the ``index``-th frame of the image on the screen.
     * @param xOffset column index to start displaying the image
     */
    //% help=images/plot-frame weight=80
    //% parts="ledmatrix" shim=ImageMethods::plotFrame
    plotFrame(xOffset: number): void;

    /**
     * Scrolls an image .
     * @param frameOffset x offset moved on each animation step, eg: 1, 2, 5
     * @param interval time between each animation step in milli seconds, eg: 200
     */
    //% help=images/scroll-image weight=79 async blockNamespace=images
    //% blockId=device_scroll_image block="scroll image %sprite|with offset %frameoffset|and interval (ms) %delay" blockGap=8
    //% parts="ledmatrix" shim=ImageMethods::scrollImage
    scrollImage(frameOffset: number, interval: number): void;

    /**
     * Sets all pixels off.
     */
    //% help=images/clear
    //% parts="ledmatrix" shim=ImageMethods::clear
    clear(): void;

    /**
     * Sets a specific pixel brightness at a given position
     */
    //%
    //% parts="ledmatrix" shim=ImageMethods::setPixelBrightness
    setPixelBrightness(x: number, y: number, value: number): void;

    /**
     * Gets the pixel brightness ([0..255]) at a given position
     */
    //%
    //% parts="ledmatrix" shim=ImageMethods::pixelBrightness
    pixelBrightness(x: number, y: number): number;

    /**
     * Gets the width in columns
     */
    //% help=functions/width shim=ImageMethods::width
    width(): number;

    /**
     * Gets the height in rows (always 5)
     */
    //% shim=ImageMethods::height
    height(): number;

    /**
     * Set a pixel state at position ``(x,y)``
     * @param x TODO
     * @param y TODO
     * @param value TODO
     */
    //% help=images/set-pixel
    //% parts="ledmatrix" shim=ImageMethods::setPixel
    setPixel(x: number, y: number, value: boolean): void;

    /**
     * Get the pixel state at position ``(x,y)``
     * @param x TODO
     * @param y TODO
     */
    //% help=images/pixel
    //% parts="ledmatrix" shim=ImageMethods::pixel
    pixel(x: number, y: number): boolean;

    /**
     * Shows a particular frame of the image strip.
     * @param frame TODO
     */
    //% weight=70 help=images/show-frame
    //% parts="ledmatrix" shim=ImageMethods::showFrame
    showFrame(frame: number): void;
}

/**
 * Creation, manipulation and display of LED images.
 */
//% color=#5C2D91 weight=31
//% advanced=true
namespace images {

    /**
     * Creates an image that fits on the LED screen.
     */
    //% weight=75 help=images/create-image
    //% blockId=device_build_image block="create image"
    //% parts="ledmatrix" imageLiteral=1 shim=images::createImage
    export function createImage(leds: string): Image {
        return undefined;
    }

    /**
     * Creates an image with 2 frames.
     */
    //% weight=74 help=images/create-big-image
    //% blockId=device_build_big_image block="create big image" imageLiteral=2
    //% parts="ledmatrix" shim=images::createBigImage
    export function createBigImage(leds: string): Image {
        return undefined;
    }
}

//% color=#0078D7 weight=100
declare namespace basic {

    /**
     * Draws an image on the LED screen.
     * @param leds the pattern of LED to turn on/off
     * @param interval time in milliseconds to pause after drawing
     */
    //% help=basic/show-leds
    //% weight=95 blockGap=8
    //% imageLiteral=1 async
    //% blockId=device_show_leds
    //% block="show leds" icon="\uf00a"
    //% parts="ledmatrix" interval.defl=400 shim=basic::showLeds
    export function showLeds(leds: string, interval?: number): void;

    /**
     * Scroll a number on the screen. If the number fits on the screen (i.e. is a single digit), do not scroll.
     * @param interval speed of scroll; eg: 150, 100, 200, -100
     */
    //% help=basic/show-number
    //% weight=96
    //% blockId=device_show_number block="show|number %number" blockGap=8
    //% async
    //% parts="ledmatrix" interval.defl=150 shim=basic::showNumber
    export function showNumber(value: number, interval?: number): void;
}