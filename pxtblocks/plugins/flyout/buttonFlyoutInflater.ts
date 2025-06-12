import * as Blockly from "blockly";
import { FlyoutButton } from "./flyoutButton";

const BUTTON_TYPE = "button";

export class ButtonFlyoutInflater extends Blockly.ButtonFlyoutInflater {
    static register() {
        Blockly.registry.register(
            Blockly.registry.Type.FLYOUT_INFLATER,
            BUTTON_TYPE,
            ButtonFlyoutInflater,
            true,
        );
    }

    load(state: object, flyout: Blockly.IFlyout): Blockly.FlyoutItem {
        const modifiedState = state as Blockly.utils.toolbox.ButtonOrLabelInfo & {id?: string};
        const button = new FlyoutButton(
            flyout.getWorkspace(),
            flyout.targetWorkspace!,
            modifiedState,
            false,
        );
        if (modifiedState.id) {
            // This id is used to manage focus after dialog interactions.
            button.getSvgRoot().setAttribute("id", modifiedState.id)
        }
        button.show();

        return new Blockly.FlyoutItem(button, BUTTON_TYPE);
    }
}