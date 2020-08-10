// Matches navigator.Gamepad's "standard" button mapping.
enum GamepadButton {
    A = 0,
    B = 1,
    X = 2,
    Y = 3,
    LeftShoulder = 4,
    RightShoulder = 5,
    LeftTrigger = 6,
    RightTrigger = 7,
    Back = 8,
    Start = 9,
    LeftStick = 10,
    RightStick = 11,
    Up = 12,
    Down = 13,
    Left = 14,
    Right = 15,
    Big = 16,
    COUNT = 17
}

// Matches navigator.Gamepad's "standard" axis mapping.
enum GamepadAxis {
    LeftStickX = 0,
    LeftStickY = 1,
    RightStickX = 2,
    RightStickY = 3,
    COUNT = 4
}

export enum ControllerButton {
    A = GamepadButton.A,
    B = GamepadButton.B,
    X = GamepadButton.X,
    Y = GamepadButton.Y,
    LeftShoulder = GamepadButton.LeftShoulder,
    RightShoulder = GamepadButton.RightShoulder,
    LeftTrigger = GamepadButton.LeftTrigger,
    RightTrigger = GamepadButton.RightTrigger,
    Back = GamepadButton.Back,
    Start = GamepadButton.Start,
    LeftStick = GamepadButton.LeftStick,
    RightStick = GamepadButton.RightStick,
    Up = GamepadButton.Up,
    Down = GamepadButton.Down,
    Left = GamepadButton.Left,
    Right = GamepadButton.Right,
    Big = GamepadButton.Big,
    // Stick movement as buttons
    LeftStickUp = GamepadButton.COUNT + 1,
    LeftStickDown = GamepadButton.COUNT + 2,
    LeftStickLeft = GamepadButton.COUNT + 3,
    LeftStickRight = GamepadButton.COUNT + 4,
    RightStickUp = GamepadButton.COUNT + 5,
    RightStickDown = GamepadButton.COUNT + 6,
    RightStickLeft = GamepadButton.COUNT + 7,
    RightStickRight = GamepadButton.COUNT + 8,
    COUNT = GamepadButton.COUNT + 9,
}

export enum ControllerStick {
    Left = 0,
    Right = 1,
    COUNT = 2
}

export enum ControllerTrigger {
    Left = 0,
    Right = 1,
    COUNT = 2
}

// Available in a math lib?
export class Vector2 {
    constructor(public x: number, public y: number) {}

    public lenSq(): number {
        return this.x * this.x + this.y * this.y;
    }

    public static Zero(): Vector2 {
        return new Vector2(0, 0);
    }

    public static Add(a: Vector2, b: Vector2): Vector2 {
        return new Vector2(a.x + b.x, a.y + b.y);
    }

    public static Negate(v: Vector2): Vector2 {
        return new Vector2(-v.x, -v.y);
    }
}


/**
 * Holds the current state of a controller. Applies deadzone to stick values.
 */
export class ControllerState {
    index: number;
    buttons: boolean[] = [];
    sticks: Vector2[] = [];
    triggers: number[] = [];

    constructor(state: Gamepad) {
        this.index = state.index;
        this.buttons.length = ControllerButton.COUNT;
        this.sticks.length = ControllerStick.COUNT;
        this.triggers.length = ControllerTrigger.COUNT;

        if (state.connected) {
            for (let i = 0; i < GamepadButton.COUNT; ++i) {
                this.buttons[i] = state.buttons[i].value ? true : false;
            }
            this.triggers[ControllerTrigger.Left] = state.buttons[ControllerButton.LeftTrigger].value;
            this.triggers[ControllerTrigger.Right] = state.buttons[ControllerButton.RightTrigger].value;
            this.sticks[ControllerStick.Left] = this.stickSample(state.axes[GamepadAxis.LeftStickX], state.axes[GamepadAxis.LeftStickY]);
            this.sticks[ControllerStick.Right] = this.stickSample(state.axes[GamepadAxis.RightStickX], state.axes[GamepadAxis.RightStickY]);
            const btnStickThreshold = 0.25;
            const btnLeftStickX = (this.sticks[ControllerStick.Left].x * this.sticks[ControllerStick.Left].x) * Math.sign(this.sticks[ControllerStick.Left].x);
            const btnLeftStickY = (this.sticks[ControllerStick.Left].y * this.sticks[ControllerStick.Left].y) * Math.sign(this.sticks[ControllerStick.Left].y);
            const btnRightStickX = (this.sticks[ControllerStick.Right].x * this.sticks[ControllerStick.Right].x) * Math.sign(this.sticks[ControllerStick.Right].x);
            const btnRightStickY = (this.sticks[ControllerStick.Right].y * this.sticks[ControllerStick.Right].y) * Math.sign(this.sticks[ControllerStick.Right].y);
            this.buttons[ControllerButton.LeftStickUp] = btnLeftStickY < -btnStickThreshold;
            this.buttons[ControllerButton.LeftStickDown] = btnLeftStickY > btnStickThreshold;
            this.buttons[ControllerButton.LeftStickLeft] = btnLeftStickX < -btnStickThreshold;
            this.buttons[ControllerButton.LeftStickRight] = btnLeftStickX > btnStickThreshold;
            this.buttons[ControllerButton.RightStickUp] = btnRightStickY < -btnStickThreshold;
            this.buttons[ControllerButton.RightStickDown] = btnRightStickY > btnStickThreshold;
            this.buttons[ControllerButton.RightStickLeft] = btnRightStickX < -btnStickThreshold;
            this.buttons[ControllerButton.RightStickRight] = btnRightStickX > btnStickThreshold;
        }
    }

