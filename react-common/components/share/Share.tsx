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
    publishAsync: (name: string, screenshotUri?: string) => Promise<ShareData>;
    showModalAsync(options: DialogOptions): Promise<void>;
}

export const Share = (props: ShareProps) => {
    const { projectName, screenshotUri, screenshotAsync, gifRecordAsync,
        gifRenderAsync, publishAsync, showModalAsync } = props;

return <div className="project-share">
        {(!!screenshotAsync || !!gifRecordAsync) && <div className="project-share-simulator">
            <div id="shareLoanedSimulator" />
        </div>}
        <ShareInfo projectName={projectName}
            screenshotUri={screenshotUri}
            screenshotAsync={screenshotAsync}
            gifRecordAsync={gifRecordAsync}
            gifRenderAsync={gifRenderAsync}
            publishAsync={publishAsync} />
    </div>
}