import { Notifications } from "../types";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    notifications: Notifications;
};

export const initialAppState: AppState = {
    notifications: []
};
