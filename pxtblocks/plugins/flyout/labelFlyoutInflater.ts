import * as Blockly from "blockly";
import { FlyoutButton } from "./flyoutButton";

const LABEL_TYPE = "label";

export class LabelFlyoutInflater extends Blockly.LabelFlyoutInflater {
    load(state: object, flyout: Blockly.IFlyout): Blockly.FlyoutItem {
        const label = new FlyoutButton(
          flyout.getWorkspace(),
          flyout.targetWorkspace!,
          state as Blockly.utils.toolbox.ButtonOrLabelInfo,
          true,
        );
        label.show();

        return new Blockly.FlyoutItem(label, LABEL_TYPE, true);
      }
}

Blockly.registry.unregister(
    Blockly.registry.Type.FLYOUT_INFLATER,
    LABEL_TYPE,
);

Blockly.registry.register(
    Blockly.registry.Type.FLYOUT_INFLATER,
    LABEL_TYPE,
    LabelFlyoutInflater,
);