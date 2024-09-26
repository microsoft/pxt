import * as React from "react";

import { tools } from "./toolDefinitions";
import { IconButton } from "./Button";
import { Palette } from "./sprite/Palette";
import { TilePalette } from "./tilemap/TilePalette";
import { Minimap } from "./tilemap/Minimap";
import { changeImageTool, ImageEditorContext, ImageEditorTool } from "./state";

interface SideBarProps {
    lightMode: boolean;
}

export const SideBar = (props: SideBarProps) => {
    const { state, dispatch } = React.useContext(ImageEditorContext);

    const { lightMode } = props;
    const { isTilemap, tool } = state.editor;

    const onToolSelected = React.useCallback((tool: ImageEditorTool) => {
        dispatch(changeImageTool(tool));
    }, [dispatch]);

    return (
        <div className={`image-editor-sidebar ${isTilemap ? "tilemap" : ""}`}>
            {isTilemap &&
                <div className="image-editor-tilemap-minimap">
                    <Minimap lightMode={lightMode} />
                </div>
            }
            <div className="image-editor-tool-buttons">
                {tools.filter(td => !td.hiddenTool).map(td =>
                    <IconButton
                        key={td.tool}
                        iconClass={td.iconClass}
                        toggle={tool != td.tool}
                        title={td.title}
                        onClick={() => onToolSelected(td.tool)} />
                )}
            </div>
            <div className="image-editor-palette">
                { isTilemap ? <TilePalette /> : <Palette /> }
            </div>
        </div>
    );
}
