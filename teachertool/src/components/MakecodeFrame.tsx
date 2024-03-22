/// <reference path="../../../localtypings/pxteditor.d.ts" />

import css from "./styling/MakeCodeFrame.module.scss";
import { useContext } from "react";
import { setEditorRef } from "../services/makecodeEditorService";
import { AppStateContext } from "../state/appStateContext";
import { getEditorUrl } from "../utils";
import { classList } from "react-common/components/util";

interface IProps {}

export const MakeCodeFrame: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    function createIFrameUrl(shareId: string): string {
        const editorUrl: string = pxt.BrowserUtils.isLocalHost()
            ? "http://localhost:3232/index.html"
            : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

        let url = editorUrl;
        if (editorUrl.charAt(editorUrl.length - 1) === "/" && !pxt.BrowserUtils.isLocalHost()) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        const shareSection = shareId ? `#pub:${shareId}` : "";
        url += `?controller=1&teachertool=1&readonly=1&ws=mem&nocookiebanner=1${shareSection}`;
        return url;
    }

    const handleIFrameRef = (el: HTMLIFrameElement | null) => {
        if (el) {
            setEditorRef(el);
        }
    };

    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return (
        <iframe
            className={classList(css["makecode-frame"], teacherTool.projectMetadata?.id ? undefined : css["invisible"])}
            src={createIFrameUrl(teacherTool.projectMetadata?.id || "")}
            title={"title"}
            ref={handleIFrameRef}
        />
    );
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
};
