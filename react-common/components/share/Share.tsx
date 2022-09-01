/// <reference path="../types.d.ts" />

import * as React from "react";
import { SimRecorder } from "./GifInfo";
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
    publishAsync: (name: string, screenshotUri?: string, forceAnonymous?: boolean) => Promise<ShareData>;
}

export const Share = (props: ShareProps) => {
    const { projectName, screenshotUri, isLoggedIn, simRecorder, publishAsync} = props;

return <div className="project-share">
        <ShareInfo projectName={projectName}
            isLoggedIn={isLoggedIn}
            screenshotUri={screenshotUri}
            simRecorder={simRecorder}
            publishAsync={publishAsync} />
    </div>
}