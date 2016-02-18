
namespace game {
    var _score: number = 0;
    var _life: number = 3;
    var _startTime: number = 0;
    var _endTime: number = 0;
    var _isGameOver: boolean = false;
    var _countdownPause: number = 0;
    var _level: number = 1;
    var _gameId: number = 0;

    /**
     * Gets the current score
     */
    //% weight=10 help=td/game-library
    export function score(): number {
        return _score;
    }

    /**
     * Sets the current score value
     * @param value TODO
     */
    //% weight=10 help=td/game-library
    export function setScore(value: number): void {
        _score = Math.max(0, value);
    }

    /**
     * Gets the current life
     */
    //% weight=10 help=td/game-library
    export function life(): number {
        return _life;
    }

    /**
     * Sets the current life value
     * @param value TODO
     */
    //% weight=10 help=td/game-library
    export function setLife(value: number): void {
        _life = Math.max(0, value);
        if (_life <= 0) {
            gameOver();
        }
    }

    /**
     * Adds points to the current score
     * @param points TODO
     */
    //% weight=10 help=td/game-library
    export function addScore(points: number): void {
        setScore(_score + points);
        control.inBackground(() => {
            led.stopAnimation();
            basic.showAnimation(`0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 1 1 1 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 0 0 0 1 0 0 0 0 0
0 0 0 0 0 0 0 1 0 0 0 1 1 1 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 0 0 0 1 0 0 0 0 0 0 0 0 0 0
0 0 1 0 0 0 1 1 1 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 1 0 0 0 1 1 1 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 0 0 0 1 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 1 1 1 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 0 0 0 1 0 0 0 0 0`, 20);
        });
    }

    /**
     * Adds life points to the current life
     * @param lives TODO
     */
    //% weight=10 help=td/game-library
    export function addLife(lives: number): void {
        setLife(_life + lives);
    }

    /**
     * Starts a game countdown timer
     * @param ms TODO
     */
    //% weight=11 help=td/game-library
    export function startCountdown(ms: number): void {
        if (checkStart()) {
            basic.showAnimation(`1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0
0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0
1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0
0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0
1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0`, 400);
            _countdownPause = Math.max(500, ms);
            _startTime = -1;
            _endTime = input.runningTime() + _countdownPause;
            control.inBackground(() => {
                basic.pause(_countdownPause);
                gameOver();
            });
        }
    }

    /**
     * Displays a game over animation.
     */
    //% weight=10 help=td/game-library
    export function gameOver(): void {
        if (!_isGameOver) {
            _isGameOver = true;
            unplugEvents();
            led.stopAnimation();
            led.setBrightness(255);
            led.setDisplayMode(led.DisplayMode.BackAndWhite);
            while (true) {
                for (let i = 0; i < 8; i++) {
                    basic.clearScreen();
                    basic.pause(100);
                    basic.showLeds(`1 1 1 1 1
1 1 1 1 1
1 1 1 1 1
1 1 1 1 1
1 1 1 1 1`, 300);
                }
                basic.showAnimation(`1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 0 0 1 1 0 0 0 1 0 0 0 0 0 0 0 0 0
1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 0 0 1 1 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
1 1 0 1 1 1 0 0 0 1 1 0 0 0 1 1 0 0 0 1 1 0 0 0 1 1 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 1 0 0 1 1 1 0 0 0 1 1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 1 1 1 1 0 0 1 1 1 0 0 0 1 1 0 0 0 0 1 0 0 0 0 0`, 100);
                for (let j = 0; j < 3; j++) {
                    basic.showString(" GAMEOVER ", 100);
                    showScore();
                }
            }
        }
        else {
            // already in game over mode in another fiber
            while (true) {
                basic.pause(10000);
            }
        }
    }

    /**
     * Gets the remaining time (since `start countdown`) or current time (since the device started or `start stopwatch`) in milliseconds.
     */
    //% weight=10 help=td/game-library
    export function currentTime(): number {
        if (_endTime > 0) {
            return Math.max(0, _endTime - input.runningTime());
        }
        else {
            return input.runningTime() - _startTime;
        }
    }

