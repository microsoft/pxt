import { useEffect } from "react";
import * as GamepadManager from "../Services/GamepadManager";

export function useOnControlPress(
    deps: any[] | undefined,
    handler: (control: GamepadManager.GamepadControl) => void,
    ...controls: GamepadManager.GamepadControl[]
) {
    if (!controls.length) {
        controls = Object.values(GamepadManager.GamepadControl);
    }
    useEffect(() => {
        const keydownhandler = (ev: KeyboardEvent) => {
            const control = GamepadManager.keyboardKeyToGamepadControl(ev.key);
            if (control && controls.includes(control)) {
                ev.stopPropagation();
                ev.preventDefault();
                handler(control);
            }
        };
        GamepadManager.addKeydownListener(keydownhandler);
        return () => GamepadManager.removeKeydownListener(keydownhandler);
    }, deps);
}
