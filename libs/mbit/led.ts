enum DisplayMode {
    //% enumval=0
    BackAndWhite,
    //% enumval=1
    Greyscale,
}

namespace led {
    /**
     * Turn on the specified LED using ``x``, ``y`` coordinates (``x`` is horizontal, ``y`` is vertical)
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/plot weight=78 shim=micro_bit::plot async
    export function plot(x: number, y: number): void { }

    /**
     * Get the on/off state of the specified LED using ``x, y`` coordinates.
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/point weight=76 shim=micro_bit::point async
    export function point(x: number, y: number): boolean { return false; }

    /**
     * Turn off the specified LED using x, y coordinates (x is horizontal, y is vertical)
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/unplot weight=77 shim=micro_bit::unPlot async
    export function unplot(x: number, y: number): void { }

    /**
     * Get the screen brightness from 0 (off) to 255 (full bright).
     */
    //% help=functions/brightness weight=75 shim=micro_bit::getBrightness async
    export function brightness(): number { return 0; }

    /**
     * Set the screen brightness from 0 (off) to 255 (full bright).
     * @param value TODO
     */
    //% help=functions/set-brightness weight=74 shim=micro_bit::setBrightness async
    export function setBrightness(value: number): void { }

    /**
     * Cancels the current animation and clears other pending animations.
     */
    //% weight=10 shim=uBit.display.stopAnimation async help=functions/stop-animation
    export function stopAnimation(): void { }

    /**
     * Sets the display mode between black and white and greyscale for rendering LEDs.
     * @param mode TODO
     */
    //% shim=micro_bit::setDisplayMode async weight=1 help=/functions/set-display-mode
    export function setDisplayMode(mode: DisplayMode): void { }

    /**
     * Toggles a particular pixel
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/toggle
    export function toggle(x: number, y: number): void {
        if (led.point(x, y)) {
            led.unplot(x, y);
        }
        else {
            led.plot(x, y);
        }
    }

    /**
     * Turns all LEDS on
     */
    //% help=functions/plot-all
    export function plotAll(): void {
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                led.plot(i, j);
            }
        }
    }

    /**
     * Inverts the current LED display
     */
    //% help=functions/toggle-all
    export function toggleAll(): void {
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                led.toggle(i, j);
            }
        }
    }

    /**
     * Fades in the screen display.
     * @param ms TODO
     */
    //% help=functions/fade-in
    export function fadeIn(ms: number): void {
        if (ms < 20) {
            led.setBrightness(255);
            return;
        }
        let dt = 50;
        let brightness = led.brightness();
        let start = input.runningTime();
        let elapsed = 0;
        while (elapsed < ms) {
            led.setBrightness(brightness + ((255 - brightness) * elapsed) / ms);
            basic.pause(dt);
            elapsed = input.runningTime() - start;
        }
        led.setBrightness(255);
    }

    /**
     * Fades out the screen brightness.
     * @param ms TODO
     */
    //% help=functions/fade-out
    export function fadeOut(ms: number): void {
        if (ms < 20) {
            led.setBrightness(0);
            return;
        }
        let brightness = led.brightness();
        let dt = 50;
        let start = input.runningTime();
        let elapsed = 0;
        while (elapsed < ms) {
            led.setBrightness(brightness - (brightness * elapsed) / ms);
            basic.pause(dt);
            elapsed = input.runningTime() - start;
        }
        led.setBrightness(0);
    }

    /**
     * Takes a screenshot of the LED screen and returns an image.
     */
    //% shim=uBit.display.screenShot async help=functions/screenshot
    export function screenshot(): Image {
        /*
        let img: Image;
        img = image.createImage("");
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                if (led.point(i, j)) {
                    img.setPixel(i, j, true);
                }
            }
        }
        return img;
        */
        return null;
    }

    /**
     * Displays a vertical bar graph based on the ``value`` and ``high`` value.
     * @param value TODO
     * @param high TODO
     */
    //% help=/functions/plot-bar-graph weight=20
    //% block="plot bar graph |from %1 |to %2"
    export function plotBarGraph(value: number, high: number): void {
        let v = pins.map(Math.abs(value), 0, high, 0, 5);
        if (v <= 0) {
            basic.plotLeds(`0 0 0 0 0
0 0 0 0 0
0 0 0 0 0
0 0 0 0 0
0 0 1 0 0`);
        }
        else if (v == 1) {
            basic.plotLeds(`0 0 0 0 0
0 0 0 0 0
0 0 0 0 0
0 0 0 0 0
1 1 1 1 1`);
        }
        else if (v == 2) {
            basic.plotLeds(`0 0 0 0 0
0 0 0 0 0
0 0 0 0 0
1 1 1 1 1
1 1 1 1 1`);
        }
        else if (v == 3) {
            basic.plotLeds(`0 0 0 0 0
0 0 0 0 0
1 1 1 1 1
1 1 1 1 1
1 1 1 1 1`);
        }
        else if (v == 4) {
            basic.plotLeds(`0 0 0 0 0
1 1 1 1 1
1 1 1 1 1
1 1 1 1 1
1 1 1 1 1`);
        }
        else {
            basic.plotLeds(`1 1 1 1 1
1 1 1 1 1
1 1 1 1 1
1 1 1 1 1
1 1 1 1 1`);
        }
    }

}
