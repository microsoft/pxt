/// <reference path="../types.d.ts" />

import * as React from "react";
import { SimRecorder } from "./ThumbnailRecorder";
import { ShareInfo } from "./ShareInfo";

export interface ShareData {
    url: string;
    embed: {
        code?: string;
        editor?: string;
        simulator?: string;
        url?: string;
    }
    qr?: string;
    error?: any;
}

export interface ShareProps {
    projectName: string;
    projectDescription?: string;
    screenshotUri?: string;
    isLoggedIn?: boolean;
    hasProjectBeenPersistentShared?: boolean;
    anonymousShareByDefault?: boolean;
    isMultiplayerGame?: boolean; // Arcade: Does the game being shared have multiplayer enabled?
    simulatorTheme?: pxt.SimulatorTheme;
    kind?: "multiplayer" | "vscode" | "share"; // Arcade: Was the share dialog opened specifically for hosting a multiplayer game?
    setAnonymousSharePreference?: (anonymousByDefault: boolean) => void;
    simRecorder: SimRecorder;
    publishAsync: (name: string, description?: string, screenshotUri?: string, forceAnonymous?: boolean, simulatorTheme?: pxt.SimulatorTheme) => Promise<ShareData>;
    onClose: () => void;
}

export const Share = (props: ShareProps) => {
    const {
        projectName,
        projectDescription,
        screenshotUri,
        isLoggedIn,
        simRecorder,
        publishAsync,
        hasProjectBeenPersistentShared,
        anonymousShareByDefault,
        setAnonymousSharePreference,
        isMultiplayerGame,
        simulatorTheme,
        kind,
        onClose
    } = props;

    return <div className="project-share">
        <ShareInfo projectName={projectName}
            projectDescription={projectDescription}
            isLoggedIn={isLoggedIn}
            screenshotUri={screenshotUri}
            simRecorder={simRecorder}
            publishAsync={publishAsync}
            isMultiplayerGame={isMultiplayerGame}
            simulatorTheme={simulatorTheme}
            kind={kind}
            hasProjectBeenPersistentShared={hasProjectBeenPersistentShared}
            anonymousShareByDefault={anonymousShareByDefault}
            setAnonymousSharePreference={setAnonymousSharePreference}
            onClose={onClose} />
    </div>
}