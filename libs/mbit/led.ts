namespace led {
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
