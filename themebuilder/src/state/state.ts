import { ModalOptions } from "../types/modalOptions";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    frameTheme?: pxt.ColorThemeInfo; // Theme actually being sent to the iframe (may contain temporary highlights, etc...)
    editingTheme?: pxt.ColorThemeInfo; // Theme being edited
    userProfile?: pxt.auth.UserProfile;
    modal?: ModalOptions;
    colorsToHighlight?: string[];
    highlightBackground: string;
    highlightForeground: string;
};

export const initialAppState: AppState = {
    highlightBackground: "#FE3ED4",
    highlightForeground: "#000000"
};
