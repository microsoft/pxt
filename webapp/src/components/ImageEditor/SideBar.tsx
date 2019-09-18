import * as React from "react";
import { connect } from "react-redux";

import { tools } from "./toolDefinitions";
import { IconButton } from "./Button";
import { ImageEditorTool, ImageEditorStore } from "./store/imageReducer";
import { dispatchChangeImageTool } from "./actions/dispatch";
import { Palette } from "./Palette";

interface SideBarProps {
    selectedTool: ImageEditorTool;
    dispatchChangeImageTool: (tool: ImageEditorTool) => void;
}

export class SideBarImpl extends React.Component<SideBarProps,{}> {
    protected handlers: (() => void)[] = [];

    render() {
        const { selectedTool } = this.props;
        return (
            <div className="image-editor-sidebar">
                <div className="image-editor-size-buttons">

                </div>
                <div className="image-editor-tool-buttons">
                    {tools.map(td =>
                        <IconButton
                            key={td.tool}
                            iconClass={td.iconClass}
                            toggle={selectedTool != td.tool}
                            title={td.title}
                            onClick={this.clickHandler(td.tool)} />
                    )}
                </div>
                <div className="image-editor-palette">
                    <Palette />
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
        selectedTool: editor.tool
    };
}

const mapDispatchToProps = {
    dispatchChangeImageTool
};


export const SideBar = connect(mapStateToProps, mapDispatchToProps)(SideBarImpl);

