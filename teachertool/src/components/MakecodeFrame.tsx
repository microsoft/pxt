/// <reference path="../../../built/pxteditor.d.ts" />
import * as React from "react";
import { useEffect, useRef } from "react";
import { setEditorRef } from "../services/makecodeEditorService";
interface MakeCodeFrameProps {
    pageSourceUrl: string;
    tutorialEventHandler?: (event: pxt.editor.EditorMessageTutorialEventRequest) => void;
}

export const MakeCodeFrame: React.FC<MakeCodeFrameProps> =
    ( { pageSourceUrl} ) => {

    let frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (frameRef.current) {
            setEditorRef(frameRef.current);
        } else {
            setEditorRef(null);
        }

        return () => {
            setEditorRef(null);
        }
    }, []);

    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return <div className="makecode-frame-outer" style={{ display: "block" }}>
        <iframe className="makecode-frame" src={pageSourceUrl} title={"title"} ref={frameRef}></iframe>
    </div>
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
}