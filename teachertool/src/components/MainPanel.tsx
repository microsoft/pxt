import * as React from "react";
import css from "./styling/MainPanel.module.scss";
import { SplitPane } from "./SplitPane";
import { RubricWorkspace } from "./RubricWorkspace";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { getSplitPosition as getLastSplitPosition, setSplitPosition as setLastSplitPosition } from "../services/storageService";

interface IProps {}

export const MainPanel: React.FC<IProps> = () => {
    function handleResizeEnd(size: number | string) {
        setLastSplitPosition(size.toString());
    }

    const lastSavedSplitPosition = getLastSplitPosition() ?? "50%";

    // TODO still:
    // Double click to restore defaults.

    return (
        <div className={css["main-panel"]}>
            <SplitPane
                split={"vertical"}
                defaultSize={lastSavedSplitPosition}
                primary={"left"}
                left={<RubricWorkspace />}
                right={<ProjectWorkspace />}
                onResizeEnd={handleResizeEnd}
            />
        </div>
    );
};
