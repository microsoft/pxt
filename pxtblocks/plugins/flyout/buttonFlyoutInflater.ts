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
        const button = new FlyoutButton(
            flyout.getWorkspace(),
            flyout.targetWorkspace!,
            state as Blockly.utils.toolbox.ButtonOrLabelInfo,
            false,
        );
        button.show();

        return new Blockly.FlyoutItem(button, BUTTON_TYPE);
    }
}