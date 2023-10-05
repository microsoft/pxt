import configData from "../config.json";
import * as NavGrid from "./NavGrid";

export enum GamepadControl {
    AButton = "AButton",
    BButton = "BButton",
    DPadUp = "DPadUp",
    DPadDown = "DPadDown",
    DPadLeft = "DPadLeft",
    DPadRight = "DPadRight",
    MenuButton = "MenuButton",
    EscapeButton = "EscapeButton",
    ResetButton = "ResetButton",
}

const gamepadControlToPinIndex: { [key in GamepadControl]: number } = {
    [GamepadControl.AButton]: configData.GamepadAButtonPin,
    [GamepadControl.BButton]: configData.GamepadBButtonPin,
    [GamepadControl.DPadUp]: configData.GamepadUpDownAxis,
    [GamepadControl.DPadDown]: configData.GamepadUpDownAxis,
    [GamepadControl.DPadLeft]: configData.GamepadLeftRightAxis,
    [GamepadControl.DPadRight]: configData.GamepadLeftRightAxis,
    [GamepadControl.MenuButton]: configData.GamepadMenuButtonPin,
    [GamepadControl.EscapeButton]: configData.GamepadEscapeButtonPin,
    [GamepadControl.ResetButton]: configData.GamepadResetButtonPin,
};

const gamepadControlToAxisDirection: { [key in GamepadControl]: number } = {
    [GamepadControl.AButton]: 0,
    [GamepadControl.BButton]: 0,
    [GamepadControl.DPadUp]: -1,
    [GamepadControl.DPadDown]: 1,
    [GamepadControl.DPadLeft]: -1,
    [GamepadControl.DPadRight]: 1,
    [GamepadControl.MenuButton]: 0,
    [GamepadControl.EscapeButton]: 0,
    [GamepadControl.ResetButton]: 0,
};

export enum ControlValue {
    Down = 1,
    Up = 0,
}

export type ControlStates = {
    [key in GamepadControl]: ControlValue;
};

type ControlCooldowns = {
    [key in GamepadControl]: number;
};

type ControlLocks = {
    [key in GamepadControl]: boolean;
};

export const emptyControlStates = (): ControlStates => ({
    [GamepadControl.AButton]: ControlValue.Up,
    [GamepadControl.BButton]: ControlValue.Up,
    [GamepadControl.DPadDown]: ControlValue.Up,
    [GamepadControl.DPadLeft]: ControlValue.Up,
    [GamepadControl.DPadRight]: ControlValue.Up,
    [GamepadControl.DPadUp]: ControlValue.Up,
    [GamepadControl.EscapeButton]: ControlValue.Up,
    [GamepadControl.MenuButton]: ControlValue.Up,
    [GamepadControl.ResetButton]: ControlValue.Up,
});

const emptyControlCooldowns = (): ControlCooldowns => ({
    [GamepadControl.AButton]: 0,
    [GamepadControl.BButton]: 0,
    [GamepadControl.DPadDown]: 0,
    [GamepadControl.DPadLeft]: 0,
    [GamepadControl.DPadRight]: 0,
    [GamepadControl.DPadUp]: 0,
    [GamepadControl.EscapeButton]: 0,
    [GamepadControl.MenuButton]: 0,
    [GamepadControl.ResetButton]: 0,
});

const emptyControlLocks = (): ControlLocks => ({
    [GamepadControl.AButton]: false,
    [GamepadControl.BButton]: false,
    [GamepadControl.DPadDown]: false,
    [GamepadControl.DPadLeft]: false,
    [GamepadControl.DPadRight]: false,
    [GamepadControl.DPadUp]: false,
    [GamepadControl.EscapeButton]: false,
    [GamepadControl.MenuButton]: false,
    [GamepadControl.ResetButton]: false,
});

type GamepadState = {
    state: ControlStates;
    cooldown: ControlCooldowns;
};

const gamepadManagerEventKey = Symbol("gamepadManagerEventKey");

