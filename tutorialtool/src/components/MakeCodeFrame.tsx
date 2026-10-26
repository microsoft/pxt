import * as React from "react";
import css from "./styling/MakeCodeFrame.module.scss";
import { setEditorRef } from "../services/makecodeEditorService";
import { getEditorUrl } from "../utils";
import { createTutorialToolEditorUrl } from "../utils/iframeUrl";
import { getLocaleParameter, getRequestedLocale } from "../utils/localization";

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
        return createTutorialToolEditorUrl(url, window.location.href, getRequestedLocale() || pxt.Util.userLanguage(), getLocaleParameter());
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
            title={lf("MakeCode editor")}
        />
    );
}