    private stickSample(sampx: number, sampy: number): Vector2 {
        return new Vector2(
            this.applyDeadzone(sampx, 0.1),
            this.applyDeadzone(sampy, 0.1)
        );
    }

    private applyDeadzone(samp: number, deadzone: number): number {
        const abs = Math.abs(samp);
        return abs < deadzone ? 0 : (abs - deadzone) * (samp / abs);
    }
}

export type StatusHandler = (active: boolean) => void;
export type ButtonHandler = (player: number, button: ControllerButton) => void;
export type StickHandler = (player: number, stick: ControllerStick, value: Vector2) => void;
export type TriggerHandler = (player: number, trigger: ControllerTrigger, value: number) => void;

class Controller {
    state: ControllerState;
    buttonPressedHandler: ButtonHandler;
    buttonReleasedHandler: ButtonHandler;
    stickChangedHandler: StickHandler;
    triggerChangedHandler: TriggerHandler;
    stickLastFrame: boolean[] = [];
    triggerLastFrame: boolean[] = [];

    constructor(state: Gamepad) {
        this.state = new ControllerState(state);
        this.stickLastFrame.length = ControllerStick.COUNT;
        this.triggerLastFrame.length = ControllerTrigger.COUNT;
    }

    public update(state: Gamepad) {
        const newState = new ControllerState(state);

        const checkButton = (i: ControllerButton) => {
            if (this.state.buttons[i] !== newState.buttons[i]) {
                if (newState.buttons[i] && this.buttonPressedHandler) {
                    this.buttonPressedHandler(state.index, i);
                } else if (this.buttonReleasedHandler) {
                    this.buttonReleasedHandler(state.index, i);
                }
            }
        }

        const checkStick = (s: ControllerStick) => {
            if (this.stickChangedHandler) {
                const newLenSq = newState.sticks[s].lenSq();
                // Epsilon check
                if (newLenSq > 0.01) {
                    this.stickChangedHandler(state.index, s, newState.sticks[s]);
                    this.stickLastFrame[s] = true;
                } else if (this.stickLastFrame[s]) {
                    this.stickChangedHandler(state.index, s, Vector2.Zero());
                    this.stickLastFrame[s] = false;
                }
            }
        }

        const checkTrigger = (t: ControllerTrigger) => {
            if (this.triggerChangedHandler) {
                // Epsilon check
                if (newState.triggers[t] > 0.01) {
                    this.triggerChangedHandler(state.index, t, newState.triggers[t]);
                    this.triggerLastFrame[t] = true;
                } else if (this.triggerLastFrame[t]) {
                    this.triggerChangedHandler(state.index, t, 0);
                    this.triggerLastFrame[t] = false;
                }
            }
        }

        for (let i = 0; i < ControllerButton.COUNT; ++i) {
            checkButton(i);
        }
        checkStick(ControllerStick.Left);
        checkStick(ControllerStick.Right);
        checkTrigger(ControllerTrigger.Left);
        checkTrigger(ControllerTrigger.Right);

        this.state = newState;
    }

    public onButtonPressed(handler: ButtonHandler) {
        this.buttonPressedHandler = handler;
    }

    public onButtonReleased(handler: ButtonHandler) {
        this.buttonReleasedHandler = handler;
    }

    public onStickChanged(handler: StickHandler) {
        this.stickChangedHandler = handler;
    }

    public onTriggerChanged(handler: TriggerHandler) {
        this.triggerChangedHandler = handler;
    }
}

/**
 * Exported service for receiving gamepad input.
 */
