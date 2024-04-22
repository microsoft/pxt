import { ModalOptions } from "../types/modalOptions";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    tutorialMarkdown?: string;
    userProfile?: pxt.auth.UserProfile;
    modal?: ModalOptions;
};

export const initialAppState: AppState = {

};
