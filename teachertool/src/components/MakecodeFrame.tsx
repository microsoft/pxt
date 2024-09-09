/// <reference path="../../../localtypings/pxteditor.d.ts" />

import css from "./styling/MakeCodeFrame.module.scss";
import { useContext, useEffect, useRef, useState } from "react";
import { setEditorRef } from "../services/makecodeEditorService";
import { AppStateContext } from "../state/appStateContext";
import { getEditorUrl } from "../utils";
import { classList } from "react-common/components/util";
import { logDebug } from "../services/loggingService";

interface IProps {}

export const MakeCodeFrame: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [frameId, setFrameId] = useState(pxt.Util.guidGen());
    const [frameUrl, setFrameUrl] = useState("");
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        const newUrl = createIFrameUrl(teacherTool.projectMetadata?.id || "");
        setFrameUrl(newUrl);
    }, [frameId, teacherTool.projectMetadata?.id]);

    function createIFrameUrl(shareId: string): string {
        const editorUrl: string = pxt.BrowserUtils.isLocalHost()
            ? "http://localhost:3232/index.html"
            : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

        let url = editorUrl;
        if (editorUrl.charAt(editorUrl.length - 1) === "/" && !pxt.BrowserUtils.isLocalHost()) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        const shareSection = shareId ? `#pub:${shareId}` : "";

        // check for dbg and consoletick flags and pass them through to the iframe if present.
        let additionalFlags = "";
        if (pxt.options.debug) {
            additionalFlags += "&dbg=1";
        }
        if (pxt.analytics.consoleTicks) {
            additionalFlags += "&consoleticks=1";
        }

        url += `?controller=1&teachertool=1&readonly=1&ws=mem&nocookiebanner=1&frameid=${frameId}${shareSection}${additionalFlags}`;
        return url;
    }

    function handleIFrameRef(el: HTMLIFrameElement | null) {
        iframeRef.current = el;
        if (el) {
            setEditorRef(el, forceIFrameReload);
        }
    }

    function forceIFrameReload() {
        setFrameId(pxt.Util.guidGen());
    }

    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return (
        <iframe
            id="code-eval-project-view-frame"
            className={classList(css["makecode-frame"], teacherTool.projectMetadata?.id ? undefined : css["invisible"])}
            src={frameUrl}
            title={"title"}
            ref={handleIFrameRef}
        />
    );
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
};
