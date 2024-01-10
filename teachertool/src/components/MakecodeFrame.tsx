/// <reference path="../../../built/pxteditor.d.ts" />
import { useContext } from "react";
import { setEditorRef } from "../services/makecodeEditorService";
import { AppStateContext } from "../state/appStateContext";
import { createIFrameUrl } from "../utils";

interface MakeCodeFrameProps {}
export const MakeCodeFrame: React.FC<MakeCodeFrameProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext)

    const handleIFrameRef = (el: HTMLIFrameElement | null) => {
        setEditorRef(el ?? undefined);
    }

    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return (
        <div className="makecode-frame-outer" style={{ display: "block" }}>
            {teacherTool.projectMetadata && (
                <iframe
                    className="makecode-frame"
                    src={createIFrameUrl(teacherTool.projectMetadata.id)}
                    title={"title"}
                    ref={handleIFrameRef} />
            )}
        </div>
    );
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
}
