/// <reference path="../types.d.ts" />

import * as React from "react";
import { SimRecorder } from "./GifRecorder";
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
    screenshotUri?: string;
    isLoggedIn?: boolean;

    simRecorder: SimRecorder;

    screenshotAsync: () => Promise<string>;
    gifRecordAsync: () => Promise<void>;
    gifRenderAsync: () => Promise<string | void>;
    gifAddFrame: (dataUri: ImageData, delay?: number) => boolean;
    publishAsync: (name: string, screenshotUri?: string, forceAnonymous?: boolean) => Promise<ShareData>;
    registerSimulatorMsgHandler?: (handler: (msg: any) => void) => void;
    unregisterSimulatorMsgHandler?: () => void;
}

export const Share = (props: ShareProps) => {
    const { projectName, screenshotUri, isLoggedIn, simRecorder, screenshotAsync, gifRecordAsync, gifRenderAsync,
        gifAddFrame, publishAsync, registerSimulatorMsgHandler, unregisterSimulatorMsgHandler } = props;

return <div className="project-share">
        <ShareInfo projectName={projectName}
            isLoggedIn={isLoggedIn}
            screenshotUri={screenshotUri}
            simRecorder={simRecorder}
            screenshotAsync={screenshotAsync}
            gifRecordAsync={gifRecordAsync}
            gifRenderAsync={gifRenderAsync}
            gifAddFrame={gifAddFrame}
            publishAsync={publishAsync}
            registerSimulatorMsgHandler={registerSimulatorMsgHandler}
            unregisterSimulatorMsgHandler={unregisterSimulatorMsgHandler} />
    </div>
}