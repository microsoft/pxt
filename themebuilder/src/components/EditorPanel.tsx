import * as React from "react";
import css from "./styling/EditorPanel.module.scss";
import { SplitPane } from "./SplitPane";
import { ThemeEditorPane } from "./ThemeEditorPane";
import { MakeCodeFrame } from "./MakeCodeFrame";

interface IProps {

}

export const EditorPanel: React.FC<IProps> = () => {
    return (
        <div className={css["editor-panel-container"]}>
            <SplitPane
                split="vertical"
                defaultSize="33%"
                primary="left"
                leftMinSize="5rem"
                rightMinSize="5rem"
                left={<ThemeEditorPane />}
                right={<MakeCodeFrame />}
            />
        </div>
    );
}
