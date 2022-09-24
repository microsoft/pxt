export type AppState = {
    motd: string;
    signedIn: boolean;
    profile: pxt.auth.UserProfile | undefined;
};

export const initialAppState: AppState = {
    motd: "Hello, World!",
    signedIn: false,
    profile: undefined,
};

