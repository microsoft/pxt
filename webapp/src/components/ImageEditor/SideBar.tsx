import * as React from "react";
import { connect } from "react-redux";

import { tools } from "./toolDefinitions";
import { ImageEditorTool, ImageEditorStore } from "./store/imageReducer";
import { dispatchChangeImageTool } from "./actions/dispatch";
import { Palette } from "./sprite/Palette";
import { TilePalette } from "./tilemap/TilePalette";
import { Minimap } from "./tilemap/Minimap";
import { Button } from "../../../../react-common/components/controls/Button";
import { classList } from "../../../../react-common/components/util";

interface SideBarProps {
    selectedTool: ImageEditorTool;
    isTilemap: boolean;
    dispatchChangeImageTool: (tool: ImageEditorTool) => void;
    lightMode: boolean;
}

export class SideBarImpl extends React.Component<SideBarProps,{}> {
    protected handlers: (() => void)[] = [];

    render() {
        const { selectedTool, isTilemap, lightMode } = this.props;
        return (
            <div className={`image-editor-sidebar ${isTilemap ? "tilemap" : ""}`}>
                {isTilemap &&
                    <div className="image-editor-tilemap-minimap">
                        <Minimap lightMode={lightMode} />
                    </div>
                }
                <div className="image-editor-tool-buttons">
                    {tools.filter(td => !td.hiddenTool).map(td =>
                        <Button
                            className={classList("image-editor-button", selectedTool !== td.tool && "toggle")}
                            key={td.tool}
                            leftIcon={td.iconClass}
                            title={td.title}
                            onClick={this.clickHandler(td.tool)}
                        />
                    )}
                </div>
                <div className="image-editor-palette">
                    { isTilemap ? <TilePalette /> : <Palette /> }
                </div>
            </div>
        );
    }

    protected clickHandler(tool: number) {
        if (!this.handlers[tool]) this.handlers[tool] = () => this.props.dispatchChangeImageTool(tool);

        return this.handlers[tool];
    }
}

function mapStateToProps({ editor }: ImageEditorStore, ownProps: any) {
    if (!editor) return {};
    return {
        isTilemap: editor.isTilemap,
        selectedTool: editor.tool
    };
}

const mapDispatchToProps = {
    dispatchChangeImageTool
};


export const SideBar = connect(mapStateToProps, mapDispatchToProps)(SideBarImpl);

