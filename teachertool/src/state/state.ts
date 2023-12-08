import { Notifications } from "../types";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    notifications: Notifications;
    volume?: number; // volume level of UI sounds, in [0..1]
};

export const initialAppState: AppState = {
    notifications: [],
    volume: 0
};
