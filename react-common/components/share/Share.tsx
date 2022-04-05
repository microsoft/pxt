/// <reference path="../types.d.ts" />

import * as React from "react";
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

    screenshotAsync: () => Promise<string>;
    gifRecordAsync: () => Promise<void>;
    gifRenderAsync: () => Promise<string | void>;
    gifAddFrame: (dataUri: ImageData, delay?: number) => boolean;
    publishAsync: (name: string, screenshotUri?: string) => Promise<ShareData>;
    registerSimulatorMsgHandler?: (handler: (msg: any) => void) => void;
    unregisterSimulatorMsgHandler?: () => void;
}

export const Share = (props: ShareProps) => {
    const { projectName, screenshotUri, screenshotAsync, gifRecordAsync, gifRenderAsync, gifAddFrame,
        publishAsync, registerSimulatorMsgHandler, unregisterSimulatorMsgHandler } = props;

return <div className="project-share">
        {(!!screenshotAsync || !!gifRecordAsync) && <div className="project-share-simulator">
            <div id="shareLoanedSimulator" />
        </div>}
        <ShareInfo projectName={projectName}
            screenshotUri={screenshotUri}
            screenshotAsync={screenshotAsync}
            gifRecordAsync={gifRecordAsync}
            gifRenderAsync={gifRenderAsync}
            gifAddFrame={gifAddFrame}
            publishAsync={publishAsync}
            registerSimulatorMsgHandler={registerSimulatorMsgHandler}
            unregisterSimulatorMsgHandler={unregisterSimulatorMsgHandler} />
    </div>
}