export class Service {
    private id: number;
    protected statusHandler: StatusHandler;
    protected buttonPressedHandler: ButtonHandler;
    protected buttonReleasedHandler: ButtonHandler;
    protected stickChangedHandler: StickHandler;
    protected triggerChangedHandler: TriggerHandler;

    constructor() {
        this.id = serviceId++;
    }

    public onStatusChanged(handler: StatusHandler) {
        this.statusHandler = handler;
        if (this.statusHandler) this.statusHandler(controllerCount > 0);
    }
    public onButtonPressed(handler: ButtonHandler) {
        this.buttonPressedHandler = handler;
    }
    public onButtonReleased(handler: ButtonHandler) {
        this.buttonReleasedHandler = handler;
    }
    public onStickChanged(handler: StickHandler) {
        this.stickChangedHandler = handler;
    }
    public onTriggerChanged(handler: TriggerHandler) {
        this.triggerChangedHandler = handler;
    }
    public getControllerState(index: number): ControllerState | null {
        return allControllers[index]?.state;
    }
    public dispose() {
        services = services.filter((service) => service.id !== this.id);
    }
}

class ServiceWithNotify extends Service {
    public notifyStatusChanged(active: boolean) {
        if (this.statusHandler) this.statusHandler(active);
    }
    public notifyButtonPressed(player: number, button: ControllerButton) {
        if (this.buttonPressedHandler) this.buttonPressedHandler(player, button);
    }
    public notifyButtonReleased(player: number, button: ControllerButton) {
        if (this.buttonReleasedHandler) this.buttonReleasedHandler(player, button);
    }
    public notifyStickChanged(player: number, stick: ControllerStick, value: Vector2) {
        if (this.stickChangedHandler) this.stickChangedHandler(player, stick, value);
    }
    public notifyTriggerChanged(player: number, trigger: ControllerTrigger, value: number) {
        if (this.triggerChangedHandler) this.triggerChangedHandler(player, trigger, value);
    }
}

const allControllers: { [index: number]: Controller } = {};
let updateTimer: number;
let gamepadsEnabled = true;
let controllerCount: number = 0;
let serviceId: number = 0;
let services: ServiceWithNotify[] = [];

function notifyStatusChanged(active: boolean) {
    services.forEach((s) => s.notifyStatusChanged(active));
}

function notifyButtonPressed(player: number, button: ControllerButton) {
    services.forEach((s) => s.notifyButtonPressed(player, button));
}

function notifyButtonReleased(player: number, button: ControllerButton) {
    services.forEach((s) => s.notifyButtonReleased(player, button));
}

function notifyStickChanged(player: number, stick: ControllerStick, value: Vector2) {
    services.forEach((s) => s.notifyStickChanged(player, stick, value));
}

function notifyTriggerChanged(player: number, trigger: ControllerTrigger, value: number) {
    services.forEach((s) => s.notifyTriggerChanged(player, trigger, value));
}

let init = () => {
    init = () => { };
    window.addEventListener("gamepadconnected", () => {
        if (!controllerCount) {
            notifyStatusChanged(true);
            updateTimer = setInterval(() => gamepadUpdate(), 20);
        }
        controllerCount += 1;
    });
    window.addEventListener("gamepaddisconnected", () => {
        controllerCount -= 1;
        if (!controllerCount) {
            clearInterval(updateTimer);
            notifyStatusChanged(false);
        }
    });
}

function gamepadUpdate() {
    if (!gamepadsEnabled)
        return;
    const gamepads = navigator.getGamepads();
    if (gamepads) {
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                handleGamepad(gamepad);
            }
        }
    }
}

function handleGamepad(gamepad: Gamepad) {
    if (!allControllers[gamepad.index]) {
        initController(gamepad);
    }
    allControllers[gamepad.index].update(gamepad);
}

function initController(gamepad: Gamepad) {
    const controller = allControllers[gamepad.index] = new Controller(gamepad);
    controller.onButtonPressed((player, button) => notifyButtonPressed(player, button));
    controller.onButtonReleased((player, button) => notifyButtonReleased(player, button));
    controller.onStickChanged((player, stick, value) => notifyStickChanged(player, stick, value));
    controller.onTriggerChanged((player, trigger, value) => notifyTriggerChanged(player, trigger, value));
}

/**
 * Returns an instance of a gamepad notification service.
 */
export function getService(): Service {
    init();
    const service = new ServiceWithNotify();
    services.push(service);
    return service;
}

export function setEnabled(enabled: boolean) {
    gamepadsEnabled = enabled;
}