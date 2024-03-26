import * as React from "react";
import css from "./styling/MakeCodeFrame.module.scss";
import { setEditorRef } from "../services/makecodeEditorService";
import { getEditorUrl } from "../utils";

export interface MakeCodeFrameProps {
}

export const MakeCodeFrame = (props: MakeCodeFrameProps) => {
    function createIFrameUrl(): string {
        const editorUrl: string = pxt.BrowserUtils.isLocalHost()
            ? "http://localhost:3232/index.html"
            : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

        let url = editorUrl;
        if (editorUrl.charAt(editorUrl.length - 1) === "/" && !pxt.BrowserUtils.isLocalHost()) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        url += `?controller=1&teachertool=1&ws=mem&nocookiebanner=1`;
        return url;
    }

    const handleIframeRef = React.useCallback((ref: HTMLIFrameElement) => {
        if (ref) {
            setEditorRef(ref);
        }
    }, []);

    return (
        <iframe
            className={css["makecode-frame"]}
            src={createIFrameUrl()} ref={handleIframeRef}
        />
    );
}