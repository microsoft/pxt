import * as React from "react";
import css from "./styling/EditorPanel.module.scss";
import { SplitPane } from "./SplitPane";
import { MonacoEditorPane } from "./MonacoEditor";
import { MakeCodeFrame } from "./MakeCodeFrame";
import { ActionBar } from "./ActionBar";

interface IProps {

}

export const EditorPanel: React.FC<IProps> = () => {
    return (
        <div className={css["editor-panel-container"]}>
            <ActionBar />
            <SplitPane
                split="vertical"
                defaultSize="50%"
                primary="left"
                leftMinSize="5rem"
                rightMinSize="5rem"
                left={<MonacoEditorPane />}
                right={<MakeCodeFrame />}
            />
        </div>
    );
}