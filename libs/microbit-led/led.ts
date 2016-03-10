enum DisplayMode {
    //% enumval=0 blockId="black and white"
    BackAndWhite,
    //% enumval=1 blockId="greyscale"
    Greyscale,
}

//% color=3 weight=35
namespace led {
    /**
     * Turn on the specified LED using x, y coordinates (x is horizontal, y is vertical). (0,0) is upper left.
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/plot weight=78 shim=micro_bit::plot
    //% blockId=device_plot block="plot|x %x|y %y" icon="\uf205" blockGap=8
    export function plot(x: number, y: number): void { }

    /**
     * Turn off the specified LED using x, y coordinates (x is horizontal, y is vertical). (0,0) is upper left.
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/unplot weight=77 shim=micro_bit::unPlot
    //% blockId=device_unplot block="unplot|x %x|y %y" icon="\uf204" blockGap=8
    export function unplot(x: number, y: number): void { }

    /**
     * Get the on/off state of the specified LED using x, y coordinates. (0,0) is upper left.
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/point weight=76 shim=micro_bit::point
    //% blockId=device_point block="point|x %x|y %y" icon="\uf10c"
    export function point(x: number, y: number): boolean {
        return false;
    }

    /**
     * Get the screen brightness from 0 (off) to 255 (full bright).
     */
    //% help=functions/brightness weight=60 shim=micro_bit::getBrightness
    //% blockId=device_get_brightness block="brightness" icon="\uf042" blockGap=8
    export function brightness(): number {
        return 0;
    }

    /**
     * Set the screen brightness from 0 (off) to 255 (full bright).
     * @param value the brightness value, eg:255, 127, 0
     */
    //% help=functions/set-brightness weight=59 shim=micro_bit::setBrightness
    //% blockId=device_set_brightness block="set brightness %value" icon="\uf042"
    export function setBrightness(value: number): void { }

    /**
     * Cancels the current animation and clears other pending animations.
     */
    //% weight=50 shim=uBit.display.stopAnimation help=functions/stop-animation
    //% blockId=device_stop_animation block="stop animation" icon="\uf04d"
    export function stopAnimation(): void { }

    /**
     * Displays a vertical bar graph based on the ``value`` and ``high`` value.
     * @param value current value to plot
     * @param high maximum value, eg: 1023, 255
     */
    //% help=/functions/plot-bar-graph weight=20
    //% blockId=device_plot_bar_graph block="plot bar graph of %value |up to %high" icon="\uf080" blockExternalInputs=true
    export function plotBarGraph(value: number, high: number = 1023): void {
        
        writeString("v: ");
        writeString(value.toString());
        writeString("\n");
        
        let v = Math.abs((value * 15) / high);
        let k = 0;
        for(let y = 4; y >= 0; --y) {
            for (let x = 0; x < 3; ++x) {
                if (k > v) {
                    unplot(2-x,y);
                    unplot(2+x,y);
                } else {
                    plot(2-x, y);
                    plot(2+x, y);
                }
                ++k;
            }
        }        
    }
    
    /**
     * Writes a string to serial
     */
    //% shim=micro_bit::serialSendString
    function writeString(text: string): void { }

    /**
     * Sets the display mode between black and white and greyscale for rendering LEDs.
     * @param mode TODO
     */
    //% shim=micro_bit::setDisplayMode weight=1 help=/functions/set-display-mode
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
        } else {
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
    export function fadeIn(ms: number = 700): void {
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
    export function fadeOut(ms: number = 700): void {
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
    //% shim=uBit.display.screenShot help=functions/screenshot
    export function screenshot(): images.Image {
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


}
