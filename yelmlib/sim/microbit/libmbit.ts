// Display/button/etc related stuff

namespace yelm.rt.micro_bit {

    function initBoard() {
        U.assert(!runtime.board)
        runtime.board = new Board()
    }
    
    export var target:Target = {
        name: "microbit",
        initCurrentRuntime: initBoard
    }

    export function board() {
        return runtime.board as Board
    }
    
    export function enums() {
        return runtime.enums as any as Enums
    }

    export interface AnimationOptions {
        interval: number;
        // false means last frame
        frame: () => boolean;
        whenDone?: (cancelled: boolean) => void;
    }

    export class AnimationQueue {
        private queue: AnimationOptions[] = [];
        private process: () => void;

        constructor(private runtime: Runtime) {
            this.process = () => {
                let top = this.queue[0]
                if (!top) return
                if (this.runtime.dead) return
                runtime = this.runtime
                let res = top.frame()
                runtime.queueDisplayUpdate()
                runtime.maybeUpdateDisplay()
                if (res === false) {
                    this.queue.shift();
                    // if there is already something in the queue, start processing
                    if (this.queue[0])
                        setTimeout(this.process, this.queue[0].interval)
                    // this may push additional stuff 
                    top.whenDone(false);
                } else {
                    setTimeout(this.process, top.interval)
                }
            }
        }

        public cancelAll() {
            let q = this.queue
            this.queue = []
            for (let a of q) {
                a.whenDone(true)
            }
        }

        public cancelCurrent() {
            let top = this.queue[0]
            if (top) {
                this.queue.shift();
                top.whenDone(true);
            }
        }

        public enqueue(anim: AnimationOptions) {
            if (!anim.whenDone) anim.whenDone = () => { };
            this.queue.push(anim)
            // we start processing when the queue goes from 0 to 1
            if (this.queue.length == 1)
                this.process()
        }

        public executeAsync(anim: AnimationOptions) {
            U.assert(!anim.whenDone)
            return new Promise<boolean>((resolve, reject) => {
                anim.whenDone = resolve
                this.enqueue(anim)
            })
        }
    }

    export function panic(code: number) {
        console.log("PANIC:", code)
        throw new Error("PANIC " + code)
    }
    
    /* basic */
    export function showDigit(v: number) {
        if (!quiet)
            console.log("DIGIT:", v)
    }    
    
    export function clearScreen() {
        board().image.clear();
        runtime.queueDisplayUpdate()
    }
    
    export function showLeds(leds: micro_bit.Image, delay: number) : void {
        showAnimation(leds, delay);
    }    

    export function showAnimation(leds: micro_bit.Image, interval: number = 400): void {
        let cb = getResume()
        let off = 0

        board().animationQ.enqueue({
            interval: interval,
            frame: () => {
                if (off >= leds.width)
                    return false;
                leds.copyTo(off, 5, board().image, 0)
                off += 5;
                return true;
            },
            whenDone: cb
        })
    }
    
    export function scrollString(s: string) {
        let cb = getResume();
        console.log("SCROLL:", s)
        setTimeout(() => { cb() }, 100)
    }    

    export function forever(a: RefAction) {
        function loop() {
            runtime.runFiberAsync(a)
                .then(() => Promise.delay(20))
                .then(loop)
                .done()
        }
        incr(a)
        loop()
    }
    
    export function pause(ms: number) {
        let cb = getResume();
        setTimeout(() => { cb() }, ms)
    }
    
    /* leds */
    export function plot(x: number, y: number) {
        board().image.set(x, y, 255);
        runtime.queueDisplayUpdate()
    }
    
    export function unPlot(x: number, y: number) {
        board().image.set(x, y, 0);
        runtime.queueDisplayUpdate()
    }
    
    export function point(x: number, y: number) : boolean {
        return !!board().image.get(x,y);
    }
    
    export function brightness() : number {
        return board().brigthness;
    }
    
    export function setBrightness(value: number) : void {
        board().brigthness = value;
        runtime.queueDisplayUpdate()
    }
    
    export function stopAnimation() : void {
        board().animationQ.cancelAll();
    }
    
    export function plotLeds(leds: micro_bit.Image): void {
        leds.copyTo(0, 5, board().image, 0)
        runtime.queueDisplayUpdate()
    }
    
    export function setDisplayMode(mode: DisplayMode) : void {
        board().displayMode = mode;
        runtime.queueDisplayUpdate()        
    }

    /* control */
    export function runInBackground(a: RefAction) {
        runtime.runFiberAsync(a).done()
    }

    /* serial */
    export function serialSendString(s: string) {
        if (s.trim() && !quiet)
            console.log("SERIAL:", s)
    }
    
    /* input */
    export function isButtonPressed(button : number) : boolean {
        if (button == 2 && !board().usesButtonAB) {
            board().usesButtonAB = true;
            runtime.queueDisplayUpdate();
        }
        var bts = board().buttonsPressed;
        if (button <= 1)
            return bts[button];
        else // A+B 
            return bts[2] || (bts[0] && bts[0]);
    }
    
    export function ioP0() { return board().pins[0]; }
    export function ioP1() { return board().pins[1]; }
    export function ioP2() { return board().pins[2]; }
    export function ioP3() { return board().pins[3]; }
    export function ioP4() { return board().pins[4]; }
    export function ioP5() { return board().pins[5]; }
    export function ioP6() { return board().pins[6]; }
    export function ioP7() { return board().pins[7]; }
    export function ioP8() { return board().pins[8]; }
    export function ioP9() { return board().pins[9]; }
    export function ioP10() { return board().pins[10]; }
    export function ioP11() { return board().pins[11]; }
    export function ioP12() { return board().pins[12]; }
    export function ioP13() { return board().pins[13]; }
    export function ioP14() { return board().pins[14]; }
    export function ioP15() { return board().pins[15]; }
    export function ioP16() { return board().pins[16]; }
    export function ioP19() { return board().pins[19]; }
    export function ioP20() { return board().pins[20]; }
    
    export function isPinTouched(pin: Pin) : boolean {
        return pin.touched;
    }
    
    export function compassHeading() : number {
        var b = board();
        if (!b.usesAcceleration) {
            b.usesAcceleration = true;
            runtime.queueDisplayUpdate();
        }
        return b.heading;       
    }
    
    export function getAcceleration(dimension: number) : number {
        var b = board();
        if (!b.usesAcceleration) {
            b.usesAcceleration = true;
            runtime.queueDisplayUpdate();
        }
        var acc = b.acceleration;
        switch(dimension) {
            case 0: return acc[0];
            case 1: return acc[1];
            case 2: return acc[2];
            default: return Math.sqrt(acc[0]*acc[0]+acc[1]*acc[1]+acc[2]*acc[2]);
        }
    }
    
    export function lightLevel() : number {
        // TODO
        return 0;
    }
    
    export function getMagneticForce() : number {
        // TODO
        return 0;
    }
    
    export function getCurrentTime() : number {
        return runtime.runningTime();
    }
}