export const isGamepadManagerEvent = (event: Event | React.SyntheticEvent) => {
    return !!(event as any)[gamepadManagerEventKey];
};

class GamepadManager {
    minButtonPinRequired: number = 0;
    minAxisRequired: number = 0;
    gamepads = new Map<number, boolean>();
    gamepadStates = new Map<number, GamepadState>();
    gamepadIntervalId: number = 0;
    windowVisible: boolean = document.visibilityState === "visible";
    // The purpose of `locks` is to prevent a held control from emitting events
    // until released. This is useful to prevent a control from triggering an
    // action immediately upon transitioning to a new UI state.
    locks: ControlLocks = { ...emptyControlLocks() };
    // Virtual gamepads are keyboard-based input mappings. Some pages may want
    // to disable this form of navigation due to conflicts with controls like
    // text inputs.
    virtualGamepadsEnabled: boolean = true;
    externalKeydownListeners: ((ev: KeyboardEvent) => void)[] = [];
    externalKeyupListeners: ((ev: KeyboardEvent) => void)[] = [];

    constructor() {
        this.minButtonPinRequired = Math.max(
            configData.GamepadAButtonPin,
            configData.GamepadBButtonPin,
            configData.GamepadEscapeButtonPin,
            configData.GamepadMenuButtonPin,
            configData.GamepadResetButtonPin
        );

        this.minAxisRequired = Math.max(
            configData.GamepadUpDownAxis,
            configData.GamepadLeftRightAxis
        );
    }

    zeroBasedIndexToKeyboardStateIndex(index: number): number {
        // Negative indices are reserved for keyboard-based "virtual" gamepads
        // (e.g.: WASD, IJKL)
        return index * -1 - 1;
    }

