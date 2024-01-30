import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/MainPanel.module.scss";

import { DebugInput } from "./DebugInput";
import { MakeCodeFrame } from "./MakecodeFrame";
import { EvalResultDisplay } from "./EvalResultDisplay";
import { ActiveRubricDisplay } from "./ActiveRubricDisplay";
import { SplitPane } from "./SplitPane";

interface IProps {}

export const MainPanel: React.FC<IProps> = () => {
    return (
        <div className={css["main-panel"]}>
            <SplitPane split={"vertical"} defaultSize={"80%"} primary={"left"}>
                {/* Left side */}
                <>
                    <DebugInput />
                    <ActiveRubricDisplay />
                    <EvalResultDisplay />
                </>
                {/* Right side */}
                <>
                    <MakeCodeFrame />
                </>
            </SplitPane>
        </div>
    );
};