    /**
     * Removes some life
     * @param life TODO
     */
    //% weight=10 help=td/game-library
    export function removeLife(life: number): void {
        setLife(_life - life);
        control.inBackground(() => {
            led.stopAnimation();
            basic.showAnimation(`1 0 0 0 1 0 0 0 0 0 1 0 0 0 1 0 0 0 0 0
0 1 0 1 0 0 0 0 0 0 0 1 0 1 0 0 0 0 0 0
0 0 1 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0
0 1 0 1 0 0 0 0 0 0 0 1 0 1 0 0 0 0 0 0
1 0 0 0 1 0 0 0 0 0 1 0 0 0 1 0 0 0 0 0`, 40);
        });
    }

    /**
     * Increments the level and display a message.
     */
    //% weight=10 help=td/game-library
    export function levelUp(): void {
        _level = _level + 1;
        basic.showString("LEVEL:", 150);
        basic.showNumber(_level, 150);
    }

    /**
     * Gets the current level
     */
    //% weight=10 help=td/game-library
    export function level(): number {
        return _level;
    }

    /**
     * Starts a stopwatch timer. `current time` will return the elapsed time.
     */
    //% weight=10 help=td/game-library
    export function startStopwatch(): void {
        _startTime = input.runningTime();
        _endTime = -1;
    }

    /**
     * Gets a value indicating if the game is still running. Returns `false` if game over.
     */
    //% weight=10 help=td/game-library
    export function isRunning(): boolean {
        let running: boolean;
        return !_isGameOver;
    }

    /**
     * Displays the score on the screen.
     */
    //% help=td/game-library weight=60
    export function showScore(): void {
        basic.showString(" SCORE ", 100);
        basic.showNumber(_score, 150);
        basic.showString(" ", 150);
    }

    /**
     * Indicates if the game is display the game over sequence.
     */
    //% help=/functions/game-library
    export function isGameOver(): boolean {
        let over: boolean;
        return _isGameOver;
    }

    /**
     * returns false if game can't start
     */
    function checkStart(): boolean {
        if (_countdownPause > 0 || _startTime > 0) {
            return false;
        }
        else {
            return true;
        }
    }

    function unplugEvents(): void {
        input.onButtonPressed(input.Button.A, () => { });
        input.onButtonPressed(input.Button.B, () => { });
        input.onButtonPressed(input.Button.AB, () => {
            control.reset();
        });
    }

}

namespace game {
    var img: Image;
    var sprites: LedSprite[];

    export class LedSprite {
        _x: number;
        _y: number;
        _dir: number;
        _brightness: number;
        _blink: number;
        /**
         * Move a certain number of LEDs
         * @param this TODO
         * @param leds TODO
         */
        public move(leds: number): void {
            if (this._dir == 0) {
                this._y = this._y - leds;
            }
            else if (this._dir == 45) {
                this._x = this._x + leds;
                this._y = this._y - leds;
            }
            else if (this._dir == 90) {
                this._x = this._x + leds;
            }
            else if (this._dir == 135) {
                this._x = this._x + leds;
                this._y = this._y + leds;
            }
            else if (this._dir == 180) {
                this._y = this._y + leds;
            }
            else if (this._dir == -45) {
                this._x = this._x - leds;
                this._y = this._y - leds;
            }
            else if (this._dir == -90) {
                this._x = this._x - leds;
            }
            else {
                this._x = this._x - leds;
                this._y = this._y + leds;
            }
            this._x = math.clamp(0, 4, this._x);
            this._y = math.clamp(0, 4, this._y);
            plot();
        }

        /**
         * Go to this position on the screen
         * @param this TODO
         * @param x TODO
         * @param y TODO
         */
        public goTo(x: number, y: number): void {
            this._x = x;
            this._y = y;
            this._x = math.clamp(0, 4, this._x);
            this._y = math.clamp(0, 4, this._y);
            plot();
        }