    initialize() {
        // Add states for keyboard-based "virtual" gamepads
        configData.VirtualGamepadMaps.forEach((_, index) => {
            index = this.zeroBasedIndexToKeyboardStateIndex(index);
            this.gamepadStates.set(index, {
                state: { ...emptyControlStates() },
                cooldown: { ...emptyControlCooldowns() },
            });
        });

        // Add initial gamepads
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad) {
                this.addGamepad(gamepad);
            }
        }

        document.addEventListener("visibilitychange", ev => {
            this.windowVisible = document.visibilityState === "visible";
        });
        window.addEventListener("gamepadconnected", ev => {
            this.addGamepad(ev.gamepad);
        });
        window.addEventListener("gamepaddisconnected", ev => {
            this.removeGamepad(ev.gamepad);
        });
        window.addEventListener("keydown", ev => {
            this.handleMappedKeyboardEvent(ev, ControlValue.Down);
        });
        window.addEventListener("keyup", ev => {
            this.handleMappedKeyboardEvent(ev, ControlValue.Up);
        });
    }

    handleMappedKeyboardEvent(ev: KeyboardEvent, value: ControlValue) {
        if (isGamepadManagerEvent(ev)) {
            // Dispatch events that originated from GamepadManager to external
            // listeners
            const listeners =
                value === ControlValue.Down
                    ? this.externalKeydownListeners
                    : this.externalKeyupListeners;
            listeners.forEach(handler => handler(ev));
            // GamepadManager-originated events should not be handled by
            // GamepadManager itself
            return;
        }
        if (!this.virtualGamepadsEnabled) {
            // Virtual gamepads are disabled. Do not generate events from keyboard input.
            return;
        }
        let index = 0;
        for (let item of configData.VirtualGamepadMaps) {
            const mapping = item as any;
            if (mapping[ev.key]) {
                // We found a virtual gamepad mapping for this key. Stop this
                // event from propagating and emit a new one for the mapped
                // control.
                ev.stopPropagation();
                ev.preventDefault();
                this.handleKeyboardEvent(
                    this.zeroBasedIndexToKeyboardStateIndex(index),
                    mapping[ev.key],
                    value
                );
                return;
            }
            index++;
        }
    }

    handleKeyboardEvent(
        index: number,
        control: GamepadControl,
        value: ControlValue
    ) {
        const prevState = this.gamepadStates.get(index)!;
        const nextState = {
            ...prevState,
            state: {
                ...prevState.state,
                [control]: value,
            },
        };
        this.handleGamepadStateChange(prevState, nextState);
        this.gamepadStates.set(index, nextState);
    }

    gamepadFilter(gamepad: Gamepad) {
        return (
            gamepad &&
            gamepad.axes &&
            gamepad.axes.length >= this.minAxisRequired &&
            gamepad.buttons &&
            gamepad.buttons.length >= this.minButtonPinRequired &&
            !!gamepad.mapping
        );
    }

    addGamepad(gamepad: Gamepad) {
        if (this.gamepadFilter(gamepad)) {
            this.gamepads.set(gamepad.index, true);
            this.gamepadStates.set(gamepad.index, {
                state: { ...this.readGamepad(gamepad) },
                cooldown: { ...emptyControlCooldowns() },
            });
            this.startPollingGamepads();
        }
    }

    removeGamepad(gamepad: Gamepad) {
        this.gamepads.delete(gamepad.index);
        if (this.gamepads.size === 0) {
            this.stopPollingGamepads();
        }
    }

    readGamepad(gamepad: Gamepad): ControlStates {
        return {
            [GamepadControl.AButton]: this.readGamepadButtonValue(
                gamepad,
                GamepadControl.AButton
            ),
            [GamepadControl.BButton]: this.readGamepadButtonValue(
                gamepad,
                GamepadControl.BButton
            ),
            [GamepadControl.DPadUp]: this.readGamepadDirectionValue(
                gamepad,
                GamepadControl.DPadUp
            ),
            [GamepadControl.DPadDown]: this.readGamepadDirectionValue(
                gamepad,
                GamepadControl.DPadDown
            ),
            [GamepadControl.DPadLeft]: this.readGamepadDirectionValue(
                gamepad,
                GamepadControl.DPadLeft
            ),
            [GamepadControl.DPadRight]: this.readGamepadDirectionValue(
                gamepad,
                GamepadControl.DPadRight
            ),
            [GamepadControl.MenuButton]: this.readGamepadButtonValue(
                gamepad,
                GamepadControl.MenuButton
            ),
            [GamepadControl.EscapeButton]: this.readGamepadButtonValue(
                gamepad,
                GamepadControl.EscapeButton
            ),
            [GamepadControl.ResetButton]: this.readGamepadButtonValue(
                gamepad,
                GamepadControl.ResetButton
            ),
        };
    }

    startPollingGamepads() {
        if (this.gamepadIntervalId === 0) {
            this.gamepadIntervalId = window.setInterval(() => {
                this.pollGamepadStates();
            }, configData.GamepadPollLoopMilli);
        }
    }

    stopPollingGamepads() {
        if (this.gamepadIntervalId !== 0) {
            window.clearInterval(this.gamepadIntervalId);
            this.gamepadIntervalId = 0;
        }
    }

    pollGamepadStates() {
        for (const gamepad of navigator.getGamepads()) {
            if (!gamepad) {
                continue;
            }
            if (!this.gamepads.has(gamepad.index)) {
                // gamepadFilter might have rejected this gamepad
                continue;
            }
            const prevState = this.gamepadStates.get(gamepad.index)!;
            const nextState = {
                state: { ...this.readGamepad(gamepad) },
                cooldown: { ...prevState.cooldown },
            };
            this.handleGamepadStateChange(prevState, nextState);
            this.gamepadStates.set(gamepad.index, nextState);
        }
    }

    handleGamepadStateChange(prevState: GamepadState, nextState: GamepadState) {
        for (let index in nextState.state) {
            this.handleGamepadControlStateChange(
                index as GamepadControl,
                prevState,
                nextState
            );
        }
    }

    handleGamepadControlStateChange(
        control: GamepadControl,
        prevState: GamepadState,
        nextState: GamepadState
    ) {
        const prevValue = prevState.state[control];
        const nextValue = nextState.state[control];

        if (prevValue === ControlValue.Up && nextValue === ControlValue.Down) {
            //console.log(control + " down");
            this.handleGamepadControlDown(control, nextState);
        } else if (
            prevValue === ControlValue.Down &&
            nextValue === ControlValue.Up
        ) {
            //console.log(control + " up");
            this.handleGamepadControlUp(control, nextState);
        } else if (
            prevValue === ControlValue.Down &&
            nextValue === ControlValue.Down &&
            !this.locks[control]
        ) {
            //console.log(control + " held");
            this.handleGamepadControlHeld(control, nextState);
        }
    }

    handleGamepadControlDown(control: GamepadControl, nextState: GamepadState) {
        this.locks[control] = false;
        nextState.cooldown[control] =
            Date.now() + configData.GamepadOnDownCooldownMilli;
        this.emitControlDownEvent(
            control,
            false,
            control === GamepadControl.AButton
        );
    }

    handleGamepadControlUp(control: GamepadControl, nextState: GamepadState) {
        this.locks[control] = false;
        nextState.cooldown[control] = 0;
        this.emitControlUpEvent(control);
    }

    handleGamepadControlHeld(control: GamepadControl, nextState: GamepadState) {
        if (nextState.cooldown[control] < Date.now()) {
            nextState.cooldown[control] =
                Date.now() + configData.GamepadOnHeldCooldownMilli;
            this.emitControlDownEvent(control, true, false);
        }
    }

    emitKeyEvent(event: string, key: string, repeat: boolean) {
        const charCode = (configData.KeyboardKeyToCharCodeMap as any)[key];
        const keyboardEvent = new KeyboardEvent(event, {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 0,
            key: key,
            keyCode: charCode,
            charCode: charCode,
            repeat: repeat,
        });
        // Add property to identify this as a GamepadManager-originated event
        Object.defineProperty(keyboardEvent, gamepadManagerEventKey, {
            value: true,
            writable: false,
            enumerable: false,
        });
        if (
            document.activeElement &&
            document.activeElement.tagName !== "BODY"
        ) {
            document.activeElement.dispatchEvent(keyboardEvent);
        } else {
            window.dispatchEvent(keyboardEvent);
        }
    }

    emitClickEvent() {
        const clickEvent = new PointerEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 0,
            button: 0,
            buttons: 1,
            clientX: 0,
            clientY: 0,
            isPrimary: true,
            pointerId: 0,
            pointerType: "mouse",
            width: 0,
            height: 0,
            pressure: 0,
            tiltX: 0,
            tiltY: 0,
            twist: 0,
            tangentialPressure: 0,
        });
        // Add property to identify this as a GamepadManager-originated event
        Object.defineProperty(clickEvent, gamepadManagerEventKey, {
            value: true,
            writable: false,
            enumerable: false,
        });
        NavGrid.getActiveElement()?.dispatchEvent(clickEvent);
    }

    emitControlDownEvent(
        control: GamepadControl,
        repeat: boolean,
        canTranslateToClick: boolean
    ) {
        const key = (configData.GamepadControlToKeyboardKeyMap as any)[control];
        if (key && this.windowVisible) {
            this.emitKeyEvent("keydown", key, repeat);
        }
    }

    emitControlUpEvent(control: GamepadControl) {
        const key = (configData.GamepadControlToKeyboardKeyMap as any)[control];
        if (key && this.windowVisible) {
            if (
                document.activeElement &&
                document.activeElement.tagName !== "BODY"
            ) {
                // Do nothing
            } else {
                this.emitKeyEvent("keyup", key, false);
            }
        }
    }

    readGamepadButtonValue(
        gamepad: Gamepad,
        control: GamepadControl
    ): ControlValue {
        const pinIndex = gamepadControlToPinIndex[control];
        if (pinIndex < 0 || pinIndex >= gamepad.buttons.length) {
            throw new Error(
                `Gamepad at index ${gamepad.index} does not have a button at pin ${pinIndex}`
            );
        }
        return gamepad.buttons[pinIndex].pressed
            ? ControlValue.Down
            : ControlValue.Up;
    }

    readGamepadDirectionValue(
        gamepad: Gamepad,
        control: GamepadControl
    ): ControlValue {
        const axisIndex = gamepadControlToPinIndex[control];
        const threshold =
            gamepadControlToAxisDirection[control] *
            configData.GamepadLeftRightThreshold;
        if (axisIndex < 0 || axisIndex >= gamepad.axes.length) {
            throw new Error(
                `Gamepad at index ${gamepad.index} does not have an axis at index ${axisIndex}`
            );
        }
        if (threshold < 0) {
            return gamepad.axes[axisIndex] <= threshold
                ? ControlValue.Down
                : ControlValue.Up;
        }
        return gamepad.axes[axisIndex] >= threshold
            ? ControlValue.Down
            : ControlValue.Up;
    }

    lockControl(control: GamepadControl) {
        this.locks[control] = true;
    }

    clear() {
        for (const key of this.gamepadStates.keys()) {
            this.gamepadStates.set(key, {
                state: { ...emptyControlStates() },
                cooldown: { ...emptyControlCooldowns() },
            });
        }
        this.locks = { ...emptyControlLocks() };
    }

    addKeydownListener(handler: (ev: KeyboardEvent) => void) {
        if (!this.externalKeydownListeners.includes(handler)) {
            this.externalKeydownListeners.push(handler);
        }
    }

    removeKeydownListener(handler: (ev: KeyboardEvent) => void) {
        const index = this.externalKeydownListeners.indexOf(handler);
        if (index >= 0) {
            this.externalKeydownListeners.splice(index, 1);
        }
    }

    addKeyupListener(handler: (ev: KeyboardEvent) => void) {
        if (!this.externalKeyupListeners.includes(handler)) {
            this.externalKeyupListeners.push(handler);
        }
    }

    removeKeyupListener(handler: (ev: KeyboardEvent) => void) {
        const index = this.externalKeyupListeners.indexOf(handler);
        if (index >= 0) {
            this.externalKeyupListeners.splice(index, 1);
        }
    }
}

