
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
    export function score() : number
    {
        return _score;
    }

    /**
     * Sets the current score value
     * @param value TODO
     */
    //% weight=10 help=td/game-library
    export function setScore(value: number) : void
    {
        _score = Math.max(0, value);
    }

    /**
     * Gets the current life
     */
    //% weight=10 help=td/game-library
    export function life() : number
    {
        return _life;
    }

    /**
     * Sets the current life value
     * @param value TODO
     */
    //% weight=10 help=td/game-library
    export function setLife(value: number) : void
    {
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
    export function addScore(points: number) : void
    {
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
    export function addLife(lives: number) : void
    {
        setLife(_life + lives);
    }

    /**
     * Starts a game countdown timer
     * @param ms TODO
     */
    //% weight=11 help=td/game-library
    export function startCountdown(ms: number) : void
    {
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
    export function gameOver() : void
    {
        if ( ! _isGameOver) {
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
    export function currentTime() : number
    {
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
    export function removeLife(life: number) : void
    {
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
    export function levelUp() : void
    {
        _level = _level + 1;
        basic.showString("LEVEL:", 150);
        basic.showNumber(_level, 150);
    }

    /**
     * Gets the current level
     */
    //% weight=10 help=td/game-library
    export function level() : number
    {
        return _level;
    }

    /**
     * Starts a stopwatch timer. `current time` will return the elapsed time.
     */
    //% weight=10 help=td/game-library
    export function startStopwatch() : void
    {
        _startTime = input.runningTime();
        _endTime = -1;
    }

    /**
     * Gets a value indicating if the game is still running. Returns `false` if game over.
     */
    //% weight=10 help=td/game-library
    export function isRunning() : boolean
    {
        let running: boolean;
        return ! _isGameOver;
    }

    /**
     * Displays the score on the screen.
     */
    //% help=td/game-library weight=60
    export function showScore() : void
    {
        basic.showString(" SCORE ", 100);
        basic.showNumber(_score, 150);
        basic.showString(" ", 150);
    }

    /**
     * Indicates if the game is display the game over sequence.
     */
    //% help=/functions/game-library
    export function isGameOver() : boolean
    {
        let over: boolean;
        return _isGameOver;
    }
    
    /**
     * returns false if game can't start
     */
    function checkStart() : boolean
    {
        if (_countdownPause > 0 || _startTime > 0) {
            return false;
        }
        else {
            return true;
        }
    }

    function unplugEvents() : void
    {
        input.onButtonPressed(input.Button.A, () => {});
        input.onButtonPressed(input.Button.B, () => {});
        input.onButtonPressed(input.Button.AB, () => {
            control.reset();
        });
    }
    
}
