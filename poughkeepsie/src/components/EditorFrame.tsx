import css from "./styling/EditorFrame.module.scss";

import React, { useContext, useState } from "react";

import { getEditorUrl } from "../utils";
import { setEditorRef } from "../services/makecodeEditorService";


interface IProps {
}

export const EditorFrame: React.FC<IProps> = ({ }) => {
    const [ frameId ] = useState(pxt.Util.guidGen());

    function createIFrameUrl(): string {
        const editorUrl: string = pxt.BrowserUtils.isLocalHost()
            ? "http://localhost:3232/index.html"
            : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

        let url = editorUrl;
        if (editorUrl.charAt(editorUrl.length - 1) === "/" && !pxt.BrowserUtils.isLocalHost()) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        url += `?controller=1&poughkeepsie=1&ws=mem&nocookiebanner=1&frameid=${frameId}`;
        return url;
    }

    const handleIFrameRef = (el: HTMLIFrameElement | null) => {
        if (el) {
            setEditorRef(el)
        }
    };

    return (
        <iframe className={css["editor-frame"]} src={createIFrameUrl()} ref={handleIFrameRef} />
    );
};