const gamepadManager = new GamepadManager();

let initializeOnce = () => {
    initializeOnce = () => {
        throw new Error("GamepadManager.initialize() called more than once.");
    };
    gamepadManager.initialize();
};

export function initialize() {
    initializeOnce();
}

export function emitKeyEvent(event: string, key: string) {
    gamepadManager.emitKeyEvent(event, key, false);
}

export function addKeydownListener(handler: (ev: KeyboardEvent) => void) {
    gamepadManager.addKeydownListener(handler);
}

export function removeKeydownListener(handler: (ev: KeyboardEvent) => void) {
    gamepadManager.removeKeydownListener(handler);
}

export function addKeyupListener(handler: (ev: KeyboardEvent) => void) {
    gamepadManager.addKeyupListener(handler);
}

export function removeKeyupListener(handler: (ev: KeyboardEvent) => void) {
    gamepadManager.removeKeyupListener(handler);
}

export function lockControl(control: GamepadControl) {
    gamepadManager.lockControl(control);
}

export function isControlLocked(control: GamepadControl): boolean {
    return gamepadManager.locks[control];
}

export function keyboardKeyToGamepadControl(
    key: string
): GamepadControl | undefined {
    for (const mapping of configData.VirtualGamepadMaps) {
        const control = (mapping as any)[key];
        if (control) {
            return control;
        }
    }
    return undefined;
}

export function setVirtualGamepadsEnabled(enabled: boolean) {
    gamepadManager.virtualGamepadsEnabled = enabled;
}

export function clear() {
    gamepadManager.clear();
}
