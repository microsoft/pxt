/// <reference path="../../../localtypings/pxteditor.d.ts" />

import css from "./styling/MakeCodeFrame.module.scss";
import { useContext, useEffect, useState } from "react";
import { setEditorRef } from "../services/makecodeEditorService";
import { AppStateContext } from "../state/appStateContext";
import { getEditorUrl } from "../utils";

interface IProps {}

export const MakeCodeFrame: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [ frameId ] = useState(pxt.Util.guidGen());


    // Clear iframe state when the iframe url is changed
    useEffect(() => {
        if (!teacherTool.projectMetadata?.id) {
            setEditorRef(undefined);
        }
    }, [teacherTool.projectMetadata?.id]);

    function createIFrameUrl(shareId: string): string {
        const editorUrl: string = pxt.BrowserUtils.isLocalHost()
            ? "http://localhost:3232/index.html"
            : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

        let url = editorUrl;
        if (editorUrl.charAt(editorUrl.length - 1) === "/" && !pxt.BrowserUtils.isLocalHost()) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        url += `?controller=1&teachertool=1&readonly=1&ws=mem&nocookiebanner=1&frameid=${frameId}#pub:${shareId}`;
        return url;
    }

    const handleIFrameRef = (el: HTMLIFrameElement | null) => {
        if (el) {
            setEditorRef(el);
        }
    };

    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return teacherTool.projectMetadata ? (
        <iframe
            className={css["makecode-frame"]}
            src={createIFrameUrl(teacherTool.projectMetadata.id)}
            title={"title"}
            ref={handleIFrameRef}
        />
    ) : null;
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
};
