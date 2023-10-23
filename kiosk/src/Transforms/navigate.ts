import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import * as Actions from "../State/Actions";
import * as GamepadManager from "../Services/GamepadManager";
import * as NavGrid from "../Services/NavGrid";
import { playSoundEffect } from "../Services/SoundEffectService";

export function navigate(nextState: KioskState) {
    const { dispatch } = stateAndDispatch();
    pxt.tickEvent("kiosk.navigate." + nextState.toLowerCase());
    // Lock the A button and Back button to prevent accidental navigation upon entering the new state
    GamepadManager.lockControl(GamepadManager.GamepadControl.AButton);
    GamepadManager.lockControl(GamepadManager.GamepadControl.BackButton);
    playSoundEffect("select");
    //NavGrid.resetUserInteraction();
    // As a general safety measure, wait one frame before changing screens to allow any pending reducer
    // actions to complete and update the state object.
    setTimeout(() => dispatch(Actions.setKioskState(nextState)), 1);
}
