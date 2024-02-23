import * as React from "react";
import css from "./styling/MainPanel.module.scss";
import { SplitPane } from "./SplitPane";
import { RubricWorkspace } from "./RubricWorkspace";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { getSplitPosition as getLastSplitPosition, setSplitPosition as setLastSplitPosition } from "../services/storageService";

interface IProps {}

export const MainPanel: React.FC<IProps> = () => {
    function handleResize(size: number | string) {
        setLastSplitPosition(size.toString());
    }

    const lastSavedSplitPosition = getLastSplitPosition() ?? "50%";

    // TODO still - fix arrow mouse display, figure out why it isn't working with the iframe loaded. Maybe test local storage more (does it redraw a bunch because of this changing after the change in SplitPane?)...

    return (
        <div className={css["main-panel"]}>
            <SplitPane
                split={"vertical"}
                defaultSize={lastSavedSplitPosition}
                primary={"left"}
                left={<RubricWorkspace />}
                right={<ProjectWorkspace />}
                onResize={handleResize}
            />
        </div>
    );
};
