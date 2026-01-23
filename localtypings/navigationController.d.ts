type WorkspaceSvg = import("blockly").WorkspaceSvg;

declare module '@blockly/keyboard-navigation' {
    class NavigationController {
        init(): void;
        addWorkspace(workspace: WorkspaceSvg): void;
        enable(workspace: WorkspaceSvg): void;
        disable(workspace: WorkspaceSvg): void;
        focusToolbox(workspace: WorkspaceSvg): void;
        navigation: Navigation;
    }

    class Navigation {
        resetFlyout(workspace: WorkspaceSvg, shouldHide: boolean): void;
        setState(workspace: WorkspaceSvg, state: BlocklyNavigationState): void;
        focusFlyout(workspace: WorkspaceSvg): void;
    }

    type BlocklyNavigationState = "workspace" | "toolbox" | "flyout";
}