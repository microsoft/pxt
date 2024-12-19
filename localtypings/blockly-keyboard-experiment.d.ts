declare module "@blockly/keyboard-experiment" {
  import { WorkspaceSvg } from "blockly";

  interface IKeyboardNavigationOptions {
    externalToolbox?: IExternalToolbox;
  }

  interface IExternalToolbox {
    focus(): void;
  }

  class KeyboardNavigation {
   constructor(workspace: WorkspaceSvg, options: IKeyboardNavigationOptions)
   focusFlyout(): void;
   onExternalToolboxFocus(): void;
   onExternalToolboxBlur(): void;
  }
}