        /**
         * If touching the edge of the stage, then bounce away.
         * @param this TODO
         */
        public ifOnEdge_Bounce(): void {
            if (this._dir == 0 && this._y == 0) {
                this._dir = 180;
            }
            else if (this._dir == 45 && (this._x == 4 || this._y == 0)) {
                if (this._x == 0 && this._y == 0) {
                    this._dir = -135;
                }
                else if (this._y == 0) {
                    this._dir = 135;
                }
                else {
                    this._dir = -45;
                }
            }
            else if (this._dir == 90 && this._x == 4) {
                this._dir = -90;
            }
            else if (this._dir == 135 && (this._x == 4 || this._y == 4)) {
                if (this.x() == 4 && this.y() == 4) {
                    this._dir = -45;
                }
                else if (this._y == 4) {
                    this._dir = 45;
                }
                else {
                    this._dir = -135;
                }
            }
            else if (this._dir == 180 && this._y == 4) {
                this._dir = 0;
            }
            else if (this._dir == -45 && (this._x == 0 || this._y == 0)) {
                if (this.x() == 0 && this.y() == 0) {
                    this._dir = 135;
                }
                else if (this._y == 0) {
                    this._dir = -135;
                }
                else {
                    this._dir = 45;
                }
            }
            else if (this._dir == -90 && this._x == 0) {
                this._dir = 90;
            }
            else if (this._dir == -135 && (this._x == 0 || this._y == 4)) {
                if (this._x == 0 && this._y == 4) {
                    this._dir = 45;
                }
                else if (this._y == 4) {
                    this._dir = -45;
                }
                else {
                    this._dir = 135;
                }
            }
            plot();
        }

        /**
         * Turn to the right (clockwise)
         * @param this TODO
         * @param degrees TODO
         */
        public turnRight(degrees: number): void {
            this.setDirection(this._dir + degrees);
        }

        /**
         * Turn to the left (counter-clockwise)
         * @param this TODO
         * @param degrees TODO
         */
        public turnLeft(degrees: number): void {
            this.turnRight(- degrees);
        }

        /**
         * Set the direction of the current sprite, rounded to the nearest multiple of 45
         * @param this TODO
         * @param degrees TODO
         */
        public setDirection(degrees: number): void {
            this._dir = ((degrees / 45) % 8) * 45;
            if (this._dir <= -180) {
                this._dir = this._dir + 360;
            }
            else if (this._dir > 180) {
                this._dir = this._dir - 360;
            }
            plot();
        }

        /**
         * Reports the ``x`` position of a sprite on the LED screen
         * @param this TODO
         */
        public x(): number {
            return this._x;
        }

        /**
         * Reports the ``y`` position of a sprite on the LED screen
         * @param this TODO
         */
        public y(): number {
            return this._y;
        }

        /**
         * Reports the current direction of a sprite
         * @param this TODO
         */
        public direction(): number {
            return this._dir;
        }

        /**
         * Set the ``x`` position of a sprite
         * @param this TODO
         * @param x TODO
         */
        public setX(x: number): void {
            this.goTo(x, this._y);
        }

        /**
         * Set the ``y`` position of a sprite
         * @param this TODO
         * @param y TODO
         */
        public setY(y: number): void {
            this.goTo(this._x, y);
        }

        /**
         * Changes the ``y`` position by the given amount
         * @param this TODO
         * @param y TODO
         */
        public changeYBy(y: number): void {
            this.goTo(this._x, this._y + y);
        }

        /**
         * Changes the ``x`` position by the given amount
         * @param this TODO
         * @param x TODO
         */
        public changeXBy(x: number): void {
            this.goTo(this._x + x, this._y);
        }

        /**
         * Reports true if sprite is touching specified sprite
         * @param this TODO
         * @param other TODO
         */
        public isTouching(other: LedSprite): boolean {
            return this._x == other._x && this._y == other._y;
        }

