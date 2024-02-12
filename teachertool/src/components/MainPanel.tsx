import * as React from "react";
import css from "./styling/MainPanel.module.scss";
import { SplitPane } from "./SplitPane";
import { RubricWorkspace } from "./RubricWorkspace";
import { ProjectWorkspace } from "./ProjectWorkspace";

interface IProps {}

export const MainPanel: React.FC<IProps> = () => {
    return (
        <div className={css["main-panel"]}>
            <SplitPane
                split={"vertical"}
                defaultSize={"80%"}
                primary={"left"}
                left={<RubricWorkspace />}
                right={<ProjectWorkspace />}
            />
        </div>
    );
};
