import { ModalOptions } from "../types/modalOptions";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    theme?: pxt.ColorThemeInfo;
    userProfile?: pxt.auth.UserProfile;
    modal?: ModalOptions;
};

export const initialAppState: AppState = {

};
