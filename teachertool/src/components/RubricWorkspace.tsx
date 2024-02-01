import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/RubricWorkspace.module.scss";

import { Toolbar } from "./Toolbar";
import { TabGroup, Tab } from "./TabGroup";
import { TabPanel } from "./TabPanel";
import { DebugInput } from "./DebugInput";
import { EvalResultDisplay } from "./EvalResultDisplay";
import { ActiveRubricDisplay } from "./ActiveRubricDisplay";

interface IProps {}

export const RubricWorkspace: React.FC<IProps> = () => {
    return (
        <div className={css.panel}>
            <Toolbar>
                {/* Left */}
                <TabGroup>
                    <Tab name="rubric">{lf("Rubric")}</Tab>
                    <Tab name="results">{lf("Results")}</Tab>
                </TabGroup>
                {/* Center */}
                <></>
                {/* Right */}
                <></>
            </Toolbar>
            <TabPanel name="rubric">
                <DebugInput />
                <ActiveRubricDisplay />
            </TabPanel>
            <TabPanel name="results">
                <EvalResultDisplay />
            </TabPanel>
        </div>
    );
};
