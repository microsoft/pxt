import configData from "../config.json";
import { KeyboardManager } from "./KeyboardManager";

enum GamepadControl {
    AButton,
    BButton,
    DPadUp,
    DPadDown,
    DPadLeft,
    DPadRight,
    MenuButton,
    EscapeButton,
    ResetButton,
}

export class GamepadManager {
    private cachedGamepads: Gamepad[] = [];
    private cacheExpires: number = 0;

    private minButtonPinRequired: number = 0;
    private minAxisRequired: number = 0;

    public keyboardManager: KeyboardManager = new KeyboardManager();

    private blockingAPressed: boolean = false;

    private cooldownTimers: { [key: number]: number } = {};

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

    getGamepads(): Gamepad[] {
        // We cache the gamepads so that we limit how often we call the underlying API. We also
        // filter down to the gamepads that are not null and have the buttons and axes we need
        // to operate based on the config settings. This might not cover all scenarios, but does
        // a good job at filtering out the random devices (like plugged-in Surface Headphones?!?)
        // that get picked up as gamepads.

        if (this.cacheExpires <= Date.now()) {
            this.cachedGamepads = navigator
                .getGamepads()
                .filter(
                    item =>
                        item &&
                        item.axes &&
                        item.axes.length >= this.minAxisRequired &&
                        item.buttons &&
                        item.buttons.length >= this.minButtonPinRequired
                ) as Gamepad[];
            this.cacheExpires = Date.now() + configData.GamepadCacheMilli;
        }

        return this.cachedGamepads;
    }

    validateGamepadIndex(gamepads: Gamepad[], gamepadIndex: number) {
        if (gamepadIndex < -1 || gamepadIndex >= gamepads.length) {
            throw new Error(`No gamepad available at index ${gamepadIndex}`);
        }
    }

    isCoolingDown(control: GamepadControl) {
        return (
            this.cooldownTimers[control] &&
            this.cooldownTimers[control] > Date.now()
        );
    }

    setCooldownTimer(control: GamepadControl) {
        this.cooldownTimers[control] =
            Date.now() + configData.GamepadCooldownMilli;
    }

    isPressedWithCooldown(control: GamepadControl, isPressed: () => any) {
        if (this.isCoolingDown(control)) return;
        const pressed = isPressed();
        if (pressed) {
            this.setCooldownTimer(control);
        }
        return pressed;
    }

    isButtonPressed(gamepadIndex: number, pinIndex: number): boolean {
        const gamepads: Gamepad[] = this.getGamepads();

        if (gamepadIndex === -1) {
            return gamepads.some((item, index) =>
                this.isButtonPressed(index, pinIndex)
            );
        }

        this.validateGamepadIndex(gamepads, gamepadIndex);
        if (pinIndex < 0 || pinIndex >= gamepads[gamepadIndex].buttons.length) {
            throw new Error(
                `Gamepad at index ${gamepadIndex} does not have a button at pin ${pinIndex}`
            );
        }

        return gamepads[gamepadIndex].buttons[pinIndex].pressed;
    }

    isAButtonPressed(gamepadIndex: number = -1): boolean {
        return this.isPressedWithCooldown(GamepadControl.AButton, () => {
            const pressed =
                this.keyboardManager.isAButtonPressed(gamepadIndex) ||
                this.isButtonPressed(
                    gamepadIndex,
                    configData.GamepadAButtonPin
                );
            if (pressed && this.blockingAPressed) {
                return false;
            }
            this.blockingAPressed = false;
            return pressed;
        });
    }

    isBButtonPressed(gamepadIndex: number = -1): boolean {
        return this.isPressedWithCooldown(
            GamepadControl.BButton,
            () =>
                this.keyboardManager.isBButtonPressed(gamepadIndex) ||
                this.isButtonPressed(gamepadIndex, configData.GamepadBButtonPin)
        );
    }

    isEscapeButtonPressed(gamepadIndex: number = -1): boolean {
        return this.isPressedWithCooldown(
            GamepadControl.EscapeButton,
            () =>
                this.keyboardManager.isEscapeButtonPressed(gamepadIndex) ||
                this.isButtonPressed(
                    gamepadIndex,
                    configData.GamepadEscapeButtonPin
                )
        );
    }

    isResetButtonPressed(gamepadIndex: number = -1): boolean {
        return this.isPressedWithCooldown(
            GamepadControl.ResetButton,
            () =>
                this.keyboardManager.isResetButtonPressed(gamepadIndex) ||
                this.isButtonPressed(
                    gamepadIndex,
                    configData.GamepadResetButtonPin
                )
        );
    }

    isMenuButtonPressed(gamepadIndex: number = -1): boolean {
        return this.isPressedWithCooldown(
            GamepadControl.MenuButton,
            () =>
                this.keyboardManager.isMenuButtonPressed(gamepadIndex) ||
                this.isButtonPressed(
                    gamepadIndex,
                    configData.GamepadMenuButtonPin
                )
        );
    }

    private isDirectionPressed(
        gamepadIndex: number,
        axisIndex: number,
        threshold: number
    ): boolean {
        const gamepads: Gamepad[] = this.getGamepads();

        if (gamepadIndex === -1) {
            return gamepads.some((item, index) =>
                this.isDirectionPressed(index, axisIndex, threshold)
            );
        }

        this.validateGamepadIndex(gamepads, gamepadIndex);

        const gamepad: Gamepad = gamepads[gamepadIndex];

        if (axisIndex < 0 || axisIndex >= gamepad.axes.length) {
            throw new Error(
                `Gamepad at index ${gamepadIndex} does not have an axis at index ${axisIndex}`
            );
        }

        if (threshold < 0) {
            return gamepad.axes[axisIndex] <= threshold;
        }

        return gamepad.axes[axisIndex] >= threshold;
    }

    isLeftPressed(gamepadIndex: number = -1) {
        return this.isPressedWithCooldown(
            GamepadControl.DPadLeft,
            () =>
                this.keyboardManager.isLeftPressed(gamepadIndex) ||
                this.isDirectionPressed(
                    gamepadIndex,
                    configData.GamepadLeftRightAxis,
                    -configData.GamepadLeftRightThreshold
                )
        );
    }

    isRightPressed(gamepadIndex: number = -1) {
        return this.isPressedWithCooldown(
            GamepadControl.DPadRight,
            () =>
                this.keyboardManager.isRightPressed(gamepadIndex) ||
                this.isDirectionPressed(
                    gamepadIndex,
                    configData.GamepadLeftRightAxis,
                    configData.GamepadLeftRightThreshold
                )
        );
    }

    isUpPressed(gamepadIndex: number = -1) {
        return this.isPressedWithCooldown(
            GamepadControl.DPadUp,
            () =>
                this.keyboardManager.isUpPressed(gamepadIndex) ||
                this.isDirectionPressed(
                    gamepadIndex,
                    configData.GamepadUpDownAxis,
                    -configData.GamepadUpDownThreshold
                )
        );
    }

    isDownPressed(gamepadIndex: number = -1) {
        return this.isPressedWithCooldown(
            GamepadControl.DPadRight,
            () =>
                this.keyboardManager.isDownPressed(gamepadIndex) ||
                this.isDirectionPressed(
                    gamepadIndex,
                    configData.GamepadUpDownAxis,
                    configData.GamepadUpDownThreshold
                )
        );
    }

    blockAPressUntilRelease() {
        this.blockingAPressed = true;
    }
}
