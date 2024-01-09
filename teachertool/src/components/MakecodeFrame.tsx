/// <reference path="../../../built/pxteditor.d.ts" />
import { useContext } from "react";
import { setEditorRef } from "../services/makecodeEditorService";
import { AppStateContext } from "../state/appStateContext";
interface MakeCodeFrameProps {
    pageSourceUrl: string;
    tutorialEventHandler?: (event: pxt.editor.EditorMessageTutorialEventRequest) => void;
}

export const MakeCodeFrame: React.FC<MakeCodeFrameProps> = ({pageSourceUrl}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const handleIFrameRef = (el: HTMLIFrameElement | null) => {
        setEditorRef(el ?? undefined);
    };

    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return <> {
        teacherTool.projectMetadata &&
        <div className="makecode-frame-outer" style={{ display: "block" }}>
            <iframe className="makecode-frame" src={pageSourceUrl} title={"title"} ref={handleIFrameRef} />
        </div>
        } </>
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
};