        /**
         * Reports true if sprite is touching an edge
         * @param this TODO
         */
        public isTouchingEdge(): boolean {
            return this._x == 0 || this._x == 4 || this._y == 0 || this._y == 4;
        }

        /**
         * Turns on the sprite (on by default)
         * @param this TODO
         */
        public on(): void {
            this.setBrightness(255);
        }

        /**
         * Turns off the sprite (on by default)
         * @param this TODO
         */
        public off(): void {
            this.setBrightness(0);
        }

        /**
         * Set the ``brightness`` of a sprite
         * @param this TODO
         * @param brightness TODO
         */
        public setBrightness(brightness: number): void {
            this._brightness = math.clamp(0, 255, brightness);
            plot();
        }

        /**
         * Reports the ``brightness` of a sprite on the LED screen
         * @param this TODO
         */
        public brightness(): number {
            let r: number;
            return this._brightness;
        }

        /**
         * Changes the ``y`` position by the given amount
         * @param this TODO
         * @param value TODO
         */
        public changeBrightnessBy(value: number): void {
            this.setBrightness(this._brightness + value);
        }

        /**
         * Changes the ``direction`` position by the given amount by turning right
         * @param this TODO
         * @param angle TODO
         */
        public changeDirectionBy(angle: number): void {
            this.turnRight(angle);
        }

        /**
         * Deletes the sprite from the game engine. All further operation of the sprite will not have any effect.
         * @param sprite TODO
         */
        public _delete(sprite: LedSprite): void {
            sprites.removeElement(sprite);
        }

        /**
         * Sets the blink duration interval in millisecond.
         * @param sprite TODO
         * @param ms TODO
         */
        public setBlink(ms: number): void {
            this._blink = math.clamp(0, 10000, ms);
        }

        /**
         * Changes the ``blink`` duration by the given amount of millisecons
         * @param this TODO
         * @param ms TODO
         */
        public changeBlinkBy(ms: number): void {
            this.setBlink(this._blink + ms);
        }

        /**
         * Reports the ``blink`` duration of a sprite
         * @param this TODO
         */
        public blink(): number {
            let r: number;
            return this._blink;
        }
    }

    function init(): void {
        if (img == null) {
            img = image.createImage(`0 0 0 0 0
0 0 0 0 0
0 0 0 0 0
0 0 0 0 0
0 0 0 0 0`);
            sprites = (<LedSprite[]>[]);
            led.setDisplayMode(led.DisplayMode.Greyscale);
            basic.forever(() => {
                basic.pause(30);
                plot();
                if (game.isGameOver()) {
                    basic.pause(600);
                }
            });
        }
    }

    /**
     * Plots the current sprites on the screen
     */
    function plot(): void {
        if (game.isGameOver()) {
            return;
        }
        let now = input.runningTime();
        img.clear();
        for (let i = 0; i < sprites.length; i++) {
            let ps = sprites[i];
            if (ps._brightness > 0) {
                let r = 0;
                if (ps._blink > 0) {
                    r = (now / ps._blink) % 2;
                }
                if (r == 0) {
                    img.setPixelBrightness(ps._x, ps._y, img.pixelBrightness(ps._x, ps._y) + ps._brightness);
                }
            }
        }
        img.plotImage(0);
    }

    /**
     * Creates a new LED sprite pointing to the right.
     * @param x TODO
     * @param y TODO
     */
    //% weight=60
    export function createSprite(x: number, y: number): LedSprite {
        let r: LedSprite;
        init();
        let p = new LedSprite();
        p._x = math.clamp(0, 4, x);
        p._y = math.clamp(0, 4, y);
        p._dir = 90;
        p._brightness = 255;
        sprites.push(p);
        plot();
        return p;
    }

    /**
     * Gets an invalid sprite; used to initialize locals.
     */
    //% weight=0
    export function invalidSprite(): LedSprite {
        return null;
    }

}

