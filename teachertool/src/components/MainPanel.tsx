import * as React from "react";
import css from "./styling/MainPanel.module.scss";
import { SplitPane } from "./SplitPane";
import { RubricWorkspace } from "./RubricWorkspace";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { getSplitPosition as getLastSplitPosition, setSplitPosition as setLastSplitPosition } from "../services/storageService";

interface IProps {}

export const MainPanel: React.FC<IProps> = () => {
    const defaultSize = "50%";

    function handleResizeEnd(size: number | string) {
        setLastSplitPosition(size.toString());
    }

    const lastSavedSplitPosition = getLastSplitPosition() ?? defaultSize;

    // TODO still:
    // Min and Max sizes.

    return (
        <div className={css["main-panel"]}>
            <SplitPane
                split={"vertical"}
                defaultSize={defaultSize}
                startingSize={lastSavedSplitPosition}
                primary={"left"}
                left={<RubricWorkspace />}
                right={<ProjectWorkspace />}
                onResizeEnd={handleResizeEnd}
            />
        </div>
    );